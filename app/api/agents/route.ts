import { NextResponse } from "next/server";
import { getAccessControlStatus, resolveRequestUser } from "@/lib/access-control";
import { auditEvent } from "@/lib/audit";
import { createDefaultAgentMemory } from "@/lib/agent-memory";
import { DEFAULT_POLICY } from "@/lib/defaults";
import { jsonError, parseJson } from "@/lib/http";
import { listAgents, saveAgent } from "@/lib/store";
import type { Agent, ExecutionMode } from "@/lib/types";
import { assertEvmAddress } from "@/lib/xlayer";

interface CreateAgentBody {
  ownerUserId?: string;
  name?: string;
  strategyProfile?: string;
  executionMode?: ExecutionMode;
  userWalletAddress?: string;
}

export async function GET(request: Request) {
  const user = await resolveRequestUser(request);
  if (!user.ok && getAccessControlStatus().requireOwner) {
    return jsonError(user.error || "Forbidden", user.status || 403);
  }
  const agents = await listAgents();
  return NextResponse.json({
    agents: user.userId ? agents.filter((agent) => agent.ownerUserId === user.userId) : []
  });
}

export async function POST(request: Request) {
  const body = await parseJson<CreateAgentBody>(request);
  const user = await resolveRequestUser(request, body);
  if (!user.ok && getAccessControlStatus().requireOwner) {
    return jsonError(user.error || "Forbidden", user.status || 403);
  }
  const now = new Date().toISOString();
  let userWalletAddress: `0x${string}` | undefined;

  if (body.userWalletAddress) {
    assertEvmAddress(body.userWalletAddress);
    userWalletAddress = body.userWalletAddress;
  }

  const ownerUserId = user.userId || body.ownerUserId?.trim();
  if (!ownerUserId) {
    return jsonError("ownerUserId is required to create an Agent", 400);
  }

  const agent: Agent = {
    id: crypto.randomUUID(),
    ownerUserId,
    name: body.name || "Prediction Agent",
    status: "active",
    strategyProfile:
      body.strategyProfile ||
      "OKX-first prediction agent. Observe real prediction markets, generate probability theses, execute only inside policy.",
    executionMode: body.executionMode || "mainnet_small",
    userWalletAddress,
    policy: DEFAULT_POLICY,
    memory: createDefaultAgentMemory(),
    messages: [],
    runs: [],
    intents: [],
    previews: [],
    executions: [],
    createdAt: now,
    updatedAt: now
  };

  const saved = await saveAgent(
    agent,
    auditEvent(agent.id, "agent.created", "Prediction Agent created", {
      ownerUserId: agent.ownerUserId,
      executionMode: agent.executionMode
    })
  );

  return NextResponse.json({ agent: saved }, { status: 201 });
}
