import { createDefaultAgentPolicy, evaluateAgentPolicy } from "../agent/policy.ts";

const policy = createDefaultAgentPolicy();
const market = {
  provider: "okx-outcomes",
  chainId: 196,
  marketId: "worldcup-spain",
  question: "西班牙会赢得 2026 年世界杯冠军吗？",
  acceptingOrders: true
};

const track = evaluateAgentPolicy({ action: "track", market, policy });
assert(track.status === "allow", "track is allowed");

const simulate = evaluateAgentPolicy({ action: "simulate", market, amountUsd: 10, policy });
assert(simulate.status === "allow", "small simulation is allowed");

const largeSimulation = evaluateAgentPolicy({ action: "simulate", market, amountUsd: 101, policy });
assert(largeSimulation.status === "block", "large simulation is blocked");

const execute = evaluateAgentPolicy({ action: "execute", market, policy });
assert(execute.status === "block", "live execution is blocked");

const wrongChain = evaluateAgentPolicy({
  action: "track",
  market: {
    ...market,
    chainId: 1
  },
  policy
});
assert(wrongChain.status === "block", "unsupported chain is blocked");

console.log(JSON.stringify({
  ok: true,
  checks: ["track allowed", "simulation allowed", "large simulation blocked", "execute blocked", "wrong chain blocked"],
  liveExecutionEnabled: policy.liveExecutionEnabled
}, null, 2));

function assert(condition, label) {
  if (!condition) throw new Error(`Agent policy smoke failed: ${label}`);
}
