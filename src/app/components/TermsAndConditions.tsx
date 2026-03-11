import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { ScrollArea } from "./ui/scroll-area";

interface TermsAndConditionsProps {
  isOpen: boolean;
  onClose: () => void;
}

function Section({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="w-1 h-6 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600" />
      <h3 className="text-base font-bold text-foreground tracking-tight">{title}</h3>
    </div>
  );
}

function SubSection({ title }: { title: string }) {
  return <h4 className="font-semibold text-sm text-indigo-600 dark:text-indigo-400 mb-2">{title}</h4>;
}

function BulletList({ items }: { items: (string | React.ReactNode)[] }) {
  return (
    <ul className="space-y-1.5 text-sm text-muted-foreground">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2">
          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-400/70 shrink-0" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function TermsAndConditions({ isOpen, onClose }: TermsAndConditionsProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] p-0 overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border bg-gradient-to-r from-indigo-50/60 via-violet-50/40 to-transparent dark:from-indigo-950/40 dark:via-violet-950/20 dark:to-transparent">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
              Terms & Conditions
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Please read these terms carefully before using NotesMitra.
            </DialogDescription>
          </DialogHeader>
        </div>

        <ScrollArea className="h-[calc(85vh-100px)] px-6 py-5">
          <div className="space-y-7 pb-4">

            {/* Service Structure */}
            <section>
              <Section title="Service Structure" />
              <div className="space-y-4 text-sm">
                <div>
                  <SubSection title="Platform Fees" />
                  <div className="space-y-3">
                    <div className="rounded-xl border border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-950/20 p-3">
                      <p className="font-medium text-foreground mb-1.5">Platform Service Charge (Seller-side)</p>
                      <BulletList items={[
                        "18% per sale, charged to the seller",
                        "Covers platform infrastructure, hosting, moderation, quality checks, admin review, and customer support"
                      ]} />
                    </div>
                    <div className="rounded-xl border border-violet-100 dark:border-violet-900/50 bg-violet-50/50 dark:bg-violet-950/20 p-3">
                      <p className="font-medium text-foreground mb-1.5">Platform Transaction Handling Fee</p>
                      <BulletList items={[
                        "2% platform handling fee",
                        "Charged to buyer at checkout and to seller from earnings",
                        "For platform-level order processing, transaction tracking, security monitoring, and settlement handling"
                      ]} />
                    </div>
                    <div className="rounded-xl border border-amber-100 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 p-3">
                      <p className="font-medium text-foreground mb-1.5">Payment Gateway Fee</p>
                      <BulletList items={[
                        "Applied directly by third-party providers (Razorpay, Paytm, etc.)",
                        "Vary by payment method — not controlled or fixed by the platform",
                        "The platform does not guarantee exact settlement amounts"
                      ]} />
                    </div>
                  </div>
                </div>

                <div>
                  <SubSection title="Earnings Distribution (Indicative)" />
                  <div className="rounded-xl border border-border bg-muted/30 dark:bg-white/[0.03] p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-sm">Seller receives</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">~80% of note price</span>
                    </div>
                    <div className="h-px bg-border" />
                    <p className="text-muted-foreground text-sm">Platform earns (total 22%):</p>
                    <BulletList items={[
                      "18% service charge (from seller)",
                      "2% transaction handling fee (from seller)",
                      "2% transaction handling fee (from buyer)"
                    ]} />
                    <p className="text-xs text-muted-foreground italic pt-1">Final settlement may vary slightly by payment method.</p>
                  </div>
                </div>
              </div>
            </section>

            <div className="h-px bg-gradient-to-r from-transparent via-indigo-200 dark:via-indigo-800/60 to-transparent" />

            {/* Pricing Clause */}
            <section>
              <Section title="Pricing Clause" />
              <div className="space-y-4 text-sm">
                <div>
                  <SubSection title="1. Seller Pricing Guidelines" />
                  <BulletList items={[
                    "Sellers may set their own prices",
                    "Minimum price per note: ₹20",
                    "Maximum price per note: ₹50",
                    "Prices must reasonably reflect content quality",
                    "The admin reserves the right to reject notes with unreasonable pricing"
                  ]} />
                </div>

                <div>
                  <SubSection title="2. Buyer Payment Terms" />
                  <BulletList items={[
                    "Listed note price + 2% platform transaction handling fee",
                    "Payments are processed via secure third-party gateways",
                    "Instant access is granted after successful payment",
                    "No refunds after download, except for verified quality issues approved by admin"
                  ]} />
                </div>

                <div>
                  <SubSection title="3. Seller Payout Terms" />
                  <BulletList items={[
                    "Sellers receive approximately 80% of the listed note price",
                    "Deductions: 18% service charge + 2% transaction fee",
                    "Earnings are credited instantly to seller wallet after each sale",
                    "Minimum withdrawal: ₹100 · Maximum per transaction: ₹500",
                    "Processing time: 1–2 business days · Valid UPI ID mandatory"
                  ]} />
                </div>

                <div>
                  <SubSection title="4. Transaction Example (for a ₹100 note)" />
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-blue-200 dark:border-blue-800/50 bg-blue-50/60 dark:bg-blue-950/20 p-3">
                      <p className="text-xs font-bold text-blue-600 dark:text-blue-400 mb-2 uppercase tracking-wide">Buyer Side</p>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <div className="flex justify-between"><span>Note price</span><span>₹100</span></div>
                        <div className="flex justify-between"><span>Fee (2%)</span><span>₹2</span></div>
                        <div className="flex justify-between font-semibold text-foreground border-t border-blue-200 dark:border-blue-800/40 pt-1 mt-1">
                          <span>Total payable</span><span className="text-blue-600 dark:text-blue-400">₹102</span>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/60 dark:bg-emerald-950/20 p-3">
                      <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-2 uppercase tracking-wide">Seller Side</p>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <div className="flex justify-between"><span>Service (18%)</span><span>−₹18</span></div>
                        <div className="flex justify-between"><span>Txn fee (2%)</span><span>−₹2</span></div>
                        <div className="flex justify-between font-semibold text-foreground border-t border-emerald-200 dark:border-emerald-800/40 pt-1 mt-1">
                          <span>Seller receives</span><span className="text-emerald-600 dark:text-emerald-400">₹80</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <div className="h-px bg-gradient-to-r from-transparent via-indigo-200 dark:via-indigo-800/60 to-transparent" />

            {/* Notes Rating System */}
            <section>
              <Section title="Notes Rating System" />
              <div className="space-y-4 text-sm">
                <div>
                  <SubSection title="1. Rating Criteria" />
                  <BulletList items={[
                    "Buyers may rate notes from 1 to 5 stars",
                    "Ratings based on quality, clarity, and usefulness",
                    "Only verified buyers can rate — one rating per buyer per note"
                  ]} />
                </div>
                <div>
                  <SubSection title="2. Quality Standards" />
                  <BulletList items={[
                    "Minimum note length: 3 pages",
                    "Automated checks: duplicate detection, blank page detection, quality scan, copyright check",
                    "Admin approval required before notes go live",
                    "Notes with average rating below 2 stars may be delisted",
                    "Repeated low-quality uploads may result in seller restrictions"
                  ]} />
                </div>
                <div>
                  <SubSection title="3. Fair Use Policy" />
                  <BulletList items={[
                    "Fake or manipulated ratings are prohibited",
                    "Sellers cannot rate their own notes",
                    "Abusive or spam reviews will be removed",
                    "Admin may suspend accounts violating rating policies"
                  ]} />
                </div>
              </div>
            </section>

            <div className="h-px bg-gradient-to-r from-transparent via-indigo-200 dark:via-indigo-800/60 to-transparent" />

            {/* General Terms */}
            <section>
              <Section title="General Terms" />
              <div className="space-y-3 text-sm text-muted-foreground">
                {[
                  { title: "Account Security", body: "Users are responsible for maintaining account confidentiality. All activity under an account is the user's responsibility." },
                  { title: "Content Ownership", body: "Sellers retain ownership of uploaded notes but grant the platform a non-exclusive license to distribute them. Buyers receive a personal, non-transferable license for study purposes only." },
                  { title: "Prohibited Content", body: "Copyrighted, plagiarized, or offensive material is strictly prohibited and may result in account suspension." },
                  { title: "Platform Rights", body: "We reserve the right to modify these terms, suspend or terminate accounts, and remove content that violates platform policies." },
                  { title: "Dispute Resolution", body: "Disputes will be handled through our support system. Serious disputes may be resolved through arbitration as per applicable laws." },
                ].map(({ title, body }) => (
                  <div key={title} className="rounded-xl border border-border bg-muted/20 dark:bg-white/[0.02] p-3">
                    <p className="font-semibold text-foreground text-sm mb-1">{title}</p>
                    <p>{body}</p>
                  </div>
                ))}
              </div>
            </section>

            <div className="rounded-xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 px-4 py-3 text-xs text-muted-foreground">
              Last updated: March 9, 2026. By using this platform, you agree to these terms and conditions.
            </div>

          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
