import type { Metadata } from "next";
import PageShell from "@/components/marketing/PageShell";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms for using Pesarc.",
};

export default function TermsPage() {
  return (
    <PageShell eyebrow="Legal" title="Terms of Service" updated="September 2026">
      <p>
        These Terms govern your use of Pesarc. By using the app, agent or website,
        you agree to them. Please read them carefully.
      </p>

      <h2>Eligibility</h2>
      <p>
        You must be old enough to form a binding contract where you live, and you
        must not be barred from using the service under any applicable law or
        sanctions.
      </p>

      <h2>Your account and wallet</h2>
      <p>
        Pesarc is non-custodial. You control your funds through an embedded or
        connected wallet. You are responsible for keeping your sign-in method
        secure. We cannot move, freeze or recover funds on your behalf, and we
        never hold your balance.
      </p>

      <h2>Acceptable use</h2>
      <ul>
        <li>Do not use Pesarc for anything illegal, fraudulent, or that harms others.</li>
        <li>Do not attempt to break, overload or reverse-engineer the service.</li>
        <li>Do not use Pesarc to launder money or evade sanctions.</li>
      </ul>

      <h2>Not financial advice</h2>
      <p>
        Pesarc provides tools to move, hold, earn and invest money. Nothing in the
        product is financial, investment, legal or tax advice. Investing, earning
        and markets carry risk, including loss of value. You make your own
        decisions.
      </p>

      <h2>Fees</h2>
      <p>
        Any fee for a transaction is shown to you before you confirm it. Network
        conditions and third-party rails may affect timing and cost.
      </p>

      <h2>Third-party services</h2>
      <p>
        Pesarc works with third parties for authentication, wallet infrastructure,
        messaging, and fiat payouts and on-ramps. Their terms may also apply, and
        we are not responsible for their acts or omissions.
      </p>

      <h2>Intellectual property</h2>
      <p>
        Pesarc and its logos, content and software are owned by us or our
        licensors. You may not copy or misuse them without permission.
      </p>

      <h2>Disclaimers</h2>
      <p>
        The service is provided &ldquo;as is&rdquo; without warranties of any
        kind. We do not guarantee that the service will always be available,
        uninterrupted or error-free.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the fullest extent permitted by law, Pesarc is not liable for indirect,
        incidental or consequential losses, or for losses arising from your own
        keys, credentials or decisions.
      </p>

      <h2>Termination</h2>
      <p>
        You may stop using Pesarc at any time. We may suspend or end access where
        required by law or to protect the service and its users.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these Terms as the product evolves. Continued use after an
        update means you accept the new Terms.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these Terms? Email{" "}
        <a href="mailto:hello@pesarc.xyz">hello@pesarc.xyz</a>.
      </p>

      <p className="note">
        This page is a starting template and not legal advice. Please have it
        reviewed and adapted by qualified counsel, including your governing law and
        dispute-resolution terms, before launch.
      </p>
    </PageShell>
  );
}
