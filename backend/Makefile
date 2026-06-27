local:
	docker compose up --build

local-d:
	docker compose up --build -d

prod:
	docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build

prod-d:
	docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d

down:
	docker compose down

down-prod:
	docker compose -f docker-compose.yml -f docker-compose.prod.yml down
