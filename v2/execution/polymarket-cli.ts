import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { MarketSnapshot } from "../domain/types";
import { mapPolymarketMarkets, pickBestWorldCupMarket } from "./polymarket-output";

const execFileAsync = promisify(execFile);

export async function listWorldCupMarkets(limit = 8): Promise<MarketSnapshot[]> {
  const { stdout } = await execFileAsync("polymarket-plugin", [
    "list-markets",
    "--keyword",
    "World Cup",
    "--limit",
    String(limit)
  ], {
    timeout: 30_000,
    maxBuffer: 1024 * 1024
  });

  return mapPolymarketMarkets(JSON.parse(stdout));
}

export async function getWorldCupCandidateMarket(): Promise<MarketSnapshot | undefined> {
  const markets = await listWorldCupMarkets(8);
  return pickBestWorldCupMarket(markets);
}
