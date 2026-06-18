import { createHmac } from "node:crypto";
import type { MarketSnapshot } from "../domain/types";
import { normalizeOkxOutcomeMarket, normalizeOkxOutcomes } from "./okx-outcomes-output";

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

export interface OkxOutcomeTicker {
  instId: string;
  last?: number;
  bid?: number;
  ask?: number;
  volume24h?: number;
  timestamp?: string;
  raw: unknown;
}

export interface OkxOutcomeCandle {
  instId: string;
  timestamp: string;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  raw: unknown;
}

export interface OkxOutcomeOrderBookLevel {
  price: number;
  size: number;
}

export interface OkxOutcomeOrderBook {
  instId: string;
  bids: OkxOutcomeOrderBookLevel[];
  asks: OkxOutcomeOrderBookLevel[];
  timestamp?: string;
  raw: unknown;
}

export interface OkxOutcomeMarketData {
  marketId: string;
  market?: MarketSnapshot;
  yesTicker?: OkxOutcomeTicker;
  noTicker?: OkxOutcomeTicker;
  yesCandles?: OkxOutcomeCandle[];
  noCandles?: OkxOutcomeCandle[];
  yesOrderBook?: OkxOutcomeOrderBook;
  noOrderBook?: OkxOutcomeOrderBook;
}

export interface OkxOutcomeMarketDataOptions {
  includeCandles?: boolean;
  includeOrderBook?: boolean;
  candleBar?: string;
  candleLimit?: number;
  bookSize?: number;
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

export async function getOkxOutcomeMarket(marketId: string): Promise<MarketSnapshot | undefined> {
  const client = createOkxOutcomesClient();
  return normalizeOkxOutcomeMarket(await client.getMarket(marketId));
}

export async function getOkxOutcomeMarketData(
  marketId: string,
  options: OkxOutcomeMarketDataOptions = {}
): Promise<OkxOutcomeMarketData> {
  const client = createOkxOutcomesClient();
  const market = normalizeOkxOutcomeMarket(await client.getMarket(marketId));
  const output: OkxOutcomeMarketData = { marketId, market };
  const candleOptions = {
    bar: options.candleBar || "15m",
    limit: options.candleLimit || 48
  };
  const bookSize = options.bookSize || 40;

  await Promise.all([
    enrichOutcomeSide({
      instId: market?.yesAssetId,
      setTicker: (ticker) => {
        output.yesTicker = ticker;
      },
      setCandles: (candles) => {
        output.yesCandles = candles;
      },
      setOrderBook: (book) => {
        output.yesOrderBook = book;
      },
      client,
      candleOptions,
      bookSize,
      includeCandles: Boolean(options.includeCandles),
      includeOrderBook: Boolean(options.includeOrderBook)
    }),
    enrichOutcomeSide({
      instId: market?.noAssetId,
      setTicker: (ticker) => {
        output.noTicker = ticker;
      },
      setCandles: (candles) => {
        output.noCandles = candles;
      },
      setOrderBook: (book) => {
        output.noOrderBook = book;
      },
      client,
      candleOptions,
      bookSize,
      includeCandles: Boolean(options.includeCandles),
      includeOrderBook: Boolean(options.includeOrderBook)
    })
  ]);

  return output;
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
    },

    async getMarket(marketId: string): Promise<unknown> {
      const payload = await request<unknown>({
        baseUrl,
        credentials,
        path: `/api/v5/predictions/markets/${encodeURIComponent(marketId)}`
      });
      return firstPayloadItem(payload);
    },

    async getTicker(instId: string): Promise<OkxOutcomeTicker | undefined> {
      const payload = await request<unknown>({
        baseUrl,
        credentials,
        path: "/api/v5/market/ticker",
        query: { instId }
      });
      return normalizeTicker(firstPayloadItem(payload), instId);
    },

    async getCandles(
      instId: string,
      options: { bar?: string; after?: string; before?: string; limit?: number } = {}
    ): Promise<OkxOutcomeCandle[]> {
      const payload = await request<unknown>({
        baseUrl,
        credentials,
        path: "/api/v5/market/candles",
        query: {
          instId,
          bar: options.bar,
          after: options.after,
          before: options.before,
          limit: options.limit
        }
      });
      return readArray(payload, ["candles", "data", "items"]).map((item) => normalizeCandle(item, instId)).filter(isDefined);
    },

    async getOrderBook(instId: string, size = 40): Promise<OkxOutcomeOrderBook | undefined> {
      const payload = await request<unknown>({
        baseUrl,
        credentials,
        path: "/api/v5/market/pm-books",
        query: { instId, sz: size }
      });
      return normalizeOrderBook(firstPayloadItem(payload), instId);
    }
  };
}

type OkxOutcomesClient = ReturnType<typeof createOkxOutcomesClient>;

