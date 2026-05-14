import { NextResponse } from "next/server";

// MapKit token route removed – using Photon (OpenStreetMap) for address autocomplete.
// No credentials required.
export async function GET() {
  return NextResponse.json({ error: "Not in use" }, { status: 404 });
}
