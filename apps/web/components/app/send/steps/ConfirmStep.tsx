import { ArrowRight, ShieldCheck } from "@/components/icons";
import { initials, type Recipient } from "@pesarc/sdk/account";
import { formatMoney, formatNumber } from "@pesarc/sdk/money";
import { PAYOUT_METHODS, type Quote } from "@pesarc/sdk/quote";
import { Avatar, Button, Card } from "@/components/app/ui";
import { formatEta } from "../QuoteBreakdown";
import { Row, StepNav } from "../shared";

export function ConfirmStep({
  recipient,
  quote,
  advanced,
  onBack,
  onSend,
}: {
  recipient: Recipient;
  quote: Quote;
  advanced: boolean;
  onBack: () => void;
  onSend: () => void;
}) {
  const payoutLabel =
    PAYOUT_METHODS.find((m) => m.id === quote.payout)?.label ?? "";

  return (
    <div>
      <StepNav onBack={onBack} title="Confirm" />

      <Card className="p-6 mb-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-xs font-semibold text-slate uppercase tracking-widest mb-1">
              You pay
            </div>
            <div className="text-3xl font-semibold text-ink numerals">
              {formatMoney(quote.sendAmount, quote.sendCurrency)}
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-slate" />
          <div className="text-right">
            <div className="text-xs font-semibold text-slate uppercase tracking-widest mb-1">
              They get
            </div>
            <div className="text-3xl font-semibold text-sky numerals">
              {formatMoney(quote.receiveAmount, quote.receiveCurrency)}
            </div>
          </div>
        </div>

        <div className="divide-y divide-black/[0.06] border-t border-black/[0.06]">
          <Row label="To">
            <span className="inline-flex items-center gap-2">
              <Avatar
                initials={initials(recipient.name)}
                color={recipient.initialsColor}
                size={22}
              />
              {recipient.name}
            </span>
          </Row>
          <Row label="Payout">{`${recipient.flag} ${payoutLabel}`}</Row>
          <Row label="Arrives">~{formatEta(quote.etaSeconds)}</Row>
          {advanced && (
            <>
              <Row label="Rate">
                {`1 ${quote.sendCurrency} = ${formatNumber(
                  quote.effectiveRate,
                  quote.receiveCurrency
                )} ${quote.receiveCurrency}`}
              </Row>
              <Row label="Route">{quote.route}</Row>
            </>
          )}
        </div>
      </Card>

      <div className="flex items-center gap-2 text-sm text-slate mb-5 px-1">
        <ShieldCheck className="w-4 h-4 text-sky shrink-0" />
        Recipient checked · no scam flags · no fees to send
      </div>

      <Button size="lg" block onClick={onSend}>
        Send {formatMoney(quote.sendAmount, quote.sendCurrency)}
      </Button>
    </div>
  );
}
