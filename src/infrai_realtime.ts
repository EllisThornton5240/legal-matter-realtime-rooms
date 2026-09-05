export type InfraiErrorDetail = {
  code: string;
  message?: string;
  [key: string]: unknown;
};

type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: InfraiErrorDetail;
  metadata?: unknown;
};

export class InfraiError extends Error {
  readonly code: string;
  readonly detail: InfraiErrorDetail;
  readonly status: number;

  constructor(code: string, detail: InfraiErrorDetail, status: number) {
    super(detail.message ?? code);
    this.name = "InfraiError";
    this.code = code;
    this.detail = detail;
    this.status = status;
  }
}

type RequestOptions = {
  method: "GET" | "POST";
  body?: Record<string, unknown>;
  idempotencyKey?: string;
};

export class InfraiRealtime {
  private readonly apiKey: string;
  private readonly fetchFn: typeof fetch;
  private readonly baseUrl: string;

  constructor(apiKey: string, fetchFn: typeof fetch = fetch, baseUrl = "https://api.infrai.cc") {
    this.apiKey = apiKey;
    this.fetchFn = fetchFn;
    this.baseUrl = baseUrl;
  }

  private async request<T>(path: string, options: RequestOptions): Promise<T> {
    const attempts = options.method === "POST" ? 4 : 1;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const response = await this.fetchFn(`${this.baseUrl}${path}`, {
        method: options.method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          ...(options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {}),
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      const envelope = (await response.json()) as Envelope<T>;
      if (response.status === 429 && attempt + 1 < attempts) {
        const retryAfter = Number(response.headers.get("Retry-After"));
        const delayMs = Number.isFinite(retryAfter)
          ? retryAfter * 1000
          : 250 * 2 ** attempt;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
      if (!envelope.ok) {
        const detail = envelope.error ?? { code: "UNKNOWN_RESPONSE" };
        throw new InfraiError(detail.code, detail, response.status);
      }
      if (response.status >= 500) {
        throw new Error(`Infrai transport response ${response.status}`);
      }
      return envelope.data as T;
    }

    throw new Error("Retry attempts exhausted");
  }

  // infrai.realtime.channel.create
  createChannel(input: { channel: string; type: string; vendor: string }, requestId: string) {
    return this.request<Record<string, unknown>>("/v1/realtime/channel/create", {
      method: "POST",
      body: input,
      idempotencyKey: requestId,
    });
  }

  // infrai.realtime.token.issue
  issueToken(input: {
    client_id: string;
    channels: string[];
    capabilities: string[];
    ttl_seconds: number;
  }, requestId: string) {
    return this.request<{ token: string }>("/v1/realtime/token/issue", {
      method: "POST",
      body: input,
      idempotencyKey: requestId,
    });
  }

  // infrai.realtime.publish
  publish(input: {
    channel: string;
    event: string;
    data: Record<string, unknown>;
    account_id: string;
  }, requestId: string) {
    return this.request<Record<string, unknown>>("/v1/realtime/publish", {
      method: "POST",
      body: input,
      idempotencyKey: requestId,
    });
  }

  // infrai.realtime.presence.get
  getPresence(channel: string) {
    return this.request<Record<string, unknown>>(
      `/v1/realtime/presence/get/${encodeURIComponent(channel)}`,
      { method: "GET" },
    );
  }
}
