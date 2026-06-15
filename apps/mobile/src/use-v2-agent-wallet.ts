import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createApi } from "./api";
import {
  createScopedV2AgentWalletSession,
  createV2AgentWalletScopeKey,
  getLatestV2Card,
  initialV2AgentWalletSession,
  isV2AgentWalletSessionScope,
  loadV2AgentWalletHome,
  loadV2AgentWalletState,
  openV2AgentWalletCard,
  refreshV2AgentWallet,
  runV2AgentWalletCardAction,
  sendV2AgentWalletText,
  verifyV2AgentWalletTx,
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
  const scopeKey = useMemo(
    () => createV2AgentWalletScopeKey(input.userId, input.walletAddress),
    [input.userId, input.walletAddress]
  );

  const updateSession = useCallback((next: V2AgentWalletSession) => {
    sessionRef.current = next;
    setSession(next);
  }, []);

  const isCurrentScope = useCallback((expectedScopeKey = scopeKey) => {
    return sessionRef.current.scopeKey === expectedScopeKey;
  }, [scopeKey]);

  const patchSession = useCallback((patch: Partial<V2AgentWalletSession>) => {
    const next = {
      ...sessionRef.current,
      ...patch
    };
    updateSession(next);
  }, [updateSession]);

  const beginRequest = useCallback(() => {
    if (!input.isReady || sessionRef.current.busy) return false;
    patchSession({
      busy: true,
      error: undefined
    });
    return true;
  }, [input.isReady, patchSession]);

  const refreshHome = useCallback(async () => {
    if (!beginRequest()) return;
    const requestScopeKey = scopeKey;
    const next = await loadV2AgentWalletHome(api, sessionRef.current, input.userId, input.walletAddress);
    if (!isCurrentScope(requestScopeKey)) return;
    updateSession({
      ...next,
      busy: false
    });
  }, [api, beginRequest, input.userId, input.walletAddress, isCurrentScope, scopeKey, updateSession]);

  const refreshWallet = useCallback(async () => {
    if (!beginRequest()) return;
    const requestScopeKey = scopeKey;
    const next = await refreshV2AgentWallet(api, sessionRef.current, input.userId, input.walletAddress);
    if (!isCurrentScope(requestScopeKey)) return;
    updateSession(next);
  }, [api, beginRequest, input.userId, input.walletAddress, isCurrentScope, scopeKey, updateSession]);

  const syncWalletState = useCallback(async () => {
    if (!beginRequest()) return;
    const requestScopeKey = scopeKey;
    const next = await loadV2AgentWalletState(api, sessionRef.current, input.userId, input.walletAddress);
    if (!isCurrentScope(requestScopeKey)) return;
    updateSession({
      ...next,
      busy: false
    });
  }, [api, beginRequest, input.userId, input.walletAddress, isCurrentScope, scopeKey, updateSession]);

  const verifyWalletTx = useCallback(async (txHash: string) => {
    if (!beginRequest()) return;
    const requestScopeKey = scopeKey;
    const next = await verifyV2AgentWalletTx(api, sessionRef.current, txHash, input.userId, input.walletAddress);
    if (!isCurrentScope(requestScopeKey)) return;
    updateSession(next);
  }, [api, beginRequest, input.userId, input.walletAddress, isCurrentScope, scopeKey, updateSession]);

  const sendText = useCallback(async (text: string) => {
    if (!text.trim() || !beginRequest()) return;
    const requestScopeKey = scopeKey;
    const next = await sendV2AgentWalletText(api, sessionRef.current, text, input.userId, input.walletAddress);
    if (!isCurrentScope(requestScopeKey)) return;
    updateSession(next);
  }, [api, beginRequest, input.userId, input.walletAddress, isCurrentScope, scopeKey, updateSession]);

  const analyzeMarket = useCallback(async (text: string, market: V2MarketSnapshot) => {
    if (!text.trim() || !beginRequest()) return;
    const requestScopeKey = scopeKey;
    const next = await sendV2AgentWalletText(api, sessionRef.current, text, input.userId, input.walletAddress, market);
    if (!isCurrentScope(requestScopeKey)) return;
    updateSession(next);
  }, [api, beginRequest, input.userId, input.walletAddress, isCurrentScope, scopeKey, updateSession]);

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

    if (!beginRequest()) return;
    const requestScopeKey = scopeKey;

    const next = await runV2AgentWalletCardAction(api, sessionRef.current, {
      action: params.action,
      card,
      amountUsd: params.amountUsd,
      idempotencyKey: params.idempotencyKey,
      userId: input.userId
    });
    if (!isCurrentScope(requestScopeKey)) return;
    updateSession(next);
  }, [api, beginRequest, input.userId, isCurrentScope, patchSession, scopeKey, updateSession]);

  const openCard = useCallback((card: V2ConversationCard) => {
    updateSession(openV2AgentWalletCard(sessionRef.current, card));
  }, [updateSession]);

  useEffect(() => {
    if (!input.isReady) return;
    let cancelled = false;
    const scopedInitialSession = createScopedV2AgentWalletSession(input.userId, input.walletAddress);
    const requestScopeKey = scopedInitialSession.scopeKey;
    updateSession(scopedInitialSession);
    loadV2AgentWalletHome(api, scopedInitialSession, input.userId, input.walletAddress).then((next) => {
      if (cancelled) return;
      if (!requestScopeKey || !isV2AgentWalletSessionScope(sessionRef.current, input.userId, input.walletAddress)) return;
      updateSession(next);
      loadV2AgentWalletState(api, next, input.userId, input.walletAddress).then((walletNext) => {
        if (!cancelled && isCurrentScope(requestScopeKey)) updateSession(walletNext);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [api, input.isReady, input.userId, input.walletAddress, isCurrentScope, updateSession]);

  return {
    session,
    refreshHome,
    refreshWallet,
    syncWalletState,
    verifyWalletTx,
    sendText,
    analyzeMarket,
    runCardAction,
    openCard,
    latestCard: getLatestV2Card(session),
    orchestration: session.orchestration,
    capability: session.orchestration?.capability
  };
}
