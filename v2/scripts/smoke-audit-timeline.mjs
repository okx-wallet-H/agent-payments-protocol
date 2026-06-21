import { listAuditTimelineEvents, saveAuditTimelineEvent } from "../storage/audit-timeline-store.ts";

const userId = `audit-smoke-${Date.now()}`;

await saveAuditTimelineEvent({
  userId,
  type: "wallet.refresh",
  title: "已检查 HWallet",
  note: "已刷新钱包状态，未发生资金动作。",
  status: "success"
});

await saveAuditTimelineEvent({
  userId,
  type: "device.evidence",
  title: "真机验证已记录",
  note: "HWallet 真机证据已记录，未发生资金动作。",
  status: "success",
  chainId: 196,
  assetSymbol: "HWallet",
  amountLabel: "copy-feedback-visible"
});

await saveAuditTimelineEvent({
  userId,
  type: "simulation.completed",
  title: "已完成模拟",
  note: "Agent 已完成一次预测模拟，未提交真实订单。",
  status: "success",
  marketId: "worldcup-spain",
  marketTitle: "西班牙会赢得 2026 年世界杯冠军吗？",
  recordId: "record-worldcup-spain-simulation"
});

const events = await listAuditTimelineEvents(userId);
const missingUserRejected = await rejectsWithAuditUserBoundary(() => saveAuditTimelineEvent({
  type: "wallet.refresh",
  title: "missing user should fail",
  note: "missing user should not write audit event",
  status: "blocked"
}));

assert(events.length === 3, "lists current user's audit events");
assert(events.every((event) => event.moneyMoved === false), "audit events do not claim money movement");
assert(events[0].createdAt >= events[1].createdAt, "events are sorted newest first");
assert(events.some((event) => event.recordId === "record-worldcup-spain-simulation"), "audit events keep record id links");
assert(events.some((event) => event.type === "device.evidence"), "audit events keep device evidence type");
assert(missingUserRejected, "missing audit user is rejected");

console.log(JSON.stringify({
  ok: true,
  checks: ["audit saved", "money movement false", "sorted newest first", "record id link", "missing user rejected"],
  events: events.map((event) => ({ type: event.type, title: event.title, moneyMoved: event.moneyMoved, recordId: event.recordId }))
}, null, 2));

function assert(condition, label) {
  if (!condition) throw new Error(`Audit timeline smoke failed: ${label}`);
}

async function rejectsWithAuditUserBoundary(callback) {
  try {
    await callback();
    return false;
  } catch (error) {
    return error instanceof Error && error.message === "Audit timeline userId is required";
  }
}
