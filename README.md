# SeatLock

SeatLock is a ticket marketplace pet project with a Next.js frontend, a Spring Boot GraphQL API, and a Go WebSocket service for live seat reservations.

This repository is a portfolio demo. Seat reservation and order persistence are real; payment processing is intentionally simulated and no real charge is made.

## Stack

- Frontend: Next.js 16, React 19
- API: Java 21, Spring Boot, GraphQL, jOOQ, Liquibase
- Realtime: Go, WebSocket, gRPC, Redis
- Data: PostgreSQL, Elasticsearch, Redis

## Run locally with Docker

Requirements: Docker Desktop with Docker Compose.

The root `docker-compose.yml` is a local-development stack. It binds services to
localhost, enables demo data and must not be deployed unchanged to production.

Create local environment files once:

```powershell
Copy-Item backend/database_local.env.example backend/database_local.env
Copy-Item backend/security.env.example backend/security.env
Copy-Item go-sockets/.env.example go-sockets/.env
```

The example JWT secret is for local development only. For a private local secret, generate 32 random bytes, encode them as Base64, and put the same value in `backend/security.env` and `go-sockets/.env`.

Start the complete stack:

```powershell
docker compose up --build
```

The local stack creates a demo event and a development administrator on first start:

```text
Email: admin@seatlock.local
Password: SeatLockDemo123!
```

These credentials exist only in the local Compose configuration. Production bootstrap credentials must be supplied through environment variables.

Services:

| Service | URL |
| --- | --- |
| Frontend | http://localhost:3000 |
| GraphQL API | http://localhost:8082/graphql |
| GraphiQL | http://localhost:8082/graphiql |
| Swagger UI | http://localhost:8082/swagger-ui.html |
| WebSocket | ws://localhost:8081/ws |
| PostgreSQL | localhost:55434 |

Stop the stack with `docker compose down`. Add `-v` only when you intentionally want to remove local database, Redis, and Elasticsearch data.

## Run services during development

Infrastructure and backend services can stay in Docker while the frontend runs locally:

```powershell
docker compose up -d --build db elasticsearch redis backend websocket
cd frontend
npm.cmd ci
npm.cmd run dev
```

The frontend uses real services when `.env.local` contains the values from `.env.example`. Remove `.env.local` to use the built-in mock defaults.

## Verification

```powershell
cd frontend
npm.cmd ci
npm.cmd test
npm.cmd run build

cd ..\backend
.\mvnw.cmd clean test "-Djooq.codegen.skip=true"

cd ..\go-sockets
go test ./...
go vet ./...
go build ./cmd/server
```

## Database schema and jOOQ

Liquibase changelogs are the schema source of truth. Generated jOOQ classes in `backend/src/main/generated/jooq` are intentionally versioned so clean Docker and CI builds do not require code generation against a live database.

After changing a Liquibase changelog:

```powershell
cd backend
.\mvnw.cmd liquibase:update
.\mvnw.cmd generate-sources
```

Commit the changelog and the updated generated jOOQ sources together.

## Security notes

- Local `.env` files are ignored by Git and excluded from Docker build contexts.
- The root Compose file binds databases and internal services to `127.0.0.1`.
- Do not reuse the development JWT secret in a deployed environment.
- Production deployments should run behind HTTPS and set `SECURITY_COOKIE_SECURE=true`.
- Activate the Spring `prod` profile to disable GraphiQL, Swagger, schema introspection, and debug logging.
- Set `FRONTEND_URL` and `WS_ALLOWED_ORIGINS` to the exact public frontend origin.
- Build the frontend with the public HTTPS API and GraphQL URLs and a public WSS URL.
- Set `REDIS_ADDR` and `SPRING_GRPC_ADDR` to private service addresses for the WebSocket service.
- Keep `APP_DEMO_DATA_ENABLED=false`; bootstrap credentials are optional and should be removed after the first administrator is created.

## License

Apache License 2.0. See `LICENSE`.
