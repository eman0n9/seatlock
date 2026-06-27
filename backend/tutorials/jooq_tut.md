# 🚀 jOOQ Advanced Usage Guide (Spring Boot)

This guide explains how to solve everyday backend tasks using jOOQ, avoiding spaghetti code and slow queries.

---

## 🧲 1. Joins
In jOOQ, joins are written just like in SQL, but with full type safety. When mapping to DTOs, use aliases or select specific fields to avoid column name collisions.



```java
import static cz.fit.cvut.seatlock.generated.Tables.ACTIVITY;
import static cz.fit.cvut.seatlock.generated.Tables.ACTIVITY_CATEGORY;

public List<ActivityDto> findActivitiesWithCategory() {
    return dsl.select(
                ACTIVITY.ID,
                ACTIVITY.TITLE,
                ACTIVITY_CATEGORY.NAME.as("categoryName") // Alias for the DTO
            )
            .from(ACTIVITY)
            .join(ACTIVITY_CATEGORY).on(ACTIVITY.ACTIVITY_CATEGORY_ID.eq(ACTIVITY_CATEGORY.ID))
            .fetchInto(ActivityDto.class);
}
```

---

## ↕️ 2. Sorting
Sorting is applied using the `.orderBy()` method. You can combine multiple fields and directions (`asc()`, `desc()`, `nullsFirst()`, `nullsLast()`).

```java
public List<Activity> findUpcomingActivities() {
    return dsl.selectFrom(ACTIVITY)
            .where(ACTIVITY.DATE.ge(java.time.LocalDate.now()))
            // Sort by upcoming dates first; if dates match, sort by start time
            .orderBy(
                ACTIVITY.DATE.asc(), 
                ACTIVITY.START_TIME.asc()
            )
            .fetchInto(Activity.class);
}
```

---

## 🧩 3. Dynamic WHERE (Filters)
**Never concatenate SQL strings!** In jOOQ, use the `Condition` object for dynamic filtering.

*Example: A complex product catalog filter where the user might provide only some of the search parameters.*

```java
import org.jooq.Condition;
import org.jooq.impl.DSL;
import static cz.fit.cvut.seatlock.generated.Tables.PRODUCT;

public List<ProductDto> searchProducts(String searchBrand, String searchModel, String searchName) {
    // 1. Start with an empty condition (evaluates to True)
    Condition condition = DSL.noCondition();

    // 2. Dynamically append conditions if parameters are not null
    if (searchBrand != null) {
        // Example value: "Air Jordan"
        condition = condition.and(PRODUCT.BRAND.eq(searchBrand));
    }
    
    if (searchModel != null) {
        // Example value: "1 Retro High Og Chicago"
        condition = condition.and(PRODUCT.MODEL.eq(searchModel));
    }
    
    if (searchName != null) {
        // Example value: "name"
        condition = condition.and(PRODUCT.NAME.eq(searchName));
    }

    // 3. Pass the final combined condition to the where() clause
    return dsl.selectFrom(PRODUCT)
            .where(condition)
            .fetchInto(ProductDto.class);
}
```

---

## 🏗️ 4. CTE (Common Table Expressions / WITH clause)
CTEs help break down complex queries into readable, modular blocks. In jOOQ, this is done using table aliases (`name().as()`).

```java
import static org.jooq.impl.DSL.*;

public List<Activity> findActivitiesInPopularCategories() {
    // 1. Define the CTE: count activities in each category
    var popularCategoriesCte = name("popular_categories").as(
        select(ACTIVITY.ACTIVITY_CATEGORY_ID)
        .from(ACTIVITY)
        .groupBy(ACTIVITY.ACTIVITY_CATEGORY_ID)
        .having(count().gt(10)) // Only keep categories with > 10 activities
    );

    // 2. Use the CTE in the main query
    return dsl.with(popularCategoriesCte)
            .select(ACTIVITY.fields())
            .from(ACTIVITY)
            .join(popularCategoriesCte)
                .on(ACTIVITY.ACTIVITY_CATEGORY_ID.eq(popularCategoriesCte.field(ACTIVITY.ACTIVITY_CATEGORY_ID)))
            .fetchInto(Activity.class);
}
```

---

## 📄 5. Pagination (Spring Data JPA Page style)
To return the familiar `Page<T>` object from Spring Data, we need to perform two steps: count the total number of records (for frontend pagination UI) and fetch the limited data chunk.

```java
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

public Page<ActivityDto> findAllPaged(Pageable pageable) {
    // 1. Base query (without fetching yet)
    var query = dsl.selectFrom(ACTIVITY)
            .where(ACTIVITY.IS_ACTIVE.isTrue());

    // 2. Count total records (jOOQ optimizes this into a SELECT COUNT(*))
    long totalElements = dsl.fetchCount(query);

    // 3. If there is no data, skip the second query
    if (totalElements == 0) {
        return Page.empty(pageable);
    }

    // 4. Apply sorting, limit, and offset from the Pageable object
    // Note: In a real project, pageable.getSort() needs to be mapped to jOOQ SortFields.
    // This shows the basic pagination approach.
    List<ActivityDto> content = query
            .orderBy(ACTIVITY.CREATED_AT.desc())
            .limit(pageable.getPageSize())
            .offset(pageable.getOffset())
            .fetchInto(ActivityDto.class);

    // 5. Return the standard Spring object
    return new PageImpl<>(content, pageable, totalElements);
}
```