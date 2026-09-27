import type { Metadata } from "next";
import PageShell from "@/components/marketing/PageShell";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Pesarc collects, uses and protects your information.",
};

export default function PrivacyPage() {
  return (
    <PageShell eyebrow="Legal" title="Privacy Policy" updated="September 2026">
      <p>
        This Privacy Policy explains how Pesarc (&ldquo;we&rdquo;,
        &ldquo;us&rdquo;) collects, uses and protects your information when you
        use our app, agent and website. We built Pesarc to move money simply and
        safely, and we try to collect only what we need to do that.
      </p>

      <h2>Who we are</h2>
      <p>
        Pesarc is a stablecoin settlement service that lets you send, hold, earn
        and invest in your own currency. Pesarc is non-custodial: we never hold
        your balance and we never have access to your funds.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Account details</strong> you give us to sign in, such as a phone number, email address or the public address of a wallet you connect.</li>
        <li><strong>Transaction details</strong> needed to complete a payment, such as amount, currency, recipient and a reference.</li>
        <li><strong>Verification details</strong> where the law requires identity checks before a payout (KYC), handled by our verification partner.</li>
        <li><strong>Usage and device data</strong>, such as app interactions and basic analytics, to keep the service working and safe.</li>
      </ul>

      <h2>What we do not collect</h2>
      <p>
        We do not hold your money and we do not store the private keys to your
        wallet. We do not sell your personal data.
      </p>

      <h2>How we use your information</h2>
      <ul>
        <li>To provide the service: complete transfers, show your balance and history, and support the agent.</li>
        <li>To keep you and the network safe: prevent fraud and abuse, and meet legal obligations.</li>
        <li>To improve the product and communicate with you about your account.</li>
      </ul>

      <h2>Service providers</h2>
      <p>
        We rely on trusted providers to run Pesarc, and share only what each
        needs to do its job. These include our authentication and embedded-wallet
        provider (Privy), our gas-sponsorship and wallet infrastructure (Alchemy),
        our messaging/OTP provider (Termii), and licensed payout and on-ramp
        partners. On-chain settlement is recorded on public blockchains, which are
        by nature public.
      </p>

      <h2>Cookies and analytics</h2>
      <p>
        We use essential cookies to keep you signed in and privacy-respecting
        analytics to understand how the product is used. You can control cookies
        in your browser.
      </p>

      <h2>Your rights</h2>
      <p>
        Depending on where you live, you may have the right to access, correct or
        delete your personal data, or to object to certain processing. Contact us
        to exercise these rights.
      </p>

      <h2>Data retention</h2>
      <p>
        We keep personal data only as long as needed to provide the service and
        meet legal and record-keeping obligations, then delete or anonymise it.
      </p>

      <h2>Changes</h2>
      <p>
        We may update this policy as the product evolves. We will post the new
        version here and update the date above.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about privacy? Email us at{" "}
        <a href="mailto:hello@pesarc.xyz">hello@pesarc.xyz</a>.
      </p>

      <p className="note">
        This page is a starting template and not legal advice. Please have it
        reviewed and adapted by qualified counsel for your jurisdiction before
        launch.
      </p>
    </PageShell>
  );
}
