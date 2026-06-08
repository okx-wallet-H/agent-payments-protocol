import { promises as fs } from "node:fs";
import path from "node:path";
import { normalizeAgentMemory } from "./agent-memory";
import { createExecutionSafetySummary } from "./execution-preview";
import { createPostgresStore } from "./postgres-store";
import type { Agent, AuditEvent, Database } from "./types";

const dbPath = path.join(process.cwd(), "data", "db.json");

export interface AgentStoreInfo {
  provider: "json_file" | "postgres";
  path?: string;
  productionReady: boolean;
  warnings: string[];
}

export interface AgentStore {
  info(): AgentStoreInfo;
  readDb(): Promise<Database>;
  writeDb(db: Database): Promise<void>;
  listAgents(): Promise<Agent[]>;
  getAgent(id: string): Promise<Agent | undefined>;
  saveAgent(agent: Agent, event?: AuditEvent | AuditEvent[]): Promise<Agent>;
  addAudit(event: AuditEvent): Promise<void>;
  listAudit(agentId: string): Promise<AuditEvent[]>;
}

async function ensureDb(): Promise<void> {
  await fs.mkdir(path.dirname(dbPath), { recursive: true });
  try {
    await fs.access(dbPath);
  } catch {
    await fs.writeFile(dbPath, JSON.stringify({ agents: [], audit: [] }, null, 2));
  }
}

function normalizeDb(db: Database): Database {
  return {
    ...db,
    agents: db.agents.map((agent) => ({
      ...agent,
      memory: normalizeAgentMemory(agent.memory),
      messages: agent.messages || [],
      runs: agent.runs || [],
      intents: agent.intents || [],
      previews: (agent.previews || []).map((preview) => ({
        ...preview,
        safetySummary:
          preview.safetySummary ||
          createExecutionSafetySummary({
            provider: preview.provider || "simulator",
            mode: preview.mode || "paper",
            amountOkb: preview.amountOkb || 0,
            estimatedCostOkb: preview.estimatedCostOkb || 0,
            warnings: preview.warnings || [],
            requiresConfirmation: Boolean(preview.confirmationText || preview.confirmationCode),
            canBroadcastTransactions: preview.mode === "live" && preview.estimatedCostOkb > 0
          }),
        confirmationStatus:
          preview.confirmationStatus || (preview.confirmationText ? "pending" : "not_required"),
        confirmationAttempts: preview.confirmationAttempts || 0,
        maxConfirmationAttempts: preview.maxConfirmationAttempts || 5
      })),
      executions: agent.executions || []
    })),
    audit: db.audit || []
  };
}

async function readJsonDb(): Promise<Database> {
  await ensureDb();
  const raw = await fs.readFile(dbPath, "utf8");
  let db: Database;
  try {
    db = JSON.parse(raw) as Database;
  } catch (error) {
    throw new Error(`JSON store is unreadable at ${dbPath}: ${error instanceof Error ? error.message : String(error)}`);
  }
  return normalizeDb(db);
}

async function writeJsonDb(db: Database): Promise<void> {
  await ensureDb();
  const normalized = normalizeDb(db);
  const tempPath = `${dbPath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tempPath, `${JSON.stringify(normalized, null, 2)}\n`);
  await fs.rename(tempPath, dbPath);
}

function createJsonFileStore(): AgentStore {
  return {
    info() {
      return {
        provider: "json_file",
        path: dbPath,
        productionReady: false,
        warnings: [
          "JSON file storage is for local MVP and demos only.",
          "Do not use JSON file storage for real funds, multi-instance deployments, or concurrent production writes.",
          ...(process.env.DATABASE_URL
            ? ["DATABASE_URL is set, but Postgres runtime wiring is not enabled yet; still using JSON file storage."]
            : [])
        ]
      };
    },
    readDb: readJsonDb,
    writeDb: writeJsonDb,
    async listAgents() {
      const db = await readJsonDb();
      return db.agents;
    },
    async getAgent(id) {
      const db = await readJsonDb();
      return db.agents.find((agent) => agent.id === id);
    },
    async saveAgent(agent, event) {
      const db = await readJsonDb();
      const index = db.agents.findIndex((item) => item.id === agent.id);
      const nextAgent = normalizeDb({
        agents: [{ ...agent, updatedAt: new Date().toISOString() }],
        audit: []
      }).agents[0];
      if (index >= 0) {
        db.agents[index] = nextAgent;
      } else {
        db.agents.unshift(nextAgent);
      }
      db.audit.unshift(...normalizeAuditEvents(event));
      await writeJsonDb(db);
      return nextAgent;
    },
    async addAudit(event) {
      const db = await readJsonDb();
      db.audit.unshift(event);
      await writeJsonDb(db);
    },
    async listAudit(agentId) {
      const db = await readJsonDb();
      return db.audit.filter((event) => event.agentId === agentId);
    }
  };
}

function getStore(): AgentStore {
  if (process.env.AGENT_STORE === "postgres") {
    if (!process.env.DATABASE_URL) {
      throw new Error("AGENT_STORE=postgres requires DATABASE_URL.");
    }
    return createPostgresStore(process.env.DATABASE_URL);
  }
  return createJsonFileStore();
}

export const store = getStore();

export const getStoreInfo = () => store.info();
export const readDb = () => store.readDb();
export const writeDb = (db: Database) => store.writeDb(db);
export const listAgents = () => store.listAgents();
export const getAgent = (id: string) => store.getAgent(id);
export const saveAgent = (agent: Agent, event?: AuditEvent | AuditEvent[]) => store.saveAgent(agent, event);
export const addAudit = (event: AuditEvent) => store.addAudit(event);
export const listAudit = (agentId: string) => store.listAudit(agentId);

export function normalizeAuditEvents(event?: AuditEvent | AuditEvent[]): AuditEvent[] {
  if (!event) return [];
  return Array.isArray(event) ? event : [event];
}
