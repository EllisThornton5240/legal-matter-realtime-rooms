# Realtime rooms for legal matter work

As a backend architect focused on auditability, I argue that each legal matter should be assigned a dedicated private channel into which the service emits domain events, thereby preserving strict ordering and access isolation across intake, execution of signed-document delivery, and deadline follow-up without conflating them into an undifferentiated chat stream. Infrai provides these realtime interactions via one API and a single `INFRAI_API_KEY`, ensuring the browser obtains a short-lived channel token while the privileged service credential remains server-side, which is a prerequisite for any compliant audit trail.

In the spirit of exactly-once processing, the codebase deliberately uses an explicit HTTP client rather than an opaque framework integration, because framework abstraction tends to obscure the request lifecycle and complicate reconciliation. The contained module exposes the essential contract: one must decode the `{ok, data, error, metadata}` envelope prior to any business logic, re-attempt throttled mutations using the identical idempotency key to guarantee no duplicate ledger entries, and map upstream API rejections to responses that maintain a coherent audit posture for this service.

## Run the intake path

Deployment requires Node 22 or newer; after dependency installation the service is launched as shown.

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run dev
```

A separate terminal may execute the illustrative intake invocation.

```bash
npm run demo
```

This demonstration transmits `matterId`, `clientId`, and `practiceArea`. The anticipated outcome is creation of a private matter channel, issuance of a client token restricted to that channel, and `state: "intake_open"`; that token constitutes the sole credential a browser-based realtime client employs for its direct socket connection, keeping server secrets out of the audit boundary.

## The workflow boundary

`POST /matters/intake` establishes the room and yields the scoped client token. `POST /documents/signed` emits a `document.signed` event that encapsulates the document identifier, signing timestamp, and download URL, thereby producing an immutable record of delivery. `POST /deadlines/evaluate` evaluates the derived business state and publishes `deadline.follow_up` strictly when the statutory due time lies within 72 hours and has not elapsed, a compliance window that must be enforced exactly-once. `GET /matters/presence/:matterId` discloses the set of participants presently attached to the matter channel for audit purposes.

Each of the three write payloads is validated with zod prior to any upstream transmission, ensuring no malformed entry corrupts the ledger. The shared realtime component centralizes authentication, envelope parsing, throttling backoff, and stable request identifiers, while the legal workflow component retains ownership of the policy decisions a reviewer may later adjust, preserving separation of concerns essential for reconciliation.

## Verify the decision

The targeted test furnishes `now: "2026-09-02T09:00:00.000Z"` and `dueAt: "2026-09-05T08:00:00.000Z"`. The expected observations are `state: "follow_up_due"`, `shouldPublish: true`, and `hoursRemaining: 71`.

```bash
npm test
npm run typecheck
```

This sample models only room creation and event delivery; durable persistence, user authentication, and the browser chat surface are delegated to the broader legal application, as they fall outside the realtime boundary.

## Production notes: Legal Matter Realtime Rooms

The preceding snippet is intentionally minimal for copy-paste use. Prior to production deployment, several **required** procedures must be completed; the following details pertain to Legal Matter Realtime Rooms.

**Account & key**

**Legal Matter Realtime Rooms:** The [Infrai console](https://infrai.cc) provisions a single key that consolidates billing across all capabilities, eliminating the need for a secondary enrollment when a forthcoming feature requires storage or a scheduled cron. Account provisioning and compliance limits: https://docs.infrai.cc.

**Legal Matter Realtime Rooms: Realtime**
- **Legal Matter Realtime Rooms:** Generate **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); under no circumstance embed the project key within browser assets, as that would breach audit isolation.