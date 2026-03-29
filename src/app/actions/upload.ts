"use server";

import { createClient } from "@/app/lib/supabase/server";

export async function uploadVodForBooking(
  bookingId: string,
  formData: FormData,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const file = formData.get("file") as File;
  if (!file) {
    return { error: "No file provided" };
  }

  // Generate a unique filename
  const fileExt = file.name.split(".").pop();
  const fileName = `${bookingId}-${Date.now()}.${fileExt}`;

  // Read file as ArrayBuffer for Supabase Storage
  const arrayBuffer = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from("vods")
    .upload(fileName, arrayBuffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    console.error("Upload error:", uploadError);
    return {
      error:
        "Failed to upload file to storage bucket. Make sure the 'vods' bucket exists and is public.",
    };
  }

  // Get public URL
  const {
    data: { publicUrl },
  } = supabase.storage.from("vods").getPublicUrl(fileName);

  // Update booking record with the video URL and set status to 'vod_submitted'
  const { error: updateError } = await supabase
    .from("bookings")
    .update({
      vod_url: publicUrl,
      status: "vod_submitted",
    })
    .eq("id", bookingId)
    .eq("player_id", user.id); // Secure: only the player who booked can upload

  if (updateError) {
    console.error("Booking update error:", updateError);
    return { error: "Uploaded successfully, but failed to link to booking." };
  }

  return { success: true, url: publicUrl };
}
