# Lesson 12 — scaling (Python)

The Lesson 11 API scaled out to two instances behind a proxy. The TypeScript twin is
[`Code/js/Lesson_12_code/`](../js/Lesson_12_code/).

## Run the rate limiter bench

```shell
cp .env.example .env          # then put a real SECRET_KEY in it
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
python migrate.py
```

You need Redis:
```shell
docker run -d --name redis-bookmarks -p 6379:6379 redis:7-alpine
```

Start the proxy and two instances in three different terminals:
```shell
python round_robin_proxy.py
RATE_LIMIT_BACKEND=local uvicorn main:app --port 8020
RATE_LIMIT_BACKEND=local uvicorn main:app --port 8021
```

Run the bench:
```shell
python bench_rate_limit.py --register
python bench_rate_limit.py --flush --base-url http://127.0.0.1:8022
```

## Run the connection limit bench

Start a small, slow database on port 55490, then proxy it to 55491 to add network delay:
```shell
docker run -d --name pg-lesson12-small -p 55490:5432 \
  -e POSTGRES_USER=learner -e POSTGRES_PASSWORD=lesson4 -e POSTGRES_DB=bookmarks \
  postgres:17 -c max_connections=15
DATABASE_URL=postgresql://learner:lesson4@localhost:55490/bookmarks python migrate.py
python slow_link_small_db.py
```

Start two instances pointing at the slow port (55491), then burst them:
```shell
DATABASE_URL=postgresql://learner:lesson4@localhost:55491/bookmarks \
  POOL_MAX_SIZE=10 POOL_ACQUIRE_TIMEOUT_SECONDS=30 uvicorn main:app --port 8020
DATABASE_URL=postgresql://learner:lesson4@localhost:55491/bookmarks \
  POOL_MAX_SIZE=10 POOL_ACQUIRE_TIMEOUT_SECONDS=30 uvicorn main:app --port 8021

python bench_pool_backpressure.py --burst 50
```

## Run the replica lag bench

Spin up two isolated instances and establish streaming replication:
```shell
docker network create lesson12-net
docker volume create pg12-replica-data

docker run -d --name pg12-primary --network lesson12-net -p 55492:5432 \
  -e POSTGRES_PASSWORD=lesson4 -e POSTGRES_HOST_AUTH_METHOD=trust \
  postgres:17 -c wal_level=replica -c max_wal_senders=5 -c hot_standby=on
docker exec pg12-primary bash -c "echo 'host replication all all trust' >> /var/lib/postgresql/data/pg_hba.conf"
docker exec pg12-primary psql -U postgres -c "SELECT pg_reload_conf();"
docker exec pg12-primary psql -U postgres -c "CREATE DATABASE bookmarks;"

docker run --rm --network lesson12-net -v pg12-replica-data:/var/lib/postgresql/data \
  postgres:17 bash -c "PGPASSWORD=lesson4 pg_basebackup -h pg12-primary -U postgres \
  -D /var/lib/postgresql/data -Fp -Xs -P -R && chmod 700 /var/lib/postgresql/data"

docker run -d --name pg12-replica --network lesson12-net -p 55493:5432 \
  -v pg12-replica-data:/var/lib/postgresql/data \
  -e POSTGRES_PASSWORD=lesson4 -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17

DATABASE_URL=postgresql://postgres:lesson4@localhost:55492/bookmarks python migrate.py
```

Measure the lag:
```shell
python replica_lag_bench.py
```

## Testing

Start the test database and run the suite:
```shell
docker compose -f docker-compose.test.yml up -d
pytest
```
