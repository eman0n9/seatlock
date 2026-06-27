# Seatmap Architecture v3

## Принципы

| Правило | Детали |
|---------|--------|
| **gRPC только Go → Spring** | Spring вообще не знает про Go. Никакой обратной связи |
| **Redis только Go** | Spring не трогает Redis |
| **Покупка через WS** | Фронт получил OK от Spring → шлёт сообщение на Go → закрывает сокет |
| **TTL по последнему коннекту** | Пока есть сокеты на эвент — TTL снят. Закрылся последний — TTL 30 минут |

---

## Структура ключей Redis

```
seat:{eventId}:{seatId} = "purchased"   без TTL пока есть коннекты, TTL 30m после последнего
seat:{eventId}:{seatId} = "reserved"    TTL 600s всегда
event_seats:{eventId}                   SET из seatId — для быстрого PERSIST/EXPIRE
connections:{eventId}   = {count}       счётчик активных сокетов
```

---

## Флоу 1 — Первый коннект, Redis пустой (худший случай)

```mermaid
sequenceDiagram
    participant F as Frontend
    participant G as Go
    participant R as Redis
    participant S as Spring
    participant DB as Database

    F->>G: WS connect (eventId=1)
    G->>R: INCR connections:1 → 1
    G->>R: SMEMBERS event_seats:1 → пусто

    note over G: cache miss — идём в Spring

    G->>S: gRPC GetPurchasedSeats(eventId=1)
    S->>DB: SELECT purchased seats WHERE event_id=1
    DB-->>S: список мест
    S-->>G: PurchasedSeatsResponse

    G->>R: SET seat:1:{id} "purchased" (без TTL, для каждого)
    G->>R: SADD event_seats:1 {id...}
    G-->>F: snapshot { purchased: [...], reserved: [] }
```

---

## Флоу 2 — Второй коннект, Redis горячий

```mermaid
sequenceDiagram
    participant F as Frontend
    participant G as Go
    participant R as Redis

    F->>G: WS connect (eventId=1)
    G->>R: INCR connections:1 → 2
    G->>R: SMEMBERS event_seats:1 → данные есть

    note over G: cache hit — gRPC не нужен

    G->>R: PERSIST seat:1:* (по списку из event_seats:1)
    G-->>F: snapshot { purchased: [...], reserved: [...] }
```

---

## Флоу 3 — Резервация места

```mermaid
sequenceDiagram
    participant F1 as Frontend (user 1)
    participant F2 as Frontend (user 2)
    participant G as Go
    participant R as Redis

    F1->>G: WS { type: "reserve", seatId: 42 }
    G->>R: SET seat:1:42 "reserved" NX EX 600

    alt место свободно
        R-->>G: OK
        G-->>F1: { seatId: 42, status: "reserved" }
        G-->>F2: broadcast { seatId: 42, status: "reserved" }
    else место уже занято
        R-->>G: FAIL
        G-->>F1: { seatId: 42, status: "taken" }
    end
```

---

## Флоу 4 — Оплата (ключевой флоу)

```mermaid
sequenceDiagram
    participant F as Frontend
    participant S as Spring
    participant DB as Database
    participant G as Go
    participant R as Redis

    note over F,G: WebSocket ещё открыт

    F->>S: POST /api/orders { eventId: 1, seatIds: [42, 43] }
    S->>DB: INSERT tickets

    alt оплата успешна
        DB-->>S: OK
        S-->>F: 200 OK

        note over F: получили OK — сообщаем Go и закрываем сокет
        F->>G: WS { type: "purchased", seatIds: [42, 43] }
        F->>G: WS close

        G->>R: SET seat:1:42 "purchased" (без TTL)
        G->>R: SET seat:1:43 "purchased" (без TTL)
        G->>R: SADD event_seats:1 42 43
        G->>R: DECR connections:1

        note over G: broadcast остальным пользователям
        G-->>F: broadcast { seats: [42, 43], status: "purchased" }

        alt connections:1 = 0
            G->>R: EXPIRE seat:1:* 1800
        end

    else оплата упала
        DB-->>S: FAIL
        S-->>F: 400/500

        note over F: ничего не отправляем на Go, сокет остаётся открытым
        note over F: зарезервированные места остаются зарезервированными до истечения TTL
    end
```

---

## Флоу 5 — Закрытие последнего коннекта (без покупки)

```mermaid
sequenceDiagram
    participant F as Frontend
    participant G as Go
    participant R as Redis

    F->>G: WS close (без purchase сообщения)
    G->>R: DECR connections:1 → 0

    alt счётчик = 0
        note over G: никого нет на эвенте — ставим TTL
        G->>R: SMEMBERS event_seats:1
        G->>R: EXPIRE seat:1:{id} 1800 (для каждого из списка)
        G->>R: DEL connections:1
    else счётчик > 0
        note over G: ещё есть коннекты — ничего не делаем
    end
```

---

## Флоу 6 — Переоткрытие после паузы (TTL ещё не истёк)

```mermaid
sequenceDiagram
    participant F as Frontend
    participant G as Go
    participant R as Redis

    note over R: ключи seat:1:* живы, TTL идёт

    F->>G: WS connect (eventId=1)
    G->>R: INCR connections:1 → 1
    G->>R: SMEMBERS event_seats:1 → данные есть

    G->>R: PERSIST seat:1:{id} (для каждого из event_seats:1)
    G-->>F: snapshot { purchased: [...], reserved: [...] }
```

---

## Флоу 7 — TTL истёк, данные сгорели

```mermaid
sequenceDiagram
    participant F as Frontend
    participant G as Go
    participant R as Redis
    participant S as Spring
    participant DB as Database

    note over R: 30 минут прошло, ключи удалены

    F->>G: WS connect (eventId=1)
    G->>R: INCR connections:1 → 1
    G->>R: SMEMBERS event_seats:1 → пусто

    note over G: cache miss — повторяем Флоу 1
    G->>S: gRPC GetPurchasedSeats(eventId=1)
    S->>DB: SELECT purchased seats
    DB-->>S: список
    S-->>G: PurchasedSeatsResponse
    G->>R: SET seat:1:{id} "purchased" (без TTL)
    G->>R: SADD event_seats:1 {id...}
    G-->>F: snapshot
```

---

## Полная карта коммуникаций

```mermaid
graph TD
    F[Frontend]
    G[Go Service]
    S[Spring Service]
    R[(Redis)]
    DB[(Database)]

    F -- "HTTP: layout карты" --> S
    F -- "HTTP: оплата" --> S
    F -- "WS: reserve / unreserve / purchased" --> G

    G -- "gRPC: GetPurchasedSeats" --> S

    G -- "read/write seats, connections, event_seats" --> R
    S -- "read/write orders, events, users" --> DB
```

---

## Нюансы реализации

**Порядок сообщений в Флоу 4 критичен**
Фронт обязан сначала отправить `{ type: "purchased" }`, и только потом закрыть сокет.
Если закрыть сокет без сообщения — Go не узнает о покупке и не обновит Redis.
Используй `ws.send(...)` синхронно перед `ws.close()`.

**Что если пользователь закрыл вкладку сразу после оплаты**
Между `200 OK` от Spring и отправкой `purchased` на Go есть маленькое окно.
Если вкладка закрылась в этот момент — Go не узнает о покупке до следующего cache miss (TTL истёк или Redis перезапустился). Это приемлемо: при следующем запросе `GetPurchasedSeats` Spring вернёт актуальные данные из БД.

**PERSIST pipeline**
Redis не поддерживает `PERSIST seat:1:*` одной командой.
Используй `SMEMBERS event_seats:1` → pipeline из `PERSIST` на каждый ключ.

**Атомарность DECR + EXPIRE**
Между `DECR → 0` и `EXPIRE` может зайти новый коннект и получить `INCR → 1`.
Тогда `EXPIRE` поставит TTL на активные данные.
Решается Lua-скриптом:
```lua
local count = redis.call('DECR', KEYS[1])
if count == 0 then
  for _, key in ipairs(redis.call('SMEMBERS', KEYS[2])) do
    redis.call('EXPIRE', key, ARGV[1])
  end
  redis.call('DEL', KEYS[1])
end
return count
```
EOF
echo "done"