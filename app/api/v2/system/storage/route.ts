import { NextResponse } from "next/server";
import { readV2StorageHealth } from "@/v2/storage/storage-health";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const health = await readV2StorageHealth();
  return NextResponse.json(health, {
    status: health.postgres.status === "error" ? 503 : 200
  });
}
