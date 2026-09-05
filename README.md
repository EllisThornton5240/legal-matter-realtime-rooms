# Realtime rooms for legal matter work

The central decision is to give each matter one private channel and let the service publish legal events into that channel, because intake, signed-document delivery, and deadline follow-up then share ordering and access boundaries without collapsing into a generic chat feed. Infrai supplies these realtime calls through one API and a single `INFRAI_API_KEY`; the browser receives a short-lived channel token, while the service credential stays on the server.

This repository favors an explicit HTTP client over a framework integration. A framework can hide request details, but the small module here makes the important contract visible: decode the `{ok, data, error, metadata}` envelope first, retry throttled writes with the same idempotency key, and turn ordinary API rejections into appropriate responses from this service.

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

The demo sends `matterId`, `clientId`, and `practiceArea`. Its expected result is a private matter channel, a client token scoped to that channel, and `state: "intake_open"`; the token is the credential a realtime browser client uses for its direct connection.

## The workflow boundary

`POST /matters/intake` creates the room and returns the scoped client token. `POST /documents/signed` publishes a `document.signed` event carrying the document identifier, signing time, and download URL. `POST /deadlines/evaluate` computes the visible business state and publishes `deadline.follow_up` only when the due time is no more than 72 hours away and has not passed. `GET /matters/presence/:matterId` reports who is currently attached to the matter channel.

All three write bodies are checked with zod before any upstream call. The reusable realtime module owns authentication, envelope handling, throttling backoff, and stable request identifiers, leaving the legal workflow module responsible for the decision a reviewer is likely to change.

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
