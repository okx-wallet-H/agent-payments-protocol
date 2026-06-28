import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const appPage = read("app/page.tsx");
const appStyles = read("app/styles.css");
const packageJson = JSON.parse(read("package.json"));
const checks = [];

check(appPage.includes('"/api/v2/phase-one"'), "human Agent chat posts to the real phase-one API route");
check(appPage.includes("createHumanPreviewUserId(email)"), "human Agent chat sends a stable user id to the API route");
check(appPage.includes("createHumanAgentMessageFromTurn"), "human Agent chat renders the real mobile turn result");
check(appPage.includes("card?: HumanPhaseOneCard"), "human Agent messages can carry real route cards");
check(appPage.includes("card: cardMessage.card"), "human Agent chat keeps the real mobile card payload");
check(appPage.includes("renderHumanAgentCard"), "human Agent chat renders structured cards instead of flattening everything to copy");
check(appPage.includes('card.type === "prediction_card"'), "human Agent chat has a prediction card branch");
check(appPage.includes('card.type === "receive_card"'), "human Agent chat has a receive card branch");
check(appPage.includes("shortenHumanAddress"), "human Agent receive cards avoid dumping raw long addresses into chat");
check(appPage.includes("const [agentBusy, setAgentBusy] = useState(false)"), "human Agent chat prevents duplicate in-flight sends");
check(appPage.includes("const agentRequestIdRef = useRef(0)"), "human Agent chat tracks in-flight route requests");
check(appPage.includes("agentRequestIdRef.current === requestId"), "human Agent chat ignores stale route responses");
check(appPage.includes("agentRequestIdRef.current += 1"), "new conversation invalidates older route responses");
check(appPage.includes("setMessages([nextMessage, pendingMessage])"), "human Agent chat clears old messages while waiting for the real route");
check(appPage.includes("setMessages([nextMessage, assistantMessage])"), "human Agent chat shows the API result for the current message");
check(appPage.includes("setMessages([nextMessage, errorMessage])"), "human Agent chat handles route errors without falling back to local fixtures");
check(appPage.includes("disabled={agentBusy || !draft.trim()}"), "human Agent send button is disabled while the real route runs");
check(appPage.includes('placeholder={agentBusy ? "Agent 正在整理..." : "向 Agent 发送消息"}'), "human Agent composer shows real in-flight state");
check(
  packageJson.scripts?.["smoke:human-agent-real-api-chat"] ===
    "node v2/scripts/smoke-human-agent-real-api-chat.mjs",
  "package exposes human Agent real API smoke"
);
check(
  packageJson.scripts?.["verify:merge"]?.includes("npm run smoke:human-agent-real-api-chat"),
  "merge verification includes human Agent real API smoke"
);
check(appStyles.includes(".human-agent-card"), "human Agent card styles exist");
check(appStyles.includes(".human-agent-card.prediction_card"), "prediction cards have a dedicated human style");
check(appStyles.includes(".human-agent-card.receive_card"), "receive cards have a dedicated human style");

reject(appPage, "function buildAgentReply", "human Agent chat no longer contains local fake reply builder");
reject(appPage, "setMessages([nextMessage, nextReply])", "human Agent chat no longer displays local fake replies");
reject(appPage, "我来打开你的 HWallet 收款入口。", "human Agent chat no longer fakes receive replies");
reject(appPage, "我先看市场热度和赔率，只给你观察结果。", "human Agent chat no longer fakes prediction replies");
reject(appPage, "我会刷新到账状态和可用余额。", "human Agent chat no longer fakes wallet refresh replies");
reject(appPage, "收到，我先看钱包和市场，再给你一张结果卡。", "human Agent chat no longer fakes generic replies");
reject(appPage, "setMessages((current", "human Agent chat still does not append old messages to the active screen");

console.log(
  JSON.stringify(
    {
      ok: true,
      checks
    },
    null,
    2
  )
);

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function check(condition, label) {
  if (!condition) throw new Error(`human Agent real API smoke failed: ${label}`);
  checks.push(label);
}

function reject(source, needle, label) {
  check(!source.includes(needle), label);
}
