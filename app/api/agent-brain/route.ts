import { NextResponse } from "next/server";
import { getAgentBrainInfo } from "@/lib/agent-brain";

export async function GET() {
  return NextResponse.json(getAgentBrainInfo());
}
