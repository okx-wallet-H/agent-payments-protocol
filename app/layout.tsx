import type { Metadata, Viewport } from "next";
import Providers from "./providers";
import "./styles.css";

export const metadata: Metadata = {
  title: "Agent Wallet | X Layer Prediction Agent",
  description: "OKX-first Agent Wallet MVP for X Layer prediction agents."
};

export const viewport: Viewport = {
  maximumScale: 1,
  interactiveWidget: "resizes-content"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
