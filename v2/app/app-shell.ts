import type { PhaseOneAppShell } from "../domain/types";

export const PHASE_ONE_APP_SHELL: PhaseOneAppShell = {
  main: "premium_ai_conversation",
  entries: [
    {
      id: "world_cup_info",
      position: "top_left",
      label: "市场"
    },
    {
      id: "user_console",
      position: "top_right",
      label: "我的"
    }
  ]
};
