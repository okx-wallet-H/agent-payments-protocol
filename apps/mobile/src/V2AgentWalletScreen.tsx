import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useEmbeddedEthereumWallet, useLoginWithEmail, usePrivy } from "@privy-io/expo";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useV2AgentWallet } from "./use-v2-agent-wallet";
import { createApi } from "./api";
import { createPrivyHWalletStatus, type PrivyHWalletStatus } from "./privy-wallet-status";
import { createHWalletEntryState } from "./hwallet-entry";
import type {
  V2AuditTimelineEvent,
  V2ConversationCard,
  V2MarketSnapshot,
  V2MobileAgentMemory,
  V2MobileChatMessage,
  V2MobileHomeView,
  V2PredictionCard,
  V2SimulationCard,
  V2StrategyCard,
  V2TrackingCard,
  V2WalletContext,
  V2WorldCupExploreCategory,
  V2WorldCupExploreMarketCard,
  V2WorldCupExploreView
} from "./types";

const worldCupPoster = require("../assets/world-cup-agent-poster.png");

type MainTab = "agent" | "worldcup" | "mine" | "wallet";
type WorldCupView = "home" | "explore" | "detail";
type MarketCategory = "冠军" | "金靴奖得主" | "小组赛" | "近期比赛";
type VerifiedWalletTransfer = NonNullable<V2MobileAgentMemory["wallet"]>["verifiedTransfers"][number];

const marketCategories: MarketCategory[] = ["冠军", "金靴奖得主", "小组赛", "近期比赛"];
const exploreCategoryByTab: Record<MarketCategory, V2WorldCupExploreCategory> = {
  冠军: "champion",
  金靴奖得主: "golden_boot",
  小组赛: "group_stage",
  近期比赛: "upcoming_matches"
};

const championMarkets = [
  { flag: "🇪🇸", name: "西班牙", percent: "17%", volume: "78.67万 交易额", color: "#d0a000" },
  { flag: "🇫🇷", name: "法国", percent: "16%", volume: "125.32万 交易额", color: "#b70d25" },
  { flag: "🏴", name: "英格兰", percent: "11%", volume: "20.85万 交易额", color: "#b20b22" },
  { flag: "🇵🇹", name: "葡萄牙", percent: "10%", volume: "38.24万 交易额", color: "#005514" },
  { flag: "🇦🇷", name: "阿根廷", percent: "9%", volume: "66.18万 交易额", color: "#6397bd" },
  { flag: "🇧🇷", name: "巴西", percent: "8%", volume: "89.43万 交易额", color: "#d5bf00" }
];

const goldenBootMarkets = [
  { flag: "🏴", name: "哈里·凯恩", percent: "14%", yes: "Yes 14¢", no: "No 87¢", volume: "4.81万 交易额" },
  { flag: "🇪🇸", name: "米克尔·奥亚萨瓦尔", percent: "8%", yes: "Yes 8¢", no: "No 93¢", volume: "1.66万 交易额" },
  { flag: "🇳🇴", name: "埃尔林·哈兰德", percent: "7%", yes: "Yes 7¢", no: "No 94¢", volume: "2.93万 交易额" }
];

const groupMarkets = [
  {
    title: "2026 年世界杯 G 组第一",
    volume: "9.48万 交易额 · 18 天后结束",
    teams: [
      ["🇧🇪", "比利时", "68¢"],
      ["🇪🇬", "埃及", "19¢"],
      ["🇮🇷", "伊朗", "12¢"],
      ["🇳🇿", "新西兰", "3¢"]
    ]
  },
  {
    title: "2026 年世界杯 K 组第一",
    volume: "24.31万 交易额 · 19 天后结束",
    teams: [
      ["🇵🇹", "葡萄牙", "63¢"],
      ["🇨🇴", "哥伦比亚", "32¢"],
      ["🇨🇩", "刚果民主共和国", "5¢"],
      ["🇺🇿", "乌兹别克斯坦", "2¢"]
    ]
  }
];

const matchMarkets = [
  {
    time: "6月12日 · (UTC+7) 02:00",
    volume: "121.23万 交易额",
    teams: [
      ["🇲🇽", "墨西哥", "69¢", "#00866a"],
      ["🇿🇦", "南非", "11¢", "#00866a"],
      ["◐", "平局", "21¢", "#696969"]
    ]
  },
  {
    time: "6月12日 · (UTC+7) 09:00",
    volume: "38.5万 交易额",
    teams: [
      ["🇰🇷", "韩国", "37¢", "#c8172f"],
      ["🇨🇿", "捷克", "34¢", "#2f72b8"],
      ["◐", "平局", "32¢", "#696969"]
    ]
  },
  {
    time: "6月13日 · (UTC+7) 02:00",
    volume: "10.98万 交易额",
    teams: [
      ["🇨🇦", "加拿大", "55¢", "#d10012"],
      ["🇧🇦", "波黑", "20¢", "#2f72b8"],
      ["◐", "平局", "27¢", "#696969"]
    ]
  }
];

