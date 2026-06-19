import { NextResponse } from "next/server";
import { guardPredictionReadRequest } from "@/v2/auth/prediction-read-guard";
import { hasOkxOutcomesCredentials } from "@/v2/execution/okx-outcomes-client";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const guard = await guardPredictionReadRequest(request, { route: "prediction-status" });
  if (!guard.ok) {
    return NextResponse.json(guard.body, {
      status: guard.status,
      headers: guard.headers
    });
  }

  const credentialsBound = hasOkxOutcomesCredentials();

  return NextResponse.json(
    {
      status: {
        type: "prediction_market_status",
        provider: "okx-outcomes",
        providerLabel: "OKX Outcomes",
        providerStatus: credentialsBound ? "connected" : "not_configured",
        credentialsBound,
        readOnly: true,
        liveExecutionClosed: true,
        apiKeyBinding: {
          label: credentialsBound ? "后端已接入" : "绑定入口预留",
          enabled: false,
          appCollectionEnabled: false,
          storage: "server-side-only",
          note: "第二阶段不在 App 内收集或保存用户 API Key。"
        },
        queryCapabilities: ["事件/市场列表", "会/不会赔率", "订单簿摘要", "成交量/流动性"],
        operationCapabilities: [
          { id: "observe", label: "Agent 观察", enabled: true, mode: "read" },
          { id: "simulate", label: "模拟预览", enabled: true, mode: "dry_run" },
          { id: "track", label: "加入跟踪", enabled: true, mode: "local" },
          { id: "build_strategy", label: "生成策略", enabled: true, mode: "local" },
          { id: "order_closed", label: "真实下单关闭", enabled: false, mode: "closed" }
        ],
        endpoints: {
          explore: "/api/v2/prediction/explore",
          detail: "/api/v2/prediction/detail"
        },
        updatedAt: new Date().toISOString()
      }
    },
    {
      headers: guard.headers
    }
  );
}
