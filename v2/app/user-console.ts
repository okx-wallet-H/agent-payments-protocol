import type { UserConsolePanel } from "../domain/types";

export function createUserConsolePanel(input?: { walletAddress?: `0x${string}` }): UserConsolePanel {
  return {
    type: "user_console_panel",
    title: "我的",
    walletLabel: input?.walletAddress ? shortAddress(input.walletAddress) : undefined,
    actions: [
      {
        id: "recharge",
        label: "充值",
        caption: "复制收款地址"
      },
      {
        id: "my_strategies",
        label: "我的策略",
        caption: "查看已生成策略"
      },
      {
        id: "tracking",
        label: "跟踪中",
        caption: "查看正在盯的机会"
      },
      {
        id: "records",
        label: "记录",
        caption: "查看操作记录"
      },
      {
        id: "settings",
        label: "设置",
        caption: "账户和偏好"
      }
    ],
    updatedAt: new Date().toISOString()
  };
}

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
