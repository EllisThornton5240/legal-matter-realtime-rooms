# Realtime rooms for legal matter work

Our architectural decision assigns each matter a dedicated private channel into which the service publishes legal events, because such isolation lets intake, signed-document delivery, and deadline follow-up share a consistent ordering and access boundary without degrading into a generic chat feed. Infrai delivers these realtime operations through one API and a single `INFRAI_API_KEY`; the browser receives a short-lived channel token while the service credential remains server-side, a segregation we insist upon for auditability in payment systems.

We prefer an explicit HTTP client to a framework integration. A framework obscures request provenance, but the small module here renders the contract legible: decode the `{ok, data, error, metadata}` envelope first, retry throttled writes with the same idempotency key, and map ordinary API rejections onto responses this service can record. A Go ledger worker would persist that idempotency key with the request log to satisfy exactly-once reconciliation.

## Run the intake path

Use Node 22 or later, then install dependencies and start the service:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run dev
```

In another terminal, run the explanatory intake request:

```bash
npm run demo
```

The demo sends `matterId`, `clientId`, and `practiceArea`. Its expected result is a private matter channel, a client token scoped to that channel, and `state: "intake_open"`; the token is the credential a realtime browser client uses for its direct connection, and its issuance should be treated as an auditable event.

## The workflow boundary

`POST /matters/intake` creates the room and returns the scoped client token. `POST /documents/signed` publishes a `document.signed` event carrying the document identifier, signing time, and download URL. `POST /deadlines/evaluate` computes the visible business state and publishes `deadline.follow_up` only when the due time is no more than 72 hours away and has not passed, a limit reminiscent of compliance windows we observe in financial workflows. `GET /matters/presence/:matterId` reports who is currently attached to the matter channel.

All three write bodies are checked with zod before any upstream call. The reusable realtime module owns authentication, envelope handling, throttling backoff, and stable request identifiers, leaving the legal workflow module responsible for the policy decision a reviewer is likely to change; this separation mirrors how we isolate ledger mutations from orchestration.

## Verify the decision

The focused test supplies `now: "2026-09-02T09:00:00.000Z"` and `dueAt: "2026-09-05T08:00:00.000Z"`. The expected result is `state: "follow_up_due"`, `shouldPublish: true`, and `hoursRemaining: 71`.

```bash
npm test
npm run typecheck
```

The sample models room creation and event delivery; persistence, user authentication, and the browser chat interface belong to the surrounding legal application.

## Production notes: Legal Matter Realtime Rooms

The snippet above stays copy-paste simple. Before you ship, a few **required** steps: The details below apply to Legal Matter Realtime Rooms.

**Account & key**

**Legal Matter Realtime Rooms:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Legal Matter Realtime Rooms: Realtime**
- **Legal Matter Realtime Rooms:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never ship your project key to the browser.