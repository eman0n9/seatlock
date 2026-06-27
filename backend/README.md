## Development Environment & Database Setup

This project uses **jOOQ** for type-safe SQL and **Liquibase** for database migrations. Since the generated jOOQ classes are derived from the database schema, they are not stored in the repository (excluded via `.gitignore`).

Every developer must generate these classes locally after cloning the project or when the database schema changes.

### 📋 Prerequisites
* **Java 21**
* **Maven 3.9+**
* **Docker (or OrbStack) & Docker Compose**

### 🚀 Getting Started

Follow these steps to sync your local environment with the current database schema:

1.  **Start the Database** Spin up the PostgreSQL container in the background:
    ```bash
    docker-compose up -d db
    ```

2.  **Run Database Migrations** Apply all Liquibase changelogs to your local instance:
    ```bash
    mvn liquibase:update
    ```

3.  **Generate jOOQ Sources** Scan the database schema and generate Java DSL classes:
    ```bash
    mvn generate-sources
    ```

### 🖥 IDE Integration (IntelliJ IDEA / VS Code)
After running the generation command, your IDE might still highlight jOOQ classes in red. To fix this:
1.  Right-click on the project root -> **Maven** -> **Reload Project**.
2.  If the folder `target/generated-sources/jooq` is not recognized, right-click it -> **Mark Directory as** -> **Generated Sources Root**.

---

### 🔄 Workflow: Adding Database Changes
When you need to modify the database (add a table or a column):
1.  Create a new XML changeset in `src/main/resources/db/changelog/v2.0/`.
2.  Include the new file in `changelog-master.xml`.
3.  Execute `mvn liquibase:update` followed by `mvn generate-sources`.
4.  Your Java code is now aware of the new schema changes!