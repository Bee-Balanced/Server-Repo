// sendReminders.js - schedules and sends reminder emails using Knock every 3 days

import { Knock } from "@knocklabs/node";
import nodeSchedule from "node-schedule";
import db from "./db.js";

if (!process.env.KNOCK_API_KEY) {
  throw new Error("❌ KNOCK_API_KEY is not defined in your environment.");
}

const knock = new Knock(process.env.KNOCK_API_KEY);
const anchorDate = new Date("2025-01-01");
const msPerDay = 1000 * 60 * 60 * 24;
const scheduleTime = "0 12 * * *"; // every day at 12:00 PM

// send a single email using Knock
const sendEmail = async (email, name) => {
  try {
    await knock.workflows.trigger("reminder", {
      recipients: [{ id: email, email }],
      data: {
        subject: "Bee Balanced Reminder",
        body: "This is your Bee Balanced check-in reminder!",
        date: new Date().toLocaleDateString(),
        name,
      },
    });
    console.log(`✅ Sent reminder to ${email}`);
  } catch (err) {
    console.error(`❌ Failed to send email to ${email}:`, err.message);
  }
};

// run a daily scheduled job to check if a reminder should be sent
const scheduleReminderJob = () => {
  nodeSchedule.scheduleJob(scheduleTime, async () => {
    const today = new Date();
    const daysSinceAnchor = Math.floor((today - anchorDate) / msPerDay);

    if (daysSinceAnchor % 3 === 0) {
      console.log("📧 Sending reminders to eligible users...");

      try {
        const [users] = await db.query("SELECT email, full_name FROM users");
        const emails = users
          .filter(user => user.email)
          .map(user => sendEmail(user.email, user.full_name));

        await Promise.all(emails);
        console.log("✅ All reminders sent.");
      } catch (err) {
        console.error("❌ Failed to fetch users or send reminders:", err.message);
      }
    }
  });
};

export { scheduleReminderJob };
