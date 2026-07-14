# SeatLock backend

Spring Boot GraphQL API backed by PostgreSQL, Elasticsearch, Redis, Liquibase, and jOOQ.

Use the root `docker-compose.yml` and root README to run the complete application.

## Local environment

```powershell
Copy-Item database_local.env.example database_local.env
Copy-Item security.env.example security.env
```

Start the complete backend dependency set from the repository root:

```powershell
cd ..
docker compose up --build
```

## jOOQ workflow

Liquibase changelogs are the schema source of truth. Generated classes in `src/main/generated/jooq` are intentionally committed because Docker and CI builds skip database-driven generation.

After changing the schema:

```powershell
.\mvnw.cmd liquibase:update
.\mvnw.cmd generate-sources
```

Commit the changelog and regenerated classes in the same change.

## Tests

With PostgreSQL, Elasticsearch, and Redis available:

```powershell
.\mvnw.cmd clean test "-Djooq.codegen.skip=true"
```
