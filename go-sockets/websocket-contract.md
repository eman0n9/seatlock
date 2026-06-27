# WebSocket Contract

## Connection

```
ws://{host}/ws?eventId={uuid}&token={jwt}
```

---

## Client → Server

| type | payload | description |
|------|---------|-------------|
| `reserve` | `{ "seatId": "uuid" }` | Reserve a seat (click on a free seat) |
| `unreserve` | `{ "seatId": "uuid" }` | Cancel own reservation (click on own reserved seat) |
| `purchased` | `{ "seatIds": ["uuid", ...] }` | Confirm purchase (after successful Spring response) |

---

## Server → Client

| type | payload | recipient | when |
|------|---------|-----------|------|
| `snapshot` | `{ "purchased": ["uuid"], "myReserved": [{"seatId": "uuid", "ttl": 542}], "otherReserved": ["uuid"] }` | sender | immediately on connect |
| `reserved` | `{ "seatId": "uuid" }` | everyone except sender | someone reserved a seat |
| `reserve_failed` | `{ "seatId": "uuid" }` | sender only | race condition — seat already taken |
| `released` | `{ "seatId": "uuid" }` | everyone | seat became free (manual unreserve or TTL expiry) |
| `purchased_bulk` | `{ "seatIds": ["uuid", ...] }` | everyone except buyer | someone purchased seats |
| `error` | `{ "message": "..." }` | sender only | server error |

---

## Seat Lifecycle

```
free ──reserve──► reserved (TTL 10 min)
reserved ──unreserve──► free (released)
reserved ──TTL expired──► free (released)
reserved ──purchased──► purchased (permanent)
```

---

## Purchase Flow

### Architecture

The SeatMap (layout, prices, zones) is fetched from **Spring REST API**.
Real-time seat statuses (reserved/purchased) come from the **Go WebSocket server**.

### Step by Step

```
1. User opens event page
   ├── Frontend fetches SeatMap from Spring REST (layout, prices, zones)
   └── Frontend opens WebSocket: ws://{host}/ws?eventId={uuid}&token={jwt}

2. Go server sends snapshot
   └── Server → Client: { type: "snapshot", purchased: [...], myReserved: [...], otherReserved: [...] }
   Frontend overlays statuses on top of the SeatMap

3. User selects seats (clicks on free seats one by one)
   ├── Client → Server: { type: "reserve", seatId: "uuid" }  (per seat)
   ├── Server → others: { type: "reserved", seatId: "uuid" }
   └── Each seat gets a 10-min TTL in Redis

4. User deselects a seat (clicks on own reserved seat)
   ├── Client → Server: { type: "unreserve", seatId: "uuid" }
   └── Server → everyone: { type: "released", seatId: "uuid" }

5. User proceeds to cart
   └── WebSocket stays open (Next.js layout keeps the provider mounted)

6. User pays via Spring REST API
   └── Frontend sends payment request to Spring

7. Spring confirms payment
   ├── Client → Server: { type: "purchased", seatIds: ["uuid", ...] }
   ├── Server marks seats as purchased in Redis (permanent, no TTL)
   ├── Server → others: { type: "purchased_bulk", seatIds: [...] }
   └── Frontend closes the WebSocket connection

8. Other users see the seats as purchased in real time
```

### Returning User (within 10 min)

```
1. User reserved seats, then closed the browser
2. Reserved seats stay in Redis with remaining TTL (not refreshed)
3. User returns and opens WebSocket again
4. Server sends snapshot with myReserved containing their seats
5. Frontend restores selection from myReserved
6. User continues to purchase
```

### WebSocket Lifecycle in Next.js

```
/event/[id]/layout.tsx  ← WebSocketProvider here
  ├── /seatmap           ← socket alive
  ├── /cart              ← socket alive
  └── leave /event/*     ← provider unmounts → socket closes
```

The WebSocket connection must stay open across seat map and cart pages.
It only closes when:
- The user completes a purchase (after sending `purchased`)
- The user navigates away from the event flow
- The user closes the browser tab

---

## Notes

- `snapshot` is sent once on connect and contains the current state split by ownership
- `myReserved` contains seats reserved by the current user (identified via JWT), each with `ttl` — remaining seconds until expiry
- `otherReserved` contains seats reserved by other users
- Reserved seats have a 10-minute TTL; if the user leaves and returns within that time, their reservations are preserved with the remaining TTL (not refreshed)
- `released` is triggered by explicit unreserve or by Redis keyspace notifications when a reservation key expires
- `reserve_failed` handles the race condition where two users click the same seat simultaneously
- After sending `purchased`, the client should close the WebSocket connection
