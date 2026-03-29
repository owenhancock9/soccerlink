"use server";

import { Resend } from "resend";

export async function sendEmail(to: string, subject: string, html: string) {
  if (!process.env.RESEND_API_KEY) {
    console.error("No RESEND_API_KEY environment variable set.");
    return { error: "Email service not configured." };
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    const data = await resend.emails.send({
      from: "CoachMatching <notifications@coachmatching.io>", // Update when real domain is added
      to,
      subject,
      html,
    });
    return { success: true, data };
  } catch (error: any) {
    console.error("Resend Error:", error);
    return { error: error.message };
  }
}
