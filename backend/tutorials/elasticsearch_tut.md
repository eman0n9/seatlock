# 🔍 Elasticsearch Guide for Seatlock Backend

Этот документ описывает, **как мы используем Elasticsearch в проекте Seatlock**:  
как выглядят документы, как мы их заполняем из доменной модели и какие поля предназначены для поиска, фильтрации и сортировки.

Цель гайда — чтобы любой разработчик в команде понимал:

- что такое `ActivityDocument`;
- почему поля помечены именно так;
- где точный поиск, а где «умный» текстовый;
- как писать новые документы и не ломать поиск.

---

## 1. Общая идея: зачем нам Elasticsearch

PostgreSQL (через jOOQ) — это **источник истины**: там хранятся пользователи, залы, мероприятия, билеты и транзакции.

Elasticsearch — это **поисковый индекс**:

- быстрый текстовый поиск по мероприятиям;
- фильтрация по категориям, залам, датам;
- будущие фасеты (агрегации по категориям и т.п.).

**Важно:** в ES мы не храним всю доменную модель. Мы храним **плоский документ**, удобный для поиска.  
Данные в ES — производная копия из PostgreSQL, которая всегда может быть переиндексирована.

---

## 2. Документ мероприятия: `ActivityDocument`

Все документы мероприятий лежат в индексе `activities` и описаны классом:

```java
@Getter
@Setter
@NoArgsConstructor
@Document(indexName = "activities")
public class ActivityDocument {

    @Id
    private String id;

    @MultiField(
            mainField = @Field(type = FieldType.Text, analyzer = "standard"),
            otherFields = @InnerField(suffix = "keyword", type = FieldType.Keyword)
    )
    private String name;

    @Field(type = FieldType.Date)
    private LocalDate date;

    @Field(type = FieldType.Text, analyzer = "standard")
    private String description;

    @Field(type = FieldType.Keyword)
    private String activityCategory;

    @Field(type = FieldType.Keyword)
    private String hall;

    @Field(type = FieldType.Text, analyzer = "standard")
    private List<String> performerNames;
}
```

Дальше по полям подробно.

---

## 3. Поля и их назначение

### 3.1. `id`

```java
@Id
private String id;
```

- Это идентификатор документа в ES.
- В маппере мы кладём туда `activity.getId().toString()` (UUID → String).
- Используется для:
    - точечного получения документа по ID;
    - переиндексации одного мероприятия.

---

### 3.2. `name` — название мероприятия (поиск + фильтр/сортировка)

```java
@MultiField(
        mainField = @Field(type = FieldType.Text, analyzer = "standard"),
        otherFields = @InnerField(suffix = "keyword", type = FieldType.Keyword)
)
private String name;
```

Здесь сразу два представления одного поля:

- `name` (основное поле) — `Text`:
    - проходит через анализатор `standard`;
    - используется для **полнотекстового поиска** (`match`, `multi_match`);
    - подходит для запросов типа `"comedy show"`, `"rock concert"` и т.п.

- `name.keyword` (внутреннее поле):
    - `Keyword` — хранится как есть, без анализа;
    - используется для **точной фильтрации и сортировки** (например, `orderBy name.keyword`).

**Правило:**

- хочешь найти по части текста/словам → используешь `name`;
- хочешь фильтровать/сортировать по точному названию → используешь `name.keyword`.

---

### 3.3. `date` — дата проведения

```java
@Field(type = FieldType.Date)
private LocalDate date;
```

- Тип `Date` в ES, маппится из/в `LocalDate`.
- Используется для:
    - фильтров по дате (`date >= today`, `date = 2026-04-01`);
    - сортировки по дате (ближайшие мероприятия).

---

### 3.4. `description` — описание мероприятия

```java
@Field(type = FieldType.Text, analyzer = "standard")
private String description;
```

- Тип `Text`.
---

### 3.5. `activityCategory` — категория мероприятия

```java
@Field(type = FieldType.Keyword)
private String activityCategory;
```

- Тип `Keyword` — **точное значение**, без анализа.
- Сюда мы кладём **имя/код категории** (например, `"CONCERT"`, `"SPORT"`, `"THEATER"`).
- Используется для:
    - фильтров по категории;
    - агрегаций (фасетов): «Сколько мероприятий в каждой категории?».

По этому полю **не делаем полнотекстовый поиск**, только точные фильтры и подсчёты.

---

### 3.6. `hall` — площадка / зал

```java
@Field(type = FieldType.Keyword)
private String hall;
```

- Аналогично категории — `Keyword`.
- Хранится строка (например, `"O2 Arena"`, `"Small Club"`).
- Используется для:
    - фильтрации по залу;
    - агрегаций (сколько мероприятий в каждой площадке).

Если когда‑то понадобится поиск по подстроке («покажи всё в залах, где есть слово “arena”»), можно будет:

- либо добавить MultiField (`Text + Keyword`);
- либо завести отдельное Text‑поле (например, `hallSearch`).

---

### 3.7. `performerNames` — имена артистов

```java
@Field(type = FieldType.Text, analyzer = "standard")
private List<String> performerNames;
```

- Список строк — имена артистов;
- Тип `Text` с анализатором `standard`;
- Используется для **поиска по артистам** (`match` по `performerNames`).

Примеры значений:

