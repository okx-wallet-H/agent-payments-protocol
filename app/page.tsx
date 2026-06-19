"use client";

import { usePrivy, useWallets } from "@privy-io/react-auth";
import {
  ArrowRight,
  Bot,
  Check,
  Coins,
  Globe,
  LockKeyhole,
  Mail,
  Settings,
  Shield,
  Sparkles,
  Trophy,
  Wallet
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import type {
  Agent,
  AuditEvent,
  ExecutionRecord,
  AgentMessage,
  PredictionMarket,
  PredictionRouterInfo,
  TradeIntent
} from "@/lib/types";
import { PRODUCT_NOTES } from "@/lib/defaults";

interface ApiState {
  agents: Agent[];
  selectedId?: string;
  audit: AuditEvent[];
  busy: boolean;
  message: string;
}

type GetAccessToken = () => Promise<string | null | undefined>;

async function api<T>(url: string, init?: RequestInit, getAccessToken?: GetAccessToken): Promise<T> {
  const accessToken = await getAccessToken?.();
  const response = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      ...(init?.headers || {})
    }
  });
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

export default function Home() {
  const searchParams = useSearchParams();
  if (searchParams.get("loginFlow") === "lock") return <MobileHumanLoginPreview />;
  return <AgentWalletHome />;
}

function MobileHumanLoginPreview() {
  const [email, setEmail] = useState("demo@hwallet.vip");
  const [step, setStep] = useState<"email" | "code">("email");
  const [code, setCode] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const normalizedEmail = email.trim();
  const canEnter = normalizedEmail.includes("@") && normalizedEmail.includes(".");
  const canUnlock = code.length === 6;

  function sendCode() {
    if (!canEnter) return;
    setCode("");
    setStep("code");
  }

  function appendDigit(digit: string) {
    setCode((current) => `${current}${digit}`.replace(/\D/g, "").slice(0, 6));
  }

  function resetEmail() {
    setStep("email");
    setCode("");
  }

  function unlockDoor() {
    if (!canUnlock) return;
    setUnlocked(true);
  }

  if (unlocked) return <HumanAgentChatHome />;

  return (
    <main className="human-lock-page" aria-label="海豚社区登录预览">
      <section className="human-door-card" aria-label="海豚社区开门">
        <div className="human-door-panel left">
          <img src="/images/logo.png" alt="" className="human-door-logo" />
          <h1>海豚，开门</h1>
          <p>你的 Agent 已就位。</p>
        </div>
        <div className="human-door-panel right" aria-hidden="true">
          <div className="human-door-line" />
          <div className="human-door-glow" />
        </div>
      </section>

      <section className="human-lock-card">
        {step === "email" ? (
          <>
            <label className="human-field">
              <span>邮箱</span>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </label>
            <button className="human-primary-button" type="button" disabled={!canEnter} onClick={sendCode}>
              进入
              <ArrowRight size={20} />
            </button>
          </>
        ) : (
          <>
            <div className="human-lock-copy compact">
              <button className="human-text-button" type="button" onClick={resetEmail}>
                换邮箱
              </button>
              <h2>验证码开锁</h2>
              <p>输入邮箱收到的 6 位验证码。</p>
            </div>
            <div className="human-code-dots" aria-label={`已输入 ${code.length} 位验证码`}>
              {Array.from({ length: 6 }).map((_, index) => (
                <span key={index} className={index < code.length ? "filled" : ""} />
              ))}
            </div>
            <div className="human-keypad" aria-label="数字密码锁">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
                <button key={digit} type="button" onClick={() => appendDigit(digit)}>
                  {digit}
                </button>
              ))}
              <button type="button" className="muted" onClick={() => setCode((current) => current.slice(0, -1))}>
                删除
              </button>
              <button type="button" onClick={() => appendDigit("0")}>
                0
              </button>
              <button type="button" className="unlock" disabled={!canUnlock} onClick={unlockDoor}>
                <Check size={22} />
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

type HumanChatMessage = {
  id: string;
  role: "assistant" | "user";
  variant?: "accent";
  title?: string;
  text: string;
};

const initialHumanChatMessages: HumanChatMessage[] = [];

function HumanAgentChatHome() {
  const [messages, setMessages] = useState<HumanChatMessage[]>(initialHumanChatMessages);
  const [draft, setDraft] = useState("");
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const latestUserMessageRef = useRef<HTMLElement | null>(null);
  const pendingFocusMessageId = useRef<string | null>(null);
  const agentPageStyle = { "--human-keyboard-offset": `${keyboardOffset}px` } as CSSProperties;

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const activeViewport = viewport;

    function syncKeyboardOffset() {
      const offset = Math.max(0, window.innerHeight - activeViewport.height - activeViewport.offsetTop);
      setKeyboardOffset(Math.round(offset));
    }

    syncKeyboardOffset();
    activeViewport.addEventListener("resize", syncKeyboardOffset);
    activeViewport.addEventListener("scroll", syncKeyboardOffset);
    return () => {
      activeViewport.removeEventListener("resize", syncKeyboardOffset);
      activeViewport.removeEventListener("scroll", syncKeyboardOffset);
    };
  }, []);

  useEffect(() => {
    if (!pendingFocusMessageId.current) return;
    const frame = window.requestAnimationFrame(() => {
      latestUserMessageRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
      pendingFocusMessageId.current = null;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages]);

  function sendAgentMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;

    const nextMessage: HumanChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text
    };

    pendingFocusMessageId.current = nextMessage.id;
    setMessages([nextMessage]);
    setDraft("");
  }

  return (
    <main
      className={`human-app-page human-agent-page${keyboardOpen ? " keyboard-open" : ""}`}
      style={agentPageStyle}
      aria-label="海豚社区 Agent 对话页"
    >
      <header className="human-app-topbar">
        <button className="human-round-button" type="button" aria-label="打开菜单">
          H
        </button>
        <button className="human-round-button" type="button" aria-label="设置">
          <Settings size={20} />
        </button>
      </header>

      <section className="human-chat-thread" aria-label="最近对话">
        {messages.map((message) => (
          <article
            key={message.id}
            ref={message.id === pendingFocusMessageId.current ? latestUserMessageRef : undefined}
            className={`human-chat-message ${message.role}${message.variant ? ` ${message.variant}` : ""}`}
          >
            {message.role === "assistant" ? (
              <>
                {message.variant === "accent" ? <Sparkles size={18} /> : <Bot size={18} />}
                <div>
                  {message.title ? <b>{message.title}</b> : null}
                  <p>{message.text}</p>
                </div>
              </>
            ) : (
              <p>{message.text}</p>
            )}
          </article>
        ))}
      </section>

      <form className="human-chat-composer" aria-label="发送消息" onSubmit={sendAgentMessage}>
        <button type="button" aria-label="添加">
          +
        </button>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onFocus={() => setKeyboardOpen(true)}
          onBlur={() => setKeyboardOpen(false)}
          placeholder="向 Agent 发送消息"
        />
        <button type="submit" aria-label="发送" disabled={!draft.trim()}>
          <ArrowRight size={18} />
        </button>
      </form>

      <nav className="human-chat-nav" aria-label="底部导航">
        <button className="active" type="button">
          <Bot size={20} />
          Agent
        </button>
        <button type="button">
          <Coins size={20} />
          市场
        </button>
        <button type="button">
          <Sparkles size={20} />
          发现
        </button>
        <button className="hmark" type="button">
          H
        </button>
      </nav>
    </main>
  );
}

