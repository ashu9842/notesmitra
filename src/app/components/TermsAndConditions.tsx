import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { ScrollArea } from "./ui/scroll-area";

interface TermsAndConditionsProps {
  isOpen: boolean;
  onClose: () => void;
}

// ── Font injection ──────────────────────────────────────────────────────────
const fontStyle = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Inter:wght@400;500;600&display=swap');
`;

// ── Sub-components ──────────────────────────────────────────────────────────
function Section({ title, icon }: { title: string; icon: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-md shadow-indigo-200 dark:shadow-indigo-900/40 shrink-0">
        <span className="text-white text-sm">{icon}</span>
      </div>
      <h3
        className="text-[15px] font-bold tracking-tight text-foreground"
        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      >
        {title}
      </h3>
      <div className="flex-1 h-px bg-gradient-to-r from-indigo-200/60 to-transparent dark:from-indigo-800/40" />
    </div>
  );
}

function SubSection({ title }: { title: string }) {
  return (
    <h4
      className="text-[11.5px] font-semibold text-indigo-600 dark:text-indigo-400 mb-2.5 uppercase tracking-wider"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      {title}
    </h4>
  );
}

function BulletList({ items }: { items: (string | React.ReactNode)[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5 items-start">
          <span className="mt-[7px] w-1.5 h-1.5 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 shrink-0" />
          <span
            className="text-[13px] leading-relaxed text-muted-foreground"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            {item}
          </span>
        </li>
      ))}
    </ul>
  );
}

function AmountRow({
  label,
  value,
  variant = "neutral",
  bold = false,
  divider = false,
}: {
  label: string;
  value: string;
  variant?: "neutral" | "positive" | "negative";
  bold?: boolean;
  divider?: boolean;
}) {
  const valueColor =
    variant === "positive"
      ? "text-emerald-600 dark:text-emerald-400"
      : variant === "negative"
      ? "text-rose-500 dark:text-rose-400"
      : "text-foreground";

  return (
    <div
      className={`flex justify-between items-center text-[12.5px] py-1 ${
        divider ? "border-t border-dashed border-border mt-1 pt-2" : ""
      } ${bold ? "font-semibold" : ""}`}
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium tabular-nums ${valueColor}`}>{value}</span>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────
export function TermsAndConditions({ isOpen, onClose }: TermsAndConditionsProps) {
  return (
    <>
      <style>{fontStyle}</style>

      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-2xl max-h-[88vh] p-0 overflow-hidden border-0 shadow-2xl shadow-indigo-200/30 dark:shadow-indigo-900/30 rounded-2xl">

          {/* ── Header ── */}
          <div className="relative px-7 pt-7 pb-5 overflow-hidden border-b border-border/60">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/80 via-violet-50/40 to-transparent dark:from-indigo-950/50 dark:via-violet-950/20 dark:to-transparent" />
            <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-violet-200/30 to-transparent dark:from-violet-800/10 rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none" />

            <DialogHeader className="relative">
              <div className="flex items-center gap-3 mb-1">
                <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-300/40 dark:shadow-indigo-900/50">
                  <span className="text-white text-base">📋</span>
                </div>
                <DialogTitle
                  className="text-[22px] font-extrabold tracking-tight bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 bg-clip-text text-transparent"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  Terms &amp; Conditions
                </DialogTitle>
              </div>
              <DialogDescription
                className="text-[13px] text-muted-foreground ml-12"
                style={{ fontFamily: "'Inter', sans-serif" }}
              >
                Please read these terms carefully before using{" "}
                <span
                  className="font-semibold text-indigo-600 dark:text-indigo-400"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  NotesMitra
                </span>.
              </DialogDescription>
            </DialogHeader>
          </div>

          {/* ── Scrollable Body ── */}
          <ScrollArea className="h-[calc(88vh-110px)] px-7 py-6">
            <div className="space-y-8 pb-4">

              {/* ════ Service Structure ════ */}
              <div>
                <Section title="Service Structure" icon="🏗️" />
                <div className="space-y-4 pl-1">

                  <div className="rounded-xl border border-border/70 bg-card/50 p-4 space-y-2.5 shadow-sm">
                    <p
                      className="text-[13px] font-semibold text-foreground"
                      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                    >
                      Platform Service Charge
                      <span className="ml-2 text-[11px] font-medium text-indigo-500 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-full">
                        Seller-side
                      </span>
                    </p>
                    <BulletList items={[
                      "18% per sale, charged to the seller (non-premium buyers: 18% of original price; premium buyers: 18% of discounted price)",
                      "Covers platform infrastructure, hosting, moderation, quality checks, admin review, and customer support",
                    ]} />
                  </div>

                  <div className="rounded-xl border border-border/70 bg-card/50 p-4 space-y-2.5 shadow-sm">
                    <p
                      className="text-[13px] font-semibold text-foreground"
                      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                    >
                      Platform Transaction Handling Fee
                      <span className="ml-2 text-[11px] font-medium text-violet-500 bg-violet-50 dark:bg-violet-950/60 px-2 py-0.5 rounded-full">
                        Buyer-side
                      </span>
                    </p>
                    <BulletList items={[
                      "2% platform handling fee (charged to buyer only for non-premium buyers)",
                      "No transaction fee for premium buyers",
                      "For platform-level order processing, transaction tracking, security monitoring, and settlement handling",
                    ]} />
                  </div>

                  <div className="rounded-xl border border-amber-200/70 dark:border-amber-800/40 bg-gradient-to-br from-amber-50/80 to-orange-50/40 dark:from-amber-950/30 dark:to-orange-950/10 p-4 space-y-2.5 shadow-sm">
                    <p
                      className="text-[13px] font-semibold text-amber-800 dark:text-amber-300"
                      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                    >
                      ⚡ Payment Gateway Fee
                    </p>
                    <BulletList items={[
                      "Applied directly by third-party providers (Razorpay, Paytm, etc.)",
                      "Vary by payment method — not controlled or fixed by the platform",
                      "The platform does not guarantee exact settlement amounts",
                    ]} />
                  </div>

                  <div>
                    <SubSection title="Earnings & Distribution (Indicative)" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="rounded-xl border border-emerald-200/60 dark:border-emerald-800/30 bg-emerald-50/50 dark:bg-emerald-950/20 p-3.5">
                        <p
                          className="text-[11px] uppercase tracking-widest font-semibold text-emerald-600 dark:text-emerald-400 mb-1.5"
                          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                        >
                          Seller Receives
                        </p>
                        <p
                          className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-300"
                          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                        >
                          80%
                        </p>
                        <p
                          className="text-[12px] text-muted-foreground mt-0.5"
                          style={{ fontFamily: "'Inter', sans-serif" }}
                        >
                          of original note price
                        </p>
                      </div>
                      <div className="rounded-xl border border-border/60 bg-card/50 p-3.5 space-y-1.5">
                        <p
                          className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground mb-1.5"
                          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                        >
                          Platform Earns
                        </p>
                        <BulletList items={[
                          "18% service charge from seller",
                          "2% transaction fee from buyer (non-premium only)",
                          "Final settlement may vary by payment method",
                        ]} />
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              {/* ════ Pricing Clause ════ */}
              <div>
                <Section title="Pricing Clause" icon="💰" />
                <div className="space-y-5 pl-1">

                  <div>
                    <SubSection title="1. Seller Pricing Guidelines" />
                    <BulletList items={[
                      "Sellers may set their own prices",
                      <span key="min">Minimum price per note: <span className="font-semibold text-foreground">₹20</span></span>,
                      <span key="max">Maximum price per note: <span className="font-semibold text-foreground">₹50</span></span>,
                      "Prices must reasonably reflect content quality",
                      "The admin reserves the right to reject notes with unreasonable pricing",
                    ]} />
                  </div>

                  <div>
                    <SubSection title="2. Buyer Payment Terms" />
                    <BulletList items={[
                      "Non-premium buyers: Listed note price + 2% platform transaction handling fee",
                      "Premium buyers: 5% discount on listed price, no transaction fee",
                      "Payments are processed via secure third-party gateways",
                      "Instant access is granted after successful payment",
                      "No refunds after download, except for verified quality issues approved by admin",
                    ]} />
                  </div>

                  <div>
                    <SubSection title="3. Seller Payout Terms" />
                    <BulletList items={[
                      "Sellers receive 80% of the original note price (regardless of buyer type)",
                      "Platform commission: 18% of original price (non-premium buyers), 18% of discounted price (premium buyers)",
                      "No 2% transaction fee is deducted from seller earnings for premium buyers",
                      "Earnings are credited instantly to seller wallet after each sale",
                      <span key="withdrawal">Minimum withdrawal: <span className="font-semibold text-foreground">₹100</span> · Maximum per transaction: <span className="font-semibold text-foreground">₹500</span></span>,
                      "Processing time: 1–2 business days · Valid UPI ID mandatory",
                    ]} />
                  </div>

                  <div>
                    <SubSection title="4. Transaction Example (₹100 note)" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">

                      <div className="rounded-xl border border-indigo-200/60 dark:border-indigo-800/30 bg-gradient-to-br from-indigo-50/70 to-indigo-50/30 dark:from-indigo-950/40 dark:to-indigo-950/10 p-4">
                        <p
                          className="text-[11px] uppercase tracking-widest font-semibold text-indigo-500 dark:text-indigo-400 mb-3"
                          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                        >
                          Non-Premium Buyer
                        </p>
                        <AmountRow label="Note price" value="₹100" />
                        <AmountRow label="Fee (2%)" value="−₹2" variant="negative" />
                        <AmountRow label="Total payable" value="₹102" bold divider />
                      </div>

                      <div className="rounded-xl border border-violet-200/60 dark:border-violet-800/30 bg-gradient-to-br from-violet-50/70 to-violet-50/30 dark:from-violet-950/40 dark:to-violet-950/10 p-4">
                        <p
                          className="text-[11px] uppercase tracking-widest font-semibold text-violet-500 dark:text-violet-400 mb-3"
                          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                        >
                          Seller Side · Non-Premium
                        </p>
                        <AmountRow label="Seller receives (80%)" value="₹80" variant="positive" />
                        <AmountRow label="Platform commission (18%)" value="−₹18" variant="negative" />
                      </div>

                      <div className="rounded-xl border border-indigo-200/60 dark:border-indigo-800/30 bg-gradient-to-br from-indigo-50/70 to-purple-50/30 dark:from-indigo-950/40 dark:to-purple-950/10 p-4">
                        <p
                          className="text-[11px] uppercase tracking-widest font-semibold text-indigo-500 dark:text-indigo-400 mb-3"
                          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                        >
                          Premium Buyer
                          <span className="ml-1.5 text-[10px] bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-full normal-case tracking-normal">
                            ★ Premium
                          </span>
                        </p>
                        <AmountRow label="Note price" value="₹100" />
                        <AmountRow label="Discount (5%)" value="−₹5" variant="negative" />
                        <AmountRow label="Total payable" value="₹95" bold divider />
                      </div>

                      <div className="rounded-xl border border-violet-200/60 dark:border-violet-800/30 bg-gradient-to-br from-violet-50/70 to-purple-50/30 dark:from-violet-950/40 dark:to-purple-950/10 p-4">
                        <p
                          className="text-[11px] uppercase tracking-widest font-semibold text-violet-500 dark:text-violet-400 mb-3"
                          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                        >
                          Seller Side · Premium
                        </p>
                        <AmountRow label="Seller receives (80%)" value="₹80" variant="positive" />
                        <AmountRow label="Platform commission (18% of ₹95)" value="−₹17.10" variant="negative" />
                      </div>

                    </div>
                  </div>

                </div>
              </div>

              {/* ════ Notes Rating System ════ */}
              <div>
                <Section title="Notes Rating System" icon="⭐" />
                <div className="space-y-5 pl-1">

                  <div>
                    <SubSection title="1. Rating Criteria" />
                    <BulletList items={[
                      "Buyers may rate notes from 1 to 5 stars",
                      "Ratings based on quality, clarity, and usefulness",
                      "Only verified buyers can rate — one rating per buyer per note",
                    ]} />
                  </div>

                  <div>
                    <SubSection title="2. Quality Standards" />
                    <BulletList items={[
                      "Minimum note length: 3 pages",
                      "Automated checks: duplicate detection, blank page detection, quality scan, copyright check",
                      "Admin approval required before notes go live",
                      "Notes with average rating below 2 stars may be delisted",
                      "Repeated low-quality uploads may result in seller restrictions",
                    ]} />
                  </div>

                  <div>
                    <SubSection title="3. Fair Use Policy" />
                    <BulletList items={[
                      "Fake or manipulated ratings are prohibited",
                      "Sellers cannot rate their own notes",
                      "Abusive or spam reviews will be removed",
                      "Admin may suspend accounts violating rating policies",
                    ]} />
                  </div>

                </div>
              </div>

              {/* ════ General Terms ════ */}
              <div>
                <Section title="General Terms" icon="📜" />
                <div className="space-y-3 pl-1">
                  {[
                    {
                      title: "Account Security",
                      body: "Users are responsible for maintaining account confidentiality. All activity under an account is the user's responsibility.",
                    },
                    {
                      title: "Content Ownership",
                      body: "Sellers retain ownership of uploaded notes but grant the platform a non-exclusive license to distribute them. Buyers receive a personal, non-transferable license for study purposes only.",
                    },
                    {
                      title: "Prohibited Content",
                      body: "Copyrighted, plagiarized, or offensive material is strictly prohibited and may result in account suspension.",
                    },
                    {
                      title: "Platform Rights",
                      body: "We reserve the right to modify these terms, suspend or terminate accounts, and remove content that violates platform policies.",
                    },
                    {
                      title: "Dispute Resolution",
                      body: "Disputes will be handled through our support system. Serious disputes may be resolved through arbitration as per applicable laws.",
                    },
                  ].map(({ title, body }) => (
                    <div
                      key={title}
                      className="rounded-xl border border-border/60 bg-card/40 p-4 hover:border-indigo-200 dark:hover:border-indigo-800/50 transition-colors duration-200"
                    >
                      <p
                        className="text-[13px] font-semibold text-foreground mb-1.5"
                        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                      >
                        {title}
                      </p>
                      <p
                        className="text-[13px] leading-relaxed text-muted-foreground"
                        style={{ fontFamily: "'Inter', sans-serif" }}
                      >
                        {body}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Footer ── */}
              <div className="flex items-center gap-3 pt-2 border-t border-border/50">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                <p
                  className="text-[11.5px] text-muted-foreground"
                  style={{ fontFamily: "'Inter', sans-serif" }}
                >
                  Last updated:{" "}
                  <span className="font-medium text-foreground">March 15, 2026</span>. By using
                  this platform, you agree to these terms and conditions.
                </p>
              </div>

            </div>
          </ScrollArea>

        </DialogContent>
      </Dialog>
    </>
  );
}