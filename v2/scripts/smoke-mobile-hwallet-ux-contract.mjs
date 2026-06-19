import { readFile } from "node:fs/promises";

const screen = await readFile("apps/mobile/src/V2AgentWalletScreen.tsx", "utf8");
const preview = await readFile("apps/mobile/src/V2AgentWalletPreview.tsx", "utf8");
const entryState = await readFile("apps/mobile/src/hwallet-entry.ts", "utf8");
const statusSmoke = await readFile("apps/mobile/src/privy-wallet-status.smoke.ts", "utf8");
const deviceQa = await readFile("docs/HWALLET_DEVICE_MULTI_USER_QA.md", "utf8");

const checks = [];

assertIncludes(screen, 'type MainTab = "agent" | "community" | "notices" | "invite" | "worldcup" | "mine" | "wallet"', "mobile shell keeps community, notices, invite, and HWallet as separate tabs");
assertIncludes(screen, 'activeTab === "notices" || activeTab === "invite" ? "community" : activeTab === "community" ? "agent" : "community"', "top-left entry returns from community child pages to community and from community to Agent");
assertIncludes(screen, 'leftIcon={isCommunityStack ? "chevron-back" : "menu"}', "community stack changes the top-left entry into a back affordance");
assertIncludes(screen, 'rightIcon={isCommunityStack ? "chatbubble-ellipses-outline" : "person-outline"}', "community stack changes the top-right entry into a message affordance");
assertIncludes(screen, 'backgroundColor: "#ffffff"', "top bar background stays aligned with the white page shell");
assertIncludes(screen, 'activeTab === "community"', "mobile shell renders the community page from the top-left entry");
assertIncludes(screen, "function CommunityTab", "community page is implemented as its own screen");
assertIncludes(screen, 'activeTab === "notices" ? <NoticeTab /> : null', "community message entry opens the platform notice page");
assertIncludes(screen, "function NoticeTab", "platform notice page is implemented");
assertIncludes(screen, "平台通知", "notice page labels platform notifications");
assertIncludes(screen, "公告", "notice page exposes platform announcements");
assertIncludes(screen, 'activeTab === "invite" ? <InviteTab /> : null', "community invite entry opens the referral page");
assertIncludes(screen, "function InviteTab", "invite referral page is implemented");
assertIncludes(screen, "赚 20% 佣金", "invite page explains the commission offer");
assertIncludes(screen, "复制邀请链接", "invite page exposes invite link copy action");
assertIncludes(screen, 'activeTab !== "worldcup" && activeTab !== "community" && activeTab !== "notices" && activeTab !== "invite"', "community child pages hide the bottom menu");
assertIncludes(screen, "communityMemberLine", "community page shows compact member identity");
assertIncludes(screen, "communityNicknameRow", "community page shows an edit affordance next to the nickname");
assertIncludes(screen, "startNicknameEdit", "community nickname edit affordance enters edit mode");
assertIncludes(screen, "communityNicknameInput", "community nickname can be edited inline");
assertIncludes(screen, "saveNickname", "community nickname edit has a save action");
assertIncludes(screen, 'accessibilityLabel="保存昵称"', "community nickname save action is accessible");
assertIncludes(preview, "startNicknameEdit", "web preview nickname edit affordance enters edit mode");
assertIncludes(preview, "communityNicknameInput", "web preview nickname can be edited inline");
assertIncludes(preview, "saveNickname", "web preview nickname edit has a save action");
assertIncludes(preview, 'accessibilityLabel="保存昵称"', "web preview nickname save action is accessible");
assert(!screen.includes("communitySearchPill"), "community page removes the redundant internal search button");
assertIncludes(screen, "communityCarousel", "community page shows a colorful carousel below the member panel");
assertIncludes(screen, "snapToInterval={communityCarouselSnap}", "community carousel snaps between cards while swiping");
assertIncludes(screen, "communityCarouselDots", "community carousel exposes visible page dots");
assertIncludes(screen, "communityEntryList", "community page uses a vertical entry list");
assertIncludes(screen, "communityFloatingNewChat", "community page keeps new chat as a floating action instead of a clipped list item");
assertIncludes(screen, "海豚会员", "community page shows a member nickname");
assertIncludes(screen, "VIP 进度", "community page shows VIP progress");
assertIncludes(screen, "邀请好友", "community page exposes invite entry");
assertIncludes(screen, "卡库", "community page exposes card library entry");
assertIncludes(screen, "发现", "community page exposes discovery entry");
assertIncludes(screen, "对话记录", "community page exposes conversation records");
assertIncludes(screen, "新会话", "community page exposes a new-chat action at the bottom of records");
assertIncludes(screen, 'label="发现"', "bottom nav keeps discovery tab separate from HWallet");
assertIncludes(screen, '<Text style={styles.hMarkText}>H</Text>', "bottom nav exposes HWallet through the H entry");
assertIncludes(screen, 'onWallet={() => setActiveTab("wallet")}', "H entry opens the HWallet tab");
checks.push("navigation keeps community, Agent, market, discovery, and HWallet boundaries");

