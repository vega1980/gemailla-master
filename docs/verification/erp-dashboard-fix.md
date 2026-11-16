# ERP registration and dashboard metrics correction

Base: `0cb66f4997962a28c96472b335f747e87e6f530a`.

Transaction creation previously omitted `ownerUid`, required by Firestore rules.
The Firebase repository now supplies the authenticated UID for both single and
bulk transaction creation. An unauthenticated caller fails before the write;
updates and other collections retain their existing behavior. ERP reports
mutation failures to the user.

The aggregation handler previously sent literal zero values for metrics outside
the current event delta. A subsequent expense could erase accumulated income.
Zero increments now initialize missing fields while preserving existing counters.
A regression test covers income, expense and document events and checks global
and monthly totals.

The dashboard previously queried the global metrics collection by a field, while
its security rule authorizes by document ID. It now reads the company's metrics
document directly. Firestore rules, Storage rules and policies are unchanged.

The dashboard E2E verifies the exact persisted totals (1000 income, 250 expenses,
750 balance, two transactions), then checks their respective cards. The income
card uses the existing compact display `$1.0K`; the old expectation `1,000` was
inconsistent with that display. ERP E2E also verifies the persisted owner UID.

## Validation

- Lint and both TypeScript checks passed.
- Unit tests: 185 passed.
- Functions tests: 154 passed, including the mixed-event regression.
- Firestore/Storage rules: 112 passed.
- Build, architecture validation and bundle budgets passed.
- Full E2E run: 45 passed, one failed solely on the old `1,000` expectation.
- Final focused E2E rerun: ERP and dashboard both passed (2/2, 25.4 seconds).

Local emulator execution required a temporary Pub/Sub port change from 8085 to
18085 and a loopback-only proxy bypass in installed Firebase CLI tooling. Both
were restored after execution; neither is part of this change. Dependency locks
were not changed.

This fix preserves future aggregation events. It does not rebuild historical
metrics already corrupted before the fix. No production data, deployment or
real-Gemini verification is included.