export function V2AgentWalletScreen({ apiBaseUrl }: { apiBaseUrl: string }) {
  const { getAccessToken, isReady, logout, user } = usePrivy();
  const { sendCode, loginWithCode, state } = useLoginWithEmail();
  const { wallets, create } = useEmbeddedEthereumWallet();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [input, setInput] = useState("");
  const [walletProvisioning, setWalletProvisioning] = useState(false);
  const [walletProvisionError, setWalletProvisionError] = useState<string | undefined>();
  const [activeTab, setActiveTab] = useState<MainTab>("agent");
  const [worldCupExplore, setWorldCupExplore] = useState<V2WorldCupExploreView | undefined>();
  const [worldCupExploreLoading, setWorldCupExploreLoading] = useState(false);
  const [worldCupExploreError, setWorldCupExploreError] = useState<string | undefined>();
  const walletProvisionAttemptRef = useRef<string | undefined>(undefined);
  const walletAutoSyncKeyRef = useRef<string | undefined>(undefined);
  const walletAddress = wallets[0]?.address as `0x${string}` | undefined;
  const worldCupApi = useMemo(() => createApi(apiBaseUrl, getAccessToken), [apiBaseUrl, getAccessToken]);
  const agent = useV2AgentWallet({
    apiBaseUrl,
    getAccessToken,
    isReady,
    userId: user?.id,
    walletAddress
  });
  const privyWalletStatus = createPrivyHWalletStatus({
    isReady,
    hasUser: Boolean(user),
    walletAddress,
    backendWalletAddress: agent.session.wallet?.status === "ready" ? agent.session.wallet.address : undefined,
    isProvisioning: walletProvisioning,
    provisionError: walletProvisionError
  });

  useEffect(() => {
    if (!isReady || !user || activeTab !== "worldcup") return;

    let cancelled = false;
    setWorldCupExploreLoading(true);
    setWorldCupExploreError(undefined);

    worldCupApi
      .getWorldCupExplore()
      .then((explore) => {
        if (!cancelled) setWorldCupExplore(explore);
      })
      .catch((error) => {
        if (!cancelled) setWorldCupExploreError(error instanceof Error ? error.message : "世界杯数据暂时不可用");
      })
      .finally(() => {
        if (!cancelled) setWorldCupExploreLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab, isReady, user, worldCupApi]);

  useEffect(() => {
    if (!walletAddress) return;
    setWalletProvisionError(undefined);
  }, [walletAddress]);

  useEffect(() => {
    if (!isReady || !user || walletAddress || walletProvisioning) return;
    if (walletProvisionAttemptRef.current === user.id) return;

    let cancelled = false;
    walletProvisionAttemptRef.current = user.id;
    setWalletProvisioning(true);
    setWalletProvisionError(undefined);

    create({ createAdditional: false })
      .catch((error) => {
        if (cancelled) return;
        setWalletProvisionError(error instanceof Error ? error.message : "HWallet 创建失败，请稍后再试。");
      })
      .finally(() => {
        if (!cancelled) setWalletProvisioning(false);
      });

    return () => {
      cancelled = true;
    };
  }, [create, isReady, user, walletAddress, walletProvisioning]);

  async function retryHWalletProvisioning() {
    if (!isReady || !user || walletAddress || walletProvisioning) return;

    walletProvisionAttemptRef.current = user.id;
    setWalletProvisioning(true);
    setWalletProvisionError(undefined);

    try {
      await create({ createAdditional: false });
    } catch (error) {
      setWalletProvisionError(error instanceof Error ? error.message : "HWallet 创建失败，请稍后再试。");
    } finally {
      setWalletProvisioning(false);
    }
  }

  useEffect(() => {
    if (activeTab !== "wallet") {
      walletAutoSyncKeyRef.current = undefined;
      return;
    }
    if (!isReady || !user || !walletAddress || agent.session.busy) return;

    const syncKey = `${user.id}:${walletAddress}`;
    if (walletAutoSyncKeyRef.current === syncKey) return;
    walletAutoSyncKeyRef.current = syncKey;
    void agent.syncWalletState();
  }, [activeTab, agent.session.busy, agent.syncWalletState, isReady, user, walletAddress]);

  async function run(action: () => Promise<unknown>) {
    try {
      await action();
    } catch (error) {
      Alert.alert("Agent Wallet", error instanceof Error ? error.message : "请求失败");
    }
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setInput("");
    setActiveTab("agent");
    await agent.sendText(trimmed);
    if (shouldOpenWalletAfterAgentText(trimmed)) {
      setActiveTab("wallet");
    }
  }

  async function startAgentFromWallet() {
    setActiveTab("agent");
    await agent.sendText("好了，继续");
  }

  if (!isReady) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.login}>
          <Text style={styles.loginBrand}>海豚社区</Text>
          <Text style={styles.loginTitle}>一句话，交给 Agent</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            inputMode="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            placeholder="邮箱"
            placeholderTextColor="#9f9992"
            style={styles.loginInput}
          />
          <Pressable style={styles.loginButton} onPress={() => run(() => sendCode({ email }))}>
            <Text style={styles.loginButtonText}>发送验证码</Text>
          </Pressable>
          <TextInput
            inputMode="numeric"
            keyboardType="number-pad"
            value={code}
            onChangeText={setCode}
            placeholder="验证码"
            placeholderTextColor="#9f9992"
            style={styles.loginInput}
          />
          <Pressable
            style={styles.loginButton}
            onPress={() =>
              run(async () => {
                await loginWithCode({ email, code });
                setCode("");
              })
            }
          >
            <Text style={styles.loginButtonText}>进入海豚社区</Text>
          </Pressable>
          <Text style={styles.loginState}>{state.status}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.shell}>
        {activeTab !== "worldcup" ? (
          <TopBar
            onLeft={() => setActiveTab("worldcup")}
            onRight={() => setActiveTab("mine")}
            rightActive={activeTab === "mine"}
          />
        ) : null}

        {activeTab === "agent" ? (
          <AgentTab
            busy={agent.session.busy}
            error={agent.session.error}
            input={input}
            messages={agent.session.messages}
            quickPrompts={agent.session.home?.quickPrompts || []}
            setInput={setInput}
            onSend={(text) => run(() => send(text))}
            onAction={(action, card) => run(() => agent.runCardAction({ action, card }))}
            onWallet={() => setActiveTab("wallet")}
          />
        ) : null}

        {activeTab === "worldcup" ? (
          <WorldCupTab
            explore={worldCupExplore}
            exploreError={worldCupExploreError}
            exploreLoading={worldCupExploreLoading}
            items={agent.session.home?.panels.topLeft.items || []}
            onAsk={(text) => run(() => send(text))}
            onAnalyzeMarket={(text, market) => run(() => agent.analyzeMarket(text, market))}
            onHome={() => setActiveTab("agent")}
            onProfile={() => setActiveTab("mine")}
          />
        ) : null}

        {activeTab === "mine" ? (
          <MineTab
            audit={agent.session.audit}
            walletAddress={walletAddress}
            trackingCount={agent.session.home?.state.trackingCount || 0}
            strategyCount={agent.session.home?.state.strategyCount || 0}
            recordCount={agent.session.home?.state.recordCount || 0}
            recent={agent.session.home?.recent}
            onRefresh={() => run(() => agent.refreshHome())}
            onLogout={() => run(logout)}
          />
        ) : null}

        {activeTab === "wallet" ? (
          <HWalletTab
            audit={agent.session.audit}
            isProvisioning={walletProvisioning}
            provisionError={walletProvisionError}
            privyStatus={privyWalletStatus}
            sessionError={agent.session.error}
            memory={agent.session.memory}
            wallet={agent.session.wallet}
            walletAddress={walletAddress}
            busy={agent.session.busy}
            onRefresh={() => run(() => agent.refreshWallet())}
            onOpenCard={(card) => {
              agent.openCard(card);
              setActiveTab("agent");
            }}
            onOpenPrediction={() => setActiveTab("worldcup")}
            onRetryProvision={() => run(retryHWalletProvisioning)}
            onStartAgent={() => run(startAgentFromWallet)}
            onVerifyTx={(txHash) => run(() => agent.verifyWalletTx(txHash))}
          />
        ) : null}

        {activeTab !== "worldcup" ? (
          <BottomNav
            activeTab={activeTab}
            onChange={setActiveTab}
            onNewChat={() => {
                setInput("");
                setActiveTab("agent");
              }}
            onWallet={() => setActiveTab("wallet")}
          />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function TopBar({
  onLeft,
  onRight,
  rightActive
}: {
  onLeft: () => void;
  onRight: () => void;
  rightActive: boolean;
}) {
  return (
    <View style={styles.topbar}>
      <Pressable style={styles.roundButton} onPress={onLeft}>
        <Ionicons name="menu" size={24} color="#1c1a17" />
      </Pressable>
      <View style={styles.topbarCenterSpacer} />
      <Pressable style={[styles.roundButton, rightActive ? styles.roundButtonActive : null]} onPress={onRight}>
        <Ionicons name="person-outline" size={21} color="#1c1a17" />
      </Pressable>
    </View>
  );
}

function AgentTab({
  busy,
  error,
  input,
  messages,
  quickPrompts,
  setInput,
  onSend,
  onAction,
  onWallet
}: {
  busy: boolean;
  error?: string;
  input: string;
  messages: V2MobileChatMessage[];
  quickPrompts: { id: string; text: string }[];
  setInput: (value: string) => void;
  onSend: (text: string) => void;
  onAction: (action: "simulate" | "track" | "build_strategy", card: V2ConversationCard) => void;
  onWallet: () => void;
}) {
  const [worldCupView, setWorldCupView] = useState<WorldCupView>("home");
  const [category, setCategory] = useState<MarketCategory>("冠军");
  const [selectedMarket, setSelectedMarket] = useState<V2WorldCupExploreMarketCard | undefined>();

  if (worldCupView === "explore") {
    return (
      <ExploreWorldCupPage
        activeCategory={category}
        onBack={() => setWorldCupView("home")}
        onCategoryChange={setCategory}
        onSelectCard={(card) => {
          setSelectedMarket(card);
          setWorldCupView("detail");
        }}
        onHome={() => setWorldCupView("home")}
        onNewChat={() => setWorldCupView("home")}
        onProfile={() => setWorldCupView("home")}
      />
    );
  }

  if (worldCupView === "detail" && selectedMarket) {
    return (
      <WorldCupMarketDetailPage
        card={selectedMarket}
        onBack={() => setWorldCupView("explore")}
        onAskAgent={(card) => {
          onSend(`帮我继续分析：${card.displayTitle || card.title}`);
          setWorldCupView("home");
        }}
        onExplore={() => setWorldCupView("explore")}
        onHome={() => setWorldCupView("home")}
        onNewChat={() => setWorldCupView("home")}
        onProfile={() => setWorldCupView("home")}
      />
    );
  }

  return (
    <View style={styles.agentScreen}>
      <ScrollView
        contentContainerStyle={[styles.messages, messages.length === 0 ? styles.messagesEmpty : null]}
        showsVerticalScrollIndicator={false}
      >
        {messages.length === 0 ? (
          <View style={styles.hero}>
            <Text style={styles.heroTitle}>海豚，一切可好？</Text>
            <View style={styles.promptStack}>
              {quickPrompts.slice(0, 2).map((prompt) => (
                <Pressable key={prompt.id} style={styles.prompt} onPress={() => onSend(prompt.text)}>
                  <Text style={styles.promptText}>{prompt.text}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} onAction={onAction} onWallet={onWallet} />
        ))}
      </ScrollView>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.composerWrap}>
        <View style={styles.composer}>
          <Pressable style={styles.plusButton}>
            <Ionicons name="add" size={24} color="#1f1d1a" />
          </Pressable>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="和 Agent 说一句"
            placeholderTextColor="#817a72"
            style={styles.composerInput}
            returnKeyType="send"
            onSubmitEditing={() => onSend(input)}
          />
          <Pressable
            style={styles.voiceButton}
            disabled={busy || !input.trim()}
            onPress={() => {
              const text = input;
              setInput("");
              onSend(text);
            }}
          >
            {busy ? <ActivityIndicator /> : <Ionicons name={input.trim() ? "arrow-up" : "options-outline"} size={21} color="#1f1d1a" />}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function WorldCupTab({
  explore,
  exploreError,
  exploreLoading,
  items,
  onAsk,
  onAnalyzeMarket,
  onHome,
  onProfile
}: {
  explore?: V2WorldCupExploreView;
  exploreError?: string;
  exploreLoading: boolean;
  items: { id: string; title: string; subtitle?: string; value?: string }[];
  onAsk: (text: string) => void;
  onAnalyzeMarket: (text: string, market: V2MarketSnapshot) => void;
  onHome: () => void;
  onProfile: () => void;
}) {
  const [worldCupView, setWorldCupView] = useState<WorldCupView>("home");
  const [category, setCategory] = useState<MarketCategory>("冠军");
  const [selectedMarket, setSelectedMarket] = useState<V2WorldCupExploreMarketCard | undefined>();
  const insight = createWorldCupInsightCopy(explore);
  const previewCards = createWorldCupPreviewCards(explore);

  if (worldCupView === "explore") {
    return (
      <ExploreWorldCupPage
        activeCategory={category}
        explore={explore}
        exploreError={exploreError}
        exploreLoading={exploreLoading}
        onBack={() => setWorldCupView("home")}
        onCategoryChange={setCategory}
        onHome={() => setWorldCupView("home")}
        onNewChat={onHome}
        onProfile={onProfile}
        onSelectCard={(card) => {
          setSelectedMarket(card);
          setWorldCupView("detail");
        }}
      />
    );
  }

  if (worldCupView === "detail" && selectedMarket) {
    return (
      <WorldCupMarketDetailPage
        card={selectedMarket}
        onBack={() => setWorldCupView("explore")}
        onAskAgent={(card) => {
          onAnalyzeMarket(`帮我继续分析：${card.displayTitle || card.title}`, card.market);
          onHome();
        }}
        onExplore={() => setWorldCupView("explore")}
        onHome={() => setWorldCupView("home")}
        onNewChat={onHome}
        onProfile={onProfile}
      />
    );
  }

  return (
    <View style={styles.worldCupShell}>
      <ScrollView contentContainerStyle={styles.worldCupPage} showsVerticalScrollIndicator={false}>
        <ImageBackground
          source={worldCupPoster}
          resizeMode="cover"
          style={styles.eventHero}
          imageStyle={styles.eventHeroImage}
        >
          <Text style={styles.worldCupLabel}>世界杯狂欢季</Text>
          <Text style={styles.worldCupTitle}>跟着 Agent 看世界杯，瓜分 USDT 奖池</Text>
          <Text style={styles.worldCupNote}>距离结束 42天 03时 46分 08秒</Text>
        </ImageBackground>

        <View style={styles.rewardCard}>
          <View style={styles.rewardTop}>
            <View style={styles.rewardCol}>
              <Text style={styles.rewardLabel}>社区奖池</Text>
              <Text style={styles.rewardValue}>5,000 USDT</Text>
            </View>
            <View style={styles.rewardCol}>
              <Text style={styles.rewardLabel}>已跟随 Agent</Text>
              <Text style={styles.rewardValue}>6,896 人</Text>
            </View>
          </View>
          <View style={styles.rewardScale}>
            <Text style={styles.scaleText}>奖池</Text>
            <Text style={styles.scaleText}>1k</Text>
            <Text style={styles.scaleText}>3k</Text>
            <Text style={styles.scaleText}>5k</Text>
            <Text style={styles.scaleText}>8k</Text>
            <Text style={styles.scaleText}>12k</Text>
            <Text style={styles.scaleText}>20k</Text>
          </View>
          <View style={styles.rewardTrack}>
            <View style={styles.rewardFill} />
            {[0, 1, 2, 3, 4, 5].map((dot) => (
              <View key={dot} style={styles.rewardDot} />
            ))}
          </View>
          <View style={styles.rewardScale}>
            <Text style={styles.scaleMuted}>Agent</Text>
            <Text style={styles.scaleMuted}>1千</Text>
            <Text style={styles.scaleMuted}>3千</Text>
            <Text style={styles.scaleMuted}>5千</Text>
            <Text style={styles.scaleMuted}>1万</Text>
            <Text style={styles.scaleMuted}>2万</Text>
            <Text style={styles.scaleMuted}>5万</Text>
          </View>
        </View>

        <View style={styles.scoreSection}>
          <View style={styles.sectionTitleRow}>
            <View>
              <Text style={styles.bigSectionTitle}>我的 Agent 战绩</Text>
              <Text style={styles.sectionSub}>Agent 预测、跟踪和执行都会累计积分</Text>
            </View>
            <Pressable style={styles.helpPill}>
              <Ionicons name="help-circle-outline" size={15} color={colors.ink} />
              <Text style={styles.helpPillText}>规则</Text>
            </Pressable>
          </View>

          <View style={styles.scoreCard}>
            <View style={styles.scoreTopRow}>
              <View>
                <Text style={styles.scoreLabel}>海豚积分 (xp)</Text>
                <Text style={styles.scoreValue}>64.22</Text>
              </View>
              <Pressable style={styles.smallPill}>
                <Text style={styles.smallPillText}>查看</Text>
              </Pressable>
            </View>
            <View style={styles.scoreDivider} />
            <Text style={styles.scoreLabel}>预计可瓜分</Text>
            <Text style={styles.rewardAmount}>3.62 USDT</Text>
            <Text style={styles.rewardUsd}>按最终排名结算</Text>
          </View>
        </View>

        <Pressable
          style={styles.agentInsightCard}
          onPress={() => {
            if (insight.marketCard) {
              onAnalyzeMarket(`帮我继续分析：${insight.marketCard.displayTitle || insight.marketCard.title}`, insight.marketCard.market);
              onHome();
              return;
            }
            onAsk("继续分析今天的世界杯机会");
          }}
        >
          <View style={styles.agentInsightTop}>
            <Text style={styles.agentInsightLabel}>今日 Agent 观点</Text>
            <Text style={styles.agentInsightStatus}>已更新</Text>
          </View>
          <Text style={styles.agentInsightTitle}>{insight.title}</Text>
          <Text style={styles.agentInsightText}>{insight.text}</Text>
          <View style={styles.agentInsightAction}>
            <Text style={styles.agentInsightActionText}>让 Agent 继续分析</Text>
            <Ionicons name="arrow-forward" size={16} color="#fff" />
          </View>
        </Pressable>

        <View style={styles.taskSection}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.bigSectionTitle}>Agent 任务</Text>
            <Pressable style={styles.helpPill}>
              <Ionicons name="receipt-outline" size={15} color={colors.ink} />
              <Text style={styles.helpPillText}>任务记录</Text>
            </Pressable>
          </View>
          <View style={styles.taskCard}>
            <Text style={styles.taskTitle}>让 Agent 看一场</Text>
            <Text style={styles.taskDesc}>每天完成一次赛事分析，可获得积分；执行或分享会额外加成</Text>
            <View style={styles.checkRow}>
              {["周一", "周二", "周三", "周四", "周五", "周六", "周日"].map((day, index) => (
                <View key={day} style={styles.checkDay}>
                  <View style={[styles.checkCircle, index === 0 ? styles.checkCircleActive : null]}>
                    {index === 0 ? <Ionicons name="checkmark" size={20} color="#fff" /> : null}
                  </View>
                  <Text style={styles.checkText}>{day}</Text>
                </View>
              ))}
            </View>
            <View style={styles.taskBottom}>
              <Text style={styles.taskReward}>+20 xp</Text>
              <Text style={styles.streakTag}>今日已分析 1 场</Text>
              <Text style={styles.disabledPill}>已完成</Text>
            </View>
          </View>
        </View>

        <View style={styles.rankSection}>
          <View style={styles.sectionTitleRow}>
            <View>
              <Text style={styles.bigSectionTitle}>排行榜</Text>
              <Text style={styles.sectionSub}>最近更新于 2026/06/08 18:50</Text>
            </View>
            <Pressable style={styles.helpPill}>
              <Ionicons name="trophy-outline" size={15} color={colors.ink} />
              <Text style={styles.helpPillText}>榜单规则</Text>
            </Pressable>
          </View>
          <View style={styles.rankPodium}>
            {[
              ["海***风", "3,084.44 xp", "158 USDT"],
              ["XD***", "3,679.98 xp", "240 USDT"],
              ["阿***森", "3,075.83 xp", "120 USDT"]
            ].map(([name, xp, btc], index) => (
              <View key={name} style={styles.rankTopCard}>
                <Text style={styles.rankWatermark}>{index === 1 ? "1" : index === 0 ? "2" : "3"}</Text>
                <View style={styles.rankAvatar}>
                  <Text style={styles.rankAvatarText}>{index === 1 ? "VIP" : "海"}</Text>
                </View>
                <Text style={styles.rankName}>{name}</Text>
                <Text style={styles.rankXp}>{xp}</Text>
                <Text style={styles.rankBtc}>{btc}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>探索赛事</Text>
          <Text style={styles.sectionHint}>Agent 实时看</Text>
        </View>

        {previewCards.length > 0 ? previewCards.map((card) => (
          <Pressable
            key={card.id}
            style={styles.watchCard}
            onPress={() => {
              onAnalyzeMarket(`帮我继续分析：${card.displayTitle || card.title}`, card.market);
              onHome();
            }}
          >
            <Text style={styles.watchFlag}>{flagForMarket(card.displayTitle || card.title)}</Text>
            <View style={styles.watchBody}>
              <Text style={styles.watchTitle}>{card.displayTitle || card.title}</Text>
              <Text style={styles.watchMeta}>{card.agentNote || "实时市场"}</Text>
            </View>
            <Text style={styles.watchPrice}>{card.probabilityLabel || optionPriceLabel(card) || "查看"}</Text>
          </Pressable>
        )) : items.slice(0, 2).map((item) => (
          <Pressable key={item.id} style={styles.watchCard} onPress={() => onAsk(item.title)}>
            <Text style={styles.watchFlag}>⚽</Text>
            <View style={styles.watchBody}>
              <Text style={styles.watchTitle}>{item.title}</Text>
              <Text style={styles.watchMeta}>{item.subtitle || "实时市场"}</Text>
            </View>
            <Text style={styles.watchPrice}>{item.value || "查看"}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <WorldCupBottomMenu
        active="home"
        onExplore={() => setWorldCupView("explore")}
        onHome={() => setWorldCupView("home")}
        onNewChat={onHome}
        onPrediction={() => setWorldCupView("home")}
        onProfile={onProfile}
      />
    </View>
  );
}

function WorldCupBottomMenu({
  active,
  onExplore,
  onHome,
  onNewChat,
  onPrediction,
  onProfile
}: {
  active: "home" | "explore";
  onExplore: () => void;
  onHome: () => void;
  onNewChat: () => void;
  onPrediction: () => void;
  onProfile: () => void;
}) {
  return (
    <View style={styles.fixedActionRow}>
      <View style={styles.campaignNavPill}>
        <Pressable style={[styles.campaignNavItem, active === "home" ? styles.campaignNavItemActive : null]} onPress={onHome}>
          <Ionicons name="pulse-outline" size={19} color={colors.ink} />
          <Text style={styles.campaignNavText}>首页</Text>
        </Pressable>
        <Pressable style={styles.campaignNavItem} onPress={onPrediction}>
          <Ionicons name="sparkles-outline" size={19} color={colors.ink} />
          <Text style={styles.campaignNavText}>预测</Text>
        </Pressable>
        <Pressable style={[styles.campaignNavItem, active === "explore" ? styles.campaignNavItemActive : null]} onPress={onExplore}>
          <Ionicons name="calendar-outline" size={19} color={colors.ink} />
          <Text style={styles.campaignNavText}>赛事</Text>
        </Pressable>
        <Pressable style={styles.campaignNavItem} onPress={onProfile}>
          <Ionicons name="compass-outline" size={19} color={colors.ink} />
          <Text style={styles.campaignNavText}>发现</Text>
        </Pressable>
      </View>
      <Pressable style={styles.newChatButton} onPress={onNewChat}>
        <Text style={styles.xMarkText}>×</Text>
      </Pressable>
    </View>
  );
}

function ExploreWorldCupPage({
  activeCategory,
  explore,
  exploreError,
  exploreLoading,
  onBack,
  onCategoryChange,
  onHome,
  onNewChat,
  onProfile,
  onSelectCard
}: {
  activeCategory: MarketCategory;
  explore?: V2WorldCupExploreView;
  exploreError?: string;
  exploreLoading?: boolean;
  onBack: () => void;
  onCategoryChange: (category: MarketCategory) => void;
  onHome: () => void;
  onNewChat: () => void;
  onProfile: () => void;
  onSelectCard: (card: V2WorldCupExploreMarketCard) => void;
}) {
  const activeExploreCategory = exploreCategoryByTab[activeCategory];
  const activeCards = explore?.cards[activeExploreCategory] || [];
  const hasDynamicCards = activeCards.length > 0;
  const hasExploreData = Boolean(explore);
  const sourceText = explore?.source?.label || "赛事数据";
  const sourceMessage = explore?.source?.warning || explore?.source?.message || "Agent 会先整理热度、价格和资金变化。";
  const sourceUpdatedAt = formatExploreUpdatedAt(explore?.source?.updatedAt || explore?.updatedAt);
  const sourceSummary = explore?.summary ? `已同步 ${explore.summary.totalMarkets} 个市场` : undefined;
  const categoryCounts = explore?.summary?.categoryCounts;

  return (
    <View style={styles.worldCupShell}>
      <ScrollView contentContainerStyle={styles.explorePage} showsVerticalScrollIndicator={false}>
        <View style={styles.exploreHeader}>
          <Pressable style={styles.exploreBackButton} onPress={onBack}>
            <Ionicons name="chevron-back" size={24} color={colors.ink} />
          </Pressable>
          <Text style={styles.exploreTitle}>探索世界杯</Text>
          <View style={styles.exploreHeaderGhost} />
        </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.marketTabs}>
        {marketCategories.map((category) => (
          <Pressable
            key={category}
            style={[styles.marketTab, activeCategory === category ? styles.marketTabActive : null]}
            onPress={() => onCategoryChange(category)}
          >
            <Text style={[styles.marketTabText, activeCategory === category ? styles.marketTabTextActive : null]}>
              {formatMarketTabLabel(category, categoryCounts)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {exploreLoading ? (
        <View style={styles.exploreStatusRow}>
          <ActivityIndicator size="small" />
          <Text style={styles.exploreStatusText}>正在更新世界杯数据</Text>
        </View>
      ) : null}

      {!exploreLoading ? (
        <View style={styles.exploreSourceCard}>
          <Text style={styles.exploreSourceLabel}>{sourceText}</Text>
          <Text style={styles.exploreSourceText}>{exploreError ? "先展示赛事样例，数据稍后自动更新。" : sourceMessage}</Text>
          {sourceSummary ? <Text style={styles.exploreSourceText}>{sourceSummary}</Text> : null}
          {sourceUpdatedAt ? <Text style={styles.exploreSourceTime}>更新于 {sourceUpdatedAt}</Text> : null}
        </View>
      ) : null}

      {hasDynamicCards && activeCategory === "冠军" ? <DynamicChampionMarketGrid cards={activeCards} onSelectCard={onSelectCard} /> : null}
      {hasDynamicCards && activeCategory === "金靴奖得主" ? <DynamicGoldenBootMarketList cards={activeCards} onSelectCard={onSelectCard} /> : null}
      {hasDynamicCards && activeCategory === "小组赛" ? <DynamicGroupMarketList cards={activeCards} onSelectCard={onSelectCard} /> : null}
      {hasDynamicCards && activeCategory === "近期比赛" ? <DynamicMatchMarketList cards={activeCards} onSelectCard={onSelectCard} /> : null}

      {hasExploreData && !hasDynamicCards && !exploreLoading ? <ExploreEmptyState category={activeCategory} /> : null}
      {!hasExploreData && !hasDynamicCards && activeCategory === "冠军" ? <ChampionMarketGrid /> : null}
      {!hasExploreData && !hasDynamicCards && activeCategory === "金靴奖得主" ? <GoldenBootMarketList /> : null}
      {!hasExploreData && !hasDynamicCards && activeCategory === "小组赛" ? <GroupMarketList /> : null}
        {!hasExploreData && !hasDynamicCards && activeCategory === "近期比赛" ? <MatchMarketList /> : null}
      </ScrollView>
      <WorldCupBottomMenu
        active="explore"
        onExplore={() => undefined}
        onHome={onHome}
        onNewChat={onNewChat}
        onPrediction={onHome}
        onProfile={onProfile}
      />
    </View>
  );
}

function ExploreEmptyState({ category }: { category: MarketCategory }) {
  const textByCategory: Record<MarketCategory, string> = {
    "冠军": "冠军市场暂时没有可展示数据。",
    "金靴奖得主": "金靴市场暂时没有可展示数据。",
    "小组赛": "小组赛市场暂时没有可展示数据。",
    "近期比赛": "近期比赛还没同步出来，先看冠军和金靴市场。"
  };

  return (
    <View style={styles.exploreEmptyCard}>
      <Text style={styles.exploreEmptyTitle}>{category}</Text>
      <Text style={styles.exploreEmptyText}>{textByCategory[category]}</Text>
    </View>
  );
}

function formatMarketTabLabel(
  category: MarketCategory,
  counts?: Record<V2WorldCupExploreCategory, number>
): string {
  if (!counts) return category;
  return `${category} ${counts[exploreCategoryByTab[category]] || 0}`;
}

function DynamicChampionMarketGrid({
  cards,
  onSelectCard
}: {
  cards: V2WorldCupExploreMarketCard[];
  onSelectCard: (card: V2WorldCupExploreMarketCard) => void;
}) {
  return (
    <View style={styles.exploreSection}>
      <View style={styles.marketSectionTitleRow}>
        <View style={styles.marketIconBadge}>
          <Text style={styles.marketIconText}>⚽</Text>
        </View>
        <Text style={styles.marketSectionTitle}>2026 年世界杯冠军</Text>
        <Ionicons name="chevron-forward" size={22} color={colors.ink} />
      </View>
      <View style={styles.championGrid}>
        {cards.slice(0, 12).map((card, index) => (
          <Pressable key={card.id} style={styles.championItem} onPress={() => onSelectCard(card)}>
            <View style={[styles.championFlagCard, { backgroundColor: championCardColor(index) }]}>
              <Text style={styles.championFlag}>{flagForMarket(card.displayTitle || card.title)}</Text>
              <Text style={styles.championPercent}>{card.probabilityLabel || optionPriceLabel(card) || "观察"}</Text>
            </View>
            <Text style={styles.championName}>{card.displayName || shortMarketTitle(card.title)}</Text>
            <Text style={styles.championVolume}>{card.volumeLabel || card.subtitle || "实时市场"}</Text>
            {card.agentNote ? <Text style={styles.championNote} numberOfLines={2}>{card.agentNote}</Text> : null}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function DynamicGoldenBootMarketList({
  cards,
  onSelectCard
}: {
  cards: V2WorldCupExploreMarketCard[];
  onSelectCard: (card: V2WorldCupExploreMarketCard) => void;
}) {
  return (
    <View style={styles.exploreCardList}>
      {cards.slice(0, 16).map((card) => (
        <Pressable key={card.id} style={styles.playerMarketCard} onPress={() => onSelectCard(card)}>
          <View style={styles.playerTopRow}>
            <Text style={styles.playerFlag}>{flagForMarket(card.displayTitle || card.title)}</Text>
            <View style={styles.playerTextStack}>
              <Text style={styles.playerName}>{card.displayName || shortMarketTitle(card.title)}</Text>
              <Text style={styles.marketQuestion} numberOfLines={2}>{card.displayTitle || card.title}</Text>
            </View>
            <Text style={styles.playerPercent}>{card.probabilityLabel || optionPriceLabel(card) || "观察"}</Text>
          </View>
          <View style={styles.playerTrack}>
            <View style={[styles.playerTrackFill, { width: probabilityWidth(card) }]} />
          </View>
          <View style={styles.yesNoRow}>
            <Text style={styles.yesPill}>{card.options[0]?.priceLabel ? `Yes ${card.options[0].priceLabel}` : "Yes"}</Text>
            <Text style={styles.noPill}>{card.options[1]?.priceLabel ? `No ${card.options[1].priceLabel}` : "No"}</Text>
          </View>
          {card.agentNote ? <Text style={styles.marketAgentNote}>{card.agentNote}</Text> : null}
          <Text style={styles.marketVolume}>{card.volumeLabel || card.subtitle || "世界杯数据展示"}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function DynamicGroupMarketList({
  cards,
  onSelectCard
}: {
  cards: V2WorldCupExploreMarketCard[];
  onSelectCard: (card: V2WorldCupExploreMarketCard) => void;
}) {
  return (
    <View style={styles.exploreCardList}>
      {cards.slice(0, 16).map((card) => (
        <Pressable key={card.id} style={styles.groupMarketCard} onPress={() => onSelectCard(card)}>
          <Text style={styles.groupTitle}>{groupTitleFromCard(card)}</Text>
          <View style={styles.groupTeamList}>
            <View style={styles.groupTeamRow}>
              <Text style={styles.groupFlag}>{flagForMarket(card.displayTitle || card.title)}</Text>
              <View style={styles.groupTeamStack}>
                <Text style={styles.groupTeamName}>{card.displayName || shortMarketTitle(card.title)}</Text>
                {card.agentNote ? <Text style={styles.marketAgentNote}>{card.agentNote}</Text> : null}
              </View>
              <Text style={styles.groupPrice}>{optionPriceLabel(card) || card.probabilityLabel || "观察"}</Text>
            </View>
          </View>
          <Text style={styles.marketVolume}>{card.volumeLabel || card.subtitle || "世界杯数据展示"}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function DynamicMatchMarketList({
  cards,
  onSelectCard
}: {
  cards: V2WorldCupExploreMarketCard[];
  onSelectCard: (card: V2WorldCupExploreMarketCard) => void;
}) {
  return (
    <View style={styles.exploreCardList}>
      {cards.slice(0, 16).map((card) => (
        <Pressable key={card.id} style={styles.matchMarketCard} onPress={() => onSelectCard(card)}>
          <View style={styles.matchTimeRow}>
            <Text style={styles.matchMarketTime}>{card.subtitle || "赛程更新中"}</Text>
            {card.timing ? (
              <Text style={[styles.matchTimingBadge, timingBadgeStyle(card.timing.status)]}>
                {matchTimingBadgeText(card.timing.status)}
              </Text>
            ) : null}
          </View>
          <View style={styles.groupTeamList}>
            <View style={styles.groupTeamRow}>
              <Text style={styles.groupFlag}>{flagForMarket(card.displayTitle || card.title)}</Text>
              <View style={styles.groupTeamStack}>
                <Text style={styles.groupTeamName}>{card.displayName || shortMarketTitle(card.title)}</Text>
                <Text style={styles.marketQuestion} numberOfLines={2}>{card.displayTitle || card.title}</Text>
              </View>
              <Text style={[styles.matchPrice, { backgroundColor: "#00866a" }]}>{optionPriceLabel(card) || card.probabilityLabel || "观察"}</Text>
            </View>
            {card.options.find((option) => option.side === "no")?.priceLabel ? (
              <View style={styles.groupTeamRow}>
                <Text style={styles.groupFlag}>◐</Text>
                <Text style={styles.groupTeamName}>另一边</Text>
                <Text style={[styles.matchPrice, { backgroundColor: "#696969" }]}>
                  {card.options.find((option) => option.side === "no")?.priceLabel}
                </Text>
              </View>
            ) : null}
          </View>
          {card.agentNote ? <Text style={styles.marketAgentNote}>{card.agentNote}</Text> : null}
          <Text style={styles.marketVolume}>{card.volumeLabel || "世界杯数据展示"}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function WorldCupMarketDetailPage({
  card,
  onBack,
  onExplore,
  onHome,
  onAskAgent,
  onNewChat,
  onProfile
}: {
  card: V2WorldCupExploreMarketCard;
  onBack: () => void;
  onExplore: () => void;
  onHome: () => void;
  onAskAgent: (card: V2WorldCupExploreMarketCard) => void;
  onNewChat: () => void;
  onProfile: () => void;
}) {
  const yesOption = card.options.find((option) => option.side === "yes") || card.options[0];
  const noOption = card.options.find((option) => option.side === "no") || card.options[1];

  return (
    <View style={styles.worldCupShell}>
      <ScrollView contentContainerStyle={styles.marketDetailPage} showsVerticalScrollIndicator={false}>
        <View style={styles.exploreHeader}>
          <Pressable style={styles.exploreBackButton} onPress={onBack}>
            <Ionicons name="chevron-back" size={24} color={colors.ink} />
          </Pressable>
          <Text style={styles.exploreTitle}>市场详情</Text>
          <View style={styles.exploreHeaderGhost} />
        </View>

      <View style={styles.marketDetailHero}>
        <View style={styles.marketDetailFlag}>
          <Text style={styles.marketDetailFlagText}>{flagForMarket(card.displayTitle || card.title)}</Text>
        </View>
        <Text style={styles.marketDetailName}>{card.displayName || shortMarketTitle(card.title)}</Text>
        <Text style={styles.marketDetailTitle}>{card.displayTitle || card.title}</Text>
        <View style={styles.playerTrack}>
          <View style={[styles.playerTrackFill, { width: probabilityWidth(card) }]} />
        </View>
      </View>

      <View style={styles.marketDetailOddsRow}>
        <View style={styles.marketDetailOddCard}>
          <Text style={styles.marketDetailOddLabel}>会</Text>
          <Text style={styles.marketDetailOddValue}>{card.probabilityLabel || yesOption?.priceLabel || "观察"}</Text>
        </View>
        <View style={styles.marketDetailOddCard}>
          <Text style={styles.marketDetailOddLabel}>不会</Text>
          <Text style={styles.marketDetailOddValue}>{noOption?.priceLabel || "观察"}</Text>
        </View>
      </View>

      <View style={styles.marketDetailInfoCard}>
        <Text style={styles.marketDetailSectionTitle}>Agent 观察</Text>
        <Text style={styles.marketDetailNote}>{card.agentNote || "数据已经同步，先观察热度和资金变化。"}</Text>
        <View style={styles.marketDetailMetaRow}>
          <Text style={styles.marketDetailMeta}>数据来源</Text>
          <Text style={styles.marketDetailMetaValue}>{marketProviderLabel(card.market.provider)}</Text>
        </View>
        <View style={styles.marketDetailMetaRow}>
          <Text style={styles.marketDetailMeta}>交易额</Text>
          <Text style={styles.marketDetailMetaValue}>{card.volumeLabel || "实时更新"}</Text>
        </View>
        <View style={styles.marketDetailMetaRow}>
          <Text style={styles.marketDetailMeta}>结束时间</Text>
          <Text style={styles.marketDetailMetaValue}>{formatMarketEndTime(card.market.endDate) || "待同步"}</Text>
        </View>
        <View style={styles.marketDetailMetaRow}>
          <Text style={styles.marketDetailMeta}>市场类型</Text>
          <Text style={styles.marketDetailMetaValue}>{marketTypeLabel(card.market.marketType)}</Text>
        </View>
        <View style={styles.marketDetailMetaRow}>
          <Text style={styles.marketDetailMeta}>状态</Text>
          <Text style={styles.marketDetailMetaValue}>{marketStatusLabel(card)}</Text>
        </View>
      </View>

        <Pressable style={styles.marketDetailPrimaryButton} onPress={() => onAskAgent(card)}>
          <Text style={styles.marketDetailPrimaryText}>让 Agent 继续分析</Text>
          <Ionicons name="arrow-forward" size={20} color="#fff" />
        </Pressable>
      </ScrollView>
      <WorldCupBottomMenu
        active="explore"
        onExplore={onExplore}
        onHome={onHome}
        onNewChat={onNewChat}
        onPrediction={onHome}
        onProfile={onProfile}
      />
    </View>
  );
}

function ChampionMarketGrid() {
  return (
    <View style={styles.exploreSection}>
      <View style={styles.marketSectionTitleRow}>
        <View style={styles.marketIconBadge}>
          <Text style={styles.marketIconText}>⚽</Text>
        </View>
        <Text style={styles.marketSectionTitle}>2026 年世界杯冠军</Text>
        <Ionicons name="chevron-forward" size={22} color={colors.ink} />
      </View>
      <View style={styles.championGrid}>
        {championMarkets.map((market) => (
          <Pressable key={market.name} style={styles.championItem}>
            <View style={[styles.championFlagCard, { backgroundColor: market.color }]}>
              <Text style={styles.championFlag}>{market.flag}</Text>
              <Text style={styles.championPercent}>{market.percent}</Text>
            </View>
            <Text style={styles.championName}>{market.name}</Text>
            <Text style={styles.championVolume}>{market.volume}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function createWorldCupInsightCopy(explore?: V2WorldCupExploreView): {
  title: string;
  text: string;
  marketCard?: V2WorldCupExploreMarketCard;
} {
  const champion = explore?.cards.champion?.[0];
  const group = explore?.cards.group_stage?.[0];
  const second = group || explore?.cards.golden_boot?.[0];

  if (!champion) {
    return {
      title: "先观察冠军盘，等实时数据更新。",
      text: "Agent 会优先看交易额、价格和热度变化，数据稳定后再给你重点方向。"
    };
  }

  const championName = champion.displayName || shortMarketTitle(champion.displayTitle || champion.title);
  const championPrice = champion.probabilityLabel || optionPriceLabel(champion) || "观察中";

  if (second) {
    const secondName = second.displayName || shortMarketTitle(second.displayTitle || second.title);
    return {
      title: `先看${championName}冠军盘，再跟踪${secondName}。`,
      text: `${championName}当前热度靠前，市场给到 ${championPrice}。我会继续看价格、成交和资金变化。`,
      marketCard: champion
    };
  }

  return {
    title: `先看${championName}冠军盘。`,
    text: `${championName}当前热度靠前，市场给到 ${championPrice}。我会继续看价格、成交和资金变化。`,
    marketCard: champion
  };
}

function createWorldCupPreviewCards(explore?: V2WorldCupExploreView): V2WorldCupExploreMarketCard[] {
  if (!explore) return [];
  return [
    ...explore.cards.champion.slice(0, 1),
    ...(explore.cards.group_stage[0] ? explore.cards.group_stage.slice(0, 1) : explore.cards.golden_boot.slice(0, 1))
  ].slice(0, 2);
}

function GoldenBootMarketList() {
  return (
    <View style={styles.exploreCardList}>
      {goldenBootMarkets.map((market) => (
        <View key={market.name} style={styles.playerMarketCard}>
          <View style={styles.playerTopRow}>
            <Text style={styles.playerFlag}>{market.flag}</Text>
            <Text style={styles.playerName}>{market.name}</Text>
            <Text style={styles.playerPercent}>{market.percent}</Text>
          </View>
          <View style={styles.playerTrack}>
            <View style={[styles.playerTrackFill, { width: market.percent as `${number}%` }]} />
          </View>
          <View style={styles.yesNoRow}>
            <Text style={styles.yesPill}>{market.yes}</Text>
            <Text style={styles.noPill}>{market.no}</Text>
          </View>
          <Text style={styles.marketVolume}>{market.volume}</Text>
        </View>
      ))}
      <Pressable style={styles.detailButton}>
        <Text style={styles.detailButtonText}>查看详情</Text>
      </Pressable>
    </View>
  );
}

function GroupMarketList() {
  return (
    <View style={styles.exploreCardList}>
      {groupMarkets.map((group) => (
        <View key={group.title} style={styles.groupMarketCard}>
          <Text style={styles.groupTitle}>{group.title}</Text>
          <View style={styles.groupTeamList}>
            {group.teams.map(([flag, team, price]) => (
              <View key={team} style={styles.groupTeamRow}>
                <Text style={styles.groupFlag}>{flag}</Text>
                <Text style={styles.groupTeamName}>{team}</Text>
                <Text style={styles.groupPrice}>{price}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.marketVolume}>{group.volume}</Text>
        </View>
      ))}
    </View>
  );
}

function MatchMarketList() {
  return (
    <View style={styles.exploreCardList}>
      {matchMarkets.map((match) => (
        <View key={match.time} style={styles.matchMarketCard}>
          <Text style={styles.matchMarketTime}>{match.time}</Text>
          <View style={styles.groupTeamList}>
            {match.teams.map(([flag, team, price, color]) => (
              <View key={`${match.time}-${team}`} style={styles.groupTeamRow}>
                <Text style={styles.groupFlag}>{flag}</Text>
                <Text style={styles.groupTeamName}>{team}</Text>
                <Text style={[styles.matchPrice, { backgroundColor: color }]}>{price}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.marketVolume}>{match.volume}</Text>
        </View>
      ))}
    </View>
  );
}

function MineTab({
  audit,
  walletAddress,
  trackingCount,
  strategyCount,
  recordCount,
  recent,
  onRefresh,
  onLogout
}: {
  audit: V2AuditTimelineEvent[];
  walletAddress?: string;
  trackingCount: number;
  strategyCount: number;
  recordCount: number;
  recent?: V2MobileHomeView["recent"];
  onRefresh: () => void;
  onLogout: () => void;
}) {
  const tracking = recent?.tracking || [];
  const strategies = recent?.strategies || [];
  const records = recent?.records || [];
  const auditEvents = audit || [];

  return (
    <ScrollView contentContainerStyle={styles.minePage} showsVerticalScrollIndicator={false}>
      <View style={styles.assetHeader}>
        <Text style={styles.assetLabel}>资产</Text>
        <Text style={styles.assetValue}>
          {64.22 + trackingCount + strategyCount}
          <Text style={styles.assetUnit}> xp</Text>
        </Text>
        <Text style={styles.assetProfit}>+0 (0.00%) 今日收益</Text>
      </View>

      <View style={styles.assetSplit}>
        <View>
          <Text style={styles.assetSmallLabel}>持仓价值</Text>
          <Text style={styles.assetSmallValue}>{54.22 + trackingCount} xp</Text>
        </View>
        <View>
          <Text style={styles.assetSmallLabel}>可用资产</Text>
          <Text style={styles.assetSmallValue}>10 xp</Text>
        </View>
      </View>

      <Pressable style={styles.greenButton} onPress={onRefresh}>
        <Text style={styles.greenButtonText}>赚取积分</Text>
      </Pressable>

      <View style={styles.mineTabs}>
        <Text style={styles.mineTabActive}>Agent 记录</Text>
        <Text style={styles.mineTabMuted}>跟踪</Text>
        <Text style={styles.mineTabMuted}>策略</Text>
      </View>

      <MineSection title="跟踪中" count={trackingCount}>
        {tracking.length > 0 ? tracking.slice(0, 2).map((card) => <MineTrackingItem key={card.id} card={card} />) : (
          <MineEmptyState text="还没有跟踪中的机会。" />
        )}
      </MineSection>

      <MineSection title="策略" count={strategyCount}>
        {strategies.length > 0 ? strategies.slice(0, 2).map((card) => <MineStrategyItem key={card.id} card={card} />) : (
          <MineEmptyState text="策略生成后会出现在这里。" />
        )}
      </MineSection>

      <MineSection title="最近记录" count={recordCount}>
        {records.length > 0 ? records.slice(0, 3).map((record) => <MineRecordItem key={record.id} record={record} />) : (
          <MineEmptyState text="最近操作会保存在这里。" />
        )}
      </MineSection>

      <MineSection title="Agent 操作" count={auditEvents.length}>
        {auditEvents.length > 0 ? auditEvents.slice(0, 4).map((event) => <MineAuditItem key={event.id} event={event} />) : (
          <MineEmptyState text="Agent 操作记录会出现在这里。" />
        )}
      </MineSection>

      <View style={styles.actionRow}>
        <Pressable style={styles.secondaryButton} onPress={onRefresh}>
          <Text style={styles.secondaryButtonText}>刷新</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={onLogout}>
          <Text style={styles.secondaryButtonText}>退出</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function HWalletTab({
  audit,
  busy,
  isProvisioning,
  provisionError,
  privyStatus,
  sessionError,
  memory,
  wallet,
  walletAddress,
  onRefresh,
  onOpenCard,
  onOpenPrediction,
  onRetryProvision,
  onStartAgent,
  onVerifyTx
}: {
  audit: V2AuditTimelineEvent[];
  busy?: boolean;
  isProvisioning?: boolean;
  provisionError?: string;
  privyStatus: PrivyHWalletStatus;
  sessionError?: string;
  memory?: V2MobileAgentMemory;
  wallet?: V2WalletContext;
  walletAddress?: string;
  onRefresh: () => void;
  onOpenCard: (card: V2ConversationCard) => void;
  onOpenPrediction: () => void;
  onRetryProvision: () => void;
  onStartAgent: () => void;
  onVerifyTx: (txHash: string) => void;
}) {
  const [txHash, setTxHash] = useState("");
  const [addressCopied, setAddressCopied] = useState(false);
  const entryState = createHWalletEntryState({
    busy,
    isProvisioning,
    privyStatus,
    provisionError,
    sessionError,
    wallet,
    walletAddress
  });
  const displayAddress = entryState.displayAddress;
  const canUseReceiveAddress = entryState.canUseReceiveAddress;
  const statusLabel = entryState.statusLabel;
  const networkLabel = entryState.networkLabel;
  const assets = wallet?.assets || [];
  const recentRecords = wallet?.recentRecords || [];
  const verifiedTransfers = memory?.wallet?.verifiedTransfers || [];
  const walletAssets = assets.length ? assets : createPendingWalletAssets();
  const primaryAsset = getPrimaryWalletAsset(walletAssets);
  const syncedAssetCount = walletAssets.filter((asset) => asset.syncStatus === "synced").length;
  const agentWalletState = wallet?.agent || createPendingAgentWalletState(canUseReceiveAddress);
  const vaultState = wallet?.vault || createPendingAgentVaultState(canUseReceiveAddress);
  const lifecycle = wallet?.lifecycle || createPendingWalletLifecycle(canUseReceiveAddress);
  const syncSummary = createWalletSyncSummary(walletAssets, agentWalletState.fundsStatus, canUseReceiveAddress);
  const latestReceivedTransfer = getLatestReceivedTransfer(verifiedTransfers);
  const walletNotice = entryState.walletNotice;
  const walletTxCheckDisabled = entryState.walletTxCheckDisabled;

  async function copyWalletAddress() {
    if (!displayAddress) return;
    await Clipboard.setStringAsync(displayAddress);
    setAddressCopied(true);
    setTimeout(() => setAddressCopied(false), 1800);
    Alert.alert("已复制", "HWallet 地址已复制。");
  }

  async function pasteTxHashFromClipboard() {
    const clipboardText = await Clipboard.getStringAsync();
    const hash = extractTransactionHash(clipboardText);
    if (!hash) {
      Alert.alert("交易哈希", "剪贴板里没有识别到 X Layer 交易哈希。");
      return;
    }
    setTxHash(hash);
  }

  async function pasteAndVerifyTxFromClipboard() {
    if (!canUseReceiveAddress) return;
    const clipboardText = await Clipboard.getStringAsync();
    const hash = extractTransactionHash(clipboardText);
    if (!hash) {
      Alert.alert("交易哈希", "剪贴板里没有识别到 X Layer 交易哈希。");
      return;
    }
    setTxHash("");
    onVerifyTx(hash);
  }

  function submitTxHash() {
    if (!canUseReceiveAddress) return;
    const trimmed = txHash.trim();
    if (!trimmed) {
      Alert.alert("交易哈希", "请粘贴一笔 X Layer 交易哈希。");
      return;
    }
    onVerifyTx(trimmed);
    setTxHash("");
  }

  function openWalletRecord(record: V2WalletContext["recentRecords"][number]) {
    Alert.alert(record.title, `${record.note}\n${formatRecordTime(record.createdAt)}`);
  }

  return (
    <ScrollView contentContainerStyle={styles.hWalletPage} showsVerticalScrollIndicator={false}>
      <View style={styles.hWalletHero}>
        <Text style={styles.hWalletEyebrow}>HWallet</Text>
        <Text style={styles.hWalletTitle}>Agent 的钱包入口</Text>
        <Text style={styles.hWalletText}>
          {entryState.canUseReceiveAddress ? "充值、收款和后续 Agent 资金识别都会从这里进入。" : entryState.receiveHint}
        </Text>
      </View>

      <View style={styles.receiveCard}>
        <View style={styles.receiveCardTop}>
          <View>
            <Text style={styles.receiveCardLabel}>收款地址</Text>
            <Text style={styles.receiveCardTitle}>{shortAddress(displayAddress) || "钱包生成中"}</Text>
          </View>
          <View style={styles.receiveNetworkPill}>
            <Text style={styles.receiveNetworkText}>{networkLabel}</Text>
          </View>
        </View>
        <Text style={styles.receiveCardHint}>
          {entryState.receiveHint}
        </Text>
        {entryState.canRetryProvisioning ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="重新生成 HWallet"
            style={styles.hWalletRetryButton}
            onPress={onRetryProvision}
          >
            <Ionicons name="refresh-outline" size={16} color={colors.ink} />
            <Text style={styles.hWalletRetryText}>重新生成 HWallet</Text>
          </Pressable>
        ) : null}
        <View style={styles.receiveStatsRow}>
          <View style={styles.receiveStatItem}>
            <Text style={styles.receiveStatLabel}>主资产</Text>
            <Text style={styles.receiveStatValue}>
              {primaryAsset ? `${primaryAsset.amountLabel} ${primaryAsset.symbol}` : "待到账"}
            </Text>
          </View>
          <View style={styles.receiveStatItem}>
            <Text style={styles.receiveStatLabel}>Agent</Text>
            <Text style={styles.receiveStatValue}>{formatAgentFundsStatus(agentWalletState.fundsStatus)}</Text>
          </View>
          <View style={styles.receiveStatItem}>
            <Text style={styles.receiveStatLabel}>记录</Text>
            <Text style={styles.receiveStatValue}>{recentRecords.length}</Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="复制 HWallet 收款地址"
          style={[styles.receiveCopyButton, !canUseReceiveAddress ? styles.hWalletDisabledButton : null]}
          disabled={!canUseReceiveAddress}
          onPress={copyWalletAddress}
        >
          <Ionicons name="copy-outline" size={17} color={canUseReceiveAddress ? "#fff" : "#9f9992"} />
          <Text style={[styles.receiveCopyText, !canUseReceiveAddress ? styles.hWalletDisabledText : null]}>
            {addressCopied ? "已复制" : "复制地址"}
          </Text>
        </Pressable>
      </View>

      <HWalletActionStrip
        busy={busy}
        canCopy={canUseReceiveAddress}
        canVerify={canUseReceiveAddress}
        onCopy={copyWalletAddress}
        onPasteAndVerify={pasteAndVerifyTxFromClipboard}
        onRefresh={onRefresh}
        onStartAgent={onStartAgent}
      />

      <WalletSyncSummaryCard summary={syncSummary} onRefresh={onRefresh} />

      {latestReceivedTransfer ? (
        <WalletVerifiedJourneyCard transfer={latestReceivedTransfer} onStartAgent={onStartAgent} />
      ) : null}

      {walletNotice ? (
        <View style={styles.hWalletNoticeCard}>
          <Ionicons name="alert-circle-outline" size={19} color="#8a5b00" />
          <Text style={styles.hWalletNoticeText}>{walletNotice}</Text>
        </View>
      ) : null}

      <View style={styles.hWalletStatusGrid}>
        <View style={styles.hWalletStatusCard}>
          <Text style={styles.hWalletStatusValue}>{statusLabel}</Text>
          <Text style={styles.hWalletStatusLabel}>钱包状态</Text>
        </View>
        <View style={styles.hWalletStatusCard}>
          <Text style={styles.hWalletStatusValue}>{networkLabel}</Text>
          <Text style={styles.hWalletStatusLabel}>默认网络</Text>
        </View>
        <View style={styles.hWalletStatusCard}>
          <Text style={styles.hWalletStatusValue}>{syncedAssetCount}</Text>
          <Text style={styles.hWalletStatusLabel}>已同步资产</Text>
        </View>
      </View>

      <WalletLifecycleCard lifecycle={lifecycle} />

      <View style={styles.walletTxCheckCard}>
        <View style={styles.walletTxCheckHeader}>
          <View>
            <Text style={styles.agentFundsLabel}>查一笔到账</Text>
            <Text style={styles.walletTxCheckTitle}>粘贴交易哈希</Text>
          </View>
          <Ionicons name="receipt-outline" size={22} color={colors.ink} />
        </View>
        <View style={styles.walletTxInputRow}>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            editable={!walletTxCheckDisabled}
            onChangeText={setTxHash}
            placeholder={canUseReceiveAddress ? "0x..." : "钱包生成后可粘贴交易哈希"}
            placeholderTextColor="#aaa39c"
            style={[styles.walletTxInput, !canUseReceiveAddress ? styles.walletTxInputDisabled : null]}
            value={txHash}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="从剪贴板粘贴交易哈希"
            disabled={walletTxCheckDisabled}
            onPress={pasteTxHashFromClipboard}
            style={[styles.walletTxPasteButton, walletTxCheckDisabled ? styles.hWalletDisabledButton : null]}
          >
            <Ionicons name="clipboard-outline" size={17} color={walletTxCheckDisabled ? "#9f9992" : colors.ink} />
            <Text style={[styles.walletTxPasteText, walletTxCheckDisabled ? styles.hWalletDisabledText : null]}>粘贴</Text>
          </Pressable>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="检查交易是否到账"
          disabled={walletTxCheckDisabled}
          onPress={submitTxHash}
          style={[styles.walletTxButton, walletTxCheckDisabled ? styles.hWalletDisabledButton : null]}
        >
          <Text style={[styles.walletTxButtonText, walletTxCheckDisabled ? styles.hWalletDisabledText : null]}>
            {busy ? "正在检查" : "检查到账"}
          </Text>
        </Pressable>
      </View>

      <View style={styles.agentFundsCard}>
        <View style={styles.agentFundsTop}>
          <View>
            <Text style={styles.agentFundsLabel}>Agent 可用状态</Text>
            <Text style={styles.agentFundsTitle}>{agentWalletState.availableText}</Text>
          </View>
          <View style={[
            styles.agentFundsBadge,
            agentWalletState.fundsStatus === "ready" ? styles.agentFundsBadgeReady : null
          ]}>
            <Text style={[
              styles.agentFundsBadgeText,
              agentWalletState.fundsStatus === "ready" ? styles.agentFundsBadgeReadyText : null
            ]}>
              {formatAgentFundsStatus(agentWalletState.fundsStatus)}
            </Text>
          </View>
        </View>
        <Text style={styles.agentFundsText}>{agentWalletState.nextActionText}</Text>
      </View>

      {agentWalletState.fundsStatus === "ready" ? (
        <View style={styles.agentNextTaskCard}>
          <View style={styles.agentNextTaskTop}>
            <View style={styles.agentNextTaskIcon}>
              <Ionicons name="sparkles-outline" size={22} color="#102015" />
            </View>
            <View style={styles.agentNextTaskText}>
              <Text style={styles.agentNextTaskTitle}>Agent 可以开始看盘</Text>
              <Text style={styles.agentNextTaskNote}>资金已识别，下一步让 Agent 看市场机会，仍然只做分析和模拟。</Text>
            </View>
          </View>
          <View style={styles.agentNextTaskActions}>
            <Pressable accessibilityRole="button" style={styles.agentNextPrimaryAction} onPress={onOpenPrediction}>
              <Text style={styles.agentNextPrimaryText}>查看市场机会</Text>
            </Pressable>
            <Pressable accessibilityRole="button" style={styles.agentNextGhostAction} onPress={onRefresh}>
              <Text style={styles.agentNextGhostText}>刷新资产</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <View style={styles.agentVaultCard}>
        <View style={styles.agentVaultHeader}>
          <View style={styles.agentVaultIcon}>
            <Text style={styles.agentVaultIconText}>H</Text>
          </View>
          <View style={styles.agentVaultTitleWrap}>
            <Text style={styles.agentFundsLabel}>{vaultState.title}</Text>
            <Text style={styles.agentVaultTitle}>{vaultState.displayText}</Text>
          </View>
          <Text style={styles.agentVaultStatus}>{formatAgentFundsStatus(vaultState.status)}</Text>
        </View>
        <View style={styles.agentVaultDivider} />
        <Text style={styles.agentVaultText}>{vaultState.sourceText}</Text>
        <Text style={styles.agentVaultMuted}>{vaultState.policyText}</Text>
      </View>

      <View style={styles.hWalletSection}>
        <View style={styles.hWalletSectionHeader}>
          <Text style={styles.hWalletSectionTitle}>资产概览</Text>
          <Text style={styles.hWalletSectionMeta}>只读同步</Text>
        </View>
        <View style={styles.walletAssetList}>
          {walletAssets.map((asset) => (
            <View key={asset.symbol} style={styles.walletAssetCard}>
              <View style={styles.walletAssetIcon}>
                <Text style={styles.walletAssetIconText}>{asset.symbol.slice(0, 1)}</Text>
              </View>
              <View style={styles.walletAssetText}>
                <Text style={styles.walletAssetSymbol}>{asset.symbol}</Text>
                <Text style={styles.walletAssetName}>{asset.name}</Text>
              </View>
              <View style={styles.walletAssetAmount}>
                <Text style={styles.walletAssetAmountText}>{asset.amountLabel}</Text>
                <Text style={styles.walletAssetValueText}>{asset.valueLabel}</Text>
                <Text style={[
                  styles.walletAssetStatusPill,
                  asset.syncStatus === "synced" ? styles.walletAssetStatusSynced : null,
                  asset.syncStatus === "failed" ? styles.walletAssetStatusFailed : null
                ]}>
                  {formatWalletAssetSyncStatus(asset.syncStatus)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.hWalletSection}>
        <View style={styles.hWalletSectionHeader}>
          <Text style={styles.hWalletSectionTitle}>最近钱包记录</Text>
          <Text style={styles.hWalletSectionMeta}>自动更新</Text>
        </View>
        <View style={styles.walletRecordList}>
          {(recentRecords.length ? recentRecords : createPendingWalletRecords(canUseReceiveAddress)).map((record) => {
            const details = createWalletRecordDetails(record);
            return (
            <View key={record.id} style={styles.walletRecordRow}>
              <View style={[styles.walletRecordIcon, { backgroundColor: details.backgroundColor }]}>
                <Ionicons name={details.icon} size={17} color={details.color} />
              </View>
              <View style={styles.walletRecordText}>
                <View style={styles.walletRecordTitleRow}>
                  <Text style={styles.walletRecordTitle}>{record.title}</Text>
                  <Text style={[styles.walletRecordStatus, { color: details.color }]}>{details.label}</Text>
                </View>
                <Text style={styles.walletRecordNote}>{record.note}</Text>
                <Text style={styles.walletRecordTime}>{formatRecordTime(record.createdAt)}</Text>
              </View>
            </View>
            );
          })}
        </View>
      </View>

      <View style={styles.hWalletSection}>
        <View style={styles.hWalletSectionHeader}>
          <Text style={styles.hWalletSectionTitle}>已验证交易</Text>
          <Text style={styles.hWalletSectionMeta}>{verifiedTransfers.length ? `${verifiedTransfers.length} 笔` : "等待验证"}</Text>
        </View>
        <View style={styles.verifiedTransferList}>
          {(verifiedTransfers.length ? verifiedTransfers.slice(0, 5) : createPendingVerifiedTransfers()).map((transfer) => (
            <View key={transfer.txHash} style={styles.verifiedTransferRow}>
              <View style={[
                styles.verifiedTransferIcon,
                transfer.status === "received" ? styles.verifiedTransferIconReady : null
              ]}>
                <Ionicons
                  name={transfer.status === "received" ? "checkmark" : "time-outline"}
                  size={16}
                  color={transfer.status === "received" ? "#fff" : colors.ink}
                />
              </View>
              <View style={styles.verifiedTransferText}>
                <Text style={styles.verifiedTransferTitle}>
                  {transfer.status === "received" ? "已到账" : "已记录"}
                  {transfer.amountLabel && transfer.assetSymbol ? ` · ${transfer.amountLabel} ${transfer.assetSymbol}` : ""}
                </Text>
                <Text style={styles.verifiedTransferHash}>{shortHash(transfer.txHash)}</Text>
              </View>
              <Text style={styles.verifiedTransferTime}>{formatRecordTime(transfer.verifiedAt)}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.hWalletSection}>
        <View style={styles.hWalletSectionHeader}>
          <Text style={styles.hWalletSectionTitle}>Agent 工作记录</Text>
          <Text style={styles.hWalletSectionMeta}>自动记录</Text>
        </View>
        <View style={styles.auditTimelineList}>
          {(audit.length ? audit.slice(0, 5) : createPendingAuditEvents()).map((event) => (
            <AgentWorkTimelineItem
              key={event.id}
              event={event}
              onOpenCard={onOpenCard}
              onOpenWalletRecord={openWalletRecord}
              onRunPrompt={onStartAgent}
            />
          ))}
        </View>
      </View>

      <Pressable accessibilityRole="button" accessibilityLabel="刷新 HWallet 状态" style={styles.hWalletRefreshButton} onPress={onRefresh}>
        <Ionicons name="refresh-outline" size={17} color={colors.ink} />
        <Text style={styles.hWalletRefreshText}>刷新钱包状态</Text>
      </Pressable>
    </ScrollView>
  );
}

function HWalletActionStrip({
  busy,
  canCopy,
  canVerify,
  onCopy,
  onPasteAndVerify,
  onRefresh,
  onStartAgent
}: {
  busy?: boolean;
  canCopy: boolean;
  canVerify: boolean;
  onCopy: () => void;
  onPasteAndVerify: () => void;
  onRefresh: () => void;
  onStartAgent: () => void;
}) {
  return (
    <View style={styles.hWalletActionStrip}>
      <HWalletActionButton
        disabled={!canCopy}
        icon="copy-outline"
        label="收款"
        onPress={onCopy}
      />
      <HWalletActionButton
        disabled={busy || !canVerify}
        icon="receipt-outline"
        label="查到账"
        onPress={onPasteAndVerify}
      />
      <HWalletActionButton
        disabled={busy}
        icon="refresh-outline"
        label="刷新"
        onPress={onRefresh}
      />
      <HWalletActionButton
        disabled={busy}
        icon="sparkles-outline"
        label="找机会"
        onPress={onStartAgent}
      />
    </View>
  );
}

function HWalletActionButton({
  disabled,
  icon,
  label,
  onPress
}: {
  disabled?: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`HWallet ${label}`}
      disabled={disabled}
      onPress={onPress}
      style={[styles.hWalletActionButton, disabled ? styles.hWalletActionButtonDisabled : null]}
    >
      <View style={styles.hWalletActionIcon}>
        <Ionicons name={icon} size={18} color={disabled ? "#aaa39c" : colors.ink} />
      </View>
      <Text style={[styles.hWalletActionText, disabled ? styles.hWalletDisabledText : null]}>{label}</Text>
    </Pressable>
  );
}

function WalletSyncSummaryCard({
  summary,
  onRefresh
}: {
  summary: ReturnType<typeof createWalletSyncSummary>;
  onRefresh: () => void;
}) {
  return (
    <View style={styles.walletSyncSummaryCard}>
      <View style={[styles.walletSyncSummaryIcon, { backgroundColor: summary.iconBackground }]}>
        <Ionicons name={summary.icon} size={19} color={summary.iconColor} />
      </View>
      <View style={styles.walletSyncSummaryText}>
        <Text style={styles.walletSyncSummaryTitle}>{summary.title}</Text>
        <Text style={styles.walletSyncSummaryNote}>{summary.note}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="刷新 HWallet 资产同步状态"
        style={styles.walletSyncSummaryButton}
        onPress={onRefresh}
      >
        <Text style={styles.walletSyncSummaryButtonText}>刷新</Text>
      </Pressable>
    </View>
  );
}

function WalletVerifiedJourneyCard({
  transfer,
  onStartAgent
}: {
  transfer: VerifiedWalletTransfer;
  onStartAgent: () => void;
}) {
  const amount = transfer.amountLabel && transfer.assetSymbol
    ? `${transfer.amountLabel} ${transfer.assetSymbol}`
    : "已确认到账";

  return (
    <View style={styles.walletJourneyCard}>
      <View style={styles.walletJourneyTop}>
        <View style={styles.walletJourneyIcon}>
          <Ionicons name="checkmark" size={19} color="#fff" />
        </View>
        <View style={styles.walletJourneyText}>
          <Text style={styles.walletJourneyTitle}>{amount}</Text>
          <Text style={styles.walletJourneyNote}>这笔资金已经计入 HWallet，Agent 可以继续分析或模拟。</Text>
        </View>
      </View>
      <View style={styles.walletJourneySteps}>
        {["已到账", "Agent 可用", "找机会"].map((step) => (
          <View key={step} style={styles.walletJourneyStep}>
            <View style={styles.walletJourneyStepDot} />
            <Text style={styles.walletJourneyStepText}>{step}</Text>
          </View>
        ))}
      </View>
      <View style={styles.walletJourneyFooter}>
        <Text style={styles.walletJourneyHash}>{shortHash(transfer.txHash)}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="让 Agent 继续找机会"
          style={styles.walletJourneyButton}
          onPress={onStartAgent}
        >
          <Text style={styles.walletJourneyButtonText}>让 Agent 继续</Text>
        </Pressable>
      </View>
    </View>
  );
}

function AgentWorkTimelineItem({
  event,
  onOpenCard,
  onOpenWalletRecord,
  onRunPrompt
}: {
  event: V2AuditTimelineEvent;
  onOpenCard: (card: V2ConversationCard) => void;
  onOpenWalletRecord: (record: V2WalletContext["recentRecords"][number]) => void;
  onRunPrompt: () => void;
}) {
  const details = createAgentWorkTimelineDetails(event);
  const hasCard = Boolean(event.card);
  const hasWalletRecord = Boolean(event.walletRecord);
  const hasNextAction = Boolean(details.actionLabel);

  return (
    <View style={styles.auditTimelineRow}>
      <View style={[styles.auditTimelineDot, event.status === "blocked" ? styles.auditTimelineDotBlocked : null]} />
      <View style={styles.auditTimelineText}>
        <View style={styles.auditTimelineTitleRow}>
          <Text style={styles.auditTimelineTitle}>{details.title}</Text>
          <Text style={[styles.auditTimelineStage, event.status === "blocked" ? styles.auditTimelineStageBlocked : null]}>
            {details.stage}
          </Text>
        </View>
        <Text style={styles.auditTimelineNote}>{details.note}</Text>
        {details.meta ? <Text style={styles.auditTimelineMeta}>{details.meta}</Text> : null}
        {hasCard || hasWalletRecord || hasNextAction ? (
          <View style={styles.auditTimelineActions}>
            {event.card ? (
              <Pressable style={styles.auditTimelineAction} onPress={() => onOpenCard(event.card!)}>
                <Text style={styles.auditTimelineActionText}>打开卡片</Text>
              </Pressable>
            ) : null}
            {event.walletRecord ? (
              <Pressable style={styles.auditTimelineActionSecondary} onPress={() => onOpenWalletRecord(event.walletRecord!)}>
                <Text style={styles.auditTimelineActionSecondaryText}>查看记录</Text>
              </Pressable>
            ) : null}
            {details.actionLabel ? (
              <Pressable style={styles.auditTimelineAction} onPress={onRunPrompt}>
                <Text style={styles.auditTimelineActionText}>{details.actionLabel}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function WalletLifecycleCard({ lifecycle }: { lifecycle: NonNullable<V2WalletContext["lifecycle"]> }) {
  return (
    <View style={styles.walletLifecycleCard}>
      {lifecycle.map((step, index) => (
        <View key={step.id} style={styles.walletLifecycleStep}>
          <View style={[styles.walletLifecycleDot, lifecycleDotStyle(step.status)]}>
            <Text style={styles.walletLifecycleDotText}>{step.status === "done" ? "✓" : index + 1}</Text>
          </View>
          <View style={styles.walletLifecycleText}>
            <Text style={styles.walletLifecycleTitle}>{step.title}</Text>
            <Text style={styles.walletLifecycleNote}>{step.note}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function createAgentWorkTimelineDetails(event: V2AuditTimelineEvent): {
  title: string;
  note: string;
  stage: string;
  meta?: string;
  actionLabel?: string;
} {
  if (event.type === "wallet.tx_verified") {
    return {
      title: event.status === "success" ? "资金已到账" : "交易已核验",
      note: event.amountLabel && event.assetSymbol
        ? `收到 ${event.amountLabel} ${event.assetSymbol}，Agent 可以继续分析或模拟。`
        : cleanAuditNote(event.note),
      stage: "钱包",
      meta: event.txHash ? `交易 ${shortHash(event.txHash)}` : undefined,
      actionLabel: event.status === "success" ? "看市场机会" : undefined
    };
  }

  if (event.type === "wallet.refresh") {
    return {
      title: "钱包已刷新",
      note: cleanAuditNote(event.note),
      stage: "钱包",
      actionLabel: event.note.includes("到账") || event.note.includes("可用") ? "看市场机会" : undefined
    };
  }

  if (event.type === "prediction.analyzed") {
    return {
      title: "已生成预测",
      note: event.marketTitle ? friendlyMarketTitle(event.marketTitle) : cleanAuditNote(event.note),
      stage: "预测",
      meta: "可在预测卡片继续跟踪或模拟"
    };
  }

  if (event.type === "tracking.saved") {
    return {
      title: "已加入跟踪",
      note: event.marketTitle ? friendlyMarketTitle(event.marketTitle) : cleanAuditNote(event.note),
      stage: "跟踪",
      meta: "有变化再提醒"
    };
  }

  if (event.type === "strategy.saved") {
    return {
      title: "策略已生成",
      note: event.marketTitle ? friendlyMarketTitle(event.marketTitle) : cleanAuditNote(event.note),
      stage: "策略",
      meta: "可在策略卡片继续模拟"
    };
  }

  if (event.type === "simulation.completed") {
    return {
      title: "模拟已完成",
      note: event.marketTitle ? friendlyMarketTitle(event.marketTitle) : cleanAuditNote(event.note),
      stage: "模拟",
      meta: [event.simulationSide, event.amountLabel ? `${event.amountLabel} USDT` : undefined].filter(Boolean).join(" · ") || "未下单"
    };
  }

  if (event.type === "policy.blocked") {
    return {
      title: "已拦截",
      note: cleanAuditNote(event.note),
      stage: "保护"
    };
  }

  return {
    title: event.title,
    note: cleanAuditNote(event.note),
    stage: event.moneyMoved ? "资金" : "记录"
  };
}

function cleanAuditNote(note: string): string {
  return note
    .replace(/未发生真实下单。?/g, "")
    .replace(/未发生资金动作。?/g, "")
    .trim() || "Agent 已记录这一步。";
}

function friendlyMarketTitle(title: string): string {
  return title
    .replace(/^Will /, "")
    .replace(/ win the 2026 FIFA World Cup\??$/i, "会赢得 2026 年世界杯冠军吗？");
}

function shortHash(hash: string): string {
  if (hash.length <= 14) return hash;
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}

function createPendingWalletAssets(): NonNullable<V2WalletContext["assets"]> {
  return [
    {
      symbol: "USDT0",
      name: "USD Tether 0",
      amountLabel: "待同步",
      valueLabel: "-",
      syncStatus: "pending"
    },
    {
      symbol: "OKB",
      name: "X Layer Gas",
      amountLabel: "待同步",
      valueLabel: "-",
      syncStatus: "pending"
    }
  ];
}

function createPendingWalletRecords(hasWallet: boolean): NonNullable<V2WalletContext["recentRecords"]> {
  return [
    {
      id: "wallet-local-pending",
      title: hasWallet ? "钱包已连接" : "等待钱包生成",
      note: hasWallet ? "下一步同步 X Layer 资产。" : "登录后会自动生成并绑定 HWallet 地址。",
      status: "pending",
      createdAt: new Date().toISOString()
    }
  ];
}

function createPendingAgentWalletState(hasWallet: boolean): V2WalletContext["agent"] {
  return {
    mode: "observe_only",
    fundsStatus: "waiting",
    availableText: hasWallet ? "等待资产同步" : "等待钱包生成",
    nextActionText: hasWallet ? "刷新后会读取 X Layer 资产。" : "登录后会自动绑定 HWallet 地址。"
  };
}

function createPendingAgentVaultState(hasWallet: boolean): V2WalletContext["vault"] {
  return {
    id: "agent-vault-local-pending",
    title: "Agent 资金池",
    status: "waiting",
    displayText: hasWallet ? "等待资产同步" : "等待钱包生成",
    policyText: "第一版只做分析、跟踪和模拟。",
    sourceText: hasWallet ? "来自 HWallet 收款地址" : "登录后自动准备",
    userVisibleAddress: false
  };
}

function createPendingWalletLifecycle(hasWallet: boolean): NonNullable<V2WalletContext["lifecycle"]> {
  return [
    { id: "identity", title: "账号", status: "done", note: "用户会话已创建" },
    { id: "wallet", title: "HWallet", status: hasWallet ? "done" : "active", note: hasWallet ? "钱包已绑定" : "等待钱包生成" },
    { id: "assets", title: "资产", status: hasWallet ? "active" : "waiting", note: hasWallet ? "正在同步资产" : "等待钱包" },
    { id: "agent", title: "Agent", status: "waiting", note: "等待可用资金" }
  ];
}

function lifecycleDotStyle(status: NonNullable<V2WalletContext["lifecycle"]>[number]["status"]) {
  if (status === "done") return { backgroundColor: "#1d7d1a" };
  if (status === "active") return { backgroundColor: "#111" };
  if (status === "failed") return { backgroundColor: "#c8172f" };
  return { backgroundColor: "#d9d6d1" };
}

function createPendingAuditEvents(): V2AuditTimelineEvent[] {
  return [
    {
      id: "audit-local-empty",
      userId: "local",
      type: "wallet.refresh",
      title: "暂无操作记录",
      note: "刷新 HWallet 或让 Agent 分析后，这里会显示记录。",
      status: "info",
      moneyMoved: false,
      createdAt: new Date().toISOString()
    }
  ];
}

function createPendingVerifiedTransfers(): NonNullable<V2MobileAgentMemory["wallet"]>["verifiedTransfers"] {
  return [
    {
      txHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
      status: "not_found",
      message: "粘贴交易哈希后会显示到账记录。",
      chainId: 196,
      verifiedAt: new Date().toISOString()
    }
  ];
}

function getLatestReceivedTransfer(transfers: VerifiedWalletTransfer[]): VerifiedWalletTransfer | undefined {
  return transfers
    .filter((transfer) => transfer.status === "received")
    .sort((left, right) => right.verifiedAt.localeCompare(left.verifiedAt))[0];
}

function formatAgentFundsStatus(status: V2WalletContext["agent"]["fundsStatus"]) {
  if (status === "ready") return "可用";
  if (status === "sync_failed") return "待刷新";
  return "等待";
}

function createWalletSyncSummary(
  assets: V2WalletContext["assets"],
  fundsStatus: V2WalletContext["agent"]["fundsStatus"],
  hasWallet: boolean
): {
  title: string;
  note: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBackground: string;
} {
  const syncedAssets = assets.filter((asset) => asset.syncStatus === "synced");
  const failedAssets = assets.filter((asset) => asset.syncStatus === "failed");
  const positiveAsset = syncedAssets.find((asset) => Number(asset.amountValue || "0") > 0);

  if (!hasWallet) {
    return {
      title: "等待 HWallet",
      note: "登录完成后会自动生成并绑定钱包。",
      icon: "wallet-outline",
      iconColor: "#8b8178",
      iconBackground: "#f1ebe5"
    };
  }

  if (fundsStatus === "ready" && positiveAsset) {
    return {
      title: "资产已可用",
      note: `已识别 ${positiveAsset.amountLabel} ${positiveAsset.symbol}，Agent 可以继续分析或模拟。`,
      icon: "checkmark",
      iconColor: "#fff",
      iconBackground: "#1d7d1a"
    };
  }

  if (failedAssets.length > 0 || fundsStatus === "sync_failed") {
    return {
      title: "同步需要重试",
      note: "资产读取暂时没有成功，可以刷新后再试。",
      icon: "alert-circle-outline",
      iconColor: "#c8172f",
      iconBackground: "#fff0f2"
    };
  }

  if (syncedAssets.length > 0) {
    return {
      title: "资产已同步",
      note: "暂时没有识别到可用资金，充值后可粘贴交易哈希核验。",
      icon: "sync-outline",
      iconColor: colors.ink,
      iconBackground: "#f1ebe5"
    };
  }

  return {
    title: "等待资产同步",
    note: "刷新后会读取 X Layer 上的稳定币和 OKB。",
    icon: "time-outline",
    iconColor: "#8b8178",
    iconBackground: "#f1ebe5"
  };
}

function formatWalletAssetSyncStatus(status: V2WalletContext["assets"][number]["syncStatus"]): string {
  if (status === "synced") return "已同步";
  if (status === "failed") return "失败";
  return "等待";
}

function getPrimaryWalletAsset(assets: V2WalletContext["assets"]) {
  return assets.find((asset) => asset.syncStatus === "synced" && Number(asset.amountValue || "0") > 0);
}

function extractTransactionHash(text: string): string | undefined {
  return text.match(/0x[a-fA-F0-9]{64}/)?.[0];
}

function shouldOpenWalletAfterAgentText(text: string): boolean {
  return Boolean(
    extractTransactionHash(text) ||
      /到账|到帐|充完|已充|充值完成|转完|转入|查账|查到账|收款|钱包|HWallet/i.test(text)
  );
}

function createWalletRecordDetails(record: V2WalletContext["recentRecords"][number]): {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  backgroundColor: string;
} {
  if (record.status === "failed") {
    return {
      icon: "alert-circle-outline",
      label: "待重试",
      color: "#c8172f",
      backgroundColor: "#fff0f2"
    };
  }

  if (record.status === "pending") {
    return {
      icon: "time-outline",
      label: "处理中",
      color: "#8a6a00",
      backgroundColor: "#fff7dc"
    };
  }

  if (record.id.includes("tx") || record.id.includes("deposit")) {
    return {
      icon: "checkmark-circle-outline",
      label: "已到账",
      color: "#1d7d1a",
      backgroundColor: "#edffe9"
    };
  }

  return {
    icon: "sync-outline",
    label: "已同步",
    color: "#287f1c",
    backgroundColor: "#f0f8ed"
  };
}

function formatRecordTime(createdAt: string): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function MineSection({ children, count, title }: { children: ReactNode; count: number; title: string }) {
  return (
    <View style={styles.mineSection}>
      <View style={styles.mineSectionHeader}>
        <Text style={styles.mineSectionTitle}>{title}</Text>
        <Text style={styles.mineSectionCount}>{count}</Text>
      </View>
      <View style={styles.mineSectionBody}>{children}</View>
    </View>
  );
}

function MineTrackingItem({ card }: { card: V2TrackingCard }) {
  const title = card.title.replace(/^已跟踪：/, "");
  return (
    <View style={styles.mineRecordCard}>
      <Text style={styles.mineRecordIcon}>{flagForMarket(title)}</Text>
      <View style={styles.mineRecordText}>
        <Text style={styles.mineRecordTitle} numberOfLines={2}>{title}</Text>
        <Text style={styles.mineRecordNote} numberOfLines={2}>{card.watchText}</Text>
      </View>
      <Text style={styles.mineRecordStatus}>{card.statusText}</Text>
    </View>
  );
}

function MineStrategyItem({ card }: { card: V2StrategyCard }) {
  const title = card.title.replace(/^策略：/, "");
  return (
    <View style={styles.mineRecordCard}>
      <View style={styles.mineRecordIconBadge}>
        <Ionicons name="git-branch-outline" size={18} color="#102015" />
      </View>
      <View style={styles.mineRecordText}>
        <Text style={styles.mineRecordTitle} numberOfLines={2}>{title}</Text>
        <Text style={styles.mineRecordNote} numberOfLines={2}>{card.steps[0] || card.agentNote}</Text>
      </View>
      <Text style={styles.mineRecordStatus}>{card.statusText}</Text>
    </View>
  );
}

function MineRecordItem({ record }: { record: V2MobileHomeView["recent"]["records"][number] }) {
  return (
    <View style={styles.mineTimelineRow}>
      <View style={styles.mineTimelineDot} />
      <View style={styles.mineTimelineText}>
        <Text style={styles.mineTimelineTitle} numberOfLines={1}>{friendlyRecordTitle(record.title)}</Text>
        <Text style={styles.mineTimelineNote} numberOfLines={2}>{record.note}</Text>
      </View>
      <Text style={styles.mineTimelineType}>{friendlyRecordType(record.type)}</Text>
    </View>
  );
}

function MineAuditItem({ event }: { event: V2AuditTimelineEvent }) {
  return (
    <View style={styles.mineTimelineRow}>
      <View style={[styles.mineTimelineDot, event.status === "blocked" ? styles.mineTimelineDotBlocked : null]} />
      <View style={styles.mineTimelineText}>
        <Text style={styles.mineTimelineTitle} numberOfLines={1}>{event.title}</Text>
        <Text style={styles.mineTimelineNote} numberOfLines={2}>{event.note}</Text>
      </View>
      <Text style={styles.mineTimelineType}>{event.moneyMoved ? "有资金动作" : "未花钱"}</Text>
    </View>
  );
}

function MineEmptyState({ text }: { text: string }) {
  return (
    <View style={styles.mineEmptyState}>
      <Text style={styles.mineEmptyText}>{text}</Text>
    </View>
  );
}

function friendlyRecordTitle(title: string): string {
  return title.replace(/^已跟踪：/, "").replace(/^策略：/, "");
}

function friendlyRecordType(type: string): string {
  if (type === "tracking.saved") return "跟踪";
  if (type === "strategy.saved") return "策略";
  if (type === "simulation.saved") return "模拟";
  return "记录";
}

function BottomNav({
  activeTab,
  onChange,
  onNewChat,
  onWallet
}: {
  activeTab: MainTab;
  onChange: (tab: MainTab) => void;
  onNewChat: () => void;
  onWallet: () => void;
}) {
  return (
    <View style={styles.bottomDockWrap}>
      <View style={styles.bottomScrim} />
      <View style={styles.bottomDock}>
        <View style={styles.tabPill}>
          <TabButton active={activeTab === "agent"} icon="chatbubble-ellipses" label="Agent" onPress={() => onChange("agent")} />
          <TabButton active={activeTab === "worldcup"} icon="pulse-outline" label="市场" onPress={() => onChange("worldcup")} />
          <TabButton active={activeTab === "mine"} icon="compass-outline" label="发现" onPress={() => onChange("mine")} />
        </View>
        <Pressable style={[styles.newChatButton, activeTab === "wallet" ? styles.newChatButtonActive : null]} onPress={onWallet}>
          <Text style={styles.hMarkText}>H</Text>
        </Pressable>
      </View>
    </View>
  );
}

function TabButton({
  active,
  icon,
  label,
  onPress
}: {
  active: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.tabButton, active ? styles.tabButtonActive : null]} onPress={onPress}>
      <Ionicons name={icon} size={21} color={active ? "#171512" : "#77716a"} />
      <Text style={[styles.tabText, active ? styles.tabTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

function ConsoleStat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.consoleStat}>
      <Text style={styles.consoleStatValue}>{value}</Text>
      <Text style={styles.consoleLabel}>{label}</Text>
    </View>
  );
}

function MessageBubble({
  message,
  onAction,
  onWallet
}: {
  message: V2MobileChatMessage;
  onAction: (action: "simulate" | "track" | "build_strategy", card: V2ConversationCard) => void;
  onWallet: () => void;
}) {
  if (message.kind === "card" && message.card) {
    return <CardMessage card={message.card} onAction={onAction} onWallet={onWallet} />;
  }

  const isUser = message.role === "user";

  return (
    <View style={[styles.bubble, isUser ? styles.userBubble : styles.agentBubble]}>
      <Text style={[styles.bubbleText, isUser ? styles.userBubbleText : null]}>{message.text}</Text>
    </View>
  );
}

function CardMessage({
  card,
  onAction,
  onWallet
}: {
  card: V2ConversationCard;
  onAction: (action: "simulate" | "track" | "build_strategy", card: V2ConversationCard) => void;
  onWallet: () => void;
}) {
  if (card.type === "receive_card") {
    return <ReceiveCardMessage card={card} onWallet={onWallet} />;
  }

  if (card.type === "prediction_card") {
    return (
      <PredictionCardMessage card={card} onAction={onAction} />
    );
  }

  if (card.type === "tracking_card") {
    return <TrackingCardMessage card={card} onAction={onAction} />;
  }

  if (card.type === "strategy_card") {
    return <StrategyCardMessage card={card} onAction={onAction} />;
  }

  if (card.type === "simulation_card") {
    return <SimulationCardMessage card={card} onAction={onAction} />;
  }

  return null;
}

function ReceiveCardMessage({
  card,
  onWallet
}: {
  card: Extract<V2ConversationCard, { type: "receive_card" }>;
  onWallet: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const address = card.addresses[0];

  async function copyAddress() {
    if (!address?.address) return;
    await Clipboard.setStringAsync(address.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
    Alert.alert("已复制", "充值地址已复制。");
  }

  return (
    <View style={styles.receiveCard}>
      <View style={styles.receiveCardTop}>
        <View>
          <Text style={styles.receiveCardLabel}>充值地址</Text>
          <Text style={styles.receiveCardTitle}>{card.title || "Agent Wallet"}</Text>
        </View>
        <View style={styles.receiveNetworkPill}>
          <Text style={styles.receiveNetworkText}>{address?.network || "X Layer"}</Text>
        </View>
      </View>
      <Text style={styles.receiveCardHint}>支持稳定币 / OKB 转入，到账后 Agent 会自动识别可用资金。</Text>
      <Text style={styles.receiveAddressText}>{address?.address ? shortAddress(address.address) : "等待钱包地址"}</Text>
      <View style={styles.receiveActionRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="复制充值地址"
          style={[styles.receiveCopyButton, styles.receiveActionButton]}
          onPress={copyAddress}
        >
          <Ionicons name="copy-outline" size={17} color="#fff" />
          <Text style={styles.receiveCopyText}>{copied ? "已复制" : "复制地址"}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="打开 HWallet"
          style={[styles.receiveWalletButton, styles.receiveActionButton]}
          onPress={onWallet}
        >
          <Ionicons name="wallet-outline" size={17} color={colors.ink} />
          <Text style={styles.receiveWalletText}>去 HWallet</Text>
        </Pressable>
      </View>
    </View>
  );
}

function SimulationCardMessage({
  card,
  onAction
}: {
  card: V2SimulationCard;
  onAction: (action: "simulate" | "track" | "build_strategy", card: V2ConversationCard) => void;
}) {
  return (
    <View style={styles.simulationCard}>
      <View style={styles.predictionHeaderRow}>
        <View style={styles.simulationFlagBadge}>
          <Ionicons name="flask-outline" size={24} color="#102015" />
        </View>
        <View style={styles.predictionHeaderText}>
          <Text style={styles.simulationEyebrow}>Agent 模拟结果</Text>
          <Text style={styles.trackingStatus}>{card.statusText}</Text>
        </View>
      </View>

      <Text style={styles.trackingTitle}>{card.title}</Text>
      {card.sideLabel ? <Text style={styles.trackingStatus}>{card.sideLabel}</Text> : null}
      <Text style={styles.trackingNote}>{card.agentNote}</Text>

      <View style={styles.simulationMetricRow}>
        <View style={styles.simulationMetricBox}>
          <Text style={styles.trackingWatchLabel}>模拟金额</Text>
          <Text style={styles.simulationMetricValue}>{card.amountLabel}</Text>
        </View>
        <View style={styles.simulationMetricBox}>
          <Text style={styles.trackingWatchLabel}>份额</Text>
          <Text style={styles.simulationMetricValue}>{card.sharesLabel || "待估算"}</Text>
        </View>
      </View>

      {card.priceLabel ? (
        <View style={styles.strategyRiskBox}>
          <Text style={styles.trackingWatchLabel}>参考价格</Text>
          <Text style={styles.strategyRiskText}>{card.priceLabel}</Text>
        </View>
      ) : null}

      <View style={styles.simulationSafeBox}>
        <Ionicons name="shield-checkmark-outline" size={18} color="#aaff35" />
        <Text style={styles.simulationSafeText}>
          {card.moneyMoved === false ? "这一步只是模拟，没有提交订单。" : "这一步需要继续确认。"}
        </Text>
      </View>

      <View style={styles.predictionActionRow}>
        <Pressable style={styles.predictionPrimaryAction} onPress={() => onAction("track", card)}>
          <Text style={styles.predictionPrimaryActionText}>加入跟踪</Text>
        </Pressable>
        <Pressable style={styles.predictionGhostAction} onPress={() => onAction("build_strategy", card)}>
          <Text style={styles.predictionGhostActionText}>生成策略</Text>
        </Pressable>
      </View>
    </View>
  );
}

function StrategyCardMessage({
  card,
  onAction
}: {
  card: V2StrategyCard;
  onAction: (action: "simulate" | "track" | "build_strategy", card: V2ConversationCard) => void;
}) {
  return (
    <View style={styles.strategyCard}>
      <View style={styles.predictionHeaderRow}>
        <View style={styles.strategyFlagBadge}>
          <Ionicons name="git-branch-outline" size={24} color="#102015" />
        </View>
        <View style={styles.predictionHeaderText}>
          <Text style={styles.strategyEyebrow}>Agent 策略草案</Text>
          <Text style={styles.trackingStatus}>{card.statusText}</Text>
        </View>
      </View>

      <Text style={styles.trackingTitle}>{card.title.replace(/^策略：/, "")}</Text>
      <Text style={styles.trackingNote}>{card.agentNote}</Text>

      <View style={styles.strategyStepList}>
        {card.steps.map((step, index) => (
          <View key={`${card.id}-${index}`} style={styles.strategyStepRow}>
            <Text style={styles.strategyStepIndex}>{index + 1}</Text>
            <Text style={styles.strategyStepText}>{step}</Text>
          </View>
        ))}
      </View>

      <View style={styles.strategyRiskBox}>
        <Text style={styles.trackingWatchLabel}>注意</Text>
        <Text style={styles.strategyRiskText}>{card.riskText}</Text>
      </View>

      <View style={styles.predictionActionRow}>
        <Pressable style={styles.predictionPrimaryAction} onPress={() => onAction("simulate", card)}>
          <Text style={styles.predictionPrimaryActionText}>先模拟</Text>
        </Pressable>
        <Pressable style={styles.predictionGhostAction} onPress={() => onAction("track", card)}>
          <Text style={styles.predictionGhostActionText}>跟踪</Text>
        </Pressable>
      </View>
    </View>
  );
}

function TrackingCardMessage({
  card,
  onAction
}: {
  card: V2TrackingCard;
  onAction: (action: "simulate" | "track" | "build_strategy", card: V2ConversationCard) => void;
}) {
  return (
    <View style={styles.trackingCard}>
      <View style={styles.predictionHeaderRow}>
        <View style={styles.trackingFlagBadge}>
          <Ionicons name="eye-outline" size={24} color="#fff" />
        </View>
        <View style={styles.predictionHeaderText}>
          <Text style={styles.trackingEyebrow}>Agent 已开始跟踪</Text>
          <Text style={styles.trackingStatus}>{card.statusText}</Text>
        </View>
      </View>

      <Text style={styles.trackingTitle}>{card.title.replace(/^已跟踪：/, "")}</Text>

      <View style={styles.trackingWatchBox}>
        <Text style={styles.trackingWatchLabel}>接下来重点看</Text>
        <Text style={styles.trackingWatchText}>{card.watchText}</Text>
      </View>

      <Text style={styles.trackingNote}>{card.agentNote}</Text>

      <View style={styles.predictionActionRow}>
        <Pressable style={styles.predictionPrimaryAction} onPress={() => onAction("build_strategy", card)}>
          <Text style={styles.predictionPrimaryActionText}>策略</Text>
        </Pressable>
        <Pressable style={styles.predictionGhostAction} onPress={() => onAction("simulate", card)}>
          <Text style={styles.predictionGhostActionText}>先模拟</Text>
        </Pressable>
      </View>
    </View>
  );
}

function PredictionCardMessage({
  card,
  onAction
}: {
  card: V2PredictionCard;
  onAction: (action: "simulate" | "track" | "build_strategy", card: V2ConversationCard) => void;
}) {
  return (
    <View style={styles.predictionCard}>
      <View style={styles.predictionHeaderRow}>
        <View style={styles.predictionFlagBadge}>
          <Text style={styles.predictionFlagText}>{flagForMarket(card.title)}</Text>
        </View>
        <View style={styles.predictionHeaderText}>
          <Text style={styles.predictionEyebrow}>Agent 预测卡</Text>
          <Text style={styles.predictionStatus}>{card.statusText}</Text>
        </View>
      </View>

      <Text style={styles.predictionTitle}>{card.title}</Text>

      <View style={styles.predictionOddsRow}>
        <View style={styles.predictionOddBox}>
          <Text style={styles.predictionOddLabel}>会</Text>
          <Text style={styles.predictionOddValue}>{card.metrics.probabilityLabel?.replace(/^会\s*/, "") || "观察"}</Text>
        </View>
        <View style={styles.predictionOddBox}>
          <Text style={styles.predictionOddLabel}>价格</Text>
          <Text style={styles.predictionOddValueSmall}>{card.metrics.priceLabel || "实时更新"}</Text>
        </View>
      </View>

      <View style={styles.predictionTrack}>
        <View style={[styles.predictionTrackFill, { width: predictionProgressWidth(card) }]} />
      </View>

      <View style={styles.predictionNoteBox}>
        <Ionicons name="pulse-outline" size={18} color="#aaff35" />
        <Text style={styles.predictionCardNoteText}>{card.agentNote}</Text>
      </View>

      {card.metrics.heatLabel ? <Text style={styles.predictionMeta}>热度 {card.metrics.heatLabel}</Text> : null}

      <View style={styles.predictionActionRow}>
        <Pressable style={styles.predictionPrimaryAction} onPress={() => onAction("track", card)}>
          <Text style={styles.predictionPrimaryActionText}>跟踪</Text>
        </Pressable>
        <Pressable style={styles.predictionGhostAction} onPress={() => onAction("simulate", card)}>
          <Text style={styles.predictionGhostActionText}>先模拟</Text>
        </Pressable>
        <Pressable style={styles.predictionGhostAction} onPress={() => onAction("build_strategy", card)}>
          <Text style={styles.predictionGhostActionText}>策略</Text>
        </Pressable>
      </View>
    </View>
  );
}

function championCardColor(index: number): string {
  const colors = ["#d0a000", "#b70d25", "#b20b22", "#005514", "#6397bd", "#d5bf00", "#0c6d43", "#1f4f9c"];
  return colors[index % colors.length];
}

function flagForMarket(title: string): string {
  const text = title.toLowerCase();
  if (/spain|西班牙/.test(text)) return "🇪🇸";
  if (/france|法国/.test(text)) return "🇫🇷";
  if (/england|英格兰|harry kane|凯恩/.test(text)) return "🏴";
  if (/portugal|葡萄牙/.test(text)) return "🇵🇹";
  if (/argentina|阿根廷/.test(text)) return "🇦🇷";
  if (/brazil|巴西/.test(text)) return "🇧🇷";
  if (/united states|美国/.test(text)) return "🇺🇸";
  if (/mexico|墨西哥/.test(text)) return "🇲🇽";
  if (/korea|韩国/.test(text)) return "🇰🇷";
  if (/belgium|比利时/.test(text)) return "🇧🇪";
  if (/canada|加拿大/.test(text)) return "🇨🇦";
  if (/norway|挪威|haaland|哈兰德/.test(text)) return "🇳🇴";
  if (/mbappe|姆巴佩|griezmann|格列兹曼/.test(text)) return "🇫🇷";
  if (/saka|萨卡|bellingham|贝林厄姆|foden|福登/.test(text)) return "🏴";
  if (/ronaldo|c 罗/.test(text)) return "🇵🇹";
  if (/messi|梅西|alvarez|阿尔瓦雷斯|lautaro|劳塔罗/.test(text)) return "🇦🇷";
  if (/raphinha|拉菲尼亚|vinicius|维尼修斯/.test(text)) return "🇧🇷";
  if (/yamal|亚马尔|oyarzabal|奥亚萨瓦尔/.test(text)) return "🇪🇸";
  return "⚽";
}

function groupTitleFromCard(card: V2WorldCupExploreMarketCard): string {
  const text = card.displayTitle || card.title;
  const group = text.match(/世界杯\s*([A-Z])\s*组/);
  if (group) return `2026 年世界杯 ${group[1]} 组第一`;
  return "2026 年世界杯小组赛";
}

function predictionProgressWidth(card: V2PredictionCard): `${number}%` {
  const price = card.market.yesPrice || 0.1;
  const percent = Math.max(3, Math.min(100, Math.round(price * 100)));
  return `${percent}%`;
}

function shortMarketTitle(title: string): string {
  const zhChampion = title.match(/^(.+?)会赢得 2026 年世界杯冠军吗？$/);
  if (zhChampion) return zhChampion[1];

  const zhGoldenBoot = title.match(/^(.+?)会拿到 2026 年世界杯金靴吗？$/);
  if (zhGoldenBoot) return zhGoldenBoot[1];

  const zhGroup = title.match(/^(.+?)会在 2026 年世界杯 [A-Z] 组排名第一吗？$/);
  if (zhGroup) return zhGroup[1];

  return title
    .replace(/会赢得 2026 年世界杯冠军吗？/g, "")
    .replace(/Will /i, "")
    .replace(/ win the 2026 FIFA World Cup\??/i, "")
    .trim()
    .slice(0, 18) || "世界杯";
}

function optionPriceLabel(card: V2WorldCupExploreMarketCard): string | undefined {
  return card.options.find((option) => option.side === "yes")?.priceLabel || card.options[0]?.priceLabel;
}

function probabilityWidth(card: V2WorldCupExploreMarketCard): `${number}%` {
  const price = card.options.find((option) => option.side === "yes")?.price || card.options[0]?.price || 0.1;
  const percent = Math.max(3, Math.min(100, Math.round(price * 100)));
  return `${percent}%`;
}

function matchTimingBadgeText(status: NonNullable<V2WorldCupExploreMarketCard["timing"]>["status"]): string {
  if (status === "soon") return "临场";
  if (status === "live") return "进行中";
  if (status === "today") return "今日";
  if (status === "ended") return "已开赛";
  return "赛程";
}

function timingBadgeStyle(status: NonNullable<V2WorldCupExploreMarketCard["timing"]>["status"]) {
  if (status === "soon" || status === "live") return { backgroundColor: "#c9ff4d", color: "#0b0b0b" };
  if (status === "today") return { backgroundColor: "#111", color: "#fff" };
  return { backgroundColor: "#ececec", color: "#4f4a45" };
}

function marketProviderLabel(provider: V2WorldCupExploreMarketCard["market"]["provider"]): string {
  if (provider === "okx-outcomes") return "OKX Outcomes";
  return "插件数据";
}

function marketTypeLabel(type?: string): string {
  if (type === "neg_risk") return "冠军组合盘";
  if (type === "binary") return "单场二选一";
  return type || "标准预测盘";
}

function marketStatusLabel(card: V2WorldCupExploreMarketCard): string {
  if (card.status === "observable" && card.market.acceptingOrders) return "可观察";
  if (card.market.status === "resolved") return "已结算";
  if (card.market.status === "settling") return "结算中";
  return "观察中";
}

function formatMarketEndTime(value?: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatExploreUpdatedAt(value?: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return undefined;
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function shortAddress(address?: string): string | undefined {
  if (!address) return undefined;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

const colors = {
  ink: "#1c1a17",
  muted: "#817a72",
  line: "#eee7df",
  paper: "#fffdfa",
  shell: "#ffffff",
  soft: "#f1ebe5"
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.shell
  },
  shell: {
    flex: 1,
    backgroundColor: colors.shell
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  login: {
    flex: 1,
    justifyContent: "center",
    padding: 28,
    gap: 12
  },
  loginBrand: {
    fontSize: 14,
    color: colors.muted
  },
  loginTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.ink,
    marginBottom: 10
  },
  loginInput: {
    minHeight: 52,
    borderRadius: 18,
    paddingHorizontal: 18,
    backgroundColor: colors.paper,
    color: colors.ink,
    fontSize: 16
  },
  loginButton: {
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center"
  },
  loginButtonText: {
    color: "#fff",
    fontWeight: "700"
  },
  loginState: {
    color: colors.muted,
    fontSize: 12
  },
  topbar: {
    height: 72,
    paddingHorizontal: 26,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  roundButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(255, 253, 250, 0.92)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#d8cec4",
    shadowOpacity: 0.8,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4
  },
  roundButtonActive: {
    backgroundColor: "#efe7df"
  },
  topbarCenterSpacer: {
    width: 76,
    height: 50
  },
  agentScreen: {
    flex: 1
  },
  messages: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 192,
    gap: 12
  },
  messagesEmpty: {
    flexGrow: 1,
    justifyContent: "center"
  },
  hero: {
    minHeight: 420,
    alignItems: "center",
    justifyContent: "center",
    gap: 22
  },
  heroTitle: {
    fontSize: 25,
    lineHeight: 32,
    fontWeight: "700",
    color: colors.ink,
    textAlign: "center"
  },
  promptStack: {
    width: "100%",
    gap: 9,
    paddingHorizontal: 18
  },
  prompt: {
    minHeight: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255, 253, 250, 0.75)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16
  },
  promptText: {
    color: colors.ink,
    fontSize: 14
  },
  bubble: {
    maxWidth: "88%",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 20
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: colors.ink
  },
  agentBubble: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255, 253, 250, 0.88)"
  },
  bubbleText: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 21
  },
  userBubbleText: {
    color: "#fff"
  },
  card: {
    borderRadius: 22,
    padding: 16,
    backgroundColor: "rgba(255, 253, 250, 0.96)",
    gap: 10,
    shadowColor: "#ddd1c7",
    shadowOpacity: 0.65,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 3
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.ink,
    lineHeight: 23
  },
  cardBody: {
    color: "#413c36",
    lineHeight: 21,
    fontSize: 14
  },
  cardLabel: {
    color: colors.muted,
    fontSize: 12
  },
  receiveCard: {
    borderRadius: 28,
    backgroundColor: "rgba(255, 253, 250, 0.97)",
    padding: 18,
    gap: 14,
    shadowColor: "#d8cec4",
    shadowOpacity: 0.7,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 14 },
    elevation: 5
  },
  receiveCardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  receiveCardLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800"
  },
  receiveCardTitle: {
    color: colors.ink,
    fontSize: 22,
    lineHeight: 29,
    fontWeight: "900",
    marginTop: 4
  },
  receiveNetworkPill: {
    minHeight: 30,
    borderRadius: 15,
    backgroundColor: "#f1ebe5",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12
  },
  receiveNetworkText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "900"
  },
  receiveCardHint: {
    color: "#69625b",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700"
  },
  hWalletRetryButton: {
    alignSelf: "flex-start",
    minHeight: 36,
    borderRadius: 18,
    backgroundColor: "#f1ebe5",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 13
  },
  hWalletRetryText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900"
  },
  receiveStatsRow: {
    flexDirection: "row",
    gap: 8
  },
  receiveStatItem: {
    flex: 1,
    minHeight: 64,
    borderRadius: 18,
    backgroundColor: "#f7f4f0",
    paddingHorizontal: 10,
    paddingVertical: 10,
    justifyContent: "center",
    gap: 4
  },
  receiveStatLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800"
  },
  receiveStatValue: {
    color: colors.ink,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "900"
  },
  receiveAddressText: {
    color: colors.ink,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "900"
  },
  receiveCopyButton: {
    minHeight: 44,
    borderRadius: 22,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8
  },
  receiveActionRow: {
    flexDirection: "row",
    gap: 10
  },
  receiveActionButton: {
    flex: 1
  },
  receiveWalletButton: {
    minHeight: 44,
    borderRadius: 22,
    backgroundColor: "#f1ebe5",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8
  },
  receiveWalletText: {
    color: colors.ink,
    fontWeight: "900",
    fontSize: 14
  },
  receiveCopyText: {
    color: "#fff",
    fontWeight: "900"
  },
  address: {
    color: colors.ink,
    fontSize: 13,
    lineHeight: 19
  },
  metricRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  metric: {
    color: "#5f5850",
    fontSize: 12,
    borderRadius: 14,
    backgroundColor: colors.soft,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9
  },
  secondaryButton: {
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: 19,
    backgroundColor: colors.soft,
    alignItems: "center",
    justifyContent: "center"
  },
  copyButton: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: colors.soft,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 7
  },
  secondaryButtonText: {
    color: colors.ink,
    fontWeight: "700"
  },
  predictionCard: {
    borderRadius: 26,
    backgroundColor: "#0c2113",
    padding: 18,
    gap: 14,
    shadowColor: "#0b1c11",
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4
  },
  predictionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  predictionFlagBadge: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center"
  },
  predictionFlagText: {
    fontSize: 30
  },
  predictionHeaderText: {
    flex: 1,
    gap: 4
  },
  predictionEyebrow: {
    color: "#aaff35",
    fontSize: 13,
    fontWeight: "900"
  },
  predictionStatus: {
    color: "rgba(255, 255, 255, 0.68)",
    fontSize: 12,
    fontWeight: "800"
  },
  predictionTitle: {
    color: "#fff",
    fontSize: 21,
    lineHeight: 28,
    fontWeight: "900"
  },
  predictionOddsRow: {
    flexDirection: "row",
    gap: 10
  },
  predictionOddBox: {
    flex: 1,
    minHeight: 78,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    padding: 14,
    gap: 8,
    justifyContent: "center"
  },
  predictionOddLabel: {
    color: "rgba(255, 255, 255, 0.68)",
    fontSize: 13,
    fontWeight: "800"
  },
  predictionOddValue: {
    color: "#fff",
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "900"
  },
  predictionOddValueSmall: {
    color: "#fff",
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "900"
  },
  predictionTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    overflow: "hidden"
  },
  predictionTrackFill: {
    height: 6,
    borderRadius: 999,
    backgroundColor: "#20b26a"
  },
  predictionNoteBox: {
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    padding: 13,
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start"
  },
  predictionCardNoteText: {
    flex: 1,
    color: "rgba(255, 255, 255, 0.82)",
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "700"
  },
  predictionMeta: {
    color: "rgba(255, 255, 255, 0.62)",
    fontSize: 12,
    fontWeight: "800"
  },
  predictionActionRow: {
    flexDirection: "row",
    gap: 8
  },
  predictionPrimaryAction: {
    flex: 1,
    minHeight: 44,
    borderRadius: 22,
    backgroundColor: "#217d1a",
    alignItems: "center",
    justifyContent: "center"
  },
  predictionPrimaryActionText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "900"
  },
  predictionGhostAction: {
    minHeight: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center"
  },
  predictionGhostActionText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "900"
  },
  trackingCard: {
    borderRadius: 26,
    backgroundColor: "#13251a",
    padding: 18,
    gap: 14,
    shadowColor: "#0b1c11",
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4
  },
  trackingFlagBadge: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: "#217d1a",
    alignItems: "center",
    justifyContent: "center"
  },
  trackingEyebrow: {
    color: "#aaff35",
    fontSize: 13,
    fontWeight: "900"
  },
  trackingStatus: {
    color: "rgba(255, 255, 255, 0.68)",
    fontSize: 12,
    fontWeight: "800"
  },
  trackingTitle: {
    color: "#fff",
    fontSize: 20,
    lineHeight: 27,
    fontWeight: "900"
  },
  trackingWatchBox: {
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    padding: 14,
    gap: 6
  },
  trackingWatchLabel: {
    color: "rgba(255, 255, 255, 0.62)",
    fontSize: 12,
    fontWeight: "900"
  },
  trackingWatchText: {
    color: "#fff",
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "900"
  },
  trackingNote: {
    color: "rgba(255, 255, 255, 0.78)",
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "700"
  },
  strategyCard: {
    borderRadius: 26,
    backgroundColor: "#102015",
    padding: 18,
    gap: 14,
    shadowColor: "#0b1c11",
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4
  },
  strategyFlagBadge: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: "#aaff35",
    alignItems: "center",
    justifyContent: "center"
  },
  strategyEyebrow: {
    color: "#aaff35",
    fontSize: 13,
    fontWeight: "900"
  },
  strategyStepList: {
    gap: 9
  },
  strategyStepRow: {
    minHeight: 42,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  strategyStepIndex: {
    width: 24,
    height: 24,
    overflow: "hidden",
    borderRadius: 12,
    backgroundColor: "rgba(170, 255, 53, 0.18)",
    color: "#aaff35",
    textAlign: "center",
    lineHeight: 24,
    fontSize: 12,
    fontWeight: "900"
  },
  strategyStepText: {
    flex: 1,
    color: "#fff",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800"
  },
  strategyRiskBox: {
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    padding: 14,
    gap: 6
  },
  strategyRiskText: {
    color: "rgba(255, 255, 255, 0.82)",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800"
  },
  simulationCard: {
    borderRadius: 26,
    backgroundColor: "#101f1b",
    padding: 18,
    gap: 14,
    shadowColor: "#0b1c11",
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4
  },
  simulationFlagBadge: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: "#aaff35",
    alignItems: "center",
    justifyContent: "center"
  },
  simulationEyebrow: {
    color: "#aaff35",
    fontSize: 13,
    fontWeight: "900"
  },
  simulationMetricRow: {
    flexDirection: "row",
    gap: 10
  },
  simulationMetricBox: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    padding: 14,
    gap: 7
  },
  simulationMetricValue: {
    color: "#fff",
    fontSize: 17,
    lineHeight: 23,
    fontWeight: "900"
  },
  simulationSafeBox: {
    borderRadius: 18,
    backgroundColor: "rgba(170, 255, 53, 0.1)",
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 9
  },
  simulationSafeText: {
    flex: 1,
    color: "rgba(255, 255, 255, 0.86)",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "800"
  },
  error: {
    paddingHorizontal: 22,
    paddingVertical: 6,
    color: "#b3261e"
  },
  composerWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 98,
    paddingHorizontal: 17
  },
  composer: {
    minHeight: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255, 253, 250, 0.96)",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    gap: 8,
    shadowColor: "#d8cec4",
    shadowOpacity: 0.8,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 15 },
    elevation: 5
  },
  plusButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line
  },
  composerInput: {
    flex: 1,
    minHeight: 48,
    color: colors.ink,
    fontSize: 16
  },
  voiceButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center"
  },
  page: {
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 140,
    gap: 14
  },
  worldCupShell: {
    flex: 1
  },
  worldCupPage: {
    paddingHorizontal: 22,
    paddingTop: 0,
    paddingBottom: 128,
    gap: 20
  },
  minePage: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 140,
    gap: 18
  },
  mineIdentity: {
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: -4
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: "#d8eee3",
    alignItems: "center",
    justifyContent: "center"
  },
  avatarText: {
    color: "#1f7422",
    fontWeight: "900"
  },
  mineName: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "800"
  },
  hWalletPage: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 140,
    gap: 18
  },
  hWalletHero: {
    borderRadius: 30,
    backgroundColor: "#101f1b",
    padding: 22,
    gap: 10,
    shadowColor: "#0b1c11",
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4
  },
  hWalletEyebrow: {
    color: "#aaff35",
    fontSize: 13,
    fontWeight: "900"
  },
  hWalletTitle: {
    color: "#fff",
    fontSize: 28,
    lineHeight: 35,
    fontWeight: "900"
  },
  hWalletText: {
    color: "rgba(255, 255, 255, 0.78)",
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "700"
  },
  hWalletDisabledButton: {
    backgroundColor: "#f1ebe5"
  },
  hWalletDisabledText: {
    color: "#9f9992"
  },
  hWalletActionStrip: {
    borderRadius: 24,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#f0ece8",
    padding: 10,
    flexDirection: "row",
    gap: 8,
    shadowColor: "#d9d3cc",
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2
  },
  hWalletActionButton: {
    flex: 1,
    minHeight: 72,
    borderRadius: 18,
    backgroundColor: "#fbfaf8",
    alignItems: "center",
    justifyContent: "center",
    gap: 7
  },
  hWalletActionButtonDisabled: {
    backgroundColor: "#f3efea"
  },
  hWalletActionIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#f1ebe5",
    alignItems: "center",
    justifyContent: "center"
  },
  hWalletActionText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "900"
  },
  walletSyncSummaryCard: {
    borderRadius: 24,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#f0ece8",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#d9d3cc",
    shadowOpacity: 0.24,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2
  },
  walletSyncSummaryIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center"
  },
  walletSyncSummaryText: {
    flex: 1,
    gap: 3,
    minWidth: 0
  },
  walletSyncSummaryTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900"
  },
  walletSyncSummaryNote: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700"
  },
  walletSyncSummaryButton: {
    minHeight: 36,
    borderRadius: 18,
    backgroundColor: "#f1ebe5",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14
  },
  walletSyncSummaryButtonText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "900"
  },
  walletJourneyCard: {
    borderRadius: 26,
    backgroundColor: "#101f1b",
    padding: 16,
    gap: 14,
    shadowColor: "#0b1c11",
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3
  },
  walletJourneyTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12
  },
  walletJourneyIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#1d7d1a",
    alignItems: "center",
    justifyContent: "center"
  },
  walletJourneyText: {
    flex: 1,
    gap: 4,
    minWidth: 0
  },
  walletJourneyTitle: {
    color: "#fff",
    fontSize: 19,
    lineHeight: 24,
    fontWeight: "900"
  },
  walletJourneyNote: {
    color: "rgba(255, 255, 255, 0.72)",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700"
  },
  walletJourneySteps: {
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    padding: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8
  },
  walletJourneyStep: {
    flex: 1,
    alignItems: "center",
    gap: 6
  },
  walletJourneyStepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#aaff35"
  },
  walletJourneyStepText: {
    color: "rgba(255, 255, 255, 0.86)",
    fontSize: 11,
    fontWeight: "900"
  },
  walletJourneyFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  walletJourneyHash: {
    color: "rgba(255, 255, 255, 0.56)",
    fontSize: 12,
    fontWeight: "800"
  },
  walletJourneyButton: {
    minHeight: 40,
    borderRadius: 20,
    backgroundColor: "#287f1c",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16
  },
  walletJourneyButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "900"
  },
  hWalletNoticeCard: {
    borderRadius: 20,
    backgroundColor: "#fff6df",
    borderWidth: 1,
    borderColor: "#f2dfb2",
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  hWalletNoticeText: {
    flex: 1,
    color: "#624316",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "800"
  },
  walletLifecycleCard: {
    borderRadius: 22,
    backgroundColor: "#fff",
    padding: 14,
    gap: 10
  },
  walletLifecycleStep: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12
  },
  walletLifecycleDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center"
  },
  walletLifecycleDotText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "900"
  },
  walletLifecycleText: {
    flex: 1,
    minWidth: 0
  },
  walletLifecycleTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900"
  },
  walletLifecycleNote: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700"
  },
  hWalletStatusGrid: {
    flexDirection: "row",
    gap: 12
  },
  hWalletStatusCard: {
    flex: 1,
    minHeight: 94,
    borderRadius: 24,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#f0ece8",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    shadowColor: "#d9d3cc",
    shadowOpacity: 0.36,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2
  },
  hWalletStatusValue: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "900"
  },
  hWalletStatusLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800"
  },
  walletTxCheckCard: {
    borderRadius: 26,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#f0ece8",
    padding: 16,
    gap: 12,
    shadowColor: "#d9d3cc",
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2
  },
  walletTxCheckHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  walletTxCheckTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900",
    marginTop: 4
  },
  walletTxInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  walletTxInput: {
    flex: 1,
    minHeight: 46,
    borderRadius: 23,
    backgroundColor: "#f7f4f0",
    paddingHorizontal: 15,
    color: colors.ink,
    fontSize: 14,
    fontWeight: "800"
  },
  walletTxInputDisabled: {
    backgroundColor: "#f3f0ec",
    color: "#9f9992"
  },
  walletTxPasteButton: {
    minHeight: 46,
    borderRadius: 23,
    backgroundColor: "#f1ebe5",
    paddingHorizontal: 13,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 5
  },
  walletTxPasteText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900"
  },
  walletTxButton: {
    minHeight: 44,
    borderRadius: 22,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center"
  },
  walletTxButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "900"
  },
  agentFundsCard: {
    borderRadius: 26,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#f0ece8",
    padding: 18,
    gap: 12,
    shadowColor: "#d9d3cc",
    shadowOpacity: 0.32,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2
  },
  agentFundsTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  agentFundsLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800"
  },
  agentFundsTitle: {
    color: colors.ink,
    fontSize: 19,
    lineHeight: 25,
    fontWeight: "900",
    marginTop: 4
  },
  agentFundsBadge: {
    borderRadius: 999,
    backgroundColor: "#f1ebe5",
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  agentFundsBadgeReady: {
    backgroundColor: "#aaff35"
  },
  agentFundsBadgeText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "900"
  },
  agentFundsBadgeReadyText: {
    color: "#16330f"
  },
  agentFundsText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700"
  },
  agentNextTaskCard: {
    borderRadius: 28,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e8efe0",
    padding: 16,
    gap: 14,
    shadowColor: "#d9d3cc",
    shadowOpacity: 0.32,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2
  },
  agentNextTaskTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  agentNextTaskIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#aaff35",
    alignItems: "center",
    justifyContent: "center"
  },
  agentNextTaskText: {
    flex: 1,
    gap: 4
  },
  agentNextTaskTitle: {
    color: colors.ink,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "900"
  },
  agentNextTaskNote: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700"
  },
  agentNextTaskActions: {
    flexDirection: "row",
    gap: 10
  },
  agentNextPrimaryAction: {
    flex: 1,
    minHeight: 44,
    borderRadius: 22,
    backgroundColor: "#287f1c",
    alignItems: "center",
    justifyContent: "center"
  },
  agentNextPrimaryText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "900"
  },
  agentNextGhostAction: {
    minWidth: 96,
    minHeight: 44,
    borderRadius: 22,
    backgroundColor: "#f1ebe5",
    alignItems: "center",
    justifyContent: "center"
  },
  agentNextGhostText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900"
  },
  agentVaultCard: {
    borderRadius: 26,
    backgroundColor: "#101f1b",
    padding: 18,
    gap: 12,
    shadowColor: "#0b1c11",
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3
  },
  agentVaultHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  agentVaultIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#aaff35",
    alignItems: "center",
    justifyContent: "center"
  },
  agentVaultIconText: {
    color: "#15310e",
    fontSize: 18,
    fontWeight: "900"
  },
  agentVaultTitleWrap: {
    flex: 1,
    gap: 3
  },
  agentVaultTitle: {
    color: "#fff",
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "900"
  },
  agentVaultStatus: {
    color: "#aaff35",
    fontSize: 12,
    fontWeight: "900"
  },
  agentVaultDivider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.12)"
  },
  agentVaultText: {
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800"
  },
  agentVaultMuted: {
    color: "rgba(255, 255, 255, 0.62)",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700"
  },
  hWalletSection: {
    gap: 12
  },
  hWalletSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 2
  },
  hWalletSectionTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "900"
  },
  hWalletSectionMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800"
  },
  walletAssetList: {
    gap: 10
  },
  walletAssetCard: {
    minHeight: 82,
    borderRadius: 24,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#f0ece8",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#d9d3cc",
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2
  },
  walletAssetIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#101f1b",
    alignItems: "center",
    justifyContent: "center"
  },
  walletAssetIconText: {
    color: "#aaff35",
    fontSize: 18,
    fontWeight: "900"
  },
  walletAssetText: {
    flex: 1,
    gap: 3
  },
  walletAssetSymbol: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900"
  },
  walletAssetName: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700"
  },
  walletAssetAmount: {
    alignItems: "flex-end",
    gap: 3
  },
  walletAssetAmountText: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900"
  },
  walletAssetValueText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700"
  },
  walletAssetStatusPill: {
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: "#f1ebe5",
    color: colors.muted,
    fontSize: 10,
    fontWeight: "900",
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  walletAssetStatusSynced: {
    backgroundColor: "#e9f8d8",
    color: "#1d7d1a"
  },
  walletAssetStatusFailed: {
    backgroundColor: "#fff0f2",
    color: "#c8172f"
  },
  walletRecordList: {
    borderRadius: 24,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#f0ece8",
    padding: 16,
    gap: 12
  },
  walletRecordRow: {
    flexDirection: "row",
    gap: 11,
    paddingVertical: 2
  },
  walletRecordIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2
  },
  walletRecordText: {
    flex: 1,
    gap: 4,
    minWidth: 0
  },
  walletRecordTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  walletRecordTitle: {
    flex: 1,
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900"
  },
  walletRecordStatus: {
    fontSize: 11,
    fontWeight: "900"
  },
  walletRecordNote: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700"
  },
  walletRecordTime: {
    color: "#aaa39c",
    fontSize: 11,
    fontWeight: "800"
  },
  verifiedTransferList: {
    borderRadius: 24,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#f0ece8",
    padding: 14,
    gap: 12
  },
  verifiedTransferRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11
  },
  verifiedTransferIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#f1ebe5",
    alignItems: "center",
    justifyContent: "center"
  },
  verifiedTransferIconReady: {
    backgroundColor: "#1d7d1a"
  },
  verifiedTransferText: {
    flex: 1,
    gap: 3,
    minWidth: 0
  },
  verifiedTransferTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900"
  },
  verifiedTransferHash: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800"
  },
  verifiedTransferTime: {
    color: "#aaa39c",
    fontSize: 11,
    fontWeight: "800"
  },
  auditTimelineList: {
    borderRadius: 24,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#f0ece8",
    padding: 16,
    gap: 14
  },
  auditTimelineRow: {
    flexDirection: "row",
    gap: 10
  },
  auditTimelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#287f1c",
    marginTop: 7
  },
  auditTimelineDotBlocked: {
    backgroundColor: "#c2410c"
  },
  auditTimelineText: {
    flex: 1,
    gap: 4
  },
  auditTimelineTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  auditTimelineTitle: {
    flex: 1,
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900"
  },
  auditTimelineStage: {
    color: "#287f1c",
    fontSize: 12,
    fontWeight: "900",
    backgroundColor: "#eff8e7",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: "hidden"
  },
  auditTimelineStageBlocked: {
    color: "#c2410c",
    backgroundColor: "#fff1e8"
  },
  auditTimelineNote: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700"
  },
  auditTimelineMeta: {
    color: "#9a928a",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700"
  },
  auditTimelineActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 2
  },
  auditTimelineAction: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#101f1b",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  auditTimelineActionText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "900"
  },
  auditTimelineActionSecondary: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#f2eee9",
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  auditTimelineActionSecondaryText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "900"
  },
  hWalletRefreshButton: {
    minHeight: 48,
    borderRadius: 24,
    backgroundColor: "#f1ebe5",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8
  },
  hWalletRefreshText: {
    color: colors.ink,
    fontWeight: "900"
  },
  assetHeader: {
    marginTop: 18,
    gap: 5
  },
  assetLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700"
  },
  assetValue: {
    color: "#050505",
    fontSize: 40,
    lineHeight: 46,
    fontWeight: "900"
  },
  assetUnit: {
    fontSize: 17,
    fontWeight: "800"
  },
  assetProfit: {
    color: "#1f9d55",
    fontSize: 14,
    fontWeight: "600"
  },
  assetSplit: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingRight: 78
  },
  assetSmallLabel: {
    color: colors.muted,
    fontSize: 13,
    marginBottom: 5
  },
  assetSmallValue: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "700"
  },
  greenButton: {
    minHeight: 54,
    borderRadius: 27,
    backgroundColor: "#26751b",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10
  },
  greenButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900"
  },
  mineTabs: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    marginTop: 8
  },
  mineTabMuted: {
    color: "#807b75",
    fontSize: 15,
    fontWeight: "700"
  },
  mineTabActive: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900",
    borderBottomWidth: 2,
    borderBottomColor: colors.ink,
    paddingBottom: 8
  },
  mineSection: {
    gap: 10
  },
  mineSectionHeader: {
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  mineSectionTitle: {
    color: "#050505",
    fontSize: 20,
    fontWeight: "900"
  },
  mineSectionCount: {
    overflow: "hidden",
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.78)",
    color: "#5f5a55",
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 12,
    fontWeight: "900"
  },
  mineSectionBody: {
    gap: 10
  },
  mineRecordCard: {
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.78)",
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  mineRecordIcon: {
    width: 38,
    fontSize: 27,
    lineHeight: 32
  },
  mineRecordIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: "#aaff35",
    alignItems: "center",
    justifyContent: "center"
  },
  mineRecordText: {
    flex: 1,
    gap: 4
  },
  mineRecordTitle: {
    color: "#050505",
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "900"
  },
  mineRecordNote: {
    color: "#746e67",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700"
  },
  mineRecordStatus: {
    overflow: "hidden",
    borderRadius: 14,
    backgroundColor: "#f1ebe5",
    color: "#1f1d1a",
    paddingHorizontal: 9,
    paddingVertical: 6,
    fontSize: 11,
    fontWeight: "900"
  },
  mineTimelineRow: {
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.68)",
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  mineTimelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#26751b"
  },
  mineTimelineDotBlocked: {
    backgroundColor: "#c2410c"
  },
  mineTimelineText: {
    flex: 1,
    gap: 3
  },
  mineTimelineTitle: {
    color: "#050505",
    fontSize: 13,
    fontWeight: "900"
  },
  mineTimelineNote: {
    color: "#746e67",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700"
  },
  mineTimelineType: {
    color: "#1f1d1a",
    fontSize: 12,
    fontWeight: "900"
  },
  mineEmptyState: {
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.62)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14
  },
  mineEmptyText: {
    color: "#746e67",
    fontSize: 13,
    fontWeight: "800"
  },
  eventHero: {
    minHeight: 372,
    marginHorizontal: -22,
    marginTop: -72,
    paddingHorizontal: 22,
    paddingBottom: 24,
    justifyContent: "flex-end",
    overflow: "hidden",
    backgroundColor: "#e6e6e3"
  },
  eventHeroImage: {
    opacity: 0.98
  },
  rewardCard: {
    marginTop: -44,
    borderRadius: 26,
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    padding: 18,
    gap: 13,
    shadowColor: "#d5d0ca",
    shadowOpacity: 0.7,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4
  },
  rewardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 18
  },
  rewardCol: {
    flex: 1,
    gap: 7
  },
  rewardLabel: {
    color: "#615c56",
    fontSize: 13
  },
  rewardValue: {
    color: "#050505",
    fontSize: 22,
    fontWeight: "900"
  },
  rewardScale: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  scaleText: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: "700"
  },
  scaleMuted: {
    color: colors.muted,
    fontSize: 10
  },
  rewardTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: "#e5e5e2",
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  rewardFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: "38%",
    borderRadius: 999,
    backgroundColor: "#b5ff2a"
  },
  rewardDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginHorizontal: 2,
    backgroundColor: "rgba(0, 0, 0, 0.44)"
  },
  scoreSection: {
    marginHorizontal: -22,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: "#fff",
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 22,
    gap: 18
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 14
  },
  bigSectionTitle: {
    color: "#050505",
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "900"
  },
  sectionSub: {
    marginTop: 6,
    color: "#625d57",
    fontSize: 13,
    lineHeight: 19
  },
  helpPill: {
    minHeight: 34,
    borderRadius: 17,
    backgroundColor: "#f0f0ef",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 5
  },
  helpPillText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "700"
  },
  scoreCard: {
    borderRadius: 20,
    backgroundColor: "#f2f2f1",
    padding: 18,
    gap: 12
  },
  scoreTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  scoreLabel: {
    color: "#6a655f",
    fontSize: 13
  },
  scoreValue: {
    marginTop: 8,
    color: "#050505",
    fontSize: 33,
    lineHeight: 38,
    fontWeight: "500"
  },
  smallPill: {
    borderRadius: 18,
    backgroundColor: "#e6e6e5",
    paddingHorizontal: 18,
    paddingVertical: 9
  },
  smallPillText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "700"
  },
  scoreDivider: {
    height: 1,
    backgroundColor: "#dededc"
  },
  rewardAmount: {
    color: "#050505",
    fontSize: 27,
    lineHeight: 34,
    fontWeight: "500"
  },
  rewardUsd: {
    color: "#6a655f",
    fontSize: 14
  },
  agentInsightCard: {
    borderRadius: 24,
    backgroundColor: "#102115",
    padding: 18,
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4
  },
  agentInsightTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  agentInsightLabel: {
    overflow: "hidden",
    borderRadius: 14,
    backgroundColor: "#b5ff2a",
    color: colors.ink,
    fontSize: 12,
    fontWeight: "900",
    paddingHorizontal: 9,
    paddingVertical: 5
  },
  agentInsightStatus: {
    color: "#b9c6bb",
    fontSize: 12,
    fontWeight: "700"
  },
  agentInsightTitle: {
    color: "#fff",
    fontSize: 18,
    lineHeight: 25,
    fontWeight: "900"
  },
  agentInsightText: {
    color: "#efe8df",
    fontSize: 13,
    lineHeight: 20
  },
  agentInsightAction: {
    minHeight: 40,
    borderRadius: 20,
    backgroundColor: "#26751b",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 2
  },
  agentInsightActionText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "900"
  },
  taskSection: {
    gap: 14
  },
  taskCard: {
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.74)",
    padding: 16,
    gap: 12
  },
  taskTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900"
  },
  taskDesc: {
    color: "#625d57",
    fontSize: 13,
    lineHeight: 19
  },
  checkRow: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  checkDay: {
    alignItems: "center",
    gap: 7
  },
  checkCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#ededec",
    alignItems: "center",
    justifyContent: "center"
  },
  checkCircleActive: {
    backgroundColor: "#26751b"
  },
  checkText: {
    color: colors.muted,
    fontSize: 11
  },
  taskBottom: {
    borderTopWidth: 1,
    borderTopColor: "#dededc",
    paddingTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  taskReward: {
    color: "#26751b",
    fontSize: 16,
    fontWeight: "800"
  },
  streakTag: {
    overflow: "hidden",
    borderRadius: 6,
    backgroundColor: "#dfff7b",
    color: "#26751b",
    paddingHorizontal: 6,
    paddingVertical: 3,
    fontSize: 12,
    fontWeight: "700"
  },
  disabledPill: {
    marginLeft: "auto",
    overflow: "hidden",
    borderRadius: 17,
    backgroundColor: "#eeeeed",
    color: "#b8b4af",
    paddingHorizontal: 18,
    paddingVertical: 8,
    fontSize: 13,
    fontWeight: "700"
  },
  rankSection: {
    gap: 14
  },
  rankPodium: {
    flexDirection: "row",
    gap: 8
  },
  rankTopCard: {
    flex: 1,
    minHeight: 126,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.74)",
    padding: 12,
    justifyContent: "flex-end",
    overflow: "hidden"
  },
  rankWatermark: {
    position: "absolute",
    right: -6,
    top: 2,
    color: "rgba(0, 0, 0, 0.08)",
    fontSize: 76,
    fontWeight: "900"
  },
  rankAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#101010",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8
  },
  rankAvatarText: {
    color: "#b5ff2a",
    fontSize: 10,
    fontWeight: "900"
  },
  rankName: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900"
  },
  rankXp: {
    color: "#4f4a45",
    fontSize: 12,
    marginTop: 3
  },
  rankBtc: {
    color: "#4f4a45",
    fontSize: 12,
    marginTop: 2
  },
  rankRow: {
    minHeight: 52,
    borderTopWidth: 1,
    borderTopColor: "#dfdfdd",
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  rankNo: {
    color: "#625d57",
    fontSize: 13
  },
  rankUser: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "800"
  },
  rankUserTag: {
    overflow: "hidden",
    borderRadius: 7,
    backgroundColor: "#eeeeed",
    color: colors.ink,
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontSize: 12
  },
  rankReward: {
    marginLeft: "auto",
    color: colors.ink,
    fontSize: 13
  },
  fixedActionRow: {
    position: "absolute",
    left: 24,
    right: 24,
    bottom: 18,
    zIndex: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  campaignNavPill: {
    flex: 1,
    minHeight: 66,
    flexDirection: "row",
    padding: 6,
    borderRadius: 33,
    backgroundColor: "rgba(255, 255, 255, 0.82)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.82)",
    shadowColor: "#cfc5bc",
    shadowOpacity: 0.52,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 6
  },
  campaignNavItem: {
    flex: 1,
    minHeight: 54,
    borderRadius: 27,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    gap: 3
  },
  campaignNavItemActive: {
    backgroundColor: "#efeae4"
  },
  campaignNavText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "800"
  },
  xMarkText: {
    color: colors.ink,
    fontSize: 29,
    lineHeight: 31,
    fontWeight: "300",
    marginTop: -2
  },
  explorePage: {
    paddingHorizontal: 22,
    paddingTop: 4,
    paddingBottom: 124,
    backgroundColor: "#fff",
    gap: 18
  },
  marketDetailPage: {
    paddingHorizontal: 22,
    paddingTop: 4,
    paddingBottom: 124,
    backgroundColor: "#fff",
    gap: 18
  },
  exploreHeader: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  exploreBackButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center"
  },
  exploreTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900"
  },
  exploreHeaderGhost: {
    width: 38,
    height: 38
  },
  marketTabs: {
    gap: 10,
    paddingRight: 18
  },
  marketTab: {
    minHeight: 34,
    borderRadius: 17,
    backgroundColor: "#f2f2f1",
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center"
  },
  marketTabActive: {
    backgroundColor: "#050505"
  },
  marketTabText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "800"
  },
  marketTabTextActive: {
    color: "#fff"
  },
  exploreStatusRow: {
    minHeight: 34,
    borderRadius: 17,
    backgroundColor: "#f2f2f1",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start"
  },
  exploreStatusText: {
    color: "#716b65",
    fontSize: 12,
    fontWeight: "700"
  },
  exploreSourceCard: {
    borderRadius: 18,
    backgroundColor: "#f2f2f1",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4
  },
  exploreSourceLabel: {
    color: "#050505",
    fontSize: 13,
    fontWeight: "900"
  },
  exploreSourceText: {
    color: "#716b65",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700"
  },
  exploreSourceTime: {
    color: "#9a948e",
    fontSize: 11,
    fontWeight: "700"
  },
  exploreEmptyCard: {
    minHeight: 142,
    borderRadius: 24,
    backgroundColor: "#f3f3f2",
    padding: 20,
    justifyContent: "center",
    gap: 8
  },
  exploreEmptyTitle: {
    color: "#050505",
    fontSize: 20,
    fontWeight: "900"
  },
  exploreEmptyText: {
    color: "#716b65",
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "700"
  },
  exploreSection: {
    gap: 18
  },
  marketSectionTitleRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  marketIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 9,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center"
  },
  marketIconText: {
    fontSize: 20
  },
  marketSectionTitle: {
    flex: 1,
    color: "#050505",
    fontSize: 20,
    fontWeight: "900"
  },
  championGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12
  },
  championItem: {
    width: "48%",
    gap: 5
  },
  championFlagCard: {
    aspectRatio: 1,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    gap: 26
  },
  championFlag: {
    fontSize: 52
  },
  championPercent: {
    color: "#fff",
    fontSize: 42,
    lineHeight: 48,
    fontWeight: "900"
  },
  championName: {
    color: "#050505",
    fontSize: 17,
    fontWeight: "900"
  },
  championVolume: {
    color: "#89847f",
    fontSize: 13
  },
  championNote: {
    color: "#5f5b55",
    fontSize: 12,
    lineHeight: 16
  },
  exploreCardList: {
    gap: 22,
    paddingTop: 12
  },
  playerMarketCard: {
    borderRadius: 22,
    backgroundColor: "#f3f3f2",
    padding: 16,
    gap: 15
  },
  playerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  playerFlag: {
    width: 42,
    fontSize: 34
  },
  playerTextStack: {
    flex: 1,
    gap: 4
  },
  playerName: {
    color: "#050505",
    fontSize: 18,
    fontWeight: "900"
  },
  playerPercent: {
    color: "#050505",
    fontSize: 18,
    fontWeight: "900"
  },
  playerTrack: {
    height: 4,
    borderRadius: 999,
    backgroundColor: "#d8d8d6",
    overflow: "hidden"
  },
  playerTrackFill: {
    height: 4,
    borderRadius: 999,
    backgroundColor: "#31bd70"
  },
  yesNoRow: {
    flexDirection: "row",
    gap: 12
  },
  yesPill: {
    flex: 1,
    overflow: "hidden",
    borderRadius: 18,
    backgroundColor: "#35c06f",
    color: "#fff",
    paddingVertical: 10,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "900"
  },
  noPill: {
    flex: 1,
    overflow: "hidden",
    borderRadius: 18,
    backgroundColor: "#ef4772",
    color: "#fff",
    paddingVertical: 10,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "900"
  },
  marketVolume: {
    color: "#8b8782",
    fontSize: 13
  },
  marketQuestion: {
    color: "#7f7972",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700"
  },
  marketAgentNote: {
    color: "#5f5b55",
    fontSize: 13,
    lineHeight: 18
  },
  marketDetailHero: {
    borderRadius: 28,
    backgroundColor: "#0c2113",
    padding: 24,
    gap: 14
  },
  marketDetailFlag: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center"
  },
  marketDetailFlagText: {
    fontSize: 40
  },
  marketDetailName: {
    color: "#fff",
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "900"
  },
  marketDetailTitle: {
    color: "rgba(255, 255, 255, 0.76)",
    fontSize: 16,
    lineHeight: 23,
    fontWeight: "800"
  },
  marketDetailOddsRow: {
    flexDirection: "row",
    gap: 12
  },
  marketDetailOddCard: {
    flex: 1,
    borderRadius: 22,
    backgroundColor: "#f3f3f2",
    padding: 18,
    gap: 8
  },
  marketDetailOddLabel: {
    color: "#77716b",
    fontSize: 14,
    fontWeight: "800"
  },
  marketDetailOddValue: {
    color: "#050505",
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "900"
  },
  marketDetailInfoCard: {
    borderRadius: 24,
    backgroundColor: "#f3f3f2",
    padding: 18,
    gap: 14
  },
  marketDetailSectionTitle: {
    color: "#050505",
    fontSize: 18,
    fontWeight: "900"
  },
  marketDetailNote: {
    color: "#4d4741",
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "700"
  },
  marketDetailMetaRow: {
    minHeight: 28,
    borderTopWidth: 1,
    borderTopColor: "#dfdfdd",
    paddingTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  marketDetailMeta: {
    color: "#7d766e",
    fontSize: 13,
    fontWeight: "800"
  },
  marketDetailMetaValue: {
    color: "#050505",
    fontSize: 14,
    fontWeight: "900"
  },
  marketDetailPrimaryButton: {
    minHeight: 58,
    borderRadius: 29,
    backgroundColor: "#217d1a",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  marketDetailPrimaryText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "900"
  },
  detailButton: {
    minHeight: 48,
    borderRadius: 24,
    backgroundColor: "#eeeeed",
    alignItems: "center",
    justifyContent: "center"
  },
  detailButtonText: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "800"
  },
  groupMarketCard: {
    borderRadius: 22,
    backgroundColor: "#f3f3f2",
    padding: 16,
    gap: 14
  },
  groupTitle: {
    color: "#050505",
    fontSize: 16,
    fontWeight: "900"
  },
  groupTeamList: {
    gap: 12
  },
  groupTeamRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  groupFlag: {
    width: 34,
    fontSize: 28
  },
  groupTeamName: {
    flex: 1,
    color: "#050505",
    fontSize: 17,
    fontWeight: "800"
  },
  groupTeamStack: {
    flex: 1,
    gap: 4
  },
  groupPrice: {
    minWidth: 66,
    overflow: "hidden",
    borderRadius: 18,
    backgroundColor: "#26751b",
    color: "#fff",
    paddingVertical: 8,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "900"
  },
  matchMarketCard: {
    borderRadius: 22,
    backgroundColor: "#f3f3f2",
    padding: 16,
    gap: 14
  },
  matchTimeRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10
  },
  matchMarketTime: {
    flex: 1,
    color: "#5f5a55",
    fontSize: 15,
    fontWeight: "800"
  },
  matchTimingBadge: {
    overflow: "hidden",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: "900"
  },
  matchPrice: {
    minWidth: 66,
    overflow: "hidden",
    borderRadius: 18,
    color: "#fff",
    paddingVertical: 8,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "900"
  },
  worldCupLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700"
  },
  worldCupTitle: {
    color: "#050505",
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900"
  },
  worldCupNote: {
    color: "#5f5850",
    fontSize: 14,
    lineHeight: 21,
    maxWidth: 310
  },
  predictionHero: {
    borderRadius: 24,
    backgroundColor: "#102115",
    padding: 18,
    gap: 13,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 }
  },
  predictionTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  matchBadge: {
    overflow: "hidden",
    borderRadius: 14,
    backgroundColor: "#b5ff2a",
    color: colors.ink,
    fontSize: 12,
    fontWeight: "900",
    paddingHorizontal: 9,
    paddingVertical: 5
  },
  matchTime: {
    color: "#b9c6bb",
    fontSize: 12,
    fontWeight: "700"
  },
  predictionTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12
  },
  teamBadge: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#ffd34f",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.32)"
  },
  teamBadgeStripeTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 12,
    backgroundColor: "#c8242f"
  },
  teamBadgeStripeBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 12,
    backgroundColor: "#c8242f"
  },
  teamBadgeText: {
    color: "#231b12",
    fontSize: 12,
    fontWeight: "900"
  },
  predictionTitleBlock: {
    flex: 1,
    gap: 5
  },
  predictionQuestion: {
    color: "#fff",
    fontSize: 20,
    lineHeight: 27,
    fontWeight: "900"
  },
  probabilityRow: {
    gap: 8
  },
  outcomeCards: {
    flexDirection: "row",
    gap: 10
  },
  outcomeCard: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 3
  },
  probabilityLabel: {
    color: "#b9c6bb",
    fontSize: 12,
    fontWeight: "800"
  },
  probabilityValue: {
    color: "#fff",
    fontSize: 22,
    lineHeight: 26,
    fontWeight: "900"
  },
  probabilityBar: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    overflow: "hidden"
  },
  probabilityFill: {
    width: "64%",
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#19a76a"
  },
  predictionNote: {
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.07)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8
  },
  predictionReason: {
    color: "#efe8df",
    flex: 1,
    fontSize: 13,
    lineHeight: 20
  },
  heroAction: {
    minHeight: 38,
    borderRadius: 19,
    backgroundColor: "#26751b",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6
  },
  heroActionText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "900"
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900"
  },
  sectionHint: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700"
  },
  watchCard: {
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.74)",
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 11
  },
  watchFlag: {
    width: 30,
    fontSize: 25,
    lineHeight: 29
  },
  watchBody: {
    flex: 1,
    gap: 4
  },
  watchTitle: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "800"
  },
  watchMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700"
  },
  watchPrice: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900"
  },
  sectionEyebrow: {
    fontSize: 13,
    color: colors.muted,
    fontWeight: "700"
  },
  pageTitle: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "800",
    color: colors.ink
  },
  pageNote: {
    color: "#5f5850",
    fontSize: 15,
    lineHeight: 22
  },
  primaryCard: {
    borderRadius: 24,
    backgroundColor: colors.ink,
    padding: 18,
    gap: 8
  },
  primaryCardTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800"
  },
  primaryCardBody: {
    color: "#efe8df",
    lineHeight: 21
  },
  marketCard: {
    borderRadius: 22,
    backgroundColor: "rgba(255, 253, 250, 0.9)",
    padding: 16,
    gap: 7
  },
  marketTitle: {
    color: colors.ink,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700"
  },
  marketMeta: {
    color: colors.muted,
    fontSize: 13
  },
  walletCard: {
    borderRadius: 24,
    backgroundColor: "rgba(255, 253, 250, 0.95)",
    padding: 18,
    gap: 8
  },
  walletText: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.ink
  },
  statsGrid: {
    flexDirection: "row",
    gap: 10
  },
  consoleStat: {
    flex: 1,
    minHeight: 78,
    borderRadius: 22,
    backgroundColor: "rgba(255, 253, 250, 0.88)",
    alignItems: "center",
    justifyContent: "center"
  },
  consoleStatValue: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: "800"
  },
  consoleLabel: {
    color: colors.muted,
    fontSize: 12
  },
  bottomDockWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 108,
    justifyContent: "flex-end",
    alignItems: "center"
  },
  bottomScrim: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(255, 253, 250, 0.08)"
  },
  bottomDock: {
    paddingBottom: 18,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12
  },
  tabPill: {
    minHeight: 66,
    borderRadius: 33,
    backgroundColor: "rgba(255, 255, 255, 0.76)",
    flexDirection: "row",
    alignItems: "center",
    padding: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.72)",
    shadowColor: "#cfc5bc",
    shadowOpacity: 0.55,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 18 },
    elevation: 6
  },
  tabButton: {
    minWidth: 78,
    minHeight: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    gap: 2
  },
  newChatButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "rgba(255, 255, 255, 0.78)",
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "rgba(23, 21, 18, 0.34)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#cfc5bc",
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 16 },
    elevation: 5
  },
  newChatButtonActive: {
    backgroundColor: "#efeae4",
    borderStyle: "solid",
    borderColor: "rgba(23, 21, 18, 0.08)"
  },
  hMarkText: {
    color: colors.ink,
    fontSize: 22,
    lineHeight: 25,
    fontWeight: "900"
  },
  tabButtonActive: {
    backgroundColor: "rgba(241, 235, 229, 0.62)"
  },
  tabText: {
    color: "#77716a",
    fontSize: 12,
    fontWeight: "600"
  },
  tabTextActive: {
    color: colors.ink,
    fontWeight: "800"
  }
});
