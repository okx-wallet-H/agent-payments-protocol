import { NextResponse } from "next/server";
import { getExecutionGateStatus } from "@/lib/execution-gates";

export async function GET() {
  return NextResponse.json({ execution: getExecutionGateStatus() });
}
