import { createHmac } from "node:crypto";
import type { MarketSnapshot } from "../domain/types";
import { normalizeOkxOutcomes } from "./okx-outcomes-output";

type QueryValue = string | number | boolean | undefined;
type LooseRecord = Record<string, unknown>;

interface OkxOutcomesCredentials {
  apiKey: string;
  apiSecret: string;
  passphrase: string;
}

interface OkxOutcomesResponse<T> {
  code?: string | number;
  msg?: string;
  message?: string;
  data?: T;
}

interface OkxEventsPayload {
  events?: unknown[];
  pagination?: unknown;
}

interface OkxMarketsPayload {
  markets?: unknown[];
}

const defaultBaseUrl = "https://www.okx.com";
const worldCupKeywords = ["World Cup", "2026 World Cup", "FIFA World Cup", "世界杯"];

export function hasOkxOutcomesCredentials(): boolean {
  return Boolean(readCredentials());
}

export async function listOkxWorldCupMarkets(): Promise<MarketSnapshot[]> {
  const client = createOkxOutcomesClient();
  const events = await client.discoverWorldCupEvents();
  if (events.length === 0) return [];

  const eventsWithMarkets: LooseRecord[] = [];
  for (const event of events.slice(0, 8)) {
    const eventId = readString(event, ["eventId", "id"]);
    const embeddedMarkets = readArray(event, ["markets"]);
    let markets = embeddedMarkets;

    if (eventId && embeddedMarkets.length < 3) {
      markets = await client.getEventMarkets(eventId).catch(() => embeddedMarkets);
    }

    eventsWithMarkets.push({
      ...event,
      markets
    });
  }

  return normalizeOkxOutcomes({ events: eventsWithMarkets }).markets.slice(0, 80);
}

function createOkxOutcomesClient() {
  const credentials = readCredentials();
  if (!credentials) {
    throw new Error("Missing OKX Outcomes REST credentials");
  }

  const baseUrl = process.env.OKX_OUTCOMES_BASE_URL || defaultBaseUrl;

  return {
    async discoverWorldCupEvents(): Promise<LooseRecord[]> {
      const byId = new Map<string, LooseRecord>();

      for (const keyword of worldCupKeywords) {
        const payload = await request<OkxEventsPayload>({
          baseUrl,
          credentials,
          path: "/api/v5/predictions/events/search",
          query: { keyword, pageSize: 20 }
        }).catch(() => undefined);

        for (const event of readArray(payload, ["events"]).filter(isRecord)) {
          const id = readString(event, ["eventId", "id"]) || JSON.stringify(event).slice(0, 80);
          byId.set(id, event);
        }
      }

      if (byId.size === 0) {
        const payload = await request<OkxEventsPayload>({
          baseUrl,
          credentials,
          path: "/api/v5/predictions/events",
          query: { status: "active", sort: "volume_24h", pageSize: 30 }
        }).catch(() => undefined);

        for (const event of readArray(payload, ["events"]).filter(isRecord).filter(isWorldCupEvent)) {
          const id = readString(event, ["eventId", "id"]) || JSON.stringify(event).slice(0, 80);
          byId.set(id, event);
        }
      }

      return [...byId.values()].sort((a, b) => readNumber(b, ["volume"]) - readNumber(a, ["volume"]));
    },

    async getEventMarkets(eventId: string): Promise<unknown[]> {
      const payload = await request<OkxMarketsPayload>({
        baseUrl,
        credentials,
        path: `/api/v5/predictions/events/${encodeURIComponent(eventId)}/markets`
      });
      return readArray(payload, ["markets"]);
    }
  };
}

async function request<T>({
  baseUrl,
  credentials,
  path,
  query
}: {
  baseUrl: string;
  credentials: OkxOutcomesCredentials;
  path: string;
  query?: Record<string, QueryValue>;
}): Promise<T> {
  const requestPath = withQuery(path, query);
  const timestamp = new Date().toISOString();
  const method = "GET";
  const body = "";
  const signature = createHmac("sha256", credentials.apiSecret)
    .update(`${timestamp}${method}${requestPath}${body}`)
    .digest("base64");

  const response = await fetch(`${baseUrl}${requestPath}`, {
    method,
    headers: {
      "OK-ACCESS-KEY": credentials.apiKey,
      "OK-ACCESS-SIGN": signature,
      "OK-ACCESS-TIMESTAMP": timestamp,
      "OK-ACCESS-PASSPHRASE": credentials.passphrase
    },
    cache: "no-store"
  });

  const data = (await response.json().catch(() => ({}))) as OkxOutcomesResponse<T>;
  const okCode = data.code === 0 || data.code === "0";
  if (!response.ok || !okCode) {
    throw new Error(data.message || data.msg || `OKX Outcomes request failed: ${response.status}`);
  }

  return data.data as T;
}

function readCredentials(): OkxOutcomesCredentials | undefined {
  const apiKey = process.env.PREDICTIONS_API_KEY?.trim();
  const apiSecret = process.env.PREDICTIONS_API_SECRET?.trim();
  const passphrase = process.env.PREDICTIONS_API_PASSPHRASE?.trim();
  if (!apiKey || !apiSecret || !passphrase) return undefined;
  return { apiKey, apiSecret, passphrase };
}

function withQuery(path: string, query?: Record<string, QueryValue>): string {
  const params = new URLSearchParams();
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value !== undefined) params.set(key, String(value));
  });
  const serialized = params.toString();
  return serialized ? `${path}?${serialized}` : path;
}

function isWorldCupEvent(event: LooseRecord): boolean {
  const text = `${readString(event, ["eventTitle", "title", "name"]) || ""} ${readString(event, ["description"]) || ""}`.toLowerCase();
  return /(world cup|fifa|世界杯)/i.test(text);
}

function readArray(input: unknown, paths: string[]): unknown[] {
  for (const path of paths) {
    const value = readPath(input, path);
    if (Array.isArray(value)) return value;
  }
  return [];
}

function readString(input: unknown, paths: string[]): string | undefined {
  const value = readUnknown(input, paths);
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function readNumber(input: unknown, paths: string[]): number {
  const next = Number(readUnknown(input, paths));
  return Number.isFinite(next) ? next : 0;
}

function readUnknown(input: unknown, paths: string[]): unknown {
  for (const path of paths) {
    const value = readPath(input, path);
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

function readPath(input: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((value, key) => {
    if (!isRecord(value)) return undefined;
    return value[key];
  }, input);
}

function isRecord(value: unknown): value is LooseRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
