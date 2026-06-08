import { NextResponse } from "next/server";
import { getAccessControlStatus } from "@/lib/access-control";

export async function GET() {
  return NextResponse.json({ accessControl: getAccessControlStatus() });
}
