import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createApi } from "./api";
import {
  getLatestV2Card,
  initialV2AgentWalletSession,
  loadV2AgentWalletHome,
  runV2AgentWalletCardAction,
  sendV2AgentWalletText,
  type V2AgentWalletSession
} from "./v2-session";
import type { V2ConversationCard, V2MarketSnapshot } from "./types";

type GetAccessToken = () => Promise<string | null | undefined>;

export function useV2AgentWallet(input: {
  apiBaseUrl: string;
  getAccessToken?: GetAccessToken;
  isReady: boolean;
  userId?: string;
  walletAddress?: `0x${string}`;
}) {
  const [session, setSession] = useState<V2AgentWalletSession>(initialV2AgentWalletSession);
  const sessionRef = useRef(session);
  const api = useMemo(() => createApi(input.apiBaseUrl, input.getAccessToken), [input.apiBaseUrl, input.getAccessToken]);

  const updateSession = useCallback((next: V2AgentWalletSession) => {
    sessionRef.current = next;
    setSession(next);
  }, []);

  const patchSession = useCallback((patch: Partial<V2AgentWalletSession>) => {
    const next = {
      ...sessionRef.current,
      ...patch
    };
    updateSession(next);
  }, [updateSession]);

  const refreshHome = useCallback(async () => {
    if (!input.isReady) return;
    patchSession({
      busy: true,
      error: undefined
    });
    const next = await loadV2AgentWalletHome(api, sessionRef.current, input.userId, input.walletAddress);
    updateSession({
      ...next,
      busy: false
    });
  }, [api, input.isReady, input.userId, input.walletAddress, patchSession, updateSession]);

  const sendText = useCallback(async (text: string) => {
    patchSession({
      busy: true,
      error: undefined
    });
    const next = await sendV2AgentWalletText(api, sessionRef.current, text, input.userId, input.walletAddress);
    updateSession(next);
  }, [api, input.userId, input.walletAddress, patchSession, updateSession]);

  const analyzeMarket = useCallback(async (text: string, market: V2MarketSnapshot) => {
    patchSession({
      busy: true,
      error: undefined
    });
    const next = await sendV2AgentWalletText(api, sessionRef.current, text, input.userId, input.walletAddress, market);
    updateSession(next);
  }, [api, input.userId, input.walletAddress, patchSession, updateSession]);

  const runCardAction = useCallback(async (params: {
    action: "simulate" | "track" | "build_strategy";
    card?: V2ConversationCard;
    amountUsd?: number;
    idempotencyKey?: string;
  }) => {
    const card = params.card || getLatestV2Card(sessionRef.current);
    if (!card) {
      patchSession({
        error: "还没有可以操作的卡片。"
      });
      return;
    }

    patchSession({
      busy: true,
      error: undefined
    });

    const next = await runV2AgentWalletCardAction(api, sessionRef.current, {
      action: params.action,
      card,
      amountUsd: params.amountUsd,
      idempotencyKey: params.idempotencyKey,
      userId: input.userId
    });
    updateSession(next);
  }, [api, input.userId, patchSession, updateSession]);

  useEffect(() => {
    if (!input.isReady) return;
    let cancelled = false;
    updateSession(initialV2AgentWalletSession);
    loadV2AgentWalletHome(api, initialV2AgentWalletSession, input.userId, input.walletAddress).then((next) => {
      if (!cancelled) updateSession(next);
    });
    return () => {
      cancelled = true;
    };
  }, [api, input.isReady, input.userId, input.walletAddress, updateSession]);

  return {
    session,
    refreshHome,
    sendText,
    analyzeMarket,
    runCardAction,
    latestCard: getLatestV2Card(session)
  };
}
