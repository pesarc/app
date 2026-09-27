import type { Metadata } from "next";
import PageShell from "@/components/marketing/PageShell";

export const metadata: Metadata = {
  title: "Careers",
  description: "Help build the money network for the Global South.",
};

export default function CareersPage() {
  return (
    <PageShell eyebrow="Company" title="Build money that works for everyone">
      <p>
        Pesarc is building the settlement layer for the Global South: send, hold,
        earn and invest in your own currency, in seconds, for a fee you can
        actually read. We hide the hard parts so anyone, including someone on a
        basic phone, can move money simply and safely.
      </p>

      <h2>How we work</h2>
      <ul>
        <li><strong>The Mum Test.</strong> If your mum can&apos;t use it, we haven&apos;t finished. Simplicity is the product.</li>
        <li><strong>Global South first.</strong> We design for real corridors, real currencies and real constraints, not a demo.</li>
        <li><strong>Own the hard parts.</strong> We build the rails we depend on, so quality and cost stay in our hands.</li>
      </ul>

      <h2>Where we&apos;d love help</h2>
      <p>
        We don&apos;t have formal listings yet, but we are always looking to meet
        exceptional people in:
      </p>
      <ul>
        <li>Engineering (full-stack, mobile, and on-chain / smart contracts)</li>
        <li>Product and design with a bias for radical simplicity</li>
        <li>Growth, partnerships and operations across African markets</li>
        <li>Compliance and payments</li>
      </ul>

      <h2>Get in touch</h2>
      <p>
        Tell us what you&apos;d want to build and why Pesarc. Send a note and
        anything that shows your work to{" "}
        <a href="mailto:hello@pesarc.xyz">hello@pesarc.xyz</a>.
      </p>
    </PageShell>
  );
}
