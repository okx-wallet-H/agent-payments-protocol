import "fast-text-encoding";
import "react-native-get-random-values";
import "@ethersproject/shims";

import { Ionicons } from "@expo/vector-icons";
import { PrivyProvider, useEmbeddedEthereumWallet, useLoginWithEmail, usePrivy } from "@privy-io/expo";
import Constants from "expo-constants";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { createApi } from "./src/api";
import type { Agent, AuditEvent, PredictionMarket, PredictionRouterInfo } from "./src/types";
import { V2AgentWalletScreen } from "./src/V2AgentWalletScreen";
import { V2AgentWalletPreview } from "./src/V2AgentWalletPreview";

const defaultApiBaseUrl =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ||
  "http://localhost:3000";

const privyAppId = process.env.EXPO_PUBLIC_PRIVY_APP_ID;
const privyClientId = process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID;

const xLayerChain = {
  id: 196,
  name: "X Layer",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.xlayer.tech"] }
  },
  blockExplorers: {
    default: { name: "OKLink", url: "https://www.oklink.com/xlayer" }
  }
};

export default function App() {
  if (process.env.EXPO_PUBLIC_AGENT_WALLET_PREVIEW === "true") {
    return <V2AgentWalletPreview />;
  }

  if (Platform.OS === "web" && process.env.EXPO_PUBLIC_AGENT_WALLET_V2_UI === "true") {
    return <V2AgentWalletPreview />;
  }

  if (!privyAppId || !privyClientId) return <MissingPrivyConfig />;

  return (
    <PrivyProvider
      appId={privyAppId}
      clientId={privyClientId}
      supportedChains={[xLayerChain]}
      config={{
        embedded: {
          ethereum: {
            createOnLogin: "users-without-wallets"
          }
        }
      }}
    >
      <AgentWalletApp />
    </PrivyProvider>
  );
}

