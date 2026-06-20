import { readFileSync } from "node:fs";

import { handlePhaseOneUserText } from "../agent/conversation-turn.ts";
import { createAgentOrchestrationPlan } from "../agent/orchestrator.ts";
import { resolveReceiveWalletAddress } from "../wallet/receive-wallet.ts";
import { createAgentWalletContext, createWalletKnowledgeNotes } from "../wallet/wallet-orchestrator.ts";

const removedDefaultAddress = ["0x65a92c1c5da328ae028e80c4fb2bfb", "223f652669"].join("");
const receiveWalletSource = readFileSync(new URL("../wallet/receive-wallet.ts", import.meta.url), "utf8");
const walletOrchestratorSource = readFileSync(new URL("../wallet/wallet-orchestrator.ts", import.meta.url), "utf8");

assert(!receiveWalletSource.includes(["DEFAULT_PHASE_ONE", "WALLET_ADDRESS"].join("_")), "receive wallet source should not declare a default address");
assert(!receiveWalletSource.includes(removedDefaultAddress), "receive wallet source should not contain the old fixed address");
assert(!walletOrchestratorSource.includes(["demo", "fallback"].join("_")), "wallet orchestration should not expose demo fallback status");
assert(resolveReceiveWalletAddress() === undefined, "empty receive address resolution should stay empty");
assert(resolveReceiveWalletAddress("not-an-address") === undefined, "invalid receive address resolution should stay empty");

const waitingWallet = createAgentWalletContext({
  userId: "hwallet-waiting-user"
});
assert(waitingWallet.status === "waiting", "wallet without address should wait for real HWallet address");
assert(waitingWallet.receiveAddress === undefined, "wallet without address should not expose a receive address");
assert(waitingWallet.statusText.includes("正在生成"), "waiting wallet should explain address generation");
assert(!waitingWallet.statusText.includes(["演示", "地址"].join("")), "waiting wallet should not mention demo address");
assert(!JSON.stringify(waitingWallet).includes(removedDefaultAddress), "waiting wallet payload should not contain the old fixed address");

const waitingNotes = createWalletKnowledgeNotes(waitingWallet).join("\n");
assert(waitingNotes.includes("等待 HWallet 生成"), "waiting wallet notes should record an explicit wait state");
assert(!waitingNotes.includes("0x"), "waiting wallet notes should not leak a fake address");

const waitingReceiveTurn = handlePhaseOneUserText({
  userText: "我要充值",
  goalType: "wallet_receive"
});
assert(waitingReceiveTurn.goal.type === "wallet_receive", "waiting receive turn should keep receive intent");
assert(waitingReceiveTurn.cards.length === 0, "waiting receive turn should not render a receive card");
assert(waitingReceiveTurn.finalText?.includes("正在生成"), "waiting receive turn should explain that HWallet is generating");

const waitingPlan = await createAgentOrchestrationPlan({
  userText: "我要充值",
  wallet: waitingWallet
});
assert(waitingPlan.action === "show_receive_address", "receive intent should still route to address flow");
assert(waitingPlan.capability.walletReady === false, "waiting wallet should not be considered ready");
assert(waitingPlan.capability.onchainSkill.status === "not_needed", "receive address flow should not call onchain skill");
assert(waitingPlan.capability.liveExecution.enabled === false, "waiting wallet should keep live execution closed");

const realAddress = "0x1111111111111111111111111111111111111111";
const hiddenStrategyAddress = "0x2222222222222222222222222222222222222222";
const readyWallet = createAgentWalletContext({
  userId: "hwallet-ready-user",
  walletAddress: realAddress
});
assert(readyWallet.status === "ready", "wallet with a valid address should be ready");
assert(readyWallet.receiveAddress === realAddress, "ready wallet should expose the supplied address");

const readyNotes = createWalletKnowledgeNotes(readyWallet).join("\n");
assert(readyNotes.includes(realAddress), "ready wallet notes should include the real receive address");
assert(!readyNotes.includes(removedDefaultAddress), "ready wallet notes should not include the old fixed address");

const readyReceiveTurn = handlePhaseOneUserText({
  userText: "我要充值",
  xLayerAddress: realAddress,
  polygonAddress: hiddenStrategyAddress,
  goalType: "wallet_receive"
});
const receiveCard = readyReceiveTurn.cards[0];
assert(receiveCard?.type === "receive_card", "ready receive turn should render a receive card");
assert(receiveCard.addresses.length === 1, "receive card should expose exactly one user-facing address");
assert(receiveCard.addresses[0].address === realAddress, "receive card should expose only the real X Layer address");
assert(!receiveCard.addresses.some((item) => item.address === hiddenStrategyAddress), "receive card should hide strategy address");

console.log(JSON.stringify({
  ok: true,
  checks: [
    "fixed receive-address fallback removed",
    "missing HWallet address stays waiting",
    "waiting state does not leak an address into Agent memory",
    "receive card is blocked until a real address exists",
    "ready wallet still exposes exactly one X Layer receive address"
  ],
  waitingStatus: waitingWallet.status,
  readyStatus: readyWallet.status,
  receiveAddressCount: receiveCard.addresses.length,
  liveExecutionEnabled: waitingPlan.capability.liveExecution.enabled
}, null, 2));

function assert(condition, label) {
  if (!condition) throw new Error(`HWallet receive-address boundary smoke failed: ${label}`);
}
