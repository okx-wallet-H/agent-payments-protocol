import { NextResponse } from "next/server";
import { getStoreInfo, readDb } from "@/lib/store";

export async function GET() {
  const db = await readDb();
  return NextResponse.json({
    storage: getStoreInfo(),
    counts: {
      agents: db.agents.length,
      audit: db.audit.length
    }
  });
}
