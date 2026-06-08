import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useEmbeddedEthereumWallet, useLoginWithEmail, usePrivy } from "@privy-io/expo";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useV2AgentWallet } from "./use-v2-agent-wallet";
import type { V2ConversationCard, V2MobileChatMessage } from "./types";

export function V2AgentWalletScreen({ apiBaseUrl }: { apiBaseUrl: string }) {
  const { getAccessToken, isReady, logout, user } = usePrivy();
  const { sendCode, loginWithCode, state } = useLoginWithEmail();
  const { wallets } = useEmbeddedEthereumWallet();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [input, setInput] = useState("");
  const [showConsole, setShowConsole] = useState(false);
  const [showWorldCup, setShowWorldCup] = useState(false);
  const walletAddress = wallets[0]?.address as `0x${string}` | undefined;
  const agent = useV2AgentWallet({
    apiBaseUrl,
    getAccessToken,
    isReady,
    userId: user?.id,
    walletAddress
  });

  async function run(action: () => Promise<unknown>) {
    try {
      await action();
    } catch (error) {
      Alert.alert("Agent Wallet", error instanceof Error ? error.message : "请求失败");
    }
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
          <Text style={styles.brand}>海豚社区</Text>
          <Text style={styles.title}>Agent Wallet</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            inputMode="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            placeholder="邮箱"
            style={styles.input}
          />
          <Pressable style={styles.button} onPress={() => run(() => sendCode({ email }))}>
            <Text style={styles.buttonText}>发送验证码</Text>
          </Pressable>
          <TextInput
            inputMode="numeric"
            keyboardType="number-pad"
            value={code}
            onChangeText={setCode}
            placeholder="验证码"
            style={styles.input}
          />
          <Pressable
            style={styles.button}
            onPress={() =>
              run(async () => {
                await loginWithCode({ email, code });
                setCode("");
              })
            }
          >
            <Text style={styles.buttonText}>进入</Text>
          </Pressable>
          <Text style={styles.muted}>{state.status}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topbar}>
        <Pressable style={styles.iconButton} onPress={() => setShowWorldCup((value) => !value)}>
          <Text style={styles.iconButtonText}>{agent.session.home?.panels.topLeft.title || "世界杯"}</Text>
        </Pressable>
        <Pressable style={styles.iconButton} onPress={() => setShowConsole((value) => !value)}>
          <Text style={styles.iconButtonText}>{agent.session.home?.panels.topRight.title || "我的"}</Text>
        </Pressable>
      </View>

      {showWorldCup ? (
        <View style={styles.console}>
          <View style={styles.consoleHeader}>
            <Text style={styles.consoleTitle}>{agent.session.home?.panels.topLeft.title || "世界杯"}</Text>
            <Pressable onPress={() => setShowWorldCup(false)}>
              <Ionicons name="close" size={18} color="#111" />
            </Pressable>
          </View>
          <Text style={styles.consoleValue}>
            {agent.session.home?.panels.topLeft.summary || "正在整理可关注方向。"}
          </Text>
          {(agent.session.home?.panels.topLeft.items || []).slice(0, 3).map((item) => (
            <Pressable
              key={item.id}
              style={styles.marketPanelItem}
              onPress={() =>
                run(async () => {
                  setShowWorldCup(false);
                  await agent.sendText(item.title);
                })
              }
            >
              <Text style={styles.marketPanelTitle}>{item.title}</Text>
              <Text style={styles.consoleLabel}>
                {item.subtitle}
                {item.value ? ` · ${item.value}` : ""}
              </Text>
            </Pressable>
          ))}
          <Pressable
            style={styles.secondaryButton}
            onPress={() =>
              run(async () => {
                setShowWorldCup(false);
                await agent.sendText("帮我看看世界杯有没有机会");
              })
            }
          >
            <Text style={styles.secondaryButtonText}>让 Agent 看机会</Text>
          </Pressable>
        </View>
      ) : null}

      {showConsole ? (
        <View style={styles.console}>
          <View style={styles.consoleHeader}>
            <Text style={styles.consoleTitle}>我的</Text>
            <Pressable onPress={() => setShowConsole(false)}>
              <Ionicons name="close" size={18} color="#111" />
            </Pressable>
          </View>
          <Text style={styles.consoleLabel}>钱包</Text>
          <Text style={styles.consoleValue}>{shortAddress(walletAddress) || "等待钱包生成"}</Text>
          <View style={styles.consoleStats}>
            <ConsoleStat label="跟踪" value={agent.session.home?.state.trackingCount || 0} />
            <ConsoleStat label="策略" value={agent.session.home?.state.strategyCount || 0} />
            <ConsoleStat label="记录" value={agent.session.home?.state.recordCount || 0} />
          </View>
          <View style={styles.actionRow}>
            <Pressable style={styles.secondaryButton} onPress={() => agent.refreshHome()}>
              <Text style={styles.secondaryButtonText}>刷新</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => run(logout)}>
              <Text style={styles.secondaryButtonText}>退出</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.messages}>
        {agent.session.messages.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>一句话即可构建交易策略</Text>
            <Text style={styles.emptyText}>{agent.session.home?.panels.topLeft.summary || "你可以直接开始问我。"}</Text>
            <View style={styles.promptRow}>
              {(agent.session.home?.quickPrompts || []).slice(0, 2).map((prompt) => (
                <Pressable key={prompt.id} style={styles.prompt} onPress={() => agent.sendText(prompt.text)}>
                  <Text style={styles.promptText}>{prompt.text}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {agent.session.messages.map((message) => (
          <MessageBubble key={message.id} message={message} onAction={(action, card) => agent.runCardAction({ action, card })} />
        ))}
      </ScrollView>

      {agent.session.error ? <Text style={styles.error}>{agent.session.error}</Text> : null}

      <View style={styles.composer}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="跟 Agent 说一句话"
          style={styles.composerInput}
        />
        <Pressable
          style={styles.sendButton}
          disabled={agent.session.busy || !input.trim()}
          onPress={() =>
            run(async () => {
              const text = input;
              setInput("");
              await agent.sendText(text);
            })
          }
        >
          {agent.session.busy ? <ActivityIndicator color="#fff" /> : <Ionicons name="arrow-up" size={20} color="#fff" />}
        </Pressable>
      </View>
    </SafeAreaView>
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

  return (
    <View style={[styles.bubble, message.role === "user" ? styles.userBubble : styles.agentBubble]}>
      <Text style={styles.bubbleText}>{message.text}</Text>
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
        <Pressable style={styles.secondaryButton} onPress={() => copyAddress()}>
          <Text style={styles.secondaryButtonText}>复制地址</Text>
        </Pressable>
      </View>
    );
  }

  if (card.type === "prediction_card") {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{card.title}</Text>
        <Text style={styles.cardBody}>{card.agentNote}</Text>
        <View style={styles.metricRow}>
          {card.metrics.probabilityLabel ? <Text style={styles.metric}>{card.metrics.probabilityLabel}</Text> : null}
          {card.metrics.priceLabel ? <Text style={styles.metric}>{card.metrics.priceLabel}</Text> : null}
        </View>
        <View style={styles.actionRow}>
          <Pressable style={styles.secondaryButton} onPress={() => onAction("simulate", card)}>
            <Text style={styles.secondaryButtonText}>先模拟</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => onAction("track", card)}>
            <Text style={styles.secondaryButtonText}>跟踪</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => onAction("build_strategy", card)}>
            <Text style={styles.secondaryButtonText}>策略</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{card.title}</Text>
      <Text style={styles.cardBody}>{card.agentNote}</Text>
    </View>
  );
}

function shortAddress(address?: string): string | undefined {
  if (!address) return undefined;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#f7f7f4"
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  login: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    gap: 12
  },
  brand: {
    fontSize: 15,
    color: "#5a665f"
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111"
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#d8ddd8",
    borderRadius: 8,
    paddingHorizontal: 14,
    backgroundColor: "#fff"
  },
  button: {
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: "#101512",
    alignItems: "center",
    justifyContent: "center"
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700"
  },
  muted: {
    color: "#7a837d",
    fontSize: 12
  },
  topbar: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  iconButton: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center"
  },
  iconButtonText: {
    color: "#111",
    fontWeight: "700"
  },
  console: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 14,
    borderRadius: 8,
    backgroundColor: "#fff",
    gap: 10
  },
  consoleHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  consoleTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111"
  },
  consoleLabel: {
    color: "#7a837d",
    fontSize: 12
  },
  consoleValue: {
    color: "#111",
    fontSize: 14
  },
  consoleStats: {
    flexDirection: "row",
    gap: 8
  },
  consoleStat: {
    flex: 1,
    minHeight: 58,
    borderRadius: 8,
    backgroundColor: "#f3f5f2",
    alignItems: "center",
    justifyContent: "center"
  },
  consoleStatValue: {
    color: "#111",
    fontSize: 18,
    fontWeight: "700"
  },
  marketPanelItem: {
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#eef2ee",
    gap: 4
  },
  marketPanelTitle: {
    color: "#111",
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 19
  },
  messages: {
    padding: 16,
    gap: 10
  },
  empty: {
    minHeight: 260,
    alignItems: "center",
    justifyContent: "center",
    gap: 12
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111",
    textAlign: "center"
  },
  emptyText: {
    color: "#68736c",
    textAlign: "center"
  },
  promptRow: {
    gap: 8
  },
  prompt: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: "#fff",
    justifyContent: "center"
  },
  promptText: {
    color: "#111"
  },
  bubble: {
    maxWidth: "86%",
    padding: 12,
    borderRadius: 8
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: "#101512"
  },
  agentBubble: {
    alignSelf: "flex-start",
    backgroundColor: "#fff"
  },
  bubbleText: {
    color: "#111"
  },
  card: {
    borderRadius: 8,
    padding: 14,
    backgroundColor: "#fff",
    gap: 8
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111"
  },
  cardBody: {
    color: "#303632",
    lineHeight: 20
  },
  address: {
    color: "#111",
    fontSize: 13
  },
  metricRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  metric: {
    color: "#526057",
    fontSize: 12
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  secondaryButton: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#eef2ee",
    alignItems: "center",
    justifyContent: "center"
  },
  secondaryButtonText: {
    color: "#111",
    fontWeight: "700"
  },
  error: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    color: "#b3261e"
  },
  composer: {
    flexDirection: "row",
    gap: 10,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#e3e6e2",
    backgroundColor: "#f7f7f4"
  },
  composerInput: {
    flex: 1,
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: "#fff",
    paddingHorizontal: 14
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: "#101512",
    alignItems: "center",
    justifyContent: "center"
  }
});
