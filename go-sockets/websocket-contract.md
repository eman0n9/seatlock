# WebSocket contract

## Connection

```text
ws://{host}/ws?eventId={uuid}&token={websocket-jwt}
```

The token is issued by Spring's `/api/auth/ws-token` endpoint and must contain
`tokenPurpose=websocket`. Browser origins must be listed in
`WS_ALLOWED_ORIGINS`.

## Client to server

| Type | Payload | Description |
| --- | --- | --- |
| `reserve` | `{ "seatId": "uuid" }` | Reserve one free seat for 10 minutes |
| `unreserve` | `{ "seatId": "uuid" }` | Release the caller's reservation |

The client never reports a purchase. Spring is the authority for checkout and
publishes committed changes through Redis.

## Server to client

| Type | Payload | Recipient |
| --- | --- | --- |
| `snapshot` | `{ "purchased": ["uuid"], "myReserved": [{"seatId":"uuid","ttl":542}], "otherReserved": ["uuid"] }` | New connection |
| `reserved` | `{ "seatId": "uuid" }` | Other clients for the event |
| `reserve_failed` | `{ "seatId": "uuid" }` | Requesting client |
| `released` | `{ "seatId": "uuid" }` | All clients for the event |
| `purchased_bulk` | `{ "seatIds": ["uuid"] }` | All clients for the event |
| `error` | `{ "message": "..." }` | Requesting client |

The snapshot is always the first frame. Events received while the snapshot is
being built are buffered and queued immediately after it.

## State flow

```text
free --reserve--> reserved --unreserve/TTL/backend release--> free
reserved --Spring checkout commit--> purchased
```

- Reservations have a 10-minute Redis TTL and a per-user limit of 10 seats.
- A reconnect keeps the remaining reservation TTL; it does not extend it.
- Spring publishes purchases on `seatlock:purchases:{eventId}`.
- Spring publishes backend-driven releases on `seatlock:releases:{eventId}`.
- Channel payloads are comma-separated seat UUIDs.
- Redis expiry notifications produce `released` only when the seat key is still
  absent. A delayed notification cannot remove a newer reservation or purchase.
- Every connection reconciles purchased seats from Spring over gRPC before its
  snapshot is read. Redis pub/sub is the fast path, not the source of truth.

## Connection lifetime

Keep the socket open while the user moves between the seat map and cart. Close
it when the event flow is left, checkout completes, or the browser tab closes.
