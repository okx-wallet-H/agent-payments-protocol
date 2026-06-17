import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Support | HWallet",
  description: "Support page for HWallet users and store reviewers."
};

export default function SupportPage() {
  return (
    <main className="legal-page">
      <section className="legal-shell">
        <p className="legal-kicker">HWallet</p>
        <h1>Support</h1>
        <p className="legal-updated">For App users, internal testers, and store review.</p>

        <div className="legal-card">
          <h2>What We Can Help With</h2>
          <ul>
            <li>Email login and account switching.</li>
            <li>HWallet receive address, copy feedback, and deposit checks.</li>
            <li>Agent analysis, simulation records, and audit history.</li>
            <li>Privacy, data, and safety questions.</li>
          </ul>
        </div>

        <div className="legal-card">
          <h2>Before Sending A Request</h2>
          <p>
            Please do not send private keys, seed phrases, login verification
            codes, API keys, database URLs, or full access tokens. HWallet support
            will never ask for a seed phrase or private key.
          </p>
        </div>

        <div className="legal-card">
          <h2>Reviewer Notes</h2>
          <p>
            This first release keeps live execution closed. The App supports
            login, wallet address display, deposit recognition, Agent analysis,
            simulation, and audit visibility. It does not submit live orders from
            the Agent.
          </p>
        </div>

        <div className="legal-card">
          <h2>Support Channel</h2>
          <p>
            Use the support contact configured in App Store Connect or Google
            Play Console for private account questions. Public product and
            privacy information is available on this site.
          </p>
        </div>

        <div className="legal-actions">
          <Link href="/privacy">Privacy policy</Link>
          <Link href="/">Back to HWallet</Link>
        </div>
      </section>
    </main>
  );
}
