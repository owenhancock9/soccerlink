"use server";

import { Resend } from "resend";

const FROM_EMAIL = "CoachingMatch <notifications@coachingmatch.co>";

async function send(to: string, subject: string, html: string) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("No RESEND_API_KEY — skipping email to", to);
    return { error: "Email service not configured." };
  }
  const resend = new Resend(process.env.RESEND_API_KEY);
  try {
    const data = await resend.emails.send({ from: FROM_EMAIL, to, subject, html });
    return { success: true, data };
  } catch (error: unknown) {
    console.error("Resend Error:", error);
    return { error: error instanceof Error ? error.message : "Unknown email error" };
  }
}

/* ─── Styled wrapper (Vinted Light Aesthetic) ─── */
function wrap(body: string) {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px; background: #f4f6f8; color: #111827;">
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="font-size: 20px; font-weight: 700; letter-spacing: -0.5px; color: #111827;">Coaching<span style="color: #09b1ba;">Match</span></span>
      </div>
      <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 4px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
        ${body}
      </div>
      <p style="text-align: center; font-size: 11px; color: #6b7280; margin-top: 24px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">
        © ${new Date().getFullYear()} CoachingMatch · <a href="https://coachingmatch.co" style="color: #09b1ba; text-decoration: none;">coachingmatch.co</a>
      </p>
    </div>
  `;
}

/* ═══════════════════════════════════
   PUBLIC EMAIL FUNCTIONS
   ═══════════════════════════════════ */

/** Notify coach that a new session was booked */
export async function sendBookingNotification(
  coachEmail: string,
  playerName: string,
  sessionDate: string,
  sessionTime: string,
  amount: number,
) {
  return send(
    coachEmail,
    `New Session Booked — ${playerName}`,
    wrap(`
      <h2 style="color: #09b1ba; font-size: 18px; font-weight: 700; margin: 0 0 16px;">New Session Booked 🎯</h2>
      <p style="color: #4b5563; margin: 0 0 24px; line-height: 1.6; font-size: 14px;">
        <strong style="color: #111827;">${playerName}</strong> just booked a session with you.
      </p>
      <div style="background: #f4f6f8; border: 1px solid #e5e7eb; border-radius: 4px; padding: 20px; margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 8px 0; color: #6b7280; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">Date</td>
            <td style="padding: 8px 0; text-align: right; color: #111827; font-weight: 700;">${sessionDate}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 8px 0; color: #6b7280; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">Time</td>
            <td style="padding: 8px 0; text-align: right; color: #111827; font-weight: 700;">${sessionTime}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">Your Payout</td>
            <td style="padding: 8px 0; text-align: right; color: #09b1ba; font-weight: 700; font-size: 16px;">$${amount.toFixed(2)}</td>
          </tr>
        </table>
      </div>
      <p style="color: #4b5563; font-size: 13px; line-height: 1.6;">
        Payment is held in escrow and will be <strong style="color: #111827;">automatically released to you 24 hours after the session</strong>. You can also confirm completion early by logging into your dashboard.
      </p>
    `),
  );
}

/** Notify the other party that one side confirmed */
export async function sendSessionConfirmedEmail(
  recipientEmail: string,
  confirmerName: string,
  role: "coach" | "player",
) {
  const otherRole = role === "coach" ? "player" : "coach";
  return send(
    recipientEmail,
    `${confirmerName} confirmed the session`,
    wrap(`
      <h2 style="color: #09b1ba; font-size: 18px; font-weight: 700; margin: 0 0 16px;">Session Confirmed Completed ✓</h2>
      <p style="color: #4b5563; margin: 0 0 16px; line-height: 1.6; font-size: 14px;">
        <strong style="color: #111827;">${confirmerName}</strong> (${role}) has confirmed that the session was completed successfully.
      </p>
      <div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 4px; padding: 16px;">
        <p style="color: #b45309; font-size: 13px; font-weight: 600; margin: 0; line-height: 1.5;">
          ⏳ Action Required: Waiting for you (${otherRole}) to confirm on your dashboard as well to release the escrow funds.
        </p>
      </div>
    `),
  );
}

/** Notify coach that funds have been released */
export async function sendFundsReleasedEmail(coachEmail: string, amount: number, autoReleased = false) {
  const heading = autoReleased ? "Funds Auto-Released 💰" : "Funds Released 💰";
  const subtext = autoReleased
    ? `24 hours have passed since your session, so payment was automatically released. <strong style="color: #09b1ba; font-size: 20px;">$${amount.toFixed(2)}</strong> has been transferred to your Stripe account.`
    : `Both parties confirmed. <strong style="color: #09b1ba; font-size: 20px;">$${amount.toFixed(2)}</strong> has been transferred to your Stripe account.`;
  return send(
    coachEmail,
    `Payment Released — $${amount.toFixed(2)}`,
    wrap(`
      <h2 style="color: #09b1ba; font-size: 18px; font-weight: 700; margin: 0 0 16px;">${heading}</h2>
      <p style="color: #4b5563; margin: 0 0 16px; line-height: 1.6; font-size: 14px;">
        ${subtext}
      </p>
      <p style="color: #6b7280; font-size: 13px;">Funds will arrive in your bank account within 1 business day.</p>
    `),
  );
}

/** Notify coach about a new rating */
export async function sendRatingReceivedEmail(
  coachEmail: string,
  playerName: string,
  rating: number,
  review: string,
) {
  const stars = "★".repeat(rating) + "☆".repeat(5 - rating);
  return send(
    coachEmail,
    `New ${rating}-Star Review from ${playerName}`,
    wrap(`
      <h2 style="color: #d97706; font-size: 18px; font-weight: 700; margin: 0 0 16px;">New Review Received ⭐</h2>
      <div style="text-align: center; margin: 20px 0; background: rgba(245, 158, 11, 0.08); padding: 12px; border-radius: 4px;">
        <span style="font-size: 24px; color: #f59e0b; letter-spacing: 4px;">${stars}</span>
      </div>
      <p style="color: #4b5563; margin: 0 0 8px; font-size: 14px;">
        <strong style="color: #111827;">${playerName}</strong> rated you <strong style="color: #d97706;">${rating} out of 5 stars</strong>
      </p>
      ${review ? `
        <div style="background: #f4f6f8; border-left: 3px solid #f59e0b; padding: 16px; border-radius: 4px; margin-top: 16px;">
          <p style="color: #111827; font-style: italic; margin: 0; line-height: 1.6; font-size: 13px;">"${review}"</p>
        </div>
      ` : ""}
    `),
  );
}

/** Generic email send (kept for backward compat) */
export async function sendEmail(to: string, subject: string, html: string) {
  return send(to, subject, html);
}
