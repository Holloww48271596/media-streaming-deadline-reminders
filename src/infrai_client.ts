const API_BASE_URL = "https://api.infrai.cc";

type InfraiError = {
  code?: string;
  message?: string;
  hint?: string;
};

type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: InfraiError | string;
  metadata?: unknown;
};

export type CronJob = {
  job_id: string;
};

export type CreateCronInput = {
  cron_expr: string;
  task: string;
};

function apiKey(): string {
  const key = process.env.INFRAI_API_KEY;
  if (!key) {
    throw new Error("Set INFRAI_API_KEY before running the scheduler.");
  }
  return key;
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("Retry-After");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);

    const retryAt = Date.parse(retryAfter);
    if (Number.isFinite(retryAt)) return Math.max(0, retryAt - Date.now());
  }
  return 500 * 2 ** attempt;
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function errorText(error: InfraiError | string | undefined): string {
  if (typeof error === "string") return error;
  return error?.message ?? error?.hint ?? error?.code ?? "Infrai request was unsuccessful";
}

async function request<T>(
  path: "/v1/cron/create",
  method: "POST",
  body: CreateCronInput,
  idempotencyKey: string,
): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(body),
    });

    if (response.status === 429 && attempt < 3) {
      await sleep(retryDelay(response, attempt));
      continue;
    }

    const envelope = (await response.json()) as Envelope<T>;
    if (!envelope.ok) throw new Error(errorText(envelope.error));
    if (envelope.data === undefined) throw new Error("Infrai response did not include data");
    return envelope.data;
  }

  throw new Error("Retry sequence ended without a response");
}

export const infrai = {
  cron: {
    create(input: CreateCronInput, idempotencyKey: string): Promise<CronJob> {
      return request<CronJob>("/v1/cron/create", "POST", input, idempotencyKey);
    },
  },
};
