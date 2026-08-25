# Lesson 14 — how a request finds your server (TypeScript)

The TypeScript twin of [`Code/Lesson_14_code/`](../../Lesson_14_code/).
Same packet, same zone, same TTL failure — over Node's `dgram` socket
instead of Python's. See the Python README for what each step proves; this
one only covers running it.

## Run the demo

```shell
npm install
./demo.sh
```

It needs `node`, `dig`, and `curl` on `PATH`, and a real network
connection. Nothing else.

## Run the Lesson 12 API this lesson extends

```shell
cp .env.example .env          # then put a real SECRET_KEY in it
npm install
npm run migrate
PORT=8020 npm start
```

See [`Code/js/Lesson_12_code/README.md`](../Lesson_12_code/README.md) for
the rate-limit, connection-pool, and replica-lag benches this directory
also carries forward unchanged.
