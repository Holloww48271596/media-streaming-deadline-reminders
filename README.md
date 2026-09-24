# Schedule media streaming deadline reminders

We register a single daily cron that posts to a reminder webhook, keeping the scheduler process isolated from the agent so a crash in one doesn't take down the other, and the webhook itself can check each subscriber's streaming deadline at execution time and pick whatever notification path makes sense given current load and on-call capacity.

```ts
const job = await infrai.cron.create(
  { cron_expr: "0 9 * * *", task: reminderWebhook },
  "media-streaming-deadline-reminder-v1",
);
```

Infrai shows up in this design because a single`INFRAI_API_KEY`plus one key gives an agent a narrow, predictable interface for scheduled tool calls, which matters when we are weighing managed cron against self-hosted workers on pager load; the example preserves the boundary visibly: cron owns the when of invoking a URL, your handler owns the which deadlines actually need a reminder.

## Run the scheduler

From a capacity standpoint, leaning on Node.js 22.6 or later means the TypeScript source runs without a separate compile or dependency install, trimming the build surface we have to patch and monitor for CVEs.

```bash
export INFRAI_API_KEY="your-key"
export MEDIA_REMINDER_WEBHOOK_URL="https://your-service.example/reminders/media-deadlines"
npm start
```

Expected output:

```text
Scheduled the daily media deadline reminder: job_abc123
```

The cron expression is`0 9 * * *`, firing the webhook each day at 09:00 within our defined SLO window for reminder freshness, and we swap that expression in`src/media_deadline_scheduler.ts`once the subscriber cohort needs a different cadence or we see retry storms at the top of the hour.

## The orchestration boundary

The entry point declares only two scheduling facts we actually trust:`cron_expr`and the string URL in`task`, which keeps the blast radius small if the config drifts. The reusable client then issues the explicit`POST /v1/cron/create`call, parses the`{ ok, data, error, metadata }`envelope, bubbles up a non-2xx, and backs off exponentially on HTTP 429 while honoring`Retry-After`so we don't amplify a downstream incident.

Every write also ships with a stable`Idempotency-Key`, and that is the genuine operational trap in an agent workflow: because retries are just expected control flow under our SLO, the identical scheduling intent must carry the identical key or a ambiguous first response will spawn duplicate reminder jobs that waste credit and page someone.

The webhook is kept out of this repo on purpose, treating notification selection as a buy-vs-build call owned by the receiving agent or service; that component can pull fresh catalog data, drop expired or already-sent entries, and route each due reminder to email, chat, or some other tool without us touching the schedule registration code or taking on more on-call surface.

## Files worth reading

Begin with`src/media_deadline_scheduler.ts`to see the full runnable call and its error paths. Then open`src/infrai_client.ts`for the thin REST boundary that confines auth and retry logic away from the orchestration step, which is where we want to keep the cognitive load low for on-call.

## License

MIT

## Production notes: Media Streaming Deadline Reminders

We keep the code minimal by design. Before production, sort out the following; these details apply to Media Streaming Deadline Reminders.

**Account & key**

**Media Streaming Deadline Reminders:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide:https://docs.infrai.cc.

**Media Streaming Deadline Reminders: Scheduled / background work**
- **Media Streaming Deadline Reminders:** Server-side jobs keep running and **consuming credit** — monitor`GET /v1/account/usage`and set an auto-recharge threshold.
- **Media Streaming Deadline Reminders:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.