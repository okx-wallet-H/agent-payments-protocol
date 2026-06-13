import type { MarketSnapshot } from "../domain/types";

type LooseRecord = Record<string, unknown>;

export interface OkxOutcomesNormalizeResult {
  eventsSeen: number;
  marketsSeen: number;
  markets: MarketSnapshot[];
  skipped: Array<{
    reason: string;
    value: unknown;
  }>;
}

export function normalizeOkxOutcomes(input: unknown): OkxOutcomesNormalizeResult {
  const events = readArray(input, ["events", "data.events", "result.events"]);
  const markets = readArray(input, ["markets", "data.markets", "result.markets"]);

  if (events.length > 0) {
    return normalizeEvents(events);
  }

  return normalizeMarkets(markets);
}

export function normalizeOkxOutcomeMarket(input: unknown, inheritedEvent?: LooseRecord): MarketSnapshot | undefined {
  if (!isRecord(input)) return undefined;

  const marketId = readString(input, ["marketId", "market_id", "id"]);
  const question = readString(input, ["question", "marketTitle", "market_title", "title", "name"]);
  if (!marketId || !question) return undefined;

  const status = readString(input, ["status", "state", "marketStatus", "market_status"]);
  const outcomes = readOutcomes(input);
  const yes = outcomes.find((outcome) => isYes(outcome.name));
  const no = outcomes.find((outcome) => isNo(outcome.name));
  const yesAssetId = readString(yes?.raw, ["assetId", "asset_id", "instId", "inst_id"]);
  const noAssetId = readString(no?.raw, ["assetId", "asset_id", "instId", "inst_id"]);
  const eventId = readString(input, ["eventId", "event_id"]) || readString(inheritedEvent, ["eventId", "event_id", "id"]);

  return {
    provider: "okx-outcomes",
    chainId: 196,
    eventId,
    marketId,
    question,
    status,
    marketType: readString(input, ["marketType", "market_type", "type"]),
    yesAssetId,
    noAssetId,
    yesPrice: parsePrice(readUnknown(yes?.raw, ["price", "last", "lastPrice", "last_price", "probability"])),
    noPrice: parsePrice(readUnknown(no?.raw, ["price", "last", "lastPrice", "last_price", "probability"])),
    acceptingOrders: status === "active" && Boolean(yesAssetId || noAssetId),
    liquidity: parseNumber(readUnknown(input, ["liquidity", "liquidityUsd", "liquidity_usd"])),
    volume24h: parseNumber(readUnknown(input, ["volume24h", "volume_24h", "volume24Hr", "volume_24hr"])),
    volume: parseNumber(readUnknown(input, ["volume", "totalVolume", "total_volume"])),
    startTime:
      readString(input, [
        "startTime",
        "start_time",
        "matchTime",
        "match_time",
        "gameTime",
        "game_time",
        "scheduledTime",
        "scheduled_time"
      ]) ||
      readString(inheritedEvent, [
        "startTime",
        "start_time",
        "matchTime",
        "match_time",
        "gameTime",
        "game_time",
        "scheduledTime",
        "scheduled_time"
      ]),
    endDate: readString(input, ["endDate", "end_date", "closeTime", "close_time", "endTime", "end_time"]),
    raw: input
  };
}

export function pickBestOkxWorldCupMarket(markets: MarketSnapshot[]): MarketSnapshot | undefined {
  return markets
    .filter((market) => market.provider === "okx-outcomes" && market.acceptingOrders)
    .sort((a, b) => scoreMarket(b) - scoreMarket(a))[0];
}

function normalizeEvents(events: unknown[]): OkxOutcomesNormalizeResult {
  const normalized: MarketSnapshot[] = [];
  const skipped: OkxOutcomesNormalizeResult["skipped"] = [];
  let marketsSeen = 0;

  for (const event of events) {
    if (!isRecord(event)) {
      skipped.push({ reason: "event_not_object", value: event });
      continue;
    }

    const markets = readArray(event, ["markets", "marketList", "market_list"]);
    marketsSeen += markets.length;
    for (const market of markets) {
      const normalizedMarket = normalizeOkxOutcomeMarket(market, event);
      if (normalizedMarket) normalized.push(normalizedMarket);
      else skipped.push({ reason: "market_missing_required_fields", value: market });
    }
  }

  return {
    eventsSeen: events.length,
    marketsSeen,
    markets: normalized,
    skipped
  };
}

function normalizeMarkets(markets: unknown[]): OkxOutcomesNormalizeResult {
  const normalized: MarketSnapshot[] = [];
  const skipped: OkxOutcomesNormalizeResult["skipped"] = [];

  for (const market of markets) {
    const normalizedMarket = normalizeOkxOutcomeMarket(market);
    if (normalizedMarket) normalized.push(normalizedMarket);
    else skipped.push({ reason: "market_missing_required_fields", value: market });
  }

  return {
    eventsSeen: 0,
    marketsSeen: markets.length,
    markets: normalized,
    skipped
  };
}

function readOutcomes(market: LooseRecord): Array<{ name: string; raw: LooseRecord }> {
  const direct = readArray(market, ["outcomes", "outcomeList", "outcome_list"]);
  const fromDirect = direct
    .filter(isRecord)
    .map((outcome) => ({
      name: readString(outcome, ["name", "outcome", "side", "label"]) || "",
      raw: outcome
    }));

  const yesOutcome = readUnknown(market, ["yesOutcome", "yes_outcome", "yes"]);
  const noOutcome = readUnknown(market, ["noOutcome", "no_outcome", "no"]);

  return [
    ...fromDirect,
    ...(isRecord(yesOutcome) ? [{ name: "YES", raw: yesOutcome }] : []),
    ...(isRecord(noOutcome) ? [{ name: "NO", raw: noOutcome }] : [])
  ];
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

function parseNumber(value: unknown): number | undefined {
  const next = Number(value);
  return Number.isFinite(next) ? next : undefined;
}

function parsePrice(value: unknown): number | undefined {
  const next = parseNumber(value);
  if (next === undefined) return undefined;
  if (next > 1 && next <= 100) return next / 100;
  return next;
}

function isRecord(value: unknown): value is LooseRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isYes(value: string): boolean {
  return ["yes", "y", "会"].includes(value.trim().toLowerCase());
}

function isNo(value: string): boolean {
  return ["no", "n", "不会"].includes(value.trim().toLowerCase());
}

function scoreMarket(market: MarketSnapshot): number {
  const volume = market.volume24h || market.volume || 0;
  const liquidity = market.liquidity || 0;
  const hasTradeableAsset = market.yesAssetId || market.noAssetId ? 1 : 0;
  return Math.log10(1 + volume) + Math.log10(1 + liquidity) + hasTradeableAsset;
}
