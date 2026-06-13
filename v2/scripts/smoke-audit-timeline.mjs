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
  type: "simulation.completed",
  title: "已完成模拟",
  note: "Agent 已完成一次预测模拟，未提交真实订单。",
  status: "success",
  marketId: "worldcup-spain",
  marketTitle: "西班牙会赢得 2026 年世界杯冠军吗？",
  recordId: "record-worldcup-spain-simulation"
});

const events = await listAuditTimelineEvents(userId);
assert(events.length === 2, "lists current user's audit events");
assert(events.every((event) => event.moneyMoved === false), "audit events do not claim money movement");
assert(events[0].createdAt >= events[1].createdAt, "events are sorted newest first");
assert(events.some((event) => event.recordId === "record-worldcup-spain-simulation"), "audit events keep record id links");

console.log(JSON.stringify({
  ok: true,
  checks: ["audit saved", "money movement false", "sorted newest first", "record id link"],
  events: events.map((event) => ({ type: event.type, title: event.title, moneyMoved: event.moneyMoved, recordId: event.recordId }))
}, null, 2));

function assert(condition, label) {
  if (!condition) throw new Error(`Audit timeline smoke failed: ${label}`);
}
