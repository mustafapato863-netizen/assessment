# Load Evidence — k6 100-VU run (Gate 8 H3)

**Date:** 2026-09-05 · **Target:** single-node local stack (1 API replica, Docker PG18, Windows host)
**Script:** `apps/api/load/load-test.js` (ramps 25→50→100 VUs, sustain 20s, reads + create/submit writes
with unique idempotency keys and per-VU IPs) · **Raw:** `apps/api/load/summary.json`

## Results (84s, 3,997 requests)

| Metric | Value | Bar (p95<3000ms, fail<1%) |
|---|---|---|
| Peak VUs | 100 | — |
| Error rate | 0.00 | PASS |
| p95 latency | 4,069 ms | MISS |
| avg latency | 1,095 ms | — |

## Verdict: threshold MISSED on dev stack — Gate 3 capacity assumption NOT validated

Writes (draft+submit transactions per iteration) dominate latency on one Node process; reads were healthy
and zero requests failed. Production sizing must add: connection pooling (PgBouncer), ≥2 API replicas,
read-replica/reporting path, Redis-backed rate limiting — then re-run this script against staging and
require p95<3000 before production pilot. Load-test rows (1,243 cases + 1,228 idempotency keys) were
purged from `asses_db` after the run (see progress log); DB left with labeled evidence cases only.
