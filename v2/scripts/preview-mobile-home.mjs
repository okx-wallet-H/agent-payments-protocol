const response = await fetch("http://localhost:3000/api/v2/mobile/home?userId=demo-user");
if (!response.ok) {
  throw new Error(`mobile home preview failed: ${response.status}`);
}

const payload = await response.json();
const home = payload.home;

console.log(JSON.stringify({
  type: home.type,
  shell: home.shell,
  state: home.state,
  quickPrompts: home.quickPrompts.map((prompt) => prompt.text),
  topLeftSummary: home.panels.topLeft.summary,
  topRightActions: home.panels.topRight.actions.map((action) => action.id),
  recent: {
    tracking: home.recent.tracking.length,
    strategies: home.recent.strategies.length,
    records: home.recent.records.length
  }
}, null, 2));
