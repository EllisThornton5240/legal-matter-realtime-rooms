import { createServer, type ServerResponse } from "node:http";
import { InfraiError, InfraiRealtime } from "./infrai_realtime.ts";
import {
  deadlineSchema,
  decideDeadlineFollowUp,
  matterChannel,
  matterIntakeSchema,
  signedDocumentSchema,
} from "./legal_workflow.ts";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");
const infrai = new InfraiRealtime(apiKey);

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readJson(req: AsyncIterable<Uint8Array>) {
  const chunks: Uint8Array[] = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url?.startsWith("/matters/presence/")) {
      const matterId = decodeURIComponent(req.url.slice("/matters/presence/".length));
      const presence = await infrai.getPresence(matterChannel(matterId));
      return send(res, 200, { matterId, presence });
    }
    if (req.method !== "POST") return send(res, 405, { error: "POST required" });
    const body = await readJson(req);

    if (req.url === "/matters/intake") {
      const input = matterIntakeSchema.parse(body);
      const channel = matterChannel(input.matterId);
      await infrai.createChannel(
        { channel, type: "private", vendor: "tencent_im" },
        `matter-intake:${input.matterId}`,
      );
      const credential = await infrai.issueToken(
        {
          client_id: input.clientId,
          channels: [channel],
          capabilities: ["subscribe", "publish"],
          ttl_seconds: 3600,
        },
        `matter-token:${input.matterId}:${input.clientId}`,
      );
      return send(res, 201, { channel, token: credential.token, state: "intake_open" });
    }

    if (req.url === "/documents/signed") {
      const input = signedDocumentSchema.parse(body);
      const channel = matterChannel(input.matterId);
      await infrai.publish(
        {
          channel,
          event: "document.signed",
          data: {
            documentId: input.documentId,
            signedAt: input.signedAt,
            downloadUrl: input.downloadUrl,
          },
          account_id: input.accountId,
        },
        `signed-document:${input.documentId}`,
      );
      return send(res, 202, { channel, state: "signed_document_delivered" });
    }

    if (req.url === "/deadlines/evaluate") {
      const input = deadlineSchema.parse(body);
      const decision = decideDeadlineFollowUp(input);
      const channel = matterChannel(input.matterId);
      if (decision.shouldPublish) {
        await infrai.publish(
          {
            channel,
            event: "deadline.follow_up",
            data: { deadlineId: input.deadlineId, dueAt: input.dueAt },
            account_id: input.accountId,
          },
          `deadline-follow-up:${input.deadlineId}`,
        );
      }
      return send(res, 200, { channel, ...decision });
    }

    return send(res, 404, { error: "Route not found" });
  } catch (error) {
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      return send(res, status, { error: error.detail });
    }
    const issues = error && typeof error === "object" && "issues" in error
      ? (error as { issues: unknown }).issues
      : undefined;
    return send(res, issues ? 400 : 500, { error: issues ?? "Request could not be processed" });
  }
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => {
  console.log(`Legal matter room service listening on http://localhost:${port}`);
});
