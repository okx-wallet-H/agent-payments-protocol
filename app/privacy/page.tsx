import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | HWallet",
  description: "Privacy policy for the HWallet mobile App."
};

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <section className="legal-shell">
        <p className="legal-kicker">HWallet</p>
        <h1>Privacy Policy</h1>
        <p className="legal-updated">Last updated: 2026-06-17</p>

        <div className="legal-card">
          <h2>What HWallet Does</h2>
          <p>
            HWallet is a wallet entry and Agent experience. The first version lets
            users sign in, receive a wallet address, review wallet state, and ask
            the Agent to analyze or simulate opportunities. Live trading and
            autonomous money movement are disabled in this release.
          </p>
        </div>

        <div className="legal-card">
          <h2>Data We Process</h2>
          <ul>
            <li>Account identifiers from email login through Privy.</li>
            <li>Wallet addresses, chain labels, and non-secret wallet state.</li>
            <li>Transaction hashes that users provide for deposit verification.</li>
            <li>Agent messages, simulation records, audit records, and App diagnostics.</li>
          </ul>
        </div>

        <div className="legal-card">
          <h2>Data We Do Not Collect</h2>
          <ul>
            <li>Private keys or seed phrases.</li>
            <li>Verification codes after login is complete.</li>
            <li>Raw access tokens in App logs, release notes, or support records.</li>
          </ul>
        </div>

        <div className="legal-card">
          <h2>How Data Is Used</h2>
          <p>
            Data is used to keep each user session isolated, display the correct
            HWallet address, sync deposits, maintain audit records, and improve
            Agent responses. Data is not used to bypass wallet authorization,
            safety controls, or release gates.
          </p>
        </div>

        <div className="legal-card">
          <h2>User Control</h2>
          <p>
            Users can sign out of the App and request support for account or data
            questions. Sensitive credentials must never be sent through support
            messages.
          </p>
        </div>

        <div className="legal-actions">
          <Link href="/support">Contact support</Link>
          <Link href="/">Back to HWallet</Link>
        </div>
      </section>
    </main>
  );
}
