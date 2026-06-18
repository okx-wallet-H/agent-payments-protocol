import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useEffect, useMemo, useRef, useState } from "react";
import { Image, ImageBackground, Keyboard, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { createApi } from "./api";
import { createFriendlyWalletNotice } from "./hwallet-entry";
import type { V2WalletContext, V2WorldCupExploreCategory, V2WorldCupExploreMarketCard, V2WorldCupExploreView } from "./types";

const worldCupPoster = require("../assets/world-cup-agent-poster.png");
const appIcon = require("../assets/icon.png");

type Tab = "agent" | "worldcup" | "mine" | "wallet";
type LoginStep = "email" | "code";
type WorldCupView = "sentiment" | "prediction" | "explore" | "profile";
type MarketCategory = "冠军" | "金靴奖得主" | "小组赛" | "近期比赛";

const loginDigits = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
const marketCategories: MarketCategory[] = ["冠军", "金靴奖得主", "小组赛", "近期比赛"];
const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:3000";
const previewEmailStorageKey = "agent-wallet-preview-email";
const exploreCategoryByTab: Record<MarketCategory, V2WorldCupExploreCategory> = {
  "冠军": "champion",
  "金靴奖得主": "golden_boot",
  "小组赛": "group_stage",
  "近期比赛": "upcoming_matches"
};

function usePreviewCopyFeedback() {
  const [copied, setCopied] = useState(false);
  const resetRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (resetRef.current) {
        clearTimeout(resetRef.current);
      }
    };
  }, []);

  function flashCopied() {
    if (resetRef.current) {
      clearTimeout(resetRef.current);
    }
    setCopied(true);
    resetRef.current = setTimeout(() => setCopied(false), 2200);
  }

  return { copied, flashCopied };
}

function formatPreviewWalletError(error: unknown, fallback: string): string {
  const rawMessage = error instanceof Error ? error.message : undefined;
  return createFriendlyWalletNotice(rawMessage) || fallback;
}

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

