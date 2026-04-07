"use server";

import { Resend } from "resend";

const FROM_EMAIL = "CoachMatching <notifications@coachmatching.io>";

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

/* ─── Styled wrapper ─── */
function wrap(body: string) {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 24px; background: #0a0a0a; color: #e2e8f0;">
      <div style="text-align: center; margin-bottom: 32px;">
        <span style="font-size: 18px; font-weight: 900; letter-spacing: -0.5px; background: linear-gradient(135deg, #6366f1, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">COACH_MATCHING</span>
      </div>
      <div style="background: #111827; border: 1px solid #1e293b; border-radius: 16px; padding: 32px;">
        ${body}
      </div>
      <p style="text-align: center; font-size: 11px; color: #475569; margin-top: 24px;">
        © ${new Date().getFullYear()} CoachMatching · <a href="https://coachingmatch.co" style="color: #6366f1;">coachingmatch.co</a>
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
      <h2 style="color: #10b981; font-size: 20px; font-weight: 800; margin: 0 0 16px;">New Session Booked 🎯</h2>
      <p style="color: #94a3b8; margin: 0 0 24px; line-height: 1.6;">
        <strong style="color: white;">${playerName}</strong> just booked a session with you.
      </p>
      <div style="background: #0a0a0a; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
          <span style="color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Date</span>
          <span style="color: white; font-weight: 700;">${sessionDate}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
          <span style="color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Time</span>
          <span style="color: white; font-weight: 700;">${sessionTime}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span style="color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Your Payout</span>
          <span style="color: #10b981; font-weight: 800; font-size: 18px;">$${amount.toFixed(2)}</span>
        </div>
      </div>
      <p style="color: #64748b; font-size: 13px; line-height: 1.6;">
        After the session, both you and the player must click <strong style="color: white;">"Confirm Session Complete"</strong> for funds to be released.
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
      <h2 style="color: #6366f1; font-size: 20px; font-weight: 800; margin: 0 0 16px;">Session Confirmed ✓</h2>
      <p style="color: #94a3b8; margin: 0 0 16px; line-height: 1.6;">
        <strong style="color: white;">${confirmerName}</strong> (${role}) has confirmed the session was completed.
      </p>
      <p style="color: #f59e0b; font-size: 14px; font-weight: 700; margin: 0;">
        ⏳ Waiting for you (${otherRole}) to confirm as well to release funds.
      </p>
    `),
  );
}

/** Notify coach that funds have been released */
export async function sendFundsReleasedEmail(coachEmail: string, amount: number) {
  return send(
    coachEmail,
    `Payment Released — $${amount.toFixed(2)}`,
    wrap(`
      <h2 style="color: #10b981; font-size: 20px; font-weight: 800; margin: 0 0 16px;">Funds Released 💰</h2>
      <p style="color: #94a3b8; margin: 0 0 16px; line-height: 1.6;">
        Both parties confirmed. <strong style="color: #10b981; font-size: 24px;">$${amount.toFixed(2)}</strong> has been transferred to your Stripe account.
      </p>
      <p style="color: #64748b; font-size: 13px;">Funds will arrive in your bank account within 1 business day.</p>
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
      <h2 style="color: #f59e0b; font-size: 20px; font-weight: 800; margin: 0 0 16px;">New Review ⭐</h2>
      <div style="text-align: center; margin: 24px 0;">
        <span style="font-size: 28px; color: #f59e0b; letter-spacing: 4px;">${stars}</span>
      </div>
      <p style="color: #94a3b8; margin: 0 0 8px;">
        <strong style="color: white;">${playerName}</strong> rated you <strong style="color: #f59e0b;">${rating}/5</strong>
      </p>
      ${review ? `
        <div style="background: #0a0a0a; border-left: 3px solid #f59e0b; padding: 16px; border-radius: 8px; margin-top: 16px;">
          <p style="color: #e2e8f0; font-style: italic; margin: 0; line-height: 1.6;">"${review}"</p>
        </div>
      ` : ""}
    `),
  );
}

/** Generic email send (kept for backward compat) */
export async function sendEmail(to: string, subject: string, html: string) {
  return send(to, subject, html);
}
