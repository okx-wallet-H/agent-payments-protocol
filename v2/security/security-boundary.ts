import type { AgentWalletSecurity } from "../domain/types";

export const AGENT_WALLET_SECURITY: AgentWalletSecurity = {
  signingModel: "tee",
  privateKeyLocation: "trusted_execution_environment",
  exportAllowedInChat: false
};

export function describeSecurityBoundary(): string {
  return "TEE signing boundary: private keys stay inside the trusted execution environment; the business Agent only creates policy-scoped execution requests.";
}