export function V2AgentWalletPreview() {
  const [previewEmail, setPreviewEmail] = useState(readStoredPreviewEmail);
  const [previewCode, setPreviewCode] = useState("");
  const [previewLoginStep, setPreviewLoginStep] = useState<LoginStep>("email");
  const [previewAuthed, setPreviewAuthed] = useState(() => readStoredPreviewEmail().length > 0);
  const [tab, setTab] = useState<Tab>("agent");
  const [input, setInput] = useState("");
  const [showReceiveCard, setShowReceiveCard] = useState(false);
  const [previewMessages, setPreviewMessages] = useState<Array<{ role: "user" | "agent"; text: string }>>([]);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [worldCupView, setWorldCupView] = useState<WorldCupView>("sentiment");
  const [marketCategory, setMarketCategory] = useState<MarketCategory>("冠军");
  const [worldCupExplore, setWorldCupExplore] = useState<V2WorldCupExploreView | undefined>();
  const [previewWallet, setPreviewWallet] = useState<V2WalletContext | undefined>();
  const [walletLoadError, setWalletLoadError] = useState<string | undefined>();
  const [walletActionBusy, setWalletActionBusy] = useState(false);
  const [worldCupExploreLoading, setWorldCupExploreLoading] = useState(false);
  const [worldCupExploreError, setWorldCupExploreError] = useState<string | undefined>();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const worldCupApi = useMemo(() => createApi(apiBaseUrl), []);
  const insightCopy = createPreviewInsightCopy(worldCupExplore);
  const showBottomDock = tab !== "worldcup" && !keyboardVisible;
  const previewUserId = useMemo(() => previewUserIdFromEmail(previewEmail), [previewEmail]);
  const receiveAddress = useMemo(() => previewAddressForEmail(previewEmail), [previewEmail]);

  function switchPreviewAccount() {
    clearStoredPreviewEmail();
    setPreviewEmail("");
    setPreviewCode("");
    setPreviewLoginStep("email");
    setPreviewAuthed(false);
    setTab("agent");
    setInput("");
    setShowReceiveCard(false);
    setPreviewMessages([]);
    setPreviewWallet(undefined);
  }

  async function submitAgentMessage() {
    const text = input.trim();
    if (!text) return;
    if (/充值|地址|钱包|收款|打款|转入/.test(text)) {
      setShowReceiveCard(true);
    }
    setInput("");
    setPreviewMessages((items) => [...items, { role: "user", text }]);
    setPreviewBusy(true);
    try {
      const response = await worldCupApi.sendV2Chat(text, previewUserId, receiveAddress);
      if (response.wallet) setPreviewWallet(response.wallet);
      const reply = response.mobileTurn.messages
        .filter((message) => message.role === "agent" && message.text)
        .map((message) => message.text)
        .slice(-1)[0] || "我看到了，继续。";
      setPreviewMessages((items) => [...items, { role: "agent", text: reply }]);
    } catch {
      setPreviewMessages((items) => [...items, { role: "agent", text: "我这边先记下了，稍后再刷新一次。" }]);
    } finally {
      setPreviewBusy(false);
    }
  }

  async function verifyPreviewWalletTx(txHash: string) {
    const trimmed = txHash.trim();
    if (!trimmed) return;

    setWalletActionBusy(true);
    setWalletLoadError(undefined);
    try {
      const response = await worldCupApi.verifyV2WalletTx(trimmed, previewUserId, receiveAddress);
      setPreviewWallet(response.wallet);
      const reply = response.mobileTurn.messages
        .filter((message) => message.role === "agent" && message.text)
        .map((message) => message.text)
        .slice(-1)[0];
      if (reply) {
        setPreviewMessages((items) => [...items, { role: "agent", text: reply }]);
      }
    } catch (error) {
      setWalletLoadError(formatPreviewWalletError(error, "这笔交易暂时没有识别成功，稍后再试一次。"));
    } finally {
      setWalletActionBusy(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    if (!previewAuthed) return;

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

    worldCupApi
      .getV2Home(previewUserId, receiveAddress)
      .then((response) => {
        if (!cancelled) {
          setPreviewWallet(response.wallet);
          setWalletLoadError(undefined);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setPreviewWallet(undefined);
          setWalletLoadError(formatPreviewWalletError(error, "HWallet 暂时没有同步成功，稍后再刷新一次。"));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [previewAuthed, previewUserId, receiveAddress, worldCupApi]);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSubscription = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSubscription = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  if (!previewAuthed) {
    const canEnter = previewEmail.trim().length > 3;
    const normalizedPreviewCode = normalizePreviewOtpCode(previewCode);
    const canUnlock = canEnter && normalizedPreviewCode.length >= 6;

    function appendPreviewCodeDigit(digit: string) {
      setPreviewCode((current) => normalizePreviewOtpCode(`${current}${digit}`));
    }

    function deletePreviewCodeDigit() {
      setPreviewCode((current) => normalizePreviewOtpCode(current).slice(0, -1));
    }

    function enterPreview() {
      if (!canEnter) return;
      if (previewLoginStep === "email") {
        setPreviewLoginStep("code");
        return;
      }
      if (!canUnlock) return;
      const normalizedEmail = previewEmail.trim().toLowerCase();
      setPreviewEmail(normalizedEmail);
      saveStoredPreviewEmail(normalizedEmail);
      setPreviewCode("");
      setPreviewLoginStep("email");
      setPreviewAuthed(true);
    }

    return (
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          style={styles.keyboardAvoid}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 16 : 0}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[
              styles.previewLogin,
              previewLoginStep === "code" ? styles.previewLoginCode : null
            ]}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.previewLoginTop}>
              <View style={styles.previewLoginDoorLeft} />
              <View style={styles.previewLoginDoorRight} />
              <View style={styles.previewLoginDoorSeam} />
              <View style={styles.previewLoginHeroGlow} />
              <View style={styles.previewLoginLogoShell}>
                <Image source={appIcon} style={styles.previewLoginLogo} resizeMode="cover" />
              </View>
              <Text style={styles.previewLoginBrand}>海豚社区</Text>
              <Text style={styles.previewLoginTitle}>海豚，开门</Text>
              <Text style={styles.previewLoginSubtitle}>你的 Agent 已就位。</Text>
            </View>

            <View style={styles.previewLoginCard}>
              <Text style={styles.previewLoginCardTitle}>{previewLoginStep === "email" ? "邮箱进入" : "验证码开锁"}</Text>
              {previewLoginStep === "email" ? (
                <>
                  <View style={styles.previewLoginFieldGroup}>
                    <Text style={styles.previewLoginLabel}>邮箱</Text>
                    <TextInput
                      autoCapitalize="none"
                      autoCorrect={false}
                      inputMode="email"
                      keyboardType="email-address"
                      value={previewEmail}
                      onChangeText={setPreviewEmail}
                      placeholder="输入邮箱"
                      placeholderTextColor="#aaa39b"
                      style={styles.previewLoginInput}
                    />
                  </View>
                  <Pressable
                    style={[styles.previewLoginButton, !canEnter ? styles.previewLoginButtonDisabled : null]}
                    disabled={!canEnter}
                    onPress={enterPreview}
                  >
                    <Text style={styles.previewLoginButtonText}>进入</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <View style={styles.previewLoginCodeDots}>
                    {Array.from({ length: 6 }).map((_, index) => (
                      <View
                        key={`preview-code-dot-${index}`}
                        style={[styles.previewLoginCodeDot, index < normalizedPreviewCode.length ? styles.previewLoginCodeDotFilled : null]}
                      />
                    ))}
                  </View>
                  <View style={styles.previewLoginKeypad}>
                    {loginDigits.map((digit) => (
                      <Pressable key={digit} style={styles.previewLoginKey} onPress={() => appendPreviewCodeDigit(digit)}>
                        <Text style={styles.previewLoginKeyText}>{digit}</Text>
                      </Pressable>
                    ))}
                    <Pressable style={styles.previewLoginKey} onPress={deletePreviewCodeDigit}>
                      <Ionicons name="backspace-outline" size={22} color={colors.ink} />
                    </Pressable>
                    <Pressable style={styles.previewLoginKey} onPress={() => appendPreviewCodeDigit("0")}>
                      <Text style={styles.previewLoginKeyText}>0</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.previewLoginKey, styles.previewLoginKeyConfirm, !canUnlock ? styles.previewLoginButtonDisabled : null]}
                      disabled={!canUnlock}
                      onPress={enterPreview}
                    >
                      <Ionicons name="checkmark" size={24} color="#ffffff" />
                    </Pressable>
                  </View>
                </>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
      <View style={styles.shell}>
        {tab !== "worldcup" ? (
          <View style={styles.topbar}>
            <Pressable
              style={styles.roundButton}
              onPress={() => {
                setTab("worldcup");
                setWorldCupView("sentiment");
              }}
            >
              <Ionicons name="menu" size={24} color={colors.ink} />
            </Pressable>
            <View style={styles.topbarCenterSpacer} />
            <Pressable style={styles.roundButton} onPress={() => setTab("mine")}>
              <Ionicons name="person-outline" size={21} color={colors.ink} />
            </Pressable>
          </View>
        ) : null}

        {tab === "agent" ? (
          <View style={styles.agentScreen}>
            <ScrollView
              style={styles.agentScroll}
              contentContainerStyle={styles.agentContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.heroTitle}>海豚，一切可好？</Text>
              {previewMessages.map((message, index) => (
                <View key={`${message.role}-${index}`} style={[styles.previewMessage, message.role === "user" ? styles.previewUserMessage : styles.previewAgentMessage]}>
                  <Text style={[styles.previewMessageText, message.role === "user" ? styles.previewUserMessageText : null]}>{message.text}</Text>
                </View>
              ))}
              {previewBusy ? (
                <View style={styles.previewAgentMessage}>
                  <Text style={styles.previewMessageText}>我看一下...</Text>
                </View>
              ) : null}
              {showReceiveCard ? <AgentReceiveCard address={receiveAddress} /> : null}
            </ScrollView>
            <View style={[styles.composerWrap, keyboardVisible ? styles.composerWrapKeyboard : null]}>
              <View style={styles.composer}>
                <Pressable style={styles.plusButton}>
                  <Ionicons name="add" size={24} color={colors.ink} />
                </Pressable>
                <TextInput
                  value={input}
                  onChangeText={setInput}
                  placeholder="和 Agent 说一句"
                  placeholderTextColor="#817a72"
                  style={styles.composerInput}
                />
                <Pressable style={styles.voiceButton} onPress={submitAgentMessage}>
                  <Ionicons name={input.trim() ? "arrow-up" : "options-outline"} size={21} color={colors.ink} />
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}

        {tab === "worldcup" ? (
          <View style={styles.worldCupShell}>
            {worldCupView === "sentiment" ? (
              <WorldCupSentimentPage />
            ) : null}

            {worldCupView === "prediction" ? (
              <ScrollView contentContainerStyle={styles.worldCupPage} showsVerticalScrollIndicator={false}>
                <Pressable style={styles.agentInsightCard} onPress={() => setTab("agent")}>
                  <View style={styles.agentInsightTop}>
                    <Text style={styles.agentInsightLabel}>今日 Agent 观点</Text>
                    <Text style={styles.agentInsightStatus}>已更新</Text>
                  </View>
                  <Text style={styles.agentInsightTitle}>{insightCopy.title}</Text>
                  <Text style={styles.agentInsightText}>{insightCopy.text}</Text>
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
              </ScrollView>
            ) : null}

            {worldCupView === "explore" ? (
              <ExploreWorldCupPage
                activeCategory={marketCategory}
                explore={worldCupExplore}
                exploreError={worldCupExploreError}
                exploreLoading={worldCupExploreLoading}
                onCategoryChange={setMarketCategory}
              />
            ) : null}

            {worldCupView === "profile" ? <ProfileAssetPage isWorldCupPage /> : null}

            <WorldCupBottomMenu
              active={worldCupView}
              onChange={setWorldCupView}
              onNewChat={() => {
                setInput("");
                setTab("agent");
              }}
            />
          </View>
        ) : null}

        {tab === "mine" ? <ProfileAssetPage /> : null}
        {tab === "wallet" ? (
          <HWalletPreview
            address={receiveAddress}
            busy={walletActionBusy}
            email={previewEmail}
            error={walletLoadError}
            wallet={previewWallet}
            onSwitchAccount={switchPreviewAccount}
            onOpenPrediction={() => {
              setTab("worldcup");
              setWorldCupView("prediction");
            }}
            onVerifyTx={verifyPreviewWalletTx}
          />
        ) : null}

        {showBottomDock ? (
          <View style={styles.bottomDockWrap}>
            <View style={styles.bottomScrim} />
            <View style={styles.bottomDock}>
              <View style={styles.tabPill}>
                <TabButton active={tab === "agent"} icon="chatbubble-ellipses" label="Agent" onPress={() => setTab("agent")} />
                <TabButton
                  active={false}
                  icon="football-outline"
                  label="市场"
                  onPress={() => {
                    setTab("worldcup");
                    setWorldCupView("sentiment");
                  }}
                />
                <TabButton active={tab === "mine"} icon="compass-outline" label="发现" onPress={() => setTab("mine")} />
              </View>
              <Pressable
                style={[styles.newChatButton, tab === "wallet" ? styles.newChatButtonActive : null]}
                onPress={() => setTab("wallet")}
              >
                <Text style={styles.hMarkText}>H</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function HWalletPreview({
  address,
  busy,
  email,
  error,
  wallet,
  onOpenPrediction,
  onSwitchAccount,
  onVerifyTx
}: {
  address: string;
  busy?: boolean;
  email: string;
  error?: string;
  wallet?: V2WalletContext;
  onOpenPrediction: () => void;
  onSwitchAccount: () => void;
  onVerifyTx: (txHash: string) => void;
}) {
  const [txHash, setTxHash] = useState("");
  const { copied, flashCopied } = usePreviewCopyFeedback();
  const assets = wallet?.assets || [
    { symbol: "USDT0" as const, name: "USD Tether 0", amountLabel: "待同步", valueLabel: "-", syncStatus: "pending" as const },
    { symbol: "OKB" as const, name: "X Layer Gas", amountLabel: "待同步", valueLabel: "-", syncStatus: "pending" as const }
  ];
  const records = wallet?.recentRecords || [
    {
      id: "preview-wallet-pending",
      title: "钱包已连接",
      note: "下一步同步 X Layer 资产。",
      status: "pending" as const,
      createdAt: new Date().toISOString()
    }
  ];
  const isAgentReady = wallet?.agent?.fundsStatus === "ready";
  const lifecycle = wallet?.lifecycle || createPendingWalletLifecycle(Boolean(address));

  function submitTxHash() {
    const trimmed = txHash.trim();
    if (!trimmed) return;
    onVerifyTx(trimmed);
    setTxHash("");
  }

  async function copyAddress() {
    await Clipboard.setStringAsync(address);
    flashCopied();
  }

  return (
    <ScrollView contentContainerStyle={styles.hWalletPage} showsVerticalScrollIndicator={false}>
      <View style={styles.hWalletHero}>
        <Text style={styles.hWalletEyebrow}>HWallet</Text>
        <Text style={styles.hWalletTitle}>Agent 的钱包入口</Text>
        <Text style={styles.hWalletText}>充值、收款和后续 Agent 资金识别都会从这里进入。</Text>
        <View style={styles.hWalletAccountRow}>
          <View style={styles.hWalletAccountTextBox}>
            <Text style={styles.hWalletAccountLabel}>当前账户</Text>
            <Text style={styles.hWalletAccountEmail} numberOfLines={1}>
              {email || "未登录"}
            </Text>
          </View>
          <Pressable style={styles.hWalletSwitchButton} onPress={onSwitchAccount}>
            <Text style={styles.hWalletSwitchText}>切换</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.agentReceiveCard}>
        <View style={styles.receiveCardTop}>
          <View>
            <Text style={styles.receiveCardLabel}>收款地址</Text>
            <Text style={styles.receiveCardTitle}>{shortPreviewAddress(address)}</Text>
          </View>
          <View style={styles.receiveNetworkPill}>
            <Text style={styles.receiveNetworkText}>X Layer</Text>
          </View>
        </View>
        <Text style={styles.receiveCardHint}>支持稳定币 / OKB 转入，到账后 Agent 会自动识别可用资金。</Text>
        <Pressable style={styles.receiveCopyButton} onPress={copyAddress}>
          <Ionicons name={copied ? "checkmark-circle-outline" : "copy-outline"} size={17} color={colors.ink} />
          <Text style={styles.receiveCopyText}>{copied ? "已复制" : "复制地址"}</Text>
        </Pressable>
      </View>

      {error ? (
        <View style={styles.hWalletNoticeCard}>
          <Ionicons name="alert-circle-outline" size={19} color="#8a5b00" />
          <Text style={styles.hWalletNoticeText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.hWalletStatusGrid}>
        <View style={styles.hWalletStatusCard}>
          <Text style={styles.hWalletStatusValue}>{wallet ? "已同步" : "待同步"}</Text>
          <Text style={styles.hWalletStatusLabel}>钱包状态</Text>
        </View>
        <View style={styles.hWalletStatusCard}>
          <Text style={styles.hWalletStatusValue}>X Layer</Text>
          <Text style={styles.hWalletStatusLabel}>默认网络</Text>
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
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          editable={!busy}
          onChangeText={setTxHash}
          placeholder="0x..."
          placeholderTextColor="#aaa39c"
          style={styles.walletTxInput}
          value={txHash}
        />
        <Pressable
          disabled={busy || !txHash.trim()}
          onPress={submitTxHash}
          style={[styles.walletTxButton, busy || !txHash.trim() ? styles.walletTxButtonDisabled : null]}
        >
          <Text style={[styles.walletTxButtonText, busy || !txHash.trim() ? styles.walletTxButtonTextDisabled : null]}>
            {busy ? "正在检查" : "检查到账"}
          </Text>
        </Pressable>
      </View>

      {isAgentReady ? (
        <View style={styles.agentReadyCard}>
          <View style={styles.agentReadyTop}>
            <View style={styles.agentReadyIcon}>
              <Ionicons name="sparkles-outline" size={21} color="#102015" />
            </View>
            <View style={styles.agentReadyTextBox}>
              <Text style={styles.agentReadyTitle}>Agent 可以开始看盘</Text>
              <Text style={styles.agentReadyText}>资金已识别，下一步让 Agent 看市场机会，先分析和模拟，不真实下单。</Text>
            </View>
          </View>
          <Pressable style={styles.agentReadyButton} onPress={onOpenPrediction}>
            <Text style={styles.agentReadyButtonText}>进入预测主页</Text>
            <Ionicons name="arrow-forward" size={17} color="#fff" />
          </Pressable>
        </View>
      ) : null}

      <View style={styles.hWalletSection}>
        <View style={styles.hWalletSectionHeader}>
          <Text style={styles.hWalletSectionTitle}>资产概览</Text>
          <Text style={styles.hWalletSectionMeta}>只读同步</Text>
        </View>
        <View style={styles.walletAssetList}>
          {assets.map((asset) => (
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
          {records.map((record) => (
            <View key={record.id} style={styles.walletRecordRow}>
              <View style={styles.walletRecordDot} />
              <View style={styles.walletRecordText}>
                <Text style={styles.walletRecordTitle}>{record.title}</Text>
                <Text style={styles.walletRecordNote}>{record.note}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

function AgentReceiveCard({ address }: { address: string }) {
  const { copied, flashCopied } = usePreviewCopyFeedback();

  async function copyAddress() {
    await Clipboard.setStringAsync(address);
    flashCopied();
  }

  return (
    <View style={styles.agentReceiveCard}>
      <View style={styles.receiveCardTop}>
        <View>
          <Text style={styles.receiveCardLabel}>充值地址</Text>
          <Text style={styles.receiveCardTitle}>HWallet</Text>
        </View>
        <View style={styles.receiveNetworkPill}>
          <Text style={styles.receiveNetworkText}>X Layer</Text>
        </View>
      </View>
      <Text style={styles.receiveCardHint}>支持稳定币 / OKB 转入，到账后 Agent 会自动识别可用资金。</Text>
      <Text style={styles.receiveAddressText}>{shortPreviewAddress(address)}</Text>
      <Pressable style={styles.receiveCopyButton} onPress={copyAddress}>
        <Ionicons name={copied ? "checkmark-circle-outline" : "copy-outline"} size={17} color={colors.ink} />
        <Text style={styles.receiveCopyText}>{copied ? "已复制" : "复制地址"}</Text>
      </Pressable>
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

function shortPreviewAddress(address: string): string {
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

function normalizePreviewOtpCode(value: string): string {
  return value.replace(/\D/g, "").slice(0, 6);
}

function readStoredPreviewEmail(): string {
  try {
    const storage = (globalThis as unknown as { localStorage?: { getItem: (key: string) => string | null } }).localStorage;
    return storage?.getItem(previewEmailStorageKey) || "";
  } catch {
    return "";
  }
}

function saveStoredPreviewEmail(email: string): void {
  try {
    const storage = (globalThis as unknown as { localStorage?: { setItem: (key: string, value: string) => void } }).localStorage;
    storage?.setItem(previewEmailStorageKey, email);
  } catch {
    // Web preview only; native Privy keeps the real session.
  }
}

function clearStoredPreviewEmail(): void {
  try {
    const storage = (globalThis as unknown as { localStorage?: { removeItem: (key: string) => void } }).localStorage;
    storage?.removeItem(previewEmailStorageKey);
  } catch {
    // Web preview only; native Privy keeps the real session.
  }
}

function previewUserIdFromEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  return normalized ? `preview:${normalized}` : "preview:guest";
}

function previewAddressForEmail(email: string): `0x${string}` {
  const normalized = email.trim().toLowerCase() || "guest";
  let state = 0x811c9dc5;

  for (let index = 0; index < normalized.length; index += 1) {
    state ^= normalized.charCodeAt(index);
    state = Math.imul(state, 0x01000193) >>> 0;
  }

  let hex = "";
  for (let index = 0; index < 10; index += 1) {
    state ^= index + normalized.length;
    state = Math.imul(state, 0x01000193) >>> 0;
    hex += state.toString(16).padStart(8, "0");
  }

  return `0x${hex.slice(0, 40)}`;
}

function ProfileAssetPage({ isWorldCupPage = false }: { isWorldCupPage?: boolean }) {
  return (
    <ScrollView
      contentContainerStyle={[styles.minePage, isWorldCupPage ? styles.worldCupProfilePage : null]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.assetHeader}>
        <Text style={styles.assetLabel}>资产</Text>
        <Text style={styles.assetValue}>
          64.22 <Text style={styles.assetUnit}>xp</Text>
        </Text>
        <Text style={styles.assetProfit}>+0 (0.00%) 今日收益</Text>
      </View>

      <View style={styles.assetSplit}>
        <View>
          <Text style={styles.assetSmallLabel}>持仓价值</Text>
          <Text style={styles.assetSmallValue}>54.22 xp</Text>
        </View>
        <View>
          <Text style={styles.assetSmallLabel}>可用资产</Text>
          <Text style={styles.assetSmallValue}>10 xp</Text>
        </View>
      </View>

      <Pressable style={styles.greenButton}>
        <Text style={styles.greenButtonText}>赚取积分</Text>
      </Pressable>

      <View style={styles.mineTabs}>
        <Text style={styles.mineTabActive}>持仓</Text>
        <Text style={styles.mineTabMuted}>未成交订单</Text>
        <Text style={styles.mineTabMuted}>历史记录</Text>
      </View>

      <View style={styles.positionToolbar}>
        <Text style={styles.positionChipActive}>当前仓位</Text>
        <Text style={styles.positionChip}>历史仓位</Text>
        <Text style={styles.positionSort}>持仓成本</Text>
        <Ionicons name="chevron-down" size={14} color={colors.ink} />
      </View>

      <View style={styles.positionList}>
        <PositionCard
          flag="🇲🇽"
          title="墨西哥会在 2026 年世界杯 A 组中排名第一吗？"
          value="20.57 xp"
          change="+0.57 (+2.86%)"
          changeTone="green"
          side="Yes 52.4¢"
          shares="38.1 份额"
        />
        <PositionCard
          flag="🇲🇽"
          title="墨西哥会在 2026 年世界杯 A 组中排名第一吗？"
          value="13.77 xp"
          change="-1.22 (-8.16%)"
          changeTone="red"
          side="No 49¢"
          shares="30.61 份额"
        />
        <PositionCard
          flag="🇰🇷"
          title="韩国会在 2026 年世界杯 A 组中排名第一吗？"
          value="9.99 xp"
          change="+0 (0.00%)"
          changeTone="green"
          side="No 78¢"
          shares="12.82 份额"
        />
        <PositionCard
          flag="🇪🇸"
          title="西班牙会赢得 2026 年世界杯冠军吗？"
          value="9.87 xp"
          change="-0.11 (-1.19%)"
          changeTone="red"
          side="Yes 61¢"
          shares="16.18 份额"
        />
      </View>
    </ScrollView>
  );
}

function WorldCupBottomMenu({
  active,
  onChange,
  onNewChat
}: {
  active: WorldCupView;
  onChange: (view: WorldCupView) => void;
  onNewChat: () => void;
}) {
  const items: Array<{ icon: keyof typeof Ionicons.glyphMap; label: string; value: WorldCupView }> = [
    { icon: "pulse-outline", label: "首页", value: "sentiment" },
    { icon: "sparkles-outline", label: "机会", value: "prediction" },
    { icon: "calendar-outline", label: "赛事", value: "explore" },
    { icon: "compass-outline", label: "发现", value: "profile" }
  ];

  return (
    <View style={styles.fixedActionRow}>
      <View style={styles.campaignNavPill}>
        {items.map((item) => (
          <Pressable
            key={item.value}
            style={[styles.campaignNavItem, active === item.value ? styles.campaignNavItemActive : null]}
            onPress={() => onChange(item.value)}
          >
            <Ionicons name={item.icon} size={19} color={colors.ink} />
            <Text style={styles.campaignNavText}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable style={styles.newChatButton} onPress={onNewChat}>
        <Text style={styles.xMarkText}>×</Text>
      </Pressable>
    </View>
  );
}

function WorldCupSentimentPage() {
  return (
    <ScrollView contentContainerStyle={styles.sentimentPage} showsVerticalScrollIndicator={false}>
      <ImageBackground
        source={worldCupPoster}
        resizeMode="cover"
        style={styles.sentimentPosterHero}
        imageStyle={styles.sentimentPosterImage}
      >
        <View style={styles.sentimentPosterText}>
          <Text style={styles.worldCupLabel}>世界杯狂欢季</Text>
          <Text style={styles.sentimentPosterTitle}>跟着 Agent 看世界杯，瓜分 USDT 奖池</Text>
          <Text style={styles.worldCupNote}>距离结束 42天 03时 46分 08秒</Text>
        </View>
      </ImageBackground>

      <View style={styles.sentimentHomeContent}>
        <View style={[styles.rewardCard, styles.homeRewardCard]}>
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
      </View>
    </ScrollView>
  );
}

function ExploreWorldCupPage({
  activeCategory,
  explore,
  exploreError,
  exploreLoading,
  onCategoryChange
}: {
  activeCategory: MarketCategory;
  explore?: V2WorldCupExploreView;
  exploreError?: string;
  exploreLoading?: boolean;
  onCategoryChange: (category: MarketCategory) => void;
}) {
  const activeExploreCategory = exploreCategoryByTab[activeCategory];
  const activeCards = explore?.cards[activeExploreCategory] || [];
  const hasDynamicCards = activeCards.length > 0;
  const hasExploreData = Boolean(explore);
  const sourceMessage = explore?.source?.warning || explore?.source?.message || "Agent 会先整理热度、价格和资金变化。";
  const updatedAt = formatExploreUpdatedAt(explore?.source?.updatedAt || explore?.updatedAt);

  return (
    <ScrollView contentContainerStyle={styles.explorePage} showsVerticalScrollIndicator={false}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.marketTabs}>
        {marketCategories.map((category) => (
          <Pressable
            key={category}
            style={[styles.marketTab, activeCategory === category ? styles.marketTabActive : null]}
            onPress={() => onCategoryChange(category)}
          >
            <Text style={[styles.marketTabText, activeCategory === category ? styles.marketTabTextActive : null]}>
              {formatMarketTabLabel(category, explore?.summary?.categoryCounts)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {exploreLoading ? <Text style={styles.exploreStatusText}>正在更新世界杯数据</Text> : null}

      {explore ? (
        <View style={styles.exploreSourceCard}>
          <Text style={styles.exploreSourceLabel}>{explore.source.label}</Text>
          <Text style={styles.exploreSourceText}>{exploreError ? "先展示赛事样例，数据稍后自动更新。" : sourceMessage}</Text>
          <Text style={styles.exploreSourceText}>已同步 {explore.summary.totalMarkets} 个市场</Text>
          {updatedAt ? <Text style={styles.exploreSourceTime}>更新于 {updatedAt}</Text> : null}
        </View>
      ) : null}

      {hasDynamicCards && activeCategory === "冠军" ? <DynamicChampionMarketGrid cards={activeCards} /> : null}
      {hasDynamicCards && activeCategory === "金靴奖得主" ? <DynamicGoldenBootMarketList cards={activeCards} /> : null}
      {hasDynamicCards && activeCategory === "小组赛" ? <DynamicGroupMarketList cards={activeCards} /> : null}
      {hasDynamicCards && activeCategory === "近期比赛" ? <DynamicMatchMarketList cards={activeCards} /> : null}

      {hasExploreData && !hasDynamicCards && !exploreLoading ? <ExploreEmptyState category={activeCategory} /> : null}
      {!hasExploreData && !hasDynamicCards && activeCategory === "冠军" ? <ChampionMarketGrid /> : null}
      {!hasExploreData && !hasDynamicCards && activeCategory === "金靴奖得主" ? <GoldenBootMarketList /> : null}
      {!hasExploreData && !hasDynamicCards && activeCategory === "小组赛" ? <GroupMarketList /> : null}
      {!hasExploreData && !hasDynamicCards && activeCategory === "近期比赛" ? <MatchMarketList /> : null}
    </ScrollView>
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

function DynamicChampionMarketGrid({ cards }: { cards: V2WorldCupExploreMarketCard[] }) {
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
          <Pressable key={card.id} style={styles.championItem}>
            <View style={[styles.championFlagCard, { backgroundColor: championCardColor(index) }]}>
              <Text style={styles.championFlag}>{flagForMarket(card.displayTitle || card.title)}</Text>
              <Text style={styles.championPercent}>{card.probabilityLabel || optionPriceLabel(card) || "观察"}</Text>
            </View>
            <Text style={styles.championName}>{card.displayName || shortMarketTitle(card.title)}</Text>
            <Text style={styles.championVolume}>{card.volumeLabel || card.subtitle || "实时市场"}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function DynamicGoldenBootMarketList({ cards }: { cards: V2WorldCupExploreMarketCard[] }) {
  return (
    <View style={styles.exploreCardList}>
      {cards.slice(0, 16).map((card) => (
        <View key={card.id} style={styles.playerMarketCard}>
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
          <Text style={styles.marketVolume}>{card.volumeLabel || card.subtitle || "世界杯数据展示"}</Text>
        </View>
      ))}
    </View>
  );
}

function DynamicGroupMarketList({ cards }: { cards: V2WorldCupExploreMarketCard[] }) {
  return (
    <View style={styles.exploreCardList}>
      {cards.slice(0, 16).map((card) => (
        <View key={card.id} style={styles.groupMarketCard}>
          <Text style={styles.groupTitle}>{groupTitleFromCard(card)}</Text>
          <View style={styles.groupTeamList}>
            <View style={styles.groupTeamRow}>
              <Text style={styles.groupFlag}>{flagForMarket(card.displayTitle || card.title)}</Text>
              <View style={styles.groupTeamStack}>
                <Text style={styles.groupTeamName}>{card.displayName || shortMarketTitle(card.title)}</Text>
                <Text style={styles.marketQuestion} numberOfLines={2}>{card.displayTitle || card.title}</Text>
              </View>
              <Text style={styles.groupPrice}>{optionPriceLabel(card) || card.probabilityLabel || "观察"}</Text>
            </View>
          </View>
          <Text style={styles.marketVolume}>{card.volumeLabel || card.subtitle || "世界杯数据展示"}</Text>
        </View>
      ))}
    </View>
  );
}

function DynamicMatchMarketList({ cards }: { cards: V2WorldCupExploreMarketCard[] }) {
  return (
    <View style={styles.exploreCardList}>
      {cards.slice(0, 16).map((card) => (
        <View key={card.id} style={styles.matchMarketCard}>
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
          </View>
          <Text style={styles.marketVolume}>{card.volumeLabel || "世界杯数据展示"}</Text>
        </View>
      ))}
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

function createPreviewInsightCopy(explore?: V2WorldCupExploreView): { title: string; text: string } {
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
      text: `${championName}当前热度靠前，市场给到 ${championPrice}。我会继续看价格、成交和资金变化。`
    };
  }

  return {
    title: `先看${championName}冠军盘。`,
    text: `${championName}当前热度靠前，市场给到 ${championPrice}。我会继续看价格、成交和资金变化。`
  };
}

function formatMarketTabLabel(
  category: MarketCategory,
  counts?: Record<V2WorldCupExploreCategory, number>
): string {
  if (!counts) return category;
  return `${category} ${counts[exploreCategoryByTab[category]] || 0}`;
}

function formatExploreUpdatedAt(value?: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

function championCardColor(index: number): string {
  const colors = ["#b70d25", "#d0a000", "#005514", "#b20b22", "#6397bd", "#d5bf00", "#0c6d43", "#1f4f9c"];
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
  if (/türkiye|turkey|土耳其/.test(text)) return "🇹🇷";
  if (/australia|澳大利亚/.test(text)) return "🇦🇺";
  if (/paraguay|巴拉圭/.test(text)) return "🇵🇾";
  return "⚽";
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
    .replace(/ win the 2026 World Cup\??/i, "")
    .replace(/ win the 2026 FIFA World Cup\??/i, "")
    .trim()
    .slice(0, 18) || "世界杯";
}

function groupTitleFromCard(card: V2WorldCupExploreMarketCard): string {
  const text = card.displayTitle || card.title;
  const group = text.match(/世界杯\s*([A-Z])\s*组/);
  if (group) return `2026 年世界杯 ${group[1]} 组第一`;
  return "2026 年世界杯小组赛";
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

function HistoryCard({
  icon,
  title,
  value,
  valueTone,
  subtitle,
  time
}: {
  icon: "gift" | "flag";
  title: string;
  value: string;
  valueTone: "green" | "red";
  subtitle: string;
  time: string;
}) {
  return (
    <View style={styles.historyCard}>
      <View style={styles.historyTop}>
        <View style={[styles.historyIcon, icon === "gift" ? styles.giftIcon : styles.flagIcon]}>
          <Ionicons name={icon === "gift" ? "gift-outline" : "flag-outline"} size={20} color={icon === "gift" ? colors.ink : "#c92450"} />
        </View>
        <Text style={styles.historyTitle}>{title}</Text>
        <Text style={[styles.historyValue, valueTone === "green" ? styles.valueGreen : styles.valueRed]}>{value}</Text>
      </View>
      <View style={styles.historyBottom}>
        <Text style={styles.historySubtitle}>{subtitle}</Text>
        <Text style={styles.historyTime}>{time}</Text>
      </View>
    </View>
  );
}

function PositionCard({
  flag,
  title,
  value,
  change,
  changeTone,
  side,
  shares
}: {
  flag: string;
  title: string;
  value: string;
  change: string;
  changeTone: "green" | "red";
  side: string;
  shares: string;
}) {
  return (
    <View style={styles.positionCard}>
      <View style={styles.positionTop}>
        <Text style={styles.positionFlag}>{flag}</Text>
        <Text style={styles.positionTitle}>{title}</Text>
        <View style={styles.positionValueBlock}>
          <Text style={styles.positionValue}>{value}</Text>
          <Text style={[styles.positionChange, changeTone === "green" ? styles.valueGreen : styles.valueRed]}>{change}</Text>
        </View>
      </View>
      <View style={styles.positionBottom}>
        <View style={styles.positionMeta}>
          <Text style={styles.sidePill}>{side}</Text>
          <Text style={styles.positionShares}>{shares}</Text>
        </View>
        <View style={styles.positionActions}>
          <Pressable style={styles.positionIconButton}>
            <Ionicons name="share-outline" size={15} color={colors.ink} />
          </Pressable>
          <Pressable style={styles.sellButton}>
            <Text style={styles.sellButtonText}>卖出</Text>
          </Pressable>
        </View>
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
      <Ionicons name={icon} size={21} color={active ? colors.ink : "#77716a"} />
      <Text style={[styles.tabText, active ? styles.tabTextActive : null]}>{label}</Text>
    </Pressable>
  );
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
  keyboardAvoid: {
    flex: 1
  },
  shell: {
    flex: 1,
    backgroundColor: colors.shell
  },
  previewLogin: {
    flexGrow: 1,
    justifyContent: "flex-start",
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 28,
    gap: 18,
    backgroundColor: "#ffffff"
  },
  previewLoginCode: {
    paddingTop: 32,
    paddingBottom: 96
  },
  previewLoginTop: {
    position: "relative",
    minHeight: 316,
    borderRadius: 38,
    overflow: "hidden",
    justifyContent: "flex-end",
    padding: 26,
    gap: 8,
    backgroundColor: "#071812",
    shadowColor: "#0b160f",
    shadowOpacity: 0.34,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 18 },
    elevation: 7
  },
  previewLoginDoorLeft: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: "50%",
    backgroundColor: "rgba(255, 255, 255, 0.035)"
  },
  previewLoginDoorRight: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: 0,
    width: "50%",
    backgroundColor: "rgba(0, 0, 0, 0.16)"
  },
  previewLoginDoorSeam: {
    position: "absolute",
    top: 26,
    bottom: 26,
    left: "50%",
    width: 1,
    backgroundColor: "rgba(201, 255, 63, 0.38)"
  },
  previewLoginHeroGlow: {
    position: "absolute",
    top: 30,
    right: 24,
    width: 148,
    height: 5,
    backgroundColor: "#c9ff3f"
  },
  previewLoginLogoShell: {
    width: 112,
    height: 112,
    borderRadius: 30,
    overflow: "hidden",
    backgroundColor: "#ffffff",
    marginBottom: 16,
    shadowColor: "#000000",
    shadowOpacity: 0.34,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6
  },
  previewLoginLogo: {
    width: "100%",
    height: "100%"
  },
  previewLoginBrand: {
    alignSelf: "flex-start",
    color: "#c9ff3f",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0
  },
  previewLoginTitle: {
    color: "#ffffff",
    fontSize: 42,
    lineHeight: 49,
    fontWeight: "900",
    letterSpacing: 0,
    marginTop: 4
  },
  previewLoginSubtitle: {
    maxWidth: 300,
    color: "#d8d2ca",
    fontSize: 16,
    lineHeight: 23,
    fontWeight: "700"
  },
  previewLoginCard: {
    borderRadius: 32,
    backgroundColor: "#ffffff",
    padding: 16,
    gap: 12,
    shadowColor: "#d9d1c8",
    shadowOpacity: 0.34,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 16 },
    elevation: 5
  },
  previewLoginCardTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 2
  },
  previewLoginFieldGroup: {
    gap: 7
  },
  previewLoginLabel: {
    color: "#6f675f",
    fontSize: 13,
    fontWeight: "900"
  },
  previewLoginInput: {
    minHeight: 54,
    borderRadius: 20,
    paddingHorizontal: 18,
    backgroundColor: "#f6f3ef",
    color: colors.ink,
    fontSize: 16,
    fontWeight: "700"
  },
  previewLoginCodeDots: {
    height: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9
  },
  previewLoginCodeDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#e2ddd6"
  },
  previewLoginCodeDotFilled: {
    backgroundColor: "#c9ff3f"
  },
  previewLoginKeypad: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  previewLoginKey: {
    width: "30.6%",
    minHeight: 56,
    borderRadius: 22,
    backgroundColor: "#f6f3ef",
    alignItems: "center",
    justifyContent: "center"
  },
  previewLoginKeyConfirm: {
    backgroundColor: colors.ink
  },
  previewLoginKeyText: {
    color: colors.ink,
    fontSize: 21,
    fontWeight: "900"
  },
  previewLoginButton: {
    minHeight: 54,
    borderRadius: 20,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center"
  },
  previewLoginButtonDisabled: {
    opacity: 0.38
  },
  previewLoginSecondaryButton: {
    minHeight: 52,
    borderRadius: 20,
    backgroundColor: "#f6f3ef",
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  previewLoginSecondaryButtonText: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900"
  },
  previewLoginButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900"
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
  topbarCenterSpacer: {
    width: 76,
    height: 50
  },
  agentScreen: {
    flex: 1
  },
  agentScroll: {
    flex: 1
  },
  agentContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 28,
    gap: 18
  },
  heroTitle: {
    fontSize: 25,
    lineHeight: 32,
    fontWeight: "700",
    color: colors.ink,
    textAlign: "center"
  },
  previewMessage: {
    maxWidth: "86%",
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  previewUserMessage: {
    alignSelf: "flex-end",
    backgroundColor: colors.ink
  },
  previewAgentMessage: {
    alignSelf: "flex-start",
    backgroundColor: "#f4f1ed"
  },
  previewMessageText: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "700"
  },
  previewUserMessageText: {
    color: "#fff"
  },
  agentReceiveCard: {
    width: "100%",
    borderRadius: 24,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#f0ece8",
    padding: 18,
    gap: 14,
    shadowColor: "#d9d3cc",
    shadowOpacity: 0.5,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4
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
    fontWeight: "700"
  },
  receiveCardTitle: {
    marginTop: 4,
    color: colors.ink,
    fontSize: 24,
    fontWeight: "900"
  },
  receiveNetworkPill: {
    borderRadius: 999,
    backgroundColor: "#f1ebe5",
    paddingHorizontal: 11,
    paddingVertical: 7
  },
  receiveNetworkText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "800"
  },
  receiveCardHint: {
    color: "#68625c",
    fontSize: 14,
    lineHeight: 20
  },
  receiveAddressText: {
    color: colors.ink,
    fontSize: 21,
    fontWeight: "900"
  },
  receiveCopyButton: {
    minHeight: 46,
    borderRadius: 23,
    backgroundColor: "#f3f0ec",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  receiveCopyText: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900"
  },
  composerWrap: {
    paddingHorizontal: 17,
    paddingTop: 8,
    paddingBottom: 94
  },
  composerWrapKeyboard: {
    paddingBottom: 12
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
    paddingTop: 16,
    paddingBottom: 128,
    gap: 20
  },
  sentimentPage: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 128,
    gap: 18
  },
  sentimentPosterHero: {
    width: "100%",
    minHeight: 470,
    overflow: "hidden",
    backgroundColor: "#e9e8e4",
    justifyContent: "flex-end",
    paddingTop: 12,
    paddingHorizontal: 22,
    paddingBottom: 78
  },
  sentimentPosterImage: {
    width: "100%",
    height: "100%",
    transform: [{ translateY: 24 }]
  },
  sentimentPosterText: {
    gap: 8
  },
  sentimentPosterTitle: {
    color: "#050505",
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "900"
  },
  sentimentHomeContent: {
    paddingHorizontal: 22,
    marginTop: 0,
    gap: 20
  },
  sentimentHeader: {
    gap: 6
  },
  sentimentTitle: {
    color: "#050505",
    fontSize: 31,
    lineHeight: 38,
    fontWeight: "900"
  },
  sentimentSub: {
    color: "#625d57",
    fontSize: 14,
    lineHeight: 21
  },
  sentimentHeroCard: {
    borderRadius: 24,
    backgroundColor: "#102115",
    padding: 18,
    gap: 12
  },
  sentimentHeroTitle: {
    color: "#fff",
    fontSize: 20,
    lineHeight: 27,
    fontWeight: "900"
  },
  sentimentHeroText: {
    color: "#efe8df",
    fontSize: 13,
    lineHeight: 20
  },
  sentimentMetricRow: {
    flexDirection: "row",
    gap: 10
  },
  sentimentMetricCard: {
    flex: 1,
    minHeight: 82,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.78)",
    alignItems: "center",
    justifyContent: "center"
  },
  todayWatchSection: {
    gap: 12
  },
  todayWatchItem: {
    minHeight: 72,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.78)",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  todayFlag: {
    fontSize: 24
  },
  todayTextStack: {
    flex: 1,
    gap: 3
  },
  todayTitle: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "900"
  },
  todayMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700"
  },
  todayOdds: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900"
  },
  minePage: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 140,
    gap: 18
  },
  worldCupProfilePage: {
    paddingTop: 26
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
  hWalletAccountRow: {
    marginTop: 6,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  hWalletAccountTextBox: {
    flex: 1,
    minWidth: 0,
    gap: 3
  },
  hWalletAccountLabel: {
    color: "rgba(255, 255, 255, 0.58)",
    fontSize: 12,
    fontWeight: "800"
  },
  hWalletAccountEmail: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900"
  },
  hWalletSwitchButton: {
    minWidth: 58,
    minHeight: 36,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center"
  },
  hWalletSwitchText: {
    color: colors.ink,
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
  agentFundsLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800"
  },
  walletTxCheckTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900",
    marginTop: 4
  },
  walletTxInput: {
    minHeight: 46,
    borderRadius: 23,
    backgroundColor: "#f7f4f0",
    paddingHorizontal: 15,
    color: colors.ink,
    fontSize: 14,
    fontWeight: "800"
  },
  walletTxButton: {
    minHeight: 44,
    borderRadius: 22,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center"
  },
  walletTxButtonDisabled: {
    backgroundColor: "#f1ebe5"
  },
  walletTxButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "900"
  },
  walletTxButtonTextDisabled: {
    color: "#9f9992"
  },
  agentReadyCard: {
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
  agentReadyTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  agentReadyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#aaff35",
    alignItems: "center",
    justifyContent: "center"
  },
  agentReadyTextBox: {
    flex: 1,
    gap: 4
  },
  agentReadyTitle: {
    color: colors.ink,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "900"
  },
  agentReadyText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700"
  },
  agentReadyButton: {
    minHeight: 44,
    borderRadius: 22,
    backgroundColor: "#287f1c",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8
  },
  agentReadyButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "900"
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
    gap: 10
  },
  walletRecordDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#287f1c",
    marginTop: 6
  },
  walletRecordText: {
    flex: 1,
    gap: 3
  },
  walletRecordTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900"
  },
  walletRecordNote: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700"
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
  positionToolbar: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: -4
  },
  positionChipActive: {
    overflow: "hidden",
    borderRadius: 19,
    backgroundColor: "#050505",
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
    paddingHorizontal: 13,
    paddingVertical: 8
  },
  positionChip: {
    overflow: "hidden",
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    color: colors.ink,
    fontSize: 13,
    fontWeight: "700",
    paddingHorizontal: 13,
    paddingVertical: 8
  },
  positionSort: {
    marginLeft: "auto",
    color: colors.ink,
    fontSize: 13,
    fontWeight: "800"
  },
  positionList: {
    gap: 14
  },
  positionCard: {
    borderRadius: 22,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#f0ece8",
    padding: 14,
    gap: 13,
    shadowColor: "#d9d3cc",
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3
  },
  positionTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10
  },
  positionFlag: {
    width: 34,
    fontSize: 26,
    lineHeight: 30
  },
  positionTitle: {
    flex: 1,
    color: colors.ink,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "800"
  },
  positionValueBlock: {
    minWidth: 76,
    alignItems: "flex-end",
    gap: 3
  },
  positionValue: {
    color: "#050505",
    fontSize: 15,
    fontWeight: "900"
  },
  positionChange: {
    fontSize: 12,
    fontWeight: "700"
  },
  positionBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  positionMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  sidePill: {
    overflow: "hidden",
    borderRadius: 7,
    backgroundColor: "rgba(241, 235, 229, 0.78)",
    color: colors.ink,
    fontSize: 12,
    fontWeight: "700",
    paddingHorizontal: 6,
    paddingVertical: 4
  },
  positionShares: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600"
  },
  positionActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  positionIconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(241, 235, 229, 0.76)",
    alignItems: "center",
    justifyContent: "center"
  },
  sellButton: {
    minWidth: 60,
    minHeight: 32,
    borderRadius: 16,
    backgroundColor: "rgba(241, 235, 229, 0.86)",
    alignItems: "center",
    justifyContent: "center"
  },
  sellButtonText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "800"
  },
  historyCard: {
    borderRadius: 18,
    backgroundColor: "rgba(255, 253, 250, 0.92)",
    padding: 16,
    gap: 16
  },
  historyTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  historyIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center"
  },
  giftIcon: {
    backgroundColor: "#b5ff2a"
  },
  flagIcon: {
    backgroundColor: "#fff1f3"
  },
  historyTitle: {
    flex: 1,
    color: colors.ink,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "800"
  },
  historyValue: {
    fontSize: 15,
    fontWeight: "800"
  },
  valueGreen: {
    color: "#19a76a"
  },
  valueRed: {
    color: "#d43f67"
  },
  historyBottom: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 12,
    flexDirection: "row",
    justifyContent: "space-between"
  },
  historySubtitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "800"
  },
  historyTime: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "600"
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
  homeRewardCard: {
    marginTop: 0
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
    gap: 8,
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
  explorePage: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 124,
    backgroundColor: "#fff",
    gap: 18
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
  exploreStatusText: {
    color: "#625d57",
    fontSize: 13,
    fontWeight: "700"
  },
  exploreSourceCard: {
    borderRadius: 18,
    backgroundColor: "#f2f2f1",
    padding: 14,
    gap: 6
  },
  exploreSourceLabel: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900"
  },
  exploreSourceText: {
    color: "#625d57",
    fontSize: 12,
    lineHeight: 17
  },
  exploreSourceTime: {
    color: "#8b8782",
    fontSize: 11,
    fontWeight: "700"
  },
  exploreEmptyCard: {
    borderRadius: 22,
    backgroundColor: "#f3f3f2",
    padding: 18,
    gap: 8
  },
  exploreEmptyTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900"
  },
  exploreEmptyText: {
    color: "#625d57",
    fontSize: 13,
    lineHeight: 19
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
  playerName: {
    flex: 1,
    color: "#050505",
    fontSize: 18,
    fontWeight: "900"
  },
  playerTextStack: {
    flex: 1,
    gap: 4
  },
  playerPercent: {
    color: "#050505",
    fontSize: 18,
    fontWeight: "900"
  },
  marketQuestion: {
    color: "#8b8782",
    fontSize: 12,
    lineHeight: 16
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
  eyebrow: {
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
  card: {
    borderRadius: 22,
    padding: 16,
    backgroundColor: "rgba(255, 253, 250, 0.96)",
    gap: 8
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.ink
  },
  cardBody: {
    color: "#413c36",
    lineHeight: 21,
    fontSize: 14
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
  stat: {
    flex: 1,
    minHeight: 78,
    borderRadius: 22,
    backgroundColor: "rgba(255, 253, 250, 0.88)",
    alignItems: "center",
    justifyContent: "center"
  },
  statValue: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: "800"
  },
  statLabel: {
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
    backgroundColor: "rgba(255, 255, 255, 0.86)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.86)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#cfc5bc",
    shadowOpacity: 0.55,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 16 },
    elevation: 5
  },
  newChatButtonActive: {
    backgroundColor: "#efeae4",
    borderColor: "rgba(23, 21, 18, 0.08)"
  },
  hMarkText: {
    color: colors.ink,
    fontSize: 22,
    lineHeight: 25,
    fontWeight: "900",
    letterSpacing: 0
  },
  xMarkText: {
    color: colors.ink,
    fontSize: 29,
    lineHeight: 31,
    fontWeight: "300",
    marginTop: -2
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
