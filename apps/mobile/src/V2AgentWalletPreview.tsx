import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { ImageBackground, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

const worldCupPoster = require("../assets/world-cup-poster.png");

type Tab = "agent" | "worldcup" | "mine";
type WorldCupView = "home" | "explore";
type MarketCategory = "冠军" | "金靴奖得主" | "小组赛" | "近期比赛";

const marketCategories: MarketCategory[] = ["冠军", "金靴奖得主", "小组赛", "近期比赛"];

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
  const [tab, setTab] = useState<Tab>("agent");
  const [input, setInput] = useState("");
  const [worldCupView, setWorldCupView] = useState<WorldCupView>("home");
  const [marketCategory, setMarketCategory] = useState<MarketCategory>("冠军");
  const showBottomDock = tab !== "worldcup";

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.shell}>
        <View style={styles.topbar}>
          <Pressable style={styles.roundButton} onPress={() => setTab("worldcup")}>
            <Ionicons name="menu" size={24} color={colors.ink} />
          </Pressable>
          <Pressable style={styles.roundButton} onPress={() => setTab("mine")}>
            <Ionicons name="person-outline" size={21} color={colors.ink} />
          </Pressable>
        </View>

        {tab === "agent" ? (
          <View style={styles.agentScreen}>
            <ScrollView contentContainerStyle={styles.agentContent} showsVerticalScrollIndicator={false}>
              <Text style={styles.heroTitle}>海豚，一切可好？</Text>
            </ScrollView>
            <View style={styles.composerWrap}>
              <View style={styles.composer}>
                <Pressable style={styles.plusButton}>
                  <Ionicons name="add" size={24} color={colors.ink} />
                </Pressable>
                <TextInput
                  value={input}
                  onChangeText={setInput}
                  placeholder="向 Agent 发送消息"
                  placeholderTextColor="#817a72"
                  style={styles.composerInput}
                />
                <Pressable style={styles.voiceButton}>
                  <Ionicons name={input.trim() ? "arrow-up" : "options-outline"} size={21} color={colors.ink} />
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}

        {tab === "worldcup" ? (
          <View style={styles.worldCupShell}>
            {worldCupView === "explore" ? (
              <ExploreWorldCupPage
                activeCategory={marketCategory}
                onBack={() => setWorldCupView("home")}
                onCategoryChange={setMarketCategory}
              />
            ) : (
              <>
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

              <Pressable style={styles.agentInsightCard} onPress={() => setTab("agent")}>
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
            </ScrollView>
            <View style={styles.fixedActionRow}>
              <Pressable style={styles.campaignNavItem} onPress={() => setTab("agent")}>
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
              <Pressable style={styles.campaignNavItem} onPress={() => setTab("agent")}>
                <Ionicons name="chatbubble-ellipses-outline" size={19} color={colors.ink} />
                <Text style={styles.campaignNavText}>新对话</Text>
              </Pressable>
            </View>
              </>
            )}
          </View>
        ) : null}

        {tab === "mine" ? (
          <ScrollView contentContainerStyle={styles.minePage} showsVerticalScrollIndicator={false}>
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
          </ScrollView>
        ) : null}

        {showBottomDock ? (
          <View style={styles.bottomDockWrap}>
            <View style={styles.bottomScrim} />
            <View style={styles.bottomDock}>
              <View style={styles.tabPill}>
                <TabButton active={tab === "agent"} icon="chatbubble-ellipses" label="Agent" onPress={() => setTab("agent")} />
                <TabButton active={false} icon="football-outline" label="世界杯" onPress={() => setTab("worldcup")} />
                <TabButton active={tab === "mine"} icon="person-outline" label="我的" onPress={() => setTab("mine")} />
              </View>
              <Pressable
                style={styles.newChatButton}
                onPress={() => {
                  setInput("");
                  setTab("agent");
                }}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={24} color={colors.ink} />
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function ExploreWorldCupPage({
  activeCategory,
  onBack,
  onCategoryChange
}: {
  activeCategory: MarketCategory;
  onBack: () => void;
  onCategoryChange: (category: MarketCategory) => void;
}) {
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

      {activeCategory === "冠军" ? <ChampionMarketGrid /> : null}
      {activeCategory === "金靴奖得主" ? <GoldenBootMarketList /> : null}
      {activeCategory === "小组赛" ? <GroupMarketList /> : null}
      {activeCategory === "近期比赛" ? <MatchMarketList /> : null}
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
  agentScreen: {
    flex: 1
  },
  agentContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 192
  },
  heroTitle: {
    fontSize: 25,
    lineHeight: 32,
    fontWeight: "700",
    color: colors.ink,
    textAlign: "center"
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
  positionCard: {
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.72)",
    padding: 12,
    gap: 12
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
