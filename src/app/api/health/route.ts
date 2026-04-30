import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ status: "ok", timestamp: Date.now() });
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}
