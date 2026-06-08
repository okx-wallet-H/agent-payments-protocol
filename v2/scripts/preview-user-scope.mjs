const userId = `scope-user-${Date.now()}`;
const otherUserId = `${userId}-other`;

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
    action: "track",
    market: predictionCard.market,
    userId
  })
});

if (!actionResponse.ok) {
  throw new Error(`track action failed: ${actionResponse.status}`);
}

const [ownRecords, otherRecords] = await Promise.all([
  readRecords(userId),
  readRecords(otherUserId)
]);

console.log(JSON.stringify({
  userId,
  ownRecordCount: ownRecords.items.length,
  otherUserId,
  otherRecordCount: otherRecords.items.length,
  isolated: ownRecords.items.length > 0 && otherRecords.items.length === 0
}, null, 2));

async function readRecords(nextUserId) {
  const response = await fetch(`http://localhost:3000/api/v2/phase-one/records?userId=${encodeURIComponent(nextUserId)}`);
  if (!response.ok) {
    throw new Error(`read records failed: ${response.status}`);
  }
  return response.json();
}
