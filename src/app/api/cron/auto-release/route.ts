import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
import { releaseFundsToCoach } from "@/app/actions/payouts";
import { sendFundsReleasedEmail } from "@/app/actions/emails";

// This route is called by Vercel Cron every hour.
// It auto-releases funds for any confirmed session where 24+ hours have
// elapsed since the scheduled session date/time without a dispute.

export async function GET(req: NextRequest) {
  // Secure the endpoint so only Vercel Cron (or an admin) can call it
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();

  // Find all confirmed bookings where session was 24+ hours ago
  // and funds haven't been released yet (status is still "confirmed")
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const cutoffDate = cutoff.toISOString().split("T")[0]; // YYYY-MM-DD

  const { data: bookings, error } = await supabase
    .from("bookings")
    .select("*, coach:coach_profiles(stripe_account_id), coach_profile:profiles!bookings_coach_id_fkey(email)")
    .eq("status", "confirmed")
    .lte("session_date", cutoffDate);

  if (error) {
    console.error("Auto-release cron error fetching bookings:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!bookings || bookings.length === 0) {
    return NextResponse.json({ released: 0, message: "No eligible bookings." });
  }

  const results: { id: string; result: string }[] = [];

  for (const booking of bookings) {
    // Double-check: combine session_date + session_time into a full timestamp
    // and verify 24h have truly elapsed (handles edge cases on cutoff day)
    try {
      const sessionDateTimeStr = `${booking.session_date}T${booking.session_time || "00:00"}`;
      const sessionDateTime = new Date(sessionDateTimeStr);
      const hoursSince = (Date.now() - sessionDateTime.getTime()) / (1000 * 60 * 60);

      if (hoursSince < 24) {
        results.push({ id: booking.id, result: "skipped (< 24h)" });
        continue;
      }

      const payoutResult = await releaseFundsToCoach(booking.id);

      if (payoutResult.error) {
        results.push({ id: booking.id, result: `error: ${payoutResult.error}` });
        continue;
      }

      // Email coach that funds were auto-released
      const coachEmail = (booking.coach_profile as any)?.email;
      if (coachEmail) {
        await sendFundsReleasedEmail(coachEmail, booking.rate || 0, true);
      }

      results.push({ id: booking.id, result: "released" });
    } catch (err) {
      results.push({ id: booking.id, result: `exception: ${err}` });
    }
  }

  const released = results.filter((r) => r.result === "released").length;
  console.log(`Auto-release cron: ${released}/${bookings.length} released`, results);

  return NextResponse.json({ released, total: bookings.length, results });
}