assertIncludes(screen, 'Alert.alert("切换账号"', "account switch uses a confirmation sheet");
assertIncludes(screen, 'text: "退出"', "account switch confirmation exposes logout action");
assertIncludes(screen, 'void run(logout)', "account switch action calls Privy logout");
assertIncludes(screen, 'accessibilityLabel="切换 HWallet 账号"', "HWallet switch button is accessible");
checks.push("HWallet account switch and logout are wired");

assertIncludes(screen, 'accessibilityLabel="复制 HWallet 收款地址"', "HWallet receive address has an accessible copy button");
assertIncludes(screen, 'addressCopied ? "已复制" : "复制地址"', "HWallet copy button changes label after copy");
assertIncludes(screen, 'accessibilityLiveRegion="polite"', "HWallet copy feedback is announced politely");
assertIncludes(screen, '收款地址已复制。转入后点刷新到账，Agent 会识别可用资金。', "HWallet page shows human copy feedback");
assertIncludes(screen, '地址已复制，转入后 Agent 会自动识别资金。', "Agent receive card shows copy feedback");
assertIncludes(screen, 'label="刷新到账"', "HWallet action strip exposes refresh-deposit as the main recognition path");
assertIncludes(screen, 'label="哈希"', "HWallet action strip keeps transaction hash as a short secondary action");
assertOrder(screen, 'label="刷新到账"', 'label="哈希"', "refresh-deposit action appears before hash verification");
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
assertIncludes(screen, "刷新到账状态", "manual refresh remains available without a transaction hash");
checks.push("hash verification remains optional, not required for normal receive flow");

assertIncludes(deviceQa, "## Installed-App Regression Gate", "device QA includes installed-app regression gate");
assertIncludes(deviceQa, "Confirm the App does not crash or return to the launcher.", "device QA checks no-crash HWallet render");
assertIncludes(deviceQa, "Confirm User B receives a different short HWallet address than User A.", "device QA checks distinct user receive addresses");
assertIncludes(deviceQa, "Switch back to User A and confirm User A's original HWallet address returns.", "device QA checks switch-back address restore");
assertIncludes(deviceQa, "Copy feedback is visible before any transaction hash check.", "device QA checks copy feedback before hash check");
assertIncludes(deviceQa, "`刷新到账` is the normal deposit recognition action.", "device QA makes refresh-deposit the normal path");
assertIncludes(deviceQa, "刷新到账不需要交易哈希。", "device QA states refresh does not require hash");
assertIncludes(deviceQa, "The transaction hash check remains optional", "device QA keeps hash verification optional");
checks.push("installed-app regression gate captures no-crash switching, distinct addresses, and copy feedback");

console.log(JSON.stringify({
  ok: true,
  checks
}, null, 2));

function assertIncludes(source, needle, label) {
  assert(source.includes(needle), label);
}

function assertOrder(source, first, second, label) {
  const firstIndex = source.indexOf(first);
  const secondIndex = source.indexOf(second);
  assert(firstIndex !== -1 && secondIndex !== -1 && firstIndex < secondIndex, label);
}

function assert(condition, label) {
  if (!condition) throw new Error(`Mobile HWallet UX contract smoke failed: ${label}`);
}
