const action = process.argv[2] || "track";
const userId = "demo-user";

const turnResponse = await fetch("http://localhost:3000/api/v2/phase-one", {
  method: "POST",
  headers: {
    "content-type": "application/json"
  },
  body: JSON.stringify({
    text: "帮我看看世界杯有没有机会"
  })
});

if (!turnResponse.ok) {
  throw new Error(`prediction turn failed: ${turnResponse.status}`);
}

const turnPayload = await turnResponse.json();
const predictionCard = turnPayload.turn.cards.find((card) => card.type === "prediction_card");
if (!predictionCard) {
  throw new Error("No prediction card found.");
}

const actionResponse = await fetch("http://localhost:3000/api/v2/phase-one/actions", {
  method: "POST",
  headers: {
    "content-type": "application/json"
  },
  body: JSON.stringify({
    action,
    market: predictionCard.market,
    amountUsd: 1,
    userId
  })
});

if (!actionResponse.ok) {
  throw new Error(`action failed: ${actionResponse.status}`);
}

const payload = await actionResponse.json();
const mobileTurn = payload.mobileTurn;

console.log(JSON.stringify({
  action,
  recordType: payload.record?.type,
  resultStatus: payload.result?.status,
  messageCount: mobileTurn.messages.length,
  messages: mobileTurn.messages.map((message) => ({
    role: message.role,
    kind: message.kind,
    text: message.text,
    cardType: message.card?.type,
    actions: message.actions?.map((nextAction) => nextAction.label)
  })),
  suggestedInput: mobileTurn.suggestedInput
}, null, 2));
