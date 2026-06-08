"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { xLayer } from "@/lib/chains";

export default function Providers({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  if (!appId) return <>{children}</>;

  return (
    <PrivyProvider
      appId={appId}
      config={{
        supportedChains: [xLayer],
        defaultChain: xLayer,
        loginMethods: ["email", "wallet", "google"],
        appearance: {
          theme: "light",
          accentColor: "#0d7a53",
          logo: undefined
        },
        embeddedWallets: {
          ethereum: {
            createOnLogin: "users-without-wallets"
          }
        }
      }}
    >
      {children}
    </PrivyProvider>
  );
}
