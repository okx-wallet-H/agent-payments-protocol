import { NextResponse } from "next/server";
import { createWorldCupExploreView } from "@/v2/app/world-cup-explore";
import {
  capturePredictionMarketSnapshotsSafely,
  readPredictionExploreData,
  readPredictionExploreMode
} from "@/v2/app/prediction-explore-data";
import { guardPredictionReadRequest } from "@/v2/auth/prediction-read-guard";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const guard = await guardPredictionReadRequest(request, { route: "prediction-explore" });
  if (!guard.ok) {
    return NextResponse.json(guard.body, {
      status: guard.status,
      headers: guard.headers
    });
  }

  const data = await readPredictionExploreData(readPredictionExploreMode(request));
  await capturePredictionMarketSnapshotsSafely(data);

  return NextResponse.json(
    {
      explore: createWorldCupExploreView(data.markets, data.source)
    },
    {
      headers: guard.headers
    }
  );
}
