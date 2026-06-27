# 🗄️ Database Development & jOOQ Workflow Guide

This guide defines how to manage database schema changes using **Liquibase** and sync them with **jOOQ** generated classes.

---

## 📂 1. Directory Structure
All database-related files are located in `src/main/resources/db/changelog/`:
- **Master File:** `changelog-master.xml` — The entry point of the entire migration system.
- **Version Folders:** `v1.0/`, `v1.1/`, etc. — Logical grouping of migration files.

---

## 🔗 2. Master Changelog Management
The `changelog-master.xml` serves **only as an index**. It is strictly forbidden to write migration logic (changesets) directly in this file.

### ⚠️ Execution Order
Liquibase executes files in the order they are listed. **Dependencies matter:** Always include the table creation file *before* any files that create Foreign Keys to that table.

```xml
<databaseChangeLog 
    xmlns="http://www.liquibase.org/xml/ns/dbchangelog"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:schemaLocation="http://www.liquibase.org/xml/ns/dbchangelog
    http://www.liquibase.org/xml/ns/dbchangelog/dbchangelog-latest.xsd">

    <include file="db/changelog/v1.0/01-create-activity-category.xml"/>
    <include file="db/changelog/v1.1/02-add-description-to-activity.xml"/>

</databaseChangeLog>
```

---

## 🏗️ 3. Creating a New Table
When creating a table, always use **snake_case** for names. Provide a `<rollback>` tag for every action to ensure safe environment resets.

**Example (`v1.0/01-create-activity-category.xml`):**
```xml
<databaseChangeLog ...>
    <changeSet id="20260322-1" author="dev_name">
        <createTable tableName="activity_category">
            <column name="id" type="UUID">
                <constraints primaryKey="true" nullable="false"/>
            </column>
            <column name="name" type="VARCHAR(255)" remarks="Human-readable category name">
                <constraints nullable="false" unique="true"/>
            </column>
        </createTable>

        <rollback>
            <dropTable tableName="activity_category"/>
        </rollback>
    </changeSet>
</databaseChangeLog>
```

---

## 🆙 4. Updating an Existing Table
**Golden Rule:** Never edit a `changeSet` that has already been deployed. If you need to add a column or change a type, create a **new** file.

**Example: Adding a column (`v1.1/02-add-description-to-activity.xml`):**
```xml
<databaseChangeLog ...>
    <changeSet id="20260322-2" author="dev_name">
        <addColumn tableName="activity_category">
            <column name="description" type="TEXT"/>
        </addColumn>

        <rollback>
            <dropColumn tableName="activity_category" columnName="description"/>
        </rollback>
    </changeSet>
</databaseChangeLog>
```

---

## 🔄 5. Syncing with jOOQ
After you apply your changes to the database, you **must** regenerate the Java DSL classes. Otherwise, your code will not "see" the new tables or columns.

1.  **Update Database:**
    ```bash
    mvn liquibase:update
    ```
2.  **Generate Java Classes:**
    ```bash
    mvn generate-sources
    ```

### 💡 Pro Tips:
- **Keep it Atomic:** One `changeSet` should contain one logical change (e.g., create one table or add two related columns).
- **Use Remarks:** The `remarks` attribute in XML will be generated as JavaDocs in your jOOQ classes — very helpful for other developers!
- **Rollbacks are Mandatory:** Always test your migration by running a rollback if possible.