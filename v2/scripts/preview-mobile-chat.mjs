const text = process.argv.slice(2).join(" ") || "帮我看看世界杯有没有机会";

const response = await fetch("http://localhost:3000/api/v2/phase-one", {
  method: "POST",
  headers: {
    "content-type": "application/json"
  },
  body: JSON.stringify({ text })
});

if (!response.ok) {
  throw new Error(`mobile chat preview failed: ${response.status}`);
}

const payload = await response.json();
const turn = payload.mobileTurn;

console.log(JSON.stringify({
  type: turn.type,
  goalType: turn.goalType,
  messageCount: turn.messages.length,
  messages: turn.messages.map((message) => ({
    role: message.role,
    kind: message.kind,
    text: message.text,
    cardType: message.card?.type,
    actions: message.actions?.map((action) => action.label)
  })),
  suggestedInput: turn.suggestedInput
}, null, 2));