```json
["Eminem", "Dr. Dre"]
["Bill Burr"]
["Radiohead"]
```

Если в будущем понадобится точная фильтрация по артисту, можно:

- либо добавить MultiField с `suffix = "keyword"`;
- либо отдельное поле `performerNamesKeyword` с `Keyword`.

---

## 4. Доменная модель vs документ

Доменная модель в коде выглядит так:

```java
@Getter
@Setter
@NoArgsConstructor
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
public class Activity {

    @EqualsAndHashCode.Include
    private UUID id;

    private String name;

    private LocalDate date;

    private LocalTime startTime;

    private LocalTime endTime;

    private String description;

    private ActivityCategory category;

    private Hall hall;

    private List<Performer> performers = new ArrayList<>();

    private List<Offer> offers = new ArrayList<>();
}
```

Здесь:

- `Activity` — основной доменный объект;
- `ActivityCategory`, `Hall`, `Performer`, `Offer` — связанные сущности;
- модель нормализована (много объектов, связи между ними).

**В Elasticsearch мы храним денормализованную версию — `ActivityDocument`:**

- вместо объектов `ActivityCategory` и `Hall` кладём их **имена**;
- вместо списка `Performer` кладём список **их имён**;
- не храним `Offer` (предложения/цены), а при необходимости можем добавить, например, `minTicketPrice`.

---

## 5. Маппинг: Activity → ActivityDocument

Отдельный маппер отвечает за превращение доменной модели в документ для ES.

Пример:

```java
public class ActivityDocumentMapper {

    public ActivityDocument toDocument(Activity activity) {
        ActivityDocument doc = new ActivityDocument();

        doc.setId(activity.getId().toString());
        doc.setName(activity.getName());
        doc.setDate(activity.getDate());
        doc.setDescription(activity.getDescription());

        if (activity.getCategory() != null) {
            doc.setActivityCategory(activity.getCategory().getName());
            // или getCode()/getSlug(), если у категории есть стабильный код
        }

        if (activity.getHall() != null) {
            doc.setHall(activity.getHall().getName());
        }

        if (activity.getPerformers() != null) {
            List<String> names = activity.getPerformers().stream()
                    .map(Performer::getName)
                    .toList();
            doc.setPerformerNames(names);
        }

        return doc;
    }
}
```

**Важно:**

- Денормализация происходит здесь, в коде — ES получает уже «плоский» JSON.
- Если структура `Activity` изменится (например, появится `language` или `minPrice`), в этом месте мы решаем:
    - нужно ли поле для поиска/фильтров;
    - и в каком виде его хранить в документе.

---

## 6. Поведение полей с точки зрения поиска

Резюмируем, какие поля за что отвечают:

- **Поисковые (full-text):**
    - `name` (`Text + analyzer="standard"`);
    - `performerNames` (`Text + analyzer="standard"`);
    - (в будущем можно добавить `description` как `Text`, если захотим).

- **Фильтрующие и агрегируемые:**
    - `name.keyword` (`Keyword`);
    - `activityCategory` (`Keyword`);
    - `hall` (`Keyword`);
    - `date` (`Date`).

- **Только для отображения:**
    - `description` (`index = false` — не участвует в поиске).

---

## 7. Что учитывать при добавлении новых полей

Когда добавляем новое поле в `ActivityDocument`, нужно ответить на два вопроса:

1. **По нему нужно искать (по тексту)?**
    - Да → `FieldType.Text` + `analyzer`.
    - Нет → можно `Keyword` или другой тип.

2. **По нему нужно фильтровать/строить агрегации/сортировать?**
    - Да → `FieldType.Keyword`, `FieldType.Date`, `FieldType.Double` и т.п.
    - Если поле текстовое и нужно и то, и другое → MultiField (`Text + Keyword`).

Примеры:

- `language` мероприятия:
    - фильтр по языку → `@Field(type = FieldType.Keyword)` + значение `"EN"`, `"CS"`, `"RU"`.
- минимальная цена билета:
  ```java
  @Field(type = FieldType.Double)
  private Double minTicketPrice;
  ```
    - фильтры `price >= X`, `price <= Y`;
    - сортировка по цене.

---

## 8. TL;DR для команды

- **Мы не индексируем доменную модель один-в-один.**  
  Мы создаём отдельный документ `ActivityDocument`, оптимизированный под поиск.

- **Text vs Keyword:**
    - `Text` (`FieldType.Text`) — для полнотекстового поиска (анализаторы, токены).
    - `Keyword` (`FieldType.Keyword`) — для точных фильтров и агрегаций.

- **MultiField (name + name.keyword):**
    - `name` — искать по словам;
    - `name.keyword` — сортировать/фильтровать по точному значению.

- **Denormalization:**
    - в ES кладём строки (имена категорий, залов, артистов), а не сложные объекты;
    - это ускоряет поиск и упрощает запросы.

- **`description` сейчас не участвует в поиске.**  
  Мы его храним только для отображения. Если понадобится поиск по описанию — поменяем маппинг на `Text`.

---

Этот документ — базовый контракт. Если кто-то добавляет новые поля в `ActivityDocument` или создаёт новые документы для других сущностей, желательно придерживаться этих же принципов: явное разделение того, **по чему ищем**, **по чему фильтруем**, и того, что просто надо отдать клиенту в ответе.