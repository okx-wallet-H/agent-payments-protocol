import { readFile } from "node:fs/promises";

const screen = await readFile("apps/mobile/src/V2AgentWalletScreen.tsx", "utf8");
const preview = await readFile("apps/mobile/src/V2AgentWalletPreview.tsx", "utf8");
const app = await readFile("apps/mobile/App.tsx", "utf8");
const webPage = await readFile("app/page.tsx", "utf8");
const webStyles = await readFile("app/styles.css", "utf8");
const webHumanPreview = sliceBetween(webPage, "function MobileHumanLoginPreview", "function AgentWalletHome");

const checks = [];

assertIncludes(screen, "KeyboardAvoidingView", "real mobile login protects input from keyboard overlap");
assertIncludes(screen, "styles.loginScrollContent", "real mobile login scrolls when keyboard is open");
assertIncludes(screen, 'const appIcon = require("../assets/icon.png")', "real mobile login uses the app icon as a brand asset");
assertIncludes(screen, "<Text style={styles.loginTitle}>海豚，开门</Text>", "real mobile login uses a short product-first title");
assertIncludes(screen, "<Text style={styles.loginSubtitle}>你的 Agent 已就位。</Text>", "real mobile login keeps copy concise");
assertIncludes(screen, "getLoginStatusText(state.status)", "real mobile login maps SDK status to friendly copy");
assertNotIncludes(screen, "<Text style={styles.loginState}>{state.status}</Text>", "real mobile login does not show raw SDK status");
assertIncludes(screen, "disabled={!canSendLoginCode}", "send-code button is disabled until email is present");
assertIncludes(screen, "disabled={!canSubmitLoginCode}", "enter button is disabled until email and code are present");
assertIncludes(screen, 'type LoginStep = "email" | "code"', "real mobile login separates email entry from verification-code lock");
assertIncludes(screen, "keyboardVerticalOffset={Platform.OS === \"ios\" ? 16 : 0}", "real mobile login offsets content above the iOS keyboard");
assertIncludes(screen, "onPress={() => run(requestLoginCode)}", "email entry button sends the verification code before showing the lock");
assertNotIncludes(screen, "styles.loginInlineCodeButton", "code lock does not show a second send-code row");
assertNotIncludes(screen, "styles.loginBackButton", "code lock hides the email row after code is sent");
assertIncludes(screen, "styles.loginKeypad", "real mobile login exposes a numeric lock keypad");
assertIncludes(screen, "normalizeOtpCode(`${current}${digit}`)", "real mobile login sanitizes numeric lock input");
checks.push("real mobile login is brand-led, keyboard-safe, lock-only after email entry, and hides SDK internals");

assertIncludes(preview, "styles.previewLogin", "web preview login uses the same scrollable shell");
assertIncludes(preview, 'const appIcon = require("../assets/icon.png")', "web preview login uses the same app icon");
assertIncludes(preview, "<Text style={styles.previewLoginTitle}>海豚，开门</Text>", "web preview login matches the real login title");
assertIncludes(preview, "styles.previewLoginCard", "web preview login keeps the same card structure");
assertIncludes(preview, 'previewLoginStep === "email" ? "邮箱进入" : "验证码开锁"', "web preview mirrors the two-step login title");
assertNotIncludes(preview, "styles.previewLoginInlineCodeButton", "web preview code lock does not show a second send-code row");
assertNotIncludes(preview, "styles.previewLoginBackButton", "web preview code lock hides the email row after code is sent");
assertIncludes(preview, "styles.previewLoginKeypad", "web preview mirrors the numeric lock keypad");
assertIncludes(preview, "normalizePreviewOtpCode(`${current}${digit}`)", "web preview sanitizes numeric lock input");
assertIncludes(preview, "disabled={!canEnter}", "web preview login keeps disabled state before email input");
checks.push("web preview login mirrors the real mobile lock-only entry");

assertIncludes(app, "function MobileWebFrame", "mobile web preview has a dedicated phone-width frame");
assertIncludes(app, 'if (Platform.OS !== "web") return <>{children}</>;', "mobile web frame does not affect native builds");
assertIncludes(app, "maxWidth: 430", "web preview is capped to a phone-sized canvas");
checks.push("web preview stays responsive and phone-sized on desktop browsers");

assertIncludes(webPage, 'searchParams.get("loginFlow") === "lock"', "root web entry switches loginFlow=lock to the human mobile preview");
assertIncludes(webHumanPreview, "function MobileHumanLoginPreview", "root web entry has a dedicated human-facing mobile login preview");
assertIncludes(webHumanPreview, "<h1>海豚，开门</h1>", "root web preview uses the human-facing door title");
assertIncludes(webHumanPreview, "<h2>邮箱进入</h2>", "root web preview starts with one email entry step");
assertIncludes(webHumanPreview, "setStep(\"code\")", "root web preview sends the code before showing the lock");
assertIncludes(webHumanPreview, "<h2>验证码开锁</h2>", "root web preview switches to a numeric lock instead of a code input row");
assertIncludes(webHumanPreview, "className=\"human-keypad\"", "root web preview exposes the keypad lock");
assertNotIncludes(webHumanPreview, "输入确认码：", "root web human preview does not expose raw execution confirmation-code copy");
assertIncludes(webStyles, ".human-lock-page", "root web human preview has a phone-width visual shell");
assertIncludes(webStyles, ".human-door-card", "root web human preview renders the door-like hero");
assertIncludes(webStyles, ".human-keypad", "root web human preview styles the numeric lock keypad");
checks.push("root /?loginFlow=lock opens the human-facing mobile login preview, not the old AI operator shell");

console.log(JSON.stringify({ ok: true, checks }, null, 2));

function assertIncludes(source, needle, label) {
  assert(source.includes(needle), label);
}

function assertNotIncludes(source, needle, label) {
  assert(!source.includes(needle), label);
}

function assert(condition, label) {
  if (!condition) throw new Error(`Mobile login UI smoke failed: ${label}`);
}

function sliceBetween(source, start, end) {
  const startIndex = source.indexOf(start);
  assert(startIndex >= 0, `${start} exists`);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert(endIndex > startIndex, `${end} follows ${start}`);
  return source.slice(startIndex, endIndex);
}