async function enrichOutcomeSide({
  instId,
  setTicker,
  setCandles,
  setOrderBook,
  client,
  candleOptions,
  bookSize,
  includeCandles,
  includeOrderBook
}: {
  instId?: string;
  setTicker: (ticker: OkxOutcomeTicker) => void;
  setCandles: (candles: OkxOutcomeCandle[]) => void;
  setOrderBook: (book: OkxOutcomeOrderBook) => void;
  client: OkxOutcomesClient;
  candleOptions: { bar: string; limit: number };
  bookSize: number;
  includeCandles: boolean;
  includeOrderBook: boolean;
}): Promise<void> {
  if (!instId) return;

  const [ticker, candles, orderBook] = await Promise.all([
    client.getTicker(instId).catch(() => undefined),
    includeCandles ? client.getCandles(instId, candleOptions).catch(() => []) : Promise.resolve([]),
    includeOrderBook ? client.getOrderBook(instId, bookSize).catch(() => undefined) : Promise.resolve(undefined)
  ]);

  if (ticker) setTicker(ticker);
  if (candles.length > 0) setCandles(candles);
  if (orderBook) setOrderBook(orderBook);
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
  if (Array.isArray(input)) return input;
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

function firstPayloadItem(input: unknown): unknown {
  const direct = readArray(input, ["data", "markets", "items"]);
  if (direct.length > 0) return direct[0];
  if (Array.isArray(input)) return input[0];
  return input;
}

function normalizeTicker(input: unknown, fallbackInstId: string): OkxOutcomeTicker | undefined {
  if (!isRecord(input)) return undefined;
  const instId = readString(input, ["instId", "inst_id", "assetId", "asset_id"]) || fallbackInstId;
  return {
    instId,
    last: readOptionalNumber(input, ["last", "lastPx", "last_px", "lastPrice", "last_price", "price"]),
    bid: readOptionalNumber(input, ["bidPx", "bid_px", "bestBid", "best_bid", "bid"]),
    ask: readOptionalNumber(input, ["askPx", "ask_px", "bestAsk", "best_ask", "ask"]),
    volume24h: readOptionalNumber(input, ["vol24h", "vol_24h", "volume24h", "volume_24h", "volume"]),
    timestamp: readString(input, ["ts", "timestamp", "time"]),
    raw: input
  };
}

function normalizeCandle(input: unknown, instId: string): OkxOutcomeCandle | undefined {
  if (Array.isArray(input)) {
    const timestamp = readString(input, ["0"]);
    if (!timestamp) return undefined;
    return {
      instId,
      timestamp,
      open: parseNumber(input[1]),
      high: parseNumber(input[2]),
      low: parseNumber(input[3]),
      close: parseNumber(input[4]),
      volume: parseNumber(input[5]),
      raw: input
    };
  }

  if (!isRecord(input)) return undefined;
  const timestamp = readString(input, ["ts", "timestamp", "time", "startTime", "start_time"]);
  if (!timestamp) return undefined;
  return {
    instId: readString(input, ["instId", "inst_id", "assetId", "asset_id"]) || instId,
    timestamp,
    open: readOptionalNumber(input, ["open", "o"]),
    high: readOptionalNumber(input, ["high", "h"]),
    low: readOptionalNumber(input, ["low", "l"]),
    close: readOptionalNumber(input, ["close", "c", "last"]),
    volume: readOptionalNumber(input, ["volume", "vol", "v"]),
    raw: input
  };
}

function normalizeOrderBook(input: unknown, instId: string): OkxOutcomeOrderBook | undefined {
  if (!isRecord(input)) return undefined;
  const bids = readBookLevels(readArray(input, ["bids", "bid"]));
  const asks = readBookLevels(readArray(input, ["asks", "ask"]));
  if (bids.length === 0 && asks.length === 0) return undefined;

  return {
    instId: readString(input, ["instId", "inst_id", "assetId", "asset_id"]) || instId,
    bids,
    asks,
    timestamp: readString(input, ["ts", "timestamp", "time"]),
    raw: input
  };
}

function readBookLevels(levels: unknown[]): OkxOutcomeOrderBookLevel[] {
  return levels
    .map((level) => {
      if (Array.isArray(level)) {
        return {
          price: parseNumber(level[0]),
          size: parseNumber(level[1])
        };
      }

      if (isRecord(level)) {
        return {
          price: readOptionalNumber(level, ["price", "px", "p"]),
          size: readOptionalNumber(level, ["size", "sz", "qty", "quantity"])
        };
      }

      return undefined;
    })
    .filter((level): level is OkxOutcomeOrderBookLevel => {
      if (!level) return false;
      return level.price !== undefined && level.size !== undefined;
    });
}

function readOptionalNumber(input: unknown, paths: string[]): number | undefined {
  return parseNumber(readUnknown(input, paths));
}

function parseNumber(value: unknown): number | undefined {
  const next = Number(value);
  return Number.isFinite(next) ? next : undefined;
}

function readPath(input: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((value, key) => {
    if (Array.isArray(value) && /^\d+$/.test(key)) return value[Number(key)];
    if (!isRecord(value)) return undefined;
    return value[key];
  }, input);
}

function isRecord(value: unknown): value is LooseRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}
