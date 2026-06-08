import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useEmbeddedEthereumWallet, useLoginWithEmail, usePrivy } from "@privy-io/expo";
import { type ReactNode, useEffect, useMemo, useState } from "react";
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
import type {
  V2ConversationCard,
  V2MarketSnapshot,
  V2MobileChatMessage,
  V2MobileHomeView,
  V2PredictionCard,
  V2SimulationCard,
  V2StrategyCard,
  V2TrackingCard,
  V2WorldCupExploreCategory,
  V2WorldCupExploreMarketCard,
  V2WorldCupExploreView
} from "./types";

const worldCupPoster = require("../assets/world-cup-poster.png");

type MainTab = "agent" | "worldcup" | "mine";
type WorldCupView = "home" | "explore" | "detail";
type MarketCategory = "冠军" | "金靴奖得主" | "小组赛" | "近期比赛";

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
  const { wallets } = useEmbeddedEthereumWallet();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [input, setInput] = useState("");
  const [activeTab, setActiveTab] = useState<MainTab>("agent");
  const [worldCupExplore, setWorldCupExplore] = useState<V2WorldCupExploreView | undefined>();
  const [worldCupExploreLoading, setWorldCupExploreLoading] = useState(false);
  const [worldCupExploreError, setWorldCupExploreError] = useState<string | undefined>();
  const walletAddress = wallets[0]?.address as `0x${string}` | undefined;
  const worldCupApi = useMemo(() => createApi(apiBaseUrl, getAccessToken), [apiBaseUrl, getAccessToken]);
  const agent = useV2AgentWallet({
    apiBaseUrl,
    getAccessToken,
    isReady,
    userId: user?.id,
    walletAddress
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
    setActiveTab("agent");
    await agent.sendText(trimmed);
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
        <TopBar
          onLeft={() => setActiveTab("worldcup")}
          onRight={() => setActiveTab("mine")}
          rightActive={activeTab === "mine"}
        />

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
          />
        ) : null}

        {activeTab === "mine" ? (
          <MineTab
            walletAddress={walletAddress}
            trackingCount={agent.session.home?.state.trackingCount || 0}
            strategyCount={agent.session.home?.state.strategyCount || 0}
            recordCount={agent.session.home?.state.recordCount || 0}
            recent={agent.session.home?.recent}
            onRefresh={() => run(() => agent.refreshHome())}
            onLogout={() => run(logout)}
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
  onAction
}: {
  busy: boolean;
  error?: string;
  input: string;
  messages: V2MobileChatMessage[];
  quickPrompts: { id: string; text: string }[];
  setInput: (value: string) => void;
  onSend: (text: string) => void;
  onAction: (action: "simulate" | "track" | "build_strategy", card: V2ConversationCard) => void;
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
          <MessageBubble key={message.id} message={message} onAction={onAction} />
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
            placeholder="向 Agent 发送消息"
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
  onHome
}: {
  explore?: V2WorldCupExploreView;
  exploreError?: string;
  exploreLoading: boolean;
  items: { id: string; title: string; subtitle?: string; value?: string }[];
  onAsk: (text: string) => void;
  onAnalyzeMarket: (text: string, market: V2MarketSnapshot) => void;
  onHome: () => void;
}) {
  const [worldCupView, setWorldCupView] = useState<WorldCupView>("home");
  const [category, setCategory] = useState<MarketCategory>("冠军");
  const [selectedMarket, setSelectedMarket] = useState<V2WorldCupExploreMarketCard | undefined>();

  if (worldCupView === "explore") {
    return (
      <ExploreWorldCupPage
        activeCategory={category}
        explore={explore}
        exploreError={exploreError}
        exploreLoading={exploreLoading}
        onBack={() => setWorldCupView("home")}
        onCategoryChange={setCategory}
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

        <Pressable style={styles.agentInsightCard} onPress={() => onAsk("继续分析今天的世界杯机会")}>
          <View style={styles.agentInsightTop}>
            <Text style={styles.agentInsightLabel}>今日 Agent 观点</Text>
            <Text style={styles.agentInsightStatus}>已更新</Text>
          </View>
          <Text style={styles.agentInsightTitle}>先观察西班牙冠军盘，优先跟踪墨西哥 A 组排名。</Text>
          <Text style={styles.agentInsightText}>热度在上升，但部分价格已经不便宜。让 Agent 继续看盘口、资金和新闻，再决定是否出手。</Text>
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

        {items.slice(0, 2).map((item) => (
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

      <View style={styles.fixedActionRow}>
        <Pressable style={styles.campaignNavItem} onPress={onHome}>
          <Ionicons name="home" size={19} color={colors.ink} />
          <Text style={styles.campaignNavText}>首页</Text>
        </Pressable>
        <Pressable style={styles.campaignNavItem}>
          <Ionicons name="share-outline" size={19} color={colors.ink} />
          <Text style={styles.campaignNavText}>分享</Text>
        </Pressable>
        <Pressable style={[styles.campaignNavItem, styles.campaignNavItemActive]} onPress={() => setWorldCupView("explore")}>
          <Ionicons name="football-outline" size={19} color={colors.ink} />
          <Text style={styles.campaignNavText}>赛事</Text>
        </Pressable>
        <Pressable style={styles.campaignNavItem} onPress={onHome}>
          <Ionicons name="chatbubble-ellipses-outline" size={19} color={colors.ink} />
          <Text style={styles.campaignNavText}>新对话</Text>
        </Pressable>
      </View>
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
  onSelectCard
}: {
  activeCategory: MarketCategory;
  explore?: V2WorldCupExploreView;
  exploreError?: string;
  exploreLoading?: boolean;
  onBack: () => void;
  onCategoryChange: (category: MarketCategory) => void;
  onSelectCard: (card: V2WorldCupExploreMarketCard) => void;
}) {
  const activeExploreCategory = exploreCategoryByTab[activeCategory];
  const activeCards = explore?.cards[activeExploreCategory] || [];
  const hasDynamicCards = activeCards.length > 0;
  const sourceText = explore?.source?.label || "赛事数据";
  const sourceMessage = explore?.source?.warning || explore?.source?.message || "Agent 会先整理热度、价格和资金变化。";
  const sourceUpdatedAt = formatExploreUpdatedAt(explore?.source?.updatedAt || explore?.updatedAt);

  return (
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
            <Text style={[styles.marketTabText, activeCategory === category ? styles.marketTabTextActive : null]}>{category}</Text>
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
          {sourceUpdatedAt ? <Text style={styles.exploreSourceTime}>更新于 {sourceUpdatedAt}</Text> : null}
        </View>
      ) : null}

      {hasDynamicCards && activeCategory === "冠军" ? <DynamicChampionMarketGrid cards={activeCards} onSelectCard={onSelectCard} /> : null}
      {hasDynamicCards && activeCategory === "金靴奖得主" ? <DynamicGoldenBootMarketList cards={activeCards} onSelectCard={onSelectCard} /> : null}
      {hasDynamicCards && activeCategory === "小组赛" ? <DynamicGroupMarketList cards={activeCards} onSelectCard={onSelectCard} /> : null}
      {hasDynamicCards && activeCategory === "近期比赛" ? <DynamicMatchMarketList cards={activeCards} onSelectCard={onSelectCard} /> : null}

      {!hasDynamicCards && activeCategory === "冠军" ? <ChampionMarketGrid /> : null}
      {!hasDynamicCards && activeCategory === "金靴奖得主" ? <GoldenBootMarketList /> : null}
      {!hasDynamicCards && activeCategory === "小组赛" ? <GroupMarketList /> : null}
      {!hasDynamicCards && activeCategory === "近期比赛" ? <MatchMarketList /> : null}
    </ScrollView>
  );
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
          <Text style={styles.matchMarketTime}>{card.subtitle || "赛程更新中"}</Text>
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
  onAskAgent
}: {
  card: V2WorldCupExploreMarketCard;
  onBack: () => void;
  onAskAgent: (card: V2WorldCupExploreMarketCard) => void;
}) {
  const yesOption = card.options.find((option) => option.side === "yes") || card.options[0];
  const noOption = card.options.find((option) => option.side === "no") || card.options[1];

  return (
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
  walletAddress,
  trackingCount,
  strategyCount,
  recordCount,
  recent,
  onRefresh,
  onLogout
}: {
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
  onNewChat
}: {
  activeTab: MainTab;
  onChange: (tab: MainTab) => void;
  onNewChat: () => void;
}) {
  return (
    <View style={styles.bottomDockWrap}>
      <View style={styles.bottomScrim} />
      <View style={styles.bottomDock}>
        <View style={styles.tabPill}>
          <TabButton active={activeTab === "agent"} icon="chatbubble-ellipses" label="Agent" onPress={() => onChange("agent")} />
          <TabButton active={activeTab === "worldcup"} icon="football-outline" label="世界杯" onPress={() => onChange("worldcup")} />
          <TabButton active={activeTab === "mine"} icon="person-outline" label="我的" onPress={() => onChange("mine")} />
        </View>
        <Pressable style={styles.newChatButton} onPress={onNewChat}>
          <Ionicons name="chatbubble-ellipses-outline" size={24} color="#171512" />
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
  onAction
}: {
  message: V2MobileChatMessage;
  onAction: (action: "simulate" | "track" | "build_strategy", card: V2ConversationCard) => void;
}) {
  if (message.kind === "card" && message.card) {
    return <CardMessage card={message.card} onAction={onAction} />;
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
  onAction
}: {
  card: V2ConversationCard;
  onAction: (action: "simulate" | "track" | "build_strategy", card: V2ConversationCard) => void;
}) {
  if (card.type === "receive_card") {
    const address = card.addresses[0];
    async function copyAddress() {
      if (!address?.address) return;
      await Clipboard.setStringAsync(address.address);
      Alert.alert("已复制", "充值地址已复制。");
    }

    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{card.title}</Text>
        <Text style={styles.cardBody}>{address?.network}</Text>
        <Text style={styles.address}>{address?.address}</Text>
        <Pressable style={styles.copyButton} onPress={() => copyAddress()}>
          <Ionicons name="copy-outline" size={17} color="#171512" />
          <Text style={styles.secondaryButtonText}>复制地址</Text>
        </Pressable>
      </View>
    );
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
    return <SimulationCardMessage card={card} />;
  }

  return null;
}

function SimulationCardMessage({ card }: { card: V2SimulationCard }) {
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
        <Text style={styles.simulationSafeText}>这一步只是模拟，没有提交订单。</Text>
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
  if (card.status === "tradeable" && card.market.acceptingOrders) return "可观察";
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
  shell: "#f7f1ec",
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
    gap: 8,
    padding: 6,
    borderRadius: 35,
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
    minHeight: 58,
    borderRadius: 25,
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
  explorePage: {
    paddingHorizontal: 22,
    paddingTop: 4,
    paddingBottom: 34,
    backgroundColor: "#fff",
    gap: 18
  },
  marketDetailPage: {
    paddingHorizontal: 22,
    paddingTop: 4,
    paddingBottom: 34,
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
  matchMarketTime: {
    color: "#5f5a55",
    fontSize: 15,
    fontWeight: "800"
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
