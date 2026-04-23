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

export async function uploadHighlightReel(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const file = formData.get("file") as File;
  if (!file) return { error: "No file provided" };

  // 50MB limit for short clips
  if (file.size > 50 * 1024 * 1024) {
    return { error: "File too large. Please upload a video under 50MB." };
  }

  const allowed = ["video/mp4", "video/quicktime", "video/webm"];
  if (!allowed.includes(file.type)) {
    return { error: "Invalid format. Please upload an MP4, MOV, or WebM file." };
  }

  const fileExt = file.name.split(".").pop();
  const fileName = `highlights/${user.id}-${Date.now()}.${fileExt}`;

  const arrayBuffer = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from("vods")
    .upload(fileName, arrayBuffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    console.error("Highlight upload error:", uploadError);
    return { error: "Failed to upload video. Make sure the 'vods' bucket exists." };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("vods").getPublicUrl(fileName);

  // Save the URL to the coach's profile
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ highlight_reel_url: publicUrl })
    .eq("id", user.id);

  if (updateError) {
    console.error("Profile update error:", updateError);
    return { error: "Uploaded, but failed to save to your profile." };
  }

  return { success: true, url: publicUrl };
}

export async function uploadProfilePicture(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const file = formData.get("file") as File;
  if (!file) return { error: "No file provided" };

  if (file.size > 5 * 1024 * 1024) {
    return { error: "File too large. Please upload an image under 5MB." };
  }

  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.type)) {
    return { error: "Invalid format. Please upload a JPG, PNG, or WebP image." };
  }

  const fileExt = file.name.split(".").pop();
  const fileName = `avatars/${user.id}-${Date.now()}.${fileExt}`;

  const arrayBuffer = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from("vods")
    .upload(fileName, arrayBuffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    console.error("Avatar upload error:", uploadError);
    return { error: "Failed to upload image." };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("vods").getPublicUrl(fileName);

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_url: publicUrl })
    .eq("id", user.id);

  if (updateError) {
    console.error("Profile update error:", updateError);
    return { error: "Uploaded, but failed to save to your profile." };
  }

  return { success: true, url: publicUrl };
}