function AgentWalletApp() {
  if (process.env.EXPO_PUBLIC_AGENT_WALLET_V2_UI === "true") {
    return <V2AgentWalletScreen apiBaseUrl={defaultApiBaseUrl} />;
  }

  const { getAccessToken, isReady, logout, user } = usePrivy();
  const { sendCode, loginWithCode, state: emailLoginState } = useLoginWithEmail();
  const { wallets } = useEmbeddedEthereumWallet();
  const [apiBaseUrl, setApiBaseUrl] = useState(defaultApiBaseUrl);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [markets, setMarkets] = useState<PredictionMarket[]>([]);
  const [routerInfo, setRouterInfo] = useState<PredictionRouterInfo>();
  const [selectedMarketId, setSelectedMarketId] = useState<string>();
  const [agentName, setAgentName] = useState("世界杯机会助手");
  const [vaultAddress, setVaultAddress] = useState("");
  const [intentAmount, setIntentAmount] = useState("0.01");
  const [maxSingleSpend, setMaxSingleSpend] = useState("0.02");
  const [dailyBudget, setDailyBudget] = useState("0.05");
  const [confirmationText, setConfirmationText] = useState("");
  const [chatInput, setChatInput] = useState("帮我看看世界杯有没有机会");
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const api = useMemo(() => createApi(apiBaseUrl, getAccessToken), [apiBaseUrl, getAccessToken]);
  const selected = useMemo(
    () => agents.find((agent) => agent.id === selectedId) || agents[0],
    [agents, selectedId]
  );
  const ownerUserId = user?.id;
  const userWalletAddress = wallets[0]?.address;

  async function load(nextSelectedId = selectedId) {
    const nextAgents = await api.listAgents(ownerUserId);
    const id = nextSelectedId || nextAgents[0]?.id;
    const nextAudit = id ? await api.listAudit(id) : [];
    setAgents(nextAgents);
    setSelectedId(id);
    setAudit(nextAudit);
  }

  async function run(label: string, action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      Alert.alert(label, error instanceof Error ? error.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!isReady || !ownerUserId) {
      setAgents([]);
      setSelectedId(undefined);
      setAudit([]);
      return;
    }
    load().catch(() => undefined);
  }, [apiBaseUrl, isReady, ownerUserId]);

  const latestIntent = selected?.intents[0];
  const latestPreview = selected?.previews?.[0];
  const latestExecution = selected?.executions[0];
  const journey = getMobileJourney({
    authenticated: Boolean(user),
    selected,
    latestIntent,
    latestPreview,
    latestExecution
  });
  const selectedMarket = useMemo(
    () => markets.find((market) => market.id === selectedMarketId) || markets[0],
    [markets, selectedMarketId]
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load().finally(() => setRefreshing(false));
            }}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>OKX X Layer · Mobile MVP</Text>
          <Text style={styles.title}>AI 帮你看机会</Text>
          <View style={styles.chainBadge}>
            <Ionicons name="flash" size={15} color="#0d7a53" />
            <Text style={styles.chainText}>X Layer Mainnet · Chain ID 196 · OKB Gas</Text>
          </View>
        </View>

        <Card title="下一步">
          <Text style={styles.nextTitle}>{journey.title}</Text>
          <Text style={styles.body}>{journey.description}</Text>
          <View style={styles.stepList}>
            {journey.steps.map((step) => (
              <View
                key={step.label}
                style={[styles.stepItem, step.current && styles.stepItemCurrent]}
              >
                <View style={[styles.stepDot, step.done && styles.stepDotDone]}>
                  <Text style={[styles.stepDotText, step.done && styles.stepDotDoneText]}>
                    {step.done ? "✓" : step.index}
                  </Text>
                </View>
                <View style={styles.flex}>
                  <Text style={styles.stepLabel}>{step.label}</Text>
                  <Text style={styles.muted}>{step.caption}</Text>
                </View>
              </View>
            ))}
          </View>
        </Card>

        <Card title="Privy 登录">
          {!isReady ? (
            <Text style={styles.body}>Privy 初始化中...</Text>
          ) : user ? (
            <>
              <Info label="用户" value={getUserEmail(user) || ownerUserId || "已登录"} />
              <Info label="用户钱包" value={userWalletAddress || "等待嵌入式 EVM 钱包生成/同步"} />
              <ActionButton icon="log-out" label="退出登录" variant="warning" disabled={busy} onPress={() => run("Logout", logout)} />
            </>
          ) : (
            <>
              <Text style={styles.label}>邮箱</Text>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                inputMode="email"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                style={styles.input}
              />
              <ActionButton
                icon="mail"
                label="发送验证码"
                disabled={busy || !email}
                onPress={() =>
                  run("Send Code", async () => {
                    await sendCode({ email });
                  })
                }
              />
              <Text style={styles.label}>验证码</Text>
              <TextInput
                inputMode="numeric"
                keyboardType="number-pad"
                value={otpCode}
                onChangeText={setOtpCode}
                placeholder="6 位验证码"
                style={styles.input}
              />
              <ActionButton
                icon="key"
                label="登录 / 注册"
                disabled={busy || !otpCode}
                onPress={() =>
                  run("Login", async () => {
                    await loginWithCode({ code: otpCode, email });
                    setOtpCode("");
                  })
                }
              />
              <Text style={styles.muted}>状态：{emailLoginState.status}</Text>
            </>
          )}
        </Card>

        <Card title="API">
          <Text style={styles.label}>Backend URL</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            value={apiBaseUrl}
            onChangeText={setApiBaseUrl}
            placeholder="http://localhost:3000"
            style={styles.input}
          />
          <ActionButton
            icon="refresh"
            label="连接"
            disabled={busy}
            onPress={() => run("Refresh", () => load(selected?.id))}
          />
        </Card>

        {user ? (
          <Card title="创建 AI 助手">
          <Text style={styles.label}>助手名称</Text>
          <TextInput value={agentName} onChangeText={setAgentName} style={styles.input} />
          <ActionButton
            icon="add-circle"
            label="创建"
            disabled={busy}
            onPress={() =>
              run("Create Agent", async () => {
                const agent = await api.createAgent(agentName, ownerUserId, userWalletAddress);
                await load(agent.id);
              })
            }
          />
          <View style={styles.agentList}>
            {agents.map((agent) => (
              <Pressable
                key={agent.id}
                style={[styles.agentItem, agent.id === selected?.id && styles.agentItemSelected]}
                onPress={() => load(agent.id)}
              >
                <View>
                  <Text style={styles.agentName}>{agent.name}</Text>
                  <Text style={styles.muted}>{agent.status} · {agent.executionMode}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#617066" />
              </Pressable>
            ))}
          </View>
          </Card>
        ) : (
          <Card title="开始">
            <Text style={styles.body}>先用邮箱注册/登录，系统会帮你准备钱包。AI 不接触私钥，也不能绕过你的确认动用资金。</Text>
          </Card>
        )}

        {selected ? (
          <>
            <Card title="AI 小金库">
              <Text style={styles.label}>绑定 Vault 地址，可留空生成占位 AA 金库</Text>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                value={vaultAddress}
                onChangeText={setVaultAddress}
                placeholder="0x..."
                style={styles.input}
              />
              <ActionButton
                icon="wallet"
                label="创建/绑定 Vault"
                disabled={busy}
                onPress={() =>
                  run("Create Vault", async () => {
                    await api.createVault(selected.id, vaultAddress);
                    await load(selected.id);
                  })
                }
              />
              <Info label="Vault" value={selected.vault?.address || "未创建"} />
              <Info label="XKO" value={selected.vault?.displayAddress || "未创建"} />
              <Info label="余额快照" value={`${selected.vault?.balanceSnapshotOkb || "0"} OKB`} />
            </Card>

            <Card title="Policy">
              <View style={styles.split}>
                <View style={styles.flex}>
                  <Text style={styles.label}>单笔上限</Text>
                  <TextInput value={maxSingleSpend} onChangeText={setMaxSingleSpend} style={styles.input} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.label}>日预算</Text>
                  <TextInput value={dailyBudget} onChangeText={setDailyBudget} style={styles.input} />
                </View>
              </View>
              <ActionButton
                icon="shield-checkmark"
                label="更新策略"
                disabled={busy}
                onPress={() =>
                  run("Update Policy", async () => {
                    await api.updatePolicy(selected.id, Number(maxSingleSpend), Number(dailyBudget));
                    await load(selected.id);
                  })
                }
              />
              <View style={styles.split}>
                <ActionButton
                  icon="pause"
                  label="暂停"
                  variant="warning"
                  disabled={busy}
                  onPress={() =>
                    run("Pause", async () => {
                      await api.updateStatus(selected.id, "paused");
                      await load(selected.id);
                    })
                  }
                />
                <ActionButton
                  icon="ban"
                  label="撤销"
                  variant="danger"
                  disabled={busy}
                  onPress={() =>
                    run("Revoke", async () => {
                      await api.updateStatus(selected.id, "revoked");
                      await load(selected.id);
                    })
                  }
                />
              </View>
            </Card>

            <Card title="直接跟 AI 说">
              <Text style={styles.label}>你想让它做什么</Text>
              <TextInput value={chatInput} onChangeText={setChatInput} style={styles.input} />
              <ActionButton
                icon="chatbubble-ellipses"
                label="发送"
                disabled={busy || !chatInput.trim()}
                onPress={() =>
                  run("Chat", async () => {
                    await api.sendMessage(selected.id, chatInput, ownerUserId);
                    setChatInput("");
                    await load(selected.id);
                  })
                }
              />
              <Text style={styles.muted}>
                training examples: {Math.floor((selected.messages || []).length / 2)}
              </Text>
              <View style={styles.result}>
                <Text style={styles.resultStatus}>MEMORY</Text>
                <Text style={styles.body}>
                  preview {selected.memory.riskProfile.requiresPreviewBeforeExecution ? "required" : "optional"} ·
                  confirm {selected.memory.riskProfile.requiresTypedConfirmation ? "required" : "optional"}
                </Text>
                {selected.memory.riskProfile.maxComfortableTradeOkb ? (
                  <Text style={styles.planStep}>- comfortable {selected.memory.riskProfile.maxComfortableTradeOkb} OKB</Text>
                ) : null}
                {selected.memory.userPreferences.slice(-2).map((item) => (
                  <Text key={item} style={styles.planStep}>- {item}</Text>
                ))}
              </View>
              {(selected.messages || []).slice(0, 6).map((message) => (
                <View key={message.id} style={styles.chatMessage}>
                  <Text style={styles.auditType}>{message.role}</Text>
                  {message.decision && (
                    <Text style={styles.muted}>
                      判断：{humanAction(message.decision.action)} ·{" "}
                      {Math.round(message.decision.confidence * 100)}%
                    </Text>
                  )}
                  <Text style={styles.body}>{message.content}</Text>
                </View>
              ))}
            </Card>

            <Card title="机会方案">
              <ActionButton
                icon="sparkles"
                label="帮我分析一次"
                disabled={busy}
                onPress={() =>
                  run("Run Agent", async () => {
                    await api.runAgent(selected.id, Number(intentAmount), "World Cup");
                    await load(selected.id);
                  })
                }
              />
              {selected.runs?.[0] && (
                <View style={styles.result}>
                  <Text style={styles.resultStatus}>RUN · {selected.runs[0].status}</Text>
                  <Text style={styles.body}>{selected.runs[0].selectionReason}</Text>
                  {selected.runs[0].selectedQuestion && (
                    <Text style={styles.planStep}>- {selected.runs[0].selectedQuestion}</Text>
                  )}
                </View>
              )}
              <ActionButton
                icon="football"
                label="刷新公开市场"
                disabled={busy}
                onPress={() =>
                  run("Load Markets", async () => {
                    const response = await api.listPredictionMarkets("World Cup");
                    setRouterInfo(response.router);
                    setMarkets(response.markets);
                    setSelectedMarketId(response.markets[0]?.id);
                  })
                }
              />
              {routerInfo && (
                <Text style={styles.muted}>
                  {routerInfo.name} · {routerInfo.primarySkill} · {routerInfo.mode}
                </Text>
              )}
              {markets.length > 0 && (
                <View style={styles.marketList}>
                  {markets.slice(0, 6).map((market) => (
                    <Pressable
                      key={market.id}
                      style={[styles.marketItem, market.id === selectedMarket?.id && styles.marketItemSelected]}
                      onPress={() => setSelectedMarketId(market.id)}
                    >
                      <Text style={styles.marketQuestion}>{market.question}</Text>
                      <Text style={styles.muted}>
                        YES {formatPrice(market.yesPrice)} · NO {formatPrice(market.noPrice)} · 24h ${formatCompact(market.volume24hr)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
              <Text style={styles.label}>预算 OKB</Text>
              <TextInput value={intentAmount} onChangeText={setIntentAmount} style={styles.input} />
              <ActionButton
                icon="analytics"
                label={selectedMarket ? "按这个市场出方案" : "出方案"}
                disabled={busy}
                onPress={() =>
                  run("Create Intent", async () => {
                    await api.createIntent(selected.id, Number(intentAmount), selectedMarket);
                    await load(selected.id);
                  })
                }
              />
              {latestIntent && (
                <View style={styles.result}>
                  <Text style={styles.resultStatus}>{latestIntent.status}</Text>
                  {latestIntent.pluginName && (
                    <Text style={styles.muted}>
                      {latestIntent.pluginName} · {latestIntent.toolRoute?.mode || "observe"} ·
                      {latestIntent.previewRequired ? " preview required" : " no preview"}
                    </Text>
                  )}
                  <Text style={styles.body}>{latestIntent.reasoning}</Text>
                  {latestIntent.executionPlan?.map((step) => (
                    <Text key={step} style={styles.planStep}>- {step}</Text>
                  ))}
                  {latestIntent.riskNotes.map((note) => (
                    <Text key={note} style={styles.risk}>{note}</Text>
                  ))}
                </View>
              )}
            </Card>

            <Card title="安全执行">
              <ActionButton
                icon="receipt"
                label="先给我看看方案"
                disabled={busy || !latestIntent}
                onPress={() =>
                  run("Preview", async () => {
                    await api.previewIntent(selected.id, latestIntent?.id);
                    await load(selected.id);
                  })
                }
              />
              <ActionButton
                icon="play"
                label="按安全规则执行/模拟"
                disabled={busy || !latestIntent}
                onPress={() =>
                  run("Execute", async () => {
                    await api.executeIntent(selected.id, latestIntent?.id, latestPreview?.id);
                    await load(selected.id);
                  })
                }
              />
              <View style={styles.result}>
                {latestPreview && (
                  <>
                    <Text style={styles.resultStatus}>{latestPreview.safetySummary.title}</Text>
                    <Text style={styles.body}>
                      {latestPreview.safetySummary.modeLabel} · {latestPreview.safetySummary.amountLabel} ·
                      {latestPreview.safetySummary.willMoveFunds ? " 会动用小金库" : " 不会真实动钱"}
                    </Text>
                    <Text style={styles.muted}>风险等级：{humanRiskLevel(latestPreview.safetySummary.riskLevel)}</Text>
                    {latestPreview.safetySummary.userChecklist.map((item) => (
                      <Text key={item} style={styles.planStep}>- {item}</Text>
                    ))}
                    <Text style={styles.muted}>
                      技术记录：{latestPreview.provider} · {latestPreview.side.toUpperCase()} · expires{" "}
                      {new Date(latestPreview.expiresAt).toLocaleTimeString()}
                    </Text>
                    <Text style={styles.muted}>confirmation: {latestPreview.confirmationStatus}</Text>
                    <Text style={styles.muted}>
                      剩余尝试：{Math.max(0, latestPreview.maxConfirmationAttempts - latestPreview.confirmationAttempts)}
                    </Text>
                    {latestPreview.confirmationStatus === "locked" ? (
                      <Text style={styles.risk}>确认码错误次数过多，请重新生成方案。</Text>
                    ) : null}
                    {(latestPreview.confirmationCode || latestPreview.confirmationText) &&
                      latestPreview.confirmationStatus !== "confirmed" &&
                      latestPreview.confirmationStatus !== "locked" && (
                      <>
                        <Text style={styles.label}>
                          输入 6 位确认码，确认后才允许继续：{latestPreview.confirmationCode || latestPreview.confirmationText}
                        </Text>
                        <TextInput
                          value={confirmationText}
                          onChangeText={setConfirmationText}
                          autoCapitalize="none"
                          keyboardType={latestPreview.confirmationCode ? "number-pad" : "default"}
                          maxLength={latestPreview.confirmationCode ? 6 : undefined}
                          style={styles.input}
                        />
                        <ActionButton
                          icon="checkmark-done"
                          label="确认这份方案"
                          disabled={busy || !confirmationText}
                          onPress={() =>
                            run("Confirm Preview", async () => {
                              await api.confirmPreview(selected.id, latestPreview.id, confirmationText, ownerUserId);
                              setConfirmationText("");
                              await load(selected.id);
                            })
                          }
                        />
                      </>
                    )}
                    {latestPreview.warnings.map((warning) => (
                      <Text key={warning} style={styles.planStep}>- {warning}</Text>
                    ))}
                  </>
                )}
                <Text style={styles.resultStatus}>{latestExecution?.status || "无执行记录"}</Text>
                <Text style={styles.body}>
                  {latestExecution?.error || latestExecution?.explorerUrl || "等待第一个预测意图。"}
                </Text>
              </View>
            </Card>

            <Card title="Audit">
              {audit.length === 0 ? <Text style={styles.muted}>暂无审计记录</Text> : null}
              {audit.map((event) => (
                <View key={event.id} style={styles.auditItem}>
                  <Text style={styles.auditType}>{event.type}</Text>
                  <Text style={styles.muted}>{new Date(event.createdAt).toLocaleString()}</Text>
                  <Text style={styles.body}>{event.message}</Text>
                </View>
              ))}
            </Card>
          </>
        ) : (
          <Card title="开始">
            <Text style={styles.body}>先创建一个 AI 助手，然后准备小金库和安全预算。</Text>
          </Card>
        )}
      </ScrollView>
      {busy && (
        <View style={styles.loading}>
          <ActivityIndicator color="#fff" />
        </View>
      )}
    </SafeAreaView>
  );
}

function MissingPrivyConfig() {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.content}>
        <Card title="Privy 配置缺失">
          <Text style={styles.body}>请配置 EXPO_PUBLIC_PRIVY_APP_ID 和 EXPO_PUBLIC_PRIVY_CLIENT_ID 后重新启动 Expo。</Text>
        </Card>
      </View>
    </SafeAreaView>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
  disabled,
  variant = "primary"
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "primary" | "warning" | "danger";
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, styles[`${variant}Button`], disabled && styles.disabled]}
    >
      <Ionicons name={icon} size={18} color="#fff" />
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
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

function getMobileJourney(input: {
  authenticated: boolean;
  selected?: Agent;
  latestIntent?: Agent["intents"][number];
  latestPreview?: Agent["previews"][number];
  latestExecution?: Agent["executions"][number];
}) {
  const steps = [
    {
      index: 1,
      label: "登录",
      caption: "邮箱进入，钱包自动准备",
      done: input.authenticated,
      current: !input.authenticated
    },
    {
      index: 2,
      label: "AI 助手",
      caption: "给你的 AI 开一个账户",
      done: Boolean(input.selected),
      current: input.authenticated && !input.selected
    },
    {
      index: 3,
      label: "小金库",
      caption: "只给 AI 小额预算",
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
      title: "先登录，系统会帮你准备钱包",
      description: "你只需要邮箱进入。AI 不接触私钥，也不能绕过你的确认动钱。",
      steps
    };
  }
  if (!input.selected) {
    return {
      title: "创建你的第一个 AI 助手",
      description: "它会负责看机会、出方案、讲风险，但不会直接动用资金。",
      steps
    };
  }
  if (!input.selected.vault) {
    return {
      title: "给 AI 准备一个小金库",
      description: "第一版可以先生成地址体验流程，真实充值以后再打开。",
      steps
    };
  }
  if (!input.latestIntent) {
    return {
      title: "让 AI 先看一次机会",
      description: "AI 会读取公开市场信息，生成一份带理由、金额和风险的方案。",
      steps
    };
  }
  if (input.latestPreview?.confirmationStatus !== "confirmed") {
    return {
      title: "先看安全方案",
      description: "确认页会写清楚是否动钱、预计金额、风险等级和确认码。",
      steps
    };
  }
  if (!input.latestExecution) {
    return {
      title: "按安全规则模拟执行",
      description: "现在仍是安全演练模式，不会真实签名或下单，但会写入透明记录。",
      steps
    };
  }
  return {
    title: "第一轮已经完成",
    description: "你可以继续让 AI 看新的机会，或者查看透明记录复盘每一步。",
    steps
  };
}

function getUserEmail(user: unknown): string | undefined {
  const direct = user as { email?: { address?: string } };
  if (direct.email?.address) return direct.email.address;
  const linkedAccounts = (user as { linkedAccounts?: Array<{ type?: string; address?: string; email?: string }> })
    .linkedAccounts;
  return linkedAccounts?.find((account) => account.type === "email")?.address;
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#f5f7f4"
  },
  content: {
    padding: 18,
    paddingBottom: 48
  },
  header: {
    marginBottom: 16
  },
  eyebrow: {
    color: "#0d7a53",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  title: {
    color: "#101914",
    fontSize: 42,
    fontWeight: "900",
    letterSpacing: 0,
    marginTop: 6
  },
  chainBadge: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#e9f3ec",
    borderColor: "#d5e4d9",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  chainText: {
    color: "#294033",
    fontSize: 13,
    fontWeight: "700"
  },
  card: {
    backgroundColor: "#fff",
    borderColor: "#dce4dc",
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 14,
    padding: 16,
    shadowColor: "#14281c",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2
  },
  cardTitle: {
    color: "#101914",
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 12
  },
  nextTitle: {
    color: "#101914",
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 26
  },
  stepList: {
    gap: 8,
    marginTop: 12
  },
  stepItem: {
    alignItems: "center",
    backgroundColor: "#fbfcfb",
    borderColor: "#dce4dc",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 10
  },
  stepItemCurrent: {
    backgroundColor: "#eef5ee",
    borderColor: "#0d7a53"
  },
  stepDot: {
    alignItems: "center",
    backgroundColor: "#edf3ef",
    borderRadius: 999,
    height: 32,
    justifyContent: "center",
    width: 32
  },
  stepDotDone: {
    backgroundColor: "#0d7a53"
  },
  stepDotText: {
    color: "#617066",
    fontSize: 12,
    fontWeight: "900"
  },
  stepDotDoneText: {
    color: "#fff"
  },
  stepLabel: {
    color: "#101914",
    fontSize: 14,
    fontWeight: "900"
  },
  label: {
    color: "#617066",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 7
  },
  input: {
    borderColor: "#dce4dc",
    borderRadius: 7,
    borderWidth: 1,
    color: "#101914",
    fontSize: 15,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 11
  },
  button: {
    alignItems: "center",
    borderRadius: 7,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 4
  },
  primaryButton: {
    backgroundColor: "#0d7a53"
  },
  warningButton: {
    backgroundColor: "#a95012"
  },
  dangerButton: {
    backgroundColor: "#a92f36"
  },
  disabled: {
    opacity: 0.55
  },
  buttonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "900"
  },
  agentList: {
    gap: 8,
    marginTop: 12
  },
  agentItem: {
    alignItems: "center",
    backgroundColor: "#edf3ef",
    borderColor: "#dce4dc",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 12
  },
  agentItemSelected: {
    borderColor: "#0d7a53",
    borderWidth: 2
  },
  agentName: {
    color: "#101914",
    fontSize: 15,
    fontWeight: "900"
  },
  muted: {
    color: "#617066",
    fontSize: 12,
    marginTop: 4
  },
  split: {
    flexDirection: "row",
    gap: 10
  },
  flex: {
    flex: 1
  },
  infoRow: {
    borderTopColor: "#eef2ef",
    borderTopWidth: 1,
    gap: 4,
    paddingTop: 10,
    marginTop: 10
  },
  infoLabel: {
    color: "#617066",
    fontSize: 12,
    fontWeight: "800"
  },
  infoValue: {
    color: "#101914",
    fontSize: 13,
    fontWeight: "700"
  },
  result: {
    backgroundColor: "#f8fbf8",
    borderColor: "#dce4dc",
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
    padding: 12
  },
  marketList: {
    gap: 8,
    marginBottom: 12,
    marginTop: 12
  },
  marketItem: {
    backgroundColor: "#f8fbf8",
    borderColor: "#dce4dc",
    borderRadius: 8,
    borderWidth: 1,
    padding: 10
  },
  marketItemSelected: {
    borderColor: "#0d7a53",
    borderWidth: 2
  },
  marketQuestion: {
    color: "#101914",
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 19
  },
  resultStatus: {
    color: "#0d7a53",
    fontSize: 14,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  body: {
    color: "#445248",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6
  },
  risk: {
    color: "#a92f36",
    fontSize: 13,
    fontWeight: "800",
    marginTop: 8
  },
  planStep: {
    color: "#445248",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 5
  },
  auditItem: {
    borderLeftColor: "#0d7a53",
    borderLeftWidth: 3,
    marginTop: 10,
    paddingLeft: 10
  },
  chatMessage: {
    backgroundColor: "#f8fbf8",
    borderColor: "#dce4dc",
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 10,
    padding: 10
  },
  auditType: {
    color: "#101914",
    fontSize: 13,
    fontWeight: "900"
  },
  loading: {
    alignItems: "center",
    backgroundColor: "rgba(16, 25, 20, 0.72)",
    borderRadius: 20,
    bottom: 28,
    height: 42,
    justifyContent: "center",
    position: "absolute",
    right: 22,
    width: 42
  }
});
