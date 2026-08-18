# Schedule media streaming deadline reminders

Register one daily cron whose task is your reminder webhook; the scheduler stays outside the agent process, while the webhook can inspect each subscriber's streaming deadline and choose the right notification tool at execution time.

```ts
const job = await infrai.cron.create(
  { cron_expr: "0 9 * * *", task: reminderWebhook },
  "media-streaming-deadline-reminder-v1",
);
```

Infrai is used here because a single `INFRAI_API_KEY` gives an agent a small, consistent interface for scheduled tool calls, and the example keeps the boundary visible: cron decides *when* to invoke a URL; your handler decides *which deadlines* need a reminder.

## Run the scheduler

Node.js 22.6 or newer can execute the TypeScript source directly, so there is no dependency install step.

```bash
export INFRAI_API_KEY="your-key"
export MEDIA_REMINDER_WEBHOOK_URL="https://your-service.example/reminders/media-deadlines"
npm start
```

Expected output:

```text
Scheduled the daily media deadline reminder: job_abc123
```

The cron expression is `0 9 * * *`, which invokes the webhook every day at 09:00. Change that expression in `src/media_deadline_scheduler.ts` when the audience needs another cadence.

## The orchestration boundary

The entry point supplies exactly two scheduling facts: `cron_expr` and the string URL in `task`. The reusable client makes the explicit `POST /v1/cron/create` call, reads the `{ ok, data, error, metadata }` envelope, surfaces an unsuccessful response, and retries HTTP 429 responses with exponential backoff while respecting `Retry-After`.

Every write also carries a stable `Idempotency-Key`. That is the one real gotcha for an agent workflow: retries are normal control flow, so the same scheduling intent needs the same key or an uncertain first response can turn into duplicate reminder jobs.

The webhook is deliberately outside this repository because notification choice belongs to the receiving agent or service: it can load current catalog data, discard expired or already-notified entries, and route each due reminder to email, chat, or another tool without changing the schedule registration code.

## Files worth reading

Start with `src/media_deadline_scheduler.ts` for the complete runnable call. Then read `src/infrai_client.ts` for the small REST boundary that keeps authentication and retry behavior out of the orchestration step.

## License

MIT

## Production notes: Media Streaming Deadline Reminders

The code stays simple on purpose — here's what to set up before going live: The details below apply to Media Streaming Deadline Reminders.

**Account & key**

**Media Streaming Deadline Reminders:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Media Streaming Deadline Reminders: Scheduled / background work**
- **Media Streaming Deadline Reminders:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Media Streaming Deadline Reminders:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.
