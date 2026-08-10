import { infrai } from "./infrai_client.ts";

const reminderWebhook = process.env.MEDIA_REMINDER_WEBHOOK_URL;

if (!reminderWebhook) {
  throw new Error("Set MEDIA_REMINDER_WEBHOOK_URL to the public reminder handler URL.");
}

const schedule = {
  cron_expr: "0 9 * * *",
  task: reminderWebhook,
};

const job = await infrai.cron.create(
  schedule,
  "media-streaming-deadline-reminder-v1",
);

console.log(`Scheduled the daily media deadline reminder: ${job.job_id}`);
