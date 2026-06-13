export type PrivyHWalletStatusKind =
  | "booting"
  | "signed_out"
  | "creating"
  | "ready"
  | "backend_bound"
  | "binding_mismatch"
  | "failed";

export interface PrivyHWalletStatusInput {
  isReady: boolean;
  hasUser: boolean;
  walletAddress?: string;
  backendWalletAddress?: string;
  isProvisioning?: boolean;
  provisionError?: string;
}

export interface PrivyHWalletStatus {
  kind: PrivyHWalletStatusKind;
  label: string;
  detail: string;
  canReceive: boolean;
  needsProvisioning: boolean;
}

export function createPrivyHWalletStatus(input: PrivyHWalletStatusInput): PrivyHWalletStatus {
  if (!input.isReady) {
    return {
      kind: "booting",
      label: "准备中",
      detail: "正在准备登录组件。",
      canReceive: false,
      needsProvisioning: false
    };
  }

  if (!input.hasUser) {
    return {
      kind: "signed_out",
      label: "未登录",
      detail: "邮箱登录后会自动生成 HWallet。",
      canReceive: false,
      needsProvisioning: false
    };
  }

  if (input.walletAddress && input.backendWalletAddress) {
    if (!sameWalletAddress(input.walletAddress, input.backendWalletAddress)) {
      return {
        kind: "binding_mismatch",
        label: "需刷新",
        detail: "当前账号的钱包状态需要重新同步，请刷新钱包或重新登录。",
        canReceive: true,
        needsProvisioning: false
      };
    }

    return {
      kind: "backend_bound",
      label: "已绑定",
      detail: "HWallet 已经和当前账号绑定，可以收款和同步资产。",
      canReceive: true,
      needsProvisioning: false
    };
  }

  if (input.walletAddress) {
    return {
      kind: "ready",
      label: "已生成",
      detail: "HWallet 已经生成，正在同步到后端。",
      canReceive: true,
      needsProvisioning: false
    };
  }

  if (input.backendWalletAddress) {
    return {
      kind: "backend_bound",
      label: "已绑定",
      detail: "HWallet 已经和当前账号绑定，可以收款和同步资产。",
      canReceive: true,
      needsProvisioning: false
    };
  }

  if (input.provisionError) {
    return {
      kind: "failed",
      label: "待重试",
      detail: "HWallet 暂时没有生成成功，可以稍后刷新。",
      canReceive: Boolean(input.walletAddress || input.backendWalletAddress),
      needsProvisioning: true
    };
  }

  if (input.isProvisioning) {
    return {
      kind: "creating",
      label: "生成中",
      detail: "正在为你生成 HWallet，稍等一下就能看到收款地址。",
      canReceive: false,
      needsProvisioning: false
    };
  }

  return {
    kind: "creating",
    label: "等待中",
    detail: "登录已完成，正在准备 HWallet。",
    canReceive: false,
    needsProvisioning: true
  };
}

function sameWalletAddress(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}
