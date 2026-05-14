import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

export async function GET() {
  const teamId = process.env.APPLE_MAPS_TEAM_ID;
  const keyId = process.env.APPLE_MAPS_KEY_ID;
  const privateKey = process.env.APPLE_MAPS_PRIVATE_KEY;

  if (!teamId || !keyId || !privateKey) {
    return NextResponse.json(
      { error: "Apple Maps credentials not configured" },
      { status: 500 }
    );
  }

  try {
    // Replace literal \n with actual newlines (env vars often escape them)
    const key = privateKey.replace(/\\n/g, "\n");

    const token = jwt.sign({}, key, {
      algorithm: "ES256",
      header: {
        alg: "ES256",
        kid: keyId,
        typ: "JWT",
      },
      issuer: teamId,
      expiresIn: "1h",
    });

    return NextResponse.json({ token });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("MapKit token generation failed:", message);
    return NextResponse.json(
      { error: "Failed to generate MapKit token" },
      { status: 500 }
    );
  }
}