function AgentWalletHome() {
  const { authenticated, getAccessToken, login, logout, ready, user } = usePrivy();
  const { wallets } = useWallets();
  const [state, setState] = useState<ApiState>({
    agents: [],
    audit: [],
    busy: false,
    message: ""
  });
  const [agentName, setAgentName] = useState("世界杯机会助手");
  const [vaultAddress, setVaultAddress] = useState("");
  const [intentAmount, setIntentAmount] = useState("0.01");
  const [maxSingleSpend, setMaxSingleSpend] = useState("0.02");
  const [dailyBudget, setDailyBudget] = useState("0.05");
  const [confirmationText, setConfirmationText] = useState("");
  const [chatInput, setChatInput] = useState("帮我看看世界杯有没有机会");
  const [markets, setMarkets] = useState<PredictionMarket[]>([]);
  const [routerInfo, setRouterInfo] = useState<PredictionRouterInfo>();
  const [selectedMarketId, setSelectedMarketId] = useState<string>();

  const selected = useMemo(
    () => state.agents.find((agent) => agent.id === state.selectedId) || state.agents[0],
    [state.agents, state.selectedId]
  );
  const ownerUserId = user?.id;
  const userWalletAddress = wallets.find((wallet) => wallet.address)?.address || getLinkedWalletAddress(user);
  const privyConfigured = Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID);
  const selectedMarket = useMemo(
    () => markets.find((market) => market.id === selectedMarketId) || markets[0],
    [markets, selectedMarketId]
  );
  const apiWithAuth = <T,>(url: string, init?: RequestInit) =>
    api<T>(url, init, privyConfigured && authenticated ? getAccessToken : undefined);

  async function load(selectedId = state.selectedId) {
    const params = ownerUserId ? `?ownerUserId=${encodeURIComponent(ownerUserId)}` : "";
    const data = await apiWithAuth<{ agents: Agent[] }>(`/api/agents${params}`);
    const nextSelected = selectedId || data.agents[0]?.id;
    let audit: AuditEvent[] = [];
    if (nextSelected) {
      audit = (await apiWithAuth<{ audit: AuditEvent[] }>(`/api/agents/${nextSelected}/audit`)).audit;
    }
    setState((current) => ({
      ...current,
      agents: data.agents,
      selectedId: nextSelected,
      audit
    }));
  }

  async function run(label: string, action: () => Promise<void>) {
    setState((current) => ({ ...current, busy: true, message: `${label}...` }));
    try {
      await action();
      setState((current) => ({ ...current, busy: false, message: `${label} completed` }));
    } catch (error) {
      setState((current) => ({
        ...current,
        busy: false,
        message: error instanceof Error ? error.message : "Unknown error"
      }));
    }
  }

  async function loadPredictionMarkets() {
    const params = new URLSearchParams({ keyword: "World Cup", limit: "10" });
    const data = await apiWithAuth<{
      router?: PredictionRouterInfo;
      markets: PredictionMarket[];
    }>(`/api/prediction/markets?${params.toString()}`);
    setRouterInfo(data.router);
    setMarkets(data.markets);
    setSelectedMarketId(data.markets[0]?.id);
  }

  async function createAgentAction() {
    const created = await apiWithAuth<{ agent: Agent }>("/api/agents", {
      method: "POST",
      body: JSON.stringify({
        ownerUserId,
        name: agentName,
        executionMode: "mainnet_small",
        userWalletAddress
      })
    });
    await load(created.agent.id);
  }

  async function createVaultAction() {
    if (!selected) return;
    await apiWithAuth(`/api/agents/${selected.id}/vault`, {
      method: "POST",
      body: JSON.stringify({
        address: vaultAddress || undefined,
        walletType: "aa_smart_account"
      })
    });
    await load(selected.id);
  }

  async function askAgentAction() {
    if (!selected) return;
    await apiWithAuth(`/api/agents/${selected.id}/chat`, {
      method: "POST",
      body: JSON.stringify({ content: chatInput || "帮我看看世界杯有没有机会", userId: ownerUserId })
    });
    setChatInput("");
    await load(selected.id);
  }

  async function analyzeAction() {
    if (!selected) return;
    await apiWithAuth(`/api/agents/${selected.id}/run`, {
      method: "POST",
      body: JSON.stringify({ amountOkb: Number(intentAmount), keyword: "World Cup" })
    });
    await load(selected.id);
  }

  async function previewAction() {
    if (!selected || !latestIntent) return;
    await apiWithAuth(`/api/agents/${selected.id}/preview`, {
      method: "POST",
      body: JSON.stringify({ intentId: latestIntent.id })
    });
    await load(selected.id);
  }

  async function executeAction() {
    if (!selected || !latestIntent) return;
    await apiWithAuth(`/api/agents/${selected.id}/execute`, {
      method: "POST",
      body: JSON.stringify({ intentId: latestIntent.id, previewId: latestPreview?.id })
    });
    await load(selected.id);
  }

  useEffect(() => {
    if (!ready || (privyConfigured && !authenticated)) {
      setState((current) => ({ ...current, agents: [], selectedId: undefined, audit: [] }));
      return;
    }
    load().catch((error) =>
      setState((current) => ({ ...current, message: error instanceof Error ? error.message : "Load failed" }))
    );
  }, [authenticated, ownerUserId, ready]);

  const latestIntent: TradeIntent | undefined = selected?.intents[0];
  const latestPreview = selected?.previews?.[0];
  const latestExecution: ExecutionRecord | undefined = selected?.executions[0];
  const latestMessages: AgentMessage[] = selected?.messages?.slice(0, 8) || [];
  const journey = getUserJourney({
    authenticated: !privyConfigured || authenticated,
    selected,
    latestIntent,
    latestPreview,
    latestExecution
  });

  if (privyConfigured && !authenticated) {
    return (
      <main className="dolphin-login">
        <div className="login-bg" />
        <div className="login-shade top" />
        <div className="login-shade bottom" />

        <section className="login-card-shell">
          <div className="login-topbar">
            <button className="chip-button" type="button">
              <Globe size={15} />
              简体中文
            </button>
            <button className="chip-button gold" type="button">
              <Trophy size={15} />
              世界杯版
            </button>
          </div>

          <div className="login-brand">
            <p className="login-kicker">OKX X Layer · Agent Wallet</p>
            <h1>海豚 AI 钱包</h1>
            <span>像聊天一样用链上 Agent</span>
            <p>不用学钱包，不用装插件，直接告诉 AI 你想看什么机会。</p>
          </div>

          <div className="login-chat-preview" aria-label="AI 对话预览">
            <article className="simple-message assistant">
              <b>AI预言帝</b>
              <p>你可以直接问：世界杯有没有机会？我先分析公开市场和风险。</p>
            </article>
            <article className="simple-message user">
              <b>我</b>
              <p>交易签名安全吗？</p>
            </article>
            <article className="simple-message assistant safety-card">
              <b>TEE 安全签名</b>
              <p>私钥永不离开可信执行环境。Agent 只负责分析、预览和发起受策略约束的执行请求。</p>
            </article>
          </div>

          <div className="login-panel" id="login">
            <div className="panel-glow" />
            <div className="login-copy">
              <h2>欢迎来到海豚社区</h2>
              <p>用邮箱进入，系统会自动准备钱包；交易签名在 TEE 可信执行环境内完成。</p>
            </div>
            <button className="gold-cta" onClick={() => login()} disabled={!ready}>
              <Mail size={19} />
              用邮箱登录 / 注册
              <ArrowRight size={19} />
            </button>
            <div className="security-note">
              <Shield size={16} />
              <span>TEE 安全签名 · X Layer 小额金库 · Onchain OS 执行预览</span>
            </div>
            {!ready && <p className="login-status">正在准备登录组件...</p>}
          </div>

          <div className="trust-strip">
            <span>
              <Check size={14} />
              不需要懂钱包
            </span>
            <span>
              <LockKeyhole size={14} />
              私钥不出 TEE
            </span>
            <span>
              <Sparkles size={14} />
              全程留记录
            </span>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="dolphin-app">
      <div className="app-bg" />
      <section className="topbar">
        <div>
          <p className="eyebrow">HWallet · OKX X Layer · Agent Wallet</p>
          <h1>Agent 的钱包入口</h1>
        </div>
        <div className="top-actions">
          <div className="chain-pill">X Layer Mainnet · Chain ID 196 · OKB Gas</div>
          {privyConfigured ? (
            authenticated ? (
              <button className="secondary" onClick={() => logout()} disabled={!ready}>
                退出
              </button>
            ) : (
              <button onClick={() => login()} disabled={!ready}>
                邮箱登录
              </button>
            )
          ) : (
            <div className="chain-pill warning">未配置 Privy App ID</div>
          )}
        </div>
      </section>

      {privyConfigured && authenticated && (
        <section className="auth-strip">
          <div>
            <Mail size={16} />
            <b>{user?.email?.address || user?.google?.email || ownerUserId}</b>
          </div>
          <div>
            <Wallet size={16} />
            <span>{userWalletAddress || "登录成功，等待 Privy 嵌入式钱包生成/同步"}</span>
          </div>
        </section>
      )}

      <section className="simple-chat-shell">
        <header className="chat-hero">
          <div className="assistant-avatar">
            <img src="/agents/agent-worldcup.jpg" alt="AI 预言帝" />
          </div>
          <div>
            <p className="eyebrow">海豚 AI 助手</p>
            <h1>想问什么，直接说</h1>
            <p>我会先看市场、讲风险、给方案。真正执行前，一定会让你确认。</p>
          </div>
        </header>

        <div className="simple-status-row" aria-label="钱包与安全状态">
          <span>
            <Wallet size={15} />
            钱包 {shortAddress(userWalletAddress) || "准备中"}
          </span>
          <span>
            <Coins size={15} />
            收款地址 {shortAddress(selected?.vault?.address) || "未准备"}
          </span>
          <span>
            <Shield size={15} />
            {latestExecution?.status || latestPreview?.confirmationStatus || "安全预览"}
          </span>
        </div>

        <div className="simple-chat-window">
          {!selected && (
            <article className="simple-message assistant">
              <b>AI预言帝</b>
              <p>先为当前账号准备 HWallet 会话。后续你只要像聊天一样说目标，我来处理分析、方案和记录。</p>
            </article>
          )}
          {selected && !selected.vault && (
            <article className="simple-message assistant">
              <b>AI预言帝</b>
              <p>会话已经准备好了。下一步同步你的收款地址，充值和后续资金识别都从这里进入。</p>
            </article>
          )}
          {selected && selected.vault && latestMessages.length === 0 && (
            <article className="simple-message assistant">
              <b>AI预言帝</b>
              <p>你可以直接问：“帮我看看世界杯有没有机会”。我会先分析，不会直接动钱。</p>
            </article>
          )}
          {latestMessages.slice().reverse().map((message) => (
            <article key={message.id} className={`simple-message ${message.role}`}>
              <b>{message.role === "assistant" ? "AI预言帝" : "我"}</b>
              {message.decision && (
                <small>
                  判断：{humanAction(message.decision.action)} · {Math.round(message.decision.confidence * 100)}%
                </small>
              )}
              <p>{message.content}</p>
            </article>
          ))}
          {latestIntent && (
            <article className="simple-message assistant safety-card">
              <b>我找到一个方案</b>
              <p>{latestIntent.reasoning}</p>
              <small>金额：{latestIntent.amountOkb} OKB · 状态：{latestIntent.status}</small>
            </article>
          )}
          {latestPreview && (
            <article className="simple-message assistant safety-card">
              <b>{latestPreview.safetySummary.title}</b>
              <p>
                {latestPreview.safetySummary.amountLabel}。{latestPreview.safetySummary.willMoveFunds ? "会进入资金预览。" : "当前不会真实动钱。"}
              </p>
              <small>风险等级：{humanRiskLevel(latestPreview.safetySummary.riskLevel)}</small>
              <small>确认状态：{latestPreview.confirmationStatus}</small>
              {latestPreview.confirmationStatus !== "confirmed" && latestPreview.confirmationStatus !== "locked" && (
                <div className="confirmation-inline">
                  <label>
                    输入确认码：{latestPreview.confirmationCode || latestPreview.confirmationText}
                    <input
                      inputMode="numeric"
                      maxLength={latestPreview.confirmationCode ? 6 : undefined}
                      value={confirmationText}
                      onChange={(event) => setConfirmationText(event.target.value)}
                    />
                  </label>
                  <button
                    className="secondary compact"
                    disabled={state.busy || !confirmationText}
                    onClick={() =>
                      run("Confirm preview", async () => {
                        await apiWithAuth(`/api/agents/${selected?.id}/preview/confirm`, {
                          method: "POST",
                          body: JSON.stringify({
                            previewId: latestPreview.id,
                            confirmationText,
                            confirmedBy: ownerUserId
                          })
                        });
                        setConfirmationText("");
                        await load(selected?.id);
                      })
                    }
                  >
                    确认
                  </button>
                </div>
              )}
            </article>
          )}
          {latestExecution && (
            <article className="simple-message assistant safety-card">
              <b>执行记录</b>
              <p>{latestExecution.error || latestExecution.explorerUrl || "已写入透明记录。"}</p>
              <small>结果：{latestExecution.status}</small>
            </article>
          )}
        </div>

        <div className="simple-action-row">
          {!selected && (
            <button disabled={state.busy || (privyConfigured && !authenticated)} onClick={() => run("Create agent", createAgentAction)}>
              准备 HWallet
            </button>
          )}
          {selected && !selected.vault && (
            <button disabled={state.busy} onClick={() => run("Create vault", createVaultAction)}>
              同步收款地址
            </button>
          )}
          {selected?.vault && !latestIntent && (
            <>
              <button className="secondary compact" disabled={state.busy} onClick={() => setChatInput("帮我看看世界杯有没有机会")}>
                世界杯有没有机会？
              </button>
              <button className="secondary compact" disabled={state.busy} onClick={() => setChatInput("先给我一个安全方案")}>
                先给我安全方案
              </button>
            </>
          )}
          {latestIntent && latestPreview?.confirmationStatus !== "confirmed" && (
            <button disabled={state.busy || !latestIntent} onClick={() => run("Preview", previewAction)}>
              生成安全确认
            </button>
          )}
          {latestPreview?.confirmationStatus === "confirmed" && !latestExecution && (
            <button disabled={state.busy || !latestIntent} onClick={() => run("Execute", executeAction)}>
              按安全规则模拟
            </button>
          )}
        </div>

        <div className="simple-composer">
          <input
            value={chatInput}
            onChange={(event) => setChatInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && selected && chatInput.trim() && !state.busy) {
                run("Chat", askAgentAction);
              }
            }}
            placeholder={selected ? "直接跟 AI 说，比如：帮我看看世界杯有没有机会" : "先创建 AI 助手"}
            disabled={!selected || state.busy}
          />
          <button disabled={state.busy || !selected || !chatInput.trim()} onClick={() => run("Chat", askAgentAction)}>
            <ArrowRight size={18} />
          </button>
        </div>

        <details className="simple-details">
          <summary>查看透明记录和高级设置</summary>
          <div className="simple-audit-list">
            {state.audit.slice(0, 8).map((event) => (
              <article key={event.id}>
                <b>{event.type}</b>
                <span>{new Date(event.createdAt).toLocaleString()}</span>
                <p>{event.message}</p>
              </article>
            ))}
          </div>
        </details>
      </section>

      {privyConfigured && !authenticated && (
        <section className="auth-gate">
          <h2>登录后进入 HWallet</h2>
          <p>你只需要邮箱登录。系统会同步钱包地址，Agent 会从这里识别资金和记录操作。</p>
          <button onClick={() => login()} disabled={!ready}>
            邮箱登录
          </button>
        </section>
      )}

      <section className="journey">
        <div className="journey-main">
          <p className="eyebrow">下一步</p>
          <h2>{journey.title}</h2>
          <p>{journey.description}</p>
          <div className="journey-actions">
            {journey.action === "login" && (
              <button onClick={() => login()} disabled={!ready}>
                先登录
              </button>
            )}
            {journey.action === "create_agent" && (
              <button disabled={state.busy || (privyConfigured && !authenticated)} onClick={() => run("Create agent", createAgentAction)}>
                准备 HWallet
              </button>
            )}
            {journey.action === "create_vault" && (
              <button disabled={state.busy || !selected} onClick={() => run("Create vault", createVaultAction)}>
                同步收款地址
              </button>
            )}
            {journey.action === "ask_agent" && (
              <button disabled={state.busy || !selected} onClick={() => run("Chat", askAgentAction)}>
                让 AI 看机会
              </button>
            )}
            {journey.action === "preview" && (
              <button disabled={state.busy || !latestIntent} onClick={() => run("Preview", previewAction)}>
                先看安全方案
              </button>
            )}
            {journey.action === "execute" && (
              <button disabled={state.busy || !latestIntent} onClick={() => run("Execute", executeAction)}>
                按安全规则模拟
              </button>
            )}
          </div>
        </div>
        <div className="journey-steps" aria-label="产品流程">
          {journey.steps.map((step) => (
            <div className={`journey-step ${step.done ? "done" : ""} ${step.current ? "current" : ""}`} key={step.label}>
              <span>{step.done ? "✓" : step.index}</span>
              <div>
                <b>{step.label}</b>
                <small>{step.caption}</small>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="wallet-summary">
        <div>
          <Wallet size={20} />
          <span>我的钱包</span>
          <b>{shortAddress(userWalletAddress) || "同步中"}</b>
        </div>
        <div>
          <Bot size={20} />
          <span>Agent 会话</span>
          <b>{selected?.name || "未创建"}</b>
        </div>
        <div>
          <Coins size={20} />
          <span>收款地址</span>
          <b>{shortAddress(selected?.vault?.address) || "未准备"}</b>
        </div>
        <div>
          <Shield size={20} />
          <span>执行状态</span>
          <b>{latestExecution?.status || latestPreview?.confirmationStatus || "待分析"}</b>
        </div>
      </section>

      <section className="grid two">
        <div className="panel">
          <h2>Agent 会话</h2>
          <div className="row">
            <label>
              会话名称
              <input value={agentName} onChange={(event) => setAgentName(event.target.value)} />
            </label>
            <button
              disabled={state.busy || (privyConfigured && !authenticated)}
              onClick={() =>
                run("Create agent", createAgentAction)
              }
            >
              创建
            </button>
          </div>
          <div className="agent-list">
            {state.agents.map((agent) => (
              <button
                key={agent.id}
                className={agent.id === selected?.id ? "selected" : ""}
                onClick={() => load(agent.id)}
              >
                <span>{agent.name}</span>
                <small>{agent.status}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="panel">
          <h2>收款地址</h2>
          {selected ? (
            <>
              <div className="row">
                <label>
                  HWallet 收款地址，可留空先体验
                  <input
                    placeholder="0x..."
                    value={vaultAddress}
                    onChange={(event) => setVaultAddress(event.target.value)}
                  />
                </label>
                <button
                  disabled={state.busy}
                  onClick={() => run("Create vault", createVaultAction)}
                >
                  创建/绑定
                </button>
              </div>
              <dl>
                <dt>地址</dt>
                <dd>{selected.vault?.address || "未创建"}</dd>
                <dt>XKO 展示</dt>
                <dd>{selected.vault?.displayAddress || "未创建"}</dd>
                <dt>余额快照</dt>
                <dd>{selected.vault?.balanceSnapshotOkb || "0"} OKB</dd>
              </dl>
            </>
          ) : (
            <p className="muted">先创建一个 AI 助手。</p>
          )}
        </div>
      </section>

      <section className="grid two">
        <div className="panel">
          <h2>直接跟 AI 说</h2>
          {selected ? (
            <>
              <div className="row">
                <label>
                  你想让它做什么
                  <input value={chatInput} onChange={(event) => setChatInput(event.target.value)} />
                </label>
                <button
                  disabled={state.busy || !chatInput.trim()}
                  onClick={() =>
                    run("Chat", askAgentAction)
                  }
                >
                  发送
                </button>
              </div>
              <div className="chat-list">
                {latestMessages.map((message) => (
                  <article key={message.id} className={`chat-message ${message.role}`}>
                    <b>{message.role}</b>
                    {message.decision && (
                      <small>
                        判断：{humanAction(message.decision.action)} ·{" "}
                        {Math.round(message.decision.confidence * 100)}%
                      </small>
                    )}
                    <p>{message.content}</p>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <p className="muted">先创建 AI 助手，再开始对话。</p>
          )}
        </div>
        <div className="panel">
          <h2>透明记录</h2>
          <div className="mini">
            <b>你可以这样说</b>
            <p>帮我看看机会 / 先给我方案 / 模拟执行 / 状态怎么样 / 你记住了什么</p>
            <small className="neutral">真实动资金前，必须先出方案、过安全规则、由你明确确认。</small>
          </div>
          {selected && (
            <div className="mini">
              <b>AI 记住了什么</b>
              <p>
                小额偏好：{selected.memory.riskProfile.prefersSmallMainnetBudgets ? "yes" : "no"} ·
                预览：{selected.memory.riskProfile.requiresPreviewBeforeExecution ? "required" : "optional"} ·
                确认：{selected.memory.riskProfile.requiresTypedConfirmation ? "required" : "optional"}
              </p>
              {selected.memory.riskProfile.maxComfortableTradeOkb && (
                <small className="neutral">comfortable amount: {selected.memory.riskProfile.maxComfortableTradeOkb} OKB</small>
              )}
              {selected.memory.userPreferences.slice(-3).map((item) => (
                <small className="neutral" key={item}>- {item}</small>
              ))}
              {selected.memory.recentLessons.slice(-2).map((item) => (
                <small className="neutral" key={item}>lesson: {item}</small>
              ))}
              <div className="link-row">
                <a href={`/api/agents/${selected.id}/memory`} target="_blank">
                  查看完整记忆
                </a>
                <button
                  className="secondary compact"
                  disabled={state.busy}
                  onClick={() =>
                    run("Reset memory", async () => {
                      await apiWithAuth(`/api/agents/${selected.id}/memory`, {
                        method: "POST",
                        body: JSON.stringify({ action: "reset" })
                      });
                      await load(selected.id);
                    })
                  }
                >
                  清空记忆
                </button>
              </div>
            </div>
          )}
          {selected && (
            <div className="mini">
              <b>学习记录</b>
              <p>导出“用户怎么说、AI 怎么判断、调用了什么、为什么安全”的记录，用于后续优化 AI。</p>
              <div className="link-row">
                <a href={`/api/agents/${selected.id}/training-data`} target="_blank">
                  下载 JSONL
                </a>
                <a href={`/api/agents/${selected.id}/training-data?format=json`} target="_blank">
                  查看 JSON
                </a>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="grid three">
        <div className="panel">
          <h2>Policy</h2>
          {selected ? (
            <>
              <label>
                单笔上限 OKB
                <input value={maxSingleSpend} onChange={(event) => setMaxSingleSpend(event.target.value)} />
              </label>
              <label>
                日预算 OKB
                <input value={dailyBudget} onChange={(event) => setDailyBudget(event.target.value)} />
              </label>
              <button
                disabled={state.busy}
                onClick={() =>
                  run("Update policy", async () => {
                    await apiWithAuth(`/api/agents/${selected.id}/policy`, {
                      method: "POST",
                      body: JSON.stringify({
                        maxSingleSpendOkb: Number(maxSingleSpend),
                        dailyBudgetOkb: Number(dailyBudget)
                      })
                    });
                    await load(selected.id);
                  })
                }
              >
                更新策略
              </button>
              <button
                className="secondary"
                disabled={state.busy}
                onClick={() =>
                  run("Pause agent", async () => {
                    await apiWithAuth(`/api/agents/${selected.id}/status`, {
                      method: "POST",
                      body: JSON.stringify({ status: "paused" })
                    });
                    await load(selected.id);
                  })
                }
              >
                暂停
              </button>
              <button
                className="danger"
                disabled={state.busy}
                onClick={() =>
                  run("Revoke agent", async () => {
                    await apiWithAuth(`/api/agents/${selected.id}/status`, {
                      method: "POST",
                      body: JSON.stringify({ status: "revoked" })
                    });
                    await load(selected.id);
                  })
                }
              >
                撤销
              </button>
            </>
          ) : (
            <p className="muted">暂无 Agent。</p>
          )}
        </div>

        <div className="panel">
          <h2>机会方案</h2>
          {selected ? (
            <>
              <button
                disabled={state.busy}
                onClick={() =>
                  run("Run agent", analyzeAction)
                }
              >
                帮我分析一次
              </button>
              {selected.runs?.[0] && (
                <div className="mini">
                  <b>RUN · {selected.runs[0].status}</b>
                  <p>{selected.runs[0].selectionReason}</p>
                  {selected.runs[0].selectedQuestion && (
                    <small className="neutral">- {selected.runs[0].selectedQuestion}</small>
                  )}
                </div>
              )}
              <button
                className="secondary compact"
                disabled={state.busy}
                onClick={() => run("Load plugin markets", loadPredictionMarkets)}
              >
                刷新公开市场
              </button>
              {routerInfo && (
                <p className="muted">
                  {routerInfo.name} · {routerInfo.primarySkill} · {routerInfo.mode}
                </p>
              )}
              {markets.length > 0 && (
                <div className="market-list">
                  {markets.slice(0, 6).map((market) => (
                    <button
                      key={market.id}
                      className={market.id === selectedMarket?.id ? "market-item selected" : "market-item"}
                      onClick={() => setSelectedMarketId(market.id)}
                    >
                      <span>{market.question}</span>
                      <small>
                        YES {formatPrice(market.yesPrice)} · NO {formatPrice(market.noPrice)} · 24h $
                        {formatCompact(market.volume24hr)}
                      </small>
                    </button>
                  ))}
                </div>
              )}
              <label>
                预算 OKB
                <input value={intentAmount} onChange={(event) => setIntentAmount(event.target.value)} />
              </label>
              <button
                disabled={state.busy}
                onClick={() =>
                  run("Generate intent", async () => {
                    await apiWithAuth(`/api/agents/${selected.id}/intents`, {
                      method: "POST",
                      body: JSON.stringify(
                        selectedMarket
                          ? {
                              market: "polymarket-world-cup-2026",
                              provider: "onchainos_plugin",
                              side: "yes",
                              amountOkb: Number(intentAmount),
                              externalMarketId: selectedMarket.id,
                              externalMarketSlug: selectedMarket.slug,
                              externalQuestion: selectedMarket.question,
                              marketProbability: selectedMarket.yesPrice,
                              yesPrice: selectedMarket.yesPrice
                            }
                          : {
                              market: "okx-world-cup-2026",
                              provider: "okx_observed",
                              side: "yes",
                              amountOkb: Number(intentAmount)
                            }
                      )
                    });
                    await load(selected.id);
                  })
                }
              >
                {selectedMarket ? "按这个市场出方案" : "出方案"}
              </button>
              {latestIntent && (
                <div className="mini">
                  <b>{latestIntent.status}</b>
                  {latestIntent.pluginName && (
                    <small className="neutral">
                      {latestIntent.pluginName} · {latestIntent.toolRoute?.mode || "observe"} ·{" "}
                      {latestIntent.previewRequired ? "preview required" : "no preview"}
                    </small>
                  )}
                  <p>{latestIntent.reasoning}</p>
                  {latestIntent.executionPlan?.map((step) => (
                    <small className="neutral" key={step}>
                      - {step}
                    </small>
                  ))}
                  {latestIntent.riskNotes.map((note) => (
                    <small key={note}>{note}</small>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="muted">暂无 Agent。</p>
          )}
        </div>

        <div className="panel">
          <h2>安全执行</h2>
          {selected ? (
            <>
              <button
                className="secondary compact"
                disabled={state.busy || !latestIntent}
                onClick={() =>
                  run("Preview", previewAction)
                }
              >
                先给我看看方案
              </button>
              <button
                disabled={state.busy || !latestIntent}
                onClick={() =>
                  run("Execute", executeAction)
                }
              >
                按安全规则执行/模拟
              </button>
              <div className="mini">
                {latestPreview && (
                  <>
                    <b>{latestPreview.safetySummary.title}</b>
                    <p>
                      {latestPreview.safetySummary.modeLabel} · {latestPreview.safetySummary.amountLabel} ·
                      {latestPreview.safetySummary.willMoveFunds ? " 会进入资金预览" : " 不会真实动钱"}
                    </p>
                    <small className="neutral">风险等级：{humanRiskLevel(latestPreview.safetySummary.riskLevel)}</small>
                    {latestPreview.safetySummary.userChecklist.map((item) => (
                      <small className="neutral" key={item}>
                        - {item}
                      </small>
                    ))}
                    <small className="neutral">
                      技术记录：{latestPreview.provider} · {latestPreview.side.toUpperCase()} · expires{" "}
                      {new Date(latestPreview.expiresAt).toLocaleTimeString()}
                    </small>
                    <small className="neutral">confirmation: {latestPreview.confirmationStatus}</small>
                    <small className="neutral">
                      剩余尝试：{Math.max(0, latestPreview.maxConfirmationAttempts - latestPreview.confirmationAttempts)}
                    </small>
                    {latestPreview.confirmationStatus === "locked" && (
                      <small>确认码错误次数过多，请重新生成方案。</small>
                    )}
                    {(latestPreview.confirmationCode || latestPreview.confirmationText) &&
                      latestPreview.confirmationStatus !== "confirmed" &&
                      latestPreview.confirmationStatus !== "locked" && (
                      <>
                        <label>
                          输入 6 位确认码，确认后才允许继续：{latestPreview.confirmationCode || latestPreview.confirmationText}
                          <input
                            inputMode="numeric"
                            maxLength={latestPreview.confirmationCode ? 6 : undefined}
                            value={confirmationText}
                            onChange={(event) => setConfirmationText(event.target.value)}
                          />
                        </label>
                        <button
                          className="secondary compact"
                          disabled={state.busy || !confirmationText}
                          onClick={() =>
                            run("Confirm preview", async () => {
                              await apiWithAuth(`/api/agents/${selected.id}/preview/confirm`, {
                                method: "POST",
                                body: JSON.stringify({
                                  previewId: latestPreview.id,
                                  confirmationText,
                                  confirmedBy: ownerUserId
                                })
                              });
                              setConfirmationText("");
                              await load(selected.id);
                            })
                          }
                        >
                          确认这份方案
                        </button>
                      </>
                    )}
                    {latestPreview.warnings.map((warning) => (
                      <small className="neutral" key={warning}>
                        - {warning}
                      </small>
                    ))}
                  </>
                )}
                <b>{latestExecution?.status || "无执行记录"}</b>
                <p>{latestExecution?.error || latestExecution?.explorerUrl || "等待第一个意图。"}</p>
              </div>
            </>
          ) : (
            <p className="muted">暂无 Agent。</p>
          )}
        </div>
      </section>

      <section className="grid two">
        <div className="panel">
          <h2>高级记录</h2>
          <pre>{selected ? JSON.stringify(selected, null, 2) : "No agent"}</pre>
        </div>
        <div className="panel">
          <h2>Audit</h2>
          <div className="audit">
            {state.audit.map((event) => (
              <article key={event.id}>
                <b>{event.type}</b>
                <span>{new Date(event.createdAt).toLocaleString()}</span>
                <p>{event.message}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="notes">
        {PRODUCT_NOTES.map((note) => (
          <p key={note}>{note}</p>
        ))}
      </section>

      {state.message && <div className="toast">{state.message}</div>}
    </main>
  );
}

function getLinkedWalletAddress(user: unknown): string | undefined {
  const linkedAccounts = (user as { linkedAccounts?: Array<{ type?: string; address?: string }> } | null)
    ?.linkedAccounts;
  return linkedAccounts?.find((account) => account.type?.includes("wallet") && account.address)?.address;
}

function shortAddress(address?: string): string | undefined {
  if (!address) return undefined;
  if (address.length <= 14) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function getUserJourney(input: {
  authenticated: boolean;
  selected?: Agent;
  latestIntent?: TradeIntent;
  latestPreview?: Agent["previews"][number];
  latestExecution?: ExecutionRecord;
}) {
  const steps = [
    {
      index: 1,
      label: "登录",
      caption: "邮箱进入，钱包自动同步",
      done: input.authenticated,
      current: !input.authenticated
    },
    {
      index: 2,
      label: "HWallet",
      caption: "为当前账号准备会话",
      done: Boolean(input.selected),
      current: input.authenticated && !input.selected
    },
    {
      index: 3,
      label: "收款地址",
      caption: "同步你的专属地址",
      done: Boolean(input.selected?.vault),
      current: Boolean(input.selected && !input.selected.vault)
    },
    {
      index: 4,
      label: "看机会",
      caption: "AI 先分析再出方案",
      done: Boolean(input.latestIntent),
      current: Boolean(input.selected?.vault && !input.latestIntent)
    },
    {
      index: 5,
      label: "确认",
      caption: "看清楚再确认",
      done: input.latestPreview?.confirmationStatus === "confirmed",
      current: Boolean(input.latestIntent && input.latestPreview?.confirmationStatus !== "confirmed")
    },
    {
      index: 6,
      label: "记录",
      caption: "每一步都能回看",
      done: Boolean(input.latestExecution),
      current: Boolean(input.latestPreview?.confirmationStatus === "confirmed" && !input.latestExecution)
    }
  ];

  if (!input.authenticated) {
    return {
      title: "登录后进入 HWallet",
      description: "你只需要邮箱进入。系统会同步钱包地址，Agent 会从这里识别资金和记录操作。",
      action: "login",
      steps
    };
  }
  if (!input.selected) {
    return {
      title: "准备 HWallet 会话",
      description: "HWallet 会把当前账号、钱包地址和 Agent 对话绑定到同一个安全会话里。",
      action: "create_agent",
      steps
    };
  }
  if (!input.selected.vault) {
    return {
      title: "同步你的收款地址",
      description: "第一版先打通收款地址、充值识别和审计记录，策略执行先保持关闭。",
      action: "create_vault",
      steps
    };
  }
  if (!input.latestIntent) {
    return {
      title: "让 AI 先看一次机会",
      description: "AI 会读取公开市场信息，生成一份带理由、金额和风险的方案。",
      action: "ask_agent",
      steps
    };
  }
  if (input.latestPreview?.confirmationStatus !== "confirmed") {
    return {
      title: "先看安全方案",
      description: "确认页会写清楚是否动钱、预计金额、风险等级和确认码。",
      action: "preview",
      steps
    };
  }
  if (!input.latestExecution) {
    return {
      title: "按安全规则模拟执行",
      description: "现在仍是安全演练模式，不会真实签名或下单，但会写入透明记录。",
      action: "execute",
      steps
    };
  }
  return {
    title: "第一轮已经完成",
    description: "你可以继续让 AI 看新的机会，或者查看透明记录复盘每一步。",
    action: "ask_agent",
    steps
  };
}

function formatPrice(value?: number): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return `${Math.round(value * 1000) / 10}%`;
}

function formatCompact(value?: number): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function humanAction(action?: string): string {
  switch (action) {
    case "run_agent":
      return "看机会";
    case "preview_intent":
      return "出方案";
    case "confirm_preview":
      return "确认方案";
    case "execute_intent":
      return "模拟执行";
    case "status":
      return "查状态";
    case "memory":
      return "查记忆";
    default:
      return "说明能力";
  }
}

function humanRiskLevel(level: string): string {
  switch (level) {
    case "low":
      return "低";
    case "medium":
      return "中";
    case "high":
      return "高";
    default:
      return level;
  }
}
