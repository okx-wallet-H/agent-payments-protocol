import { readFile } from "node:fs/promises";

const screen = await readFile("apps/mobile/src/V2AgentWalletScreen.tsx", "utf8");
const entryState = await readFile("apps/mobile/src/hwallet-entry.ts", "utf8");
const statusSmoke = await readFile("apps/mobile/src/privy-wallet-status.smoke.ts", "utf8");
const deviceQa = await readFile("docs/HWALLET_DEVICE_MULTI_USER_QA.md", "utf8");

const checks = [];

assertIncludes(screen, 'type MainTab = "agent" | "worldcup" | "mine" | "wallet"', "mobile shell keeps HWallet as its own tab");
assertIncludes(screen, 'label="发现"', "bottom nav keeps discovery tab separate from HWallet");
assertIncludes(screen, '<Text style={styles.hMarkText}>H</Text>', "bottom nav exposes HWallet through the H entry");
assertIncludes(screen, 'onWallet={() => setActiveTab("wallet")}', "H entry opens the HWallet tab");
checks.push("bottom navigation keeps Agent, market, discovery, and HWallet boundaries");

assertIncludes(screen, 'Alert.alert("切换账号"', "account switch uses a confirmation sheet");
assertIncludes(screen, 'text: "退出"', "account switch confirmation exposes logout action");
assertIncludes(screen, 'void run(logout)', "account switch action calls Privy logout");
assertIncludes(screen, 'accessibilityLabel="切换 HWallet 账号"', "HWallet switch button is accessible");
checks.push("HWallet account switch and logout are wired");

assertIncludes(screen, 'accessibilityLabel="复制 HWallet 收款地址"', "HWallet receive address has an accessible copy button");
assertIncludes(screen, 'addressCopied ? "已复制" : "复制地址"', "HWallet copy button changes label after copy");
assertIncludes(screen, 'accessibilityLiveRegion="polite"', "HWallet copy feedback is announced politely");
assertIncludes(screen, '收款地址已复制，可以去交易所或钱包转入。', "HWallet page shows human copy feedback");
assertIncludes(screen, '地址已复制，转入后 Agent 会自动识别资金。', "Agent receive card shows copy feedback");
checks.push("receive-address copy feedback is visible and accessible");

assertIncludes(screen, "const displayAddress = entryState.displayAddress", "HWallet page renders the current entry display address");
assertIncludes(screen, "const canUseReceiveAddress = entryState.canUseReceiveAddress", "HWallet page gates receive actions on usable wallet state");
assertIncludes(screen, "disabled={!canUseReceiveAddress}", "HWallet copy button disables before wallet is usable");
assertIncludes(entryState, 'const isSignedOut = input.privyStatus.kind === "signed_out"', "entry state detects signed-out sessions");
assertIncludes(entryState, "displayAddress = isSignedOut", "entry state hides stale addresses after sign-out");
assertIncludes(statusSmoke, "signed-out HWallet entry hides stale wallet address", "status smoke protects stale-address hiding");
checks.push("signed-out and pending wallet states cannot expose stale receive addresses");

assertIncludes(screen, "高级核对", "transaction hash check stays secondary");
assertIncludes(screen, "到账会自动识别，哈希只用来核对单笔。", "hash check explains it is optional");
assertIncludes(screen, "showTxCheck", "hash check stays collapsed unless opened");
checks.push("hash verification remains optional, not required for normal receive flow");

assertIncludes(deviceQa, "## Installed-App Regression Gate", "device QA includes installed-app regression gate");
assertIncludes(deviceQa, "Confirm the App does not crash or return to the launcher.", "device QA checks no-crash HWallet render");
assertIncludes(deviceQa, "Confirm User B receives a different short HWallet address than User A.", "device QA checks distinct user receive addresses");
assertIncludes(deviceQa, "Switch back to User A and confirm User A's original HWallet address returns.", "device QA checks switch-back address restore");
assertIncludes(deviceQa, "Copy feedback is visible before any transaction hash check.", "device QA checks copy feedback before hash check");
assertIncludes(deviceQa, "The transaction hash check remains optional", "device QA keeps hash verification optional");
checks.push("installed-app regression gate captures no-crash switching, distinct addresses, and copy feedback");

console.log(JSON.stringify({
  ok: true,
  checks
}, null, 2));

function assertIncludes(source, needle, label) {
  assert(source.includes(needle), label);
}

function assert(condition, label) {
  if (!condition) throw new Error(`Mobile HWallet UX contract smoke failed: ${label}`);
}
