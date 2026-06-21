import { createWorldCupExploreView } from "../app/world-cup-explore.ts";

const checks = [];
const emptyView = createWorldCupExploreView([]);

check(emptyView.source.provider === "okx-outcomes", "default view keeps OKX Outcomes as the real provider boundary");
check(emptyView.source.mode === "unavailable", "default view is unavailable instead of sample");
check(emptyView.source.providerStatus === "unavailable", "default view reports unavailable provider status");
check(emptyView.source.credentialsBound === false, "default view does not imply credentials are bound");
check(emptyView.summary.totalMarkets === 0, "default view does not return sample markets");
check(Object.values(emptyView.cards).every((cards) => cards.length === 0), "default view has no sample cards");
check(!emptyView.source.message.includes("样例"), "default view message does not present sample data");

console.log(JSON.stringify({
  ok: true,
  checks,
  source: emptyView.source,
  summary: emptyView.summary
}, null, 2));

function check(condition, label) {
  if (!condition) throw new Error(`World Cup explore default boundary smoke failed: ${label}`);
  checks.push(label);
}
