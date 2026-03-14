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

            {/* ── Service Structure ── */}
            <div>
              <Section title="Service Structure" />

              <div className="space-y-4">
                <SubSection title="Platform Fees" />

                <div>
                  <p className="text-sm font-semibold text-foreground mb-1.5">Platform Service Charge (Seller-side)</p>
                  <BulletList items={[
                    "18% per sale, charged to the seller (non-premium buyers: 18% of original price; premium buyers: 18% of discounted price)",
                    "Covers platform infrastructure, hosting, moderation, quality checks, admin review, and customer support",
                  ]} />
                </div>

                <div>
                  <p className="text-sm font-semibold text-foreground mb-1.5">Platform Transaction Handling Fee</p>
                  <BulletList items={[
                    "2% platform handling fee (charged to buyer only for non-premium buyers)",
                    "No transaction fee for premium buyers",
                    "For platform-level order processing, transaction tracking, security monitoring, and settlement handling",
                  ]} />
                </div>

                <div className="rounded-xl border border-amber-100 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 p-3">
                  <p className="font-medium text-foreground mb-1.5">Payment Gateway Fee</p>
                  <BulletList items={[
                    "Applied directly by third-party providers (Razorpay, Paytm, etc.)",
                    "Vary by payment method — not controlled or fixed by the platform",
                    "The platform does not guarantee exact settlement amounts",
                  ]} />
                </div>

                <SubSection title="Earnings & Distribution (Indicative)" />

                <div>
                  <p className="text-sm font-semibold text-foreground mb-1.5">Seller receives</p>
                  <BulletList items={[
                    <span key="seller"><span className="text-green-700 dark:text-green-400 font-semibold">80%</span> of original note price</span>
                  ]} />
                </div>

                <div>
                  <p className="text-sm font-semibold text-foreground mb-1.5">Platform earns:</p>
                  <BulletList items={[
                    "18% service charge (from seller; non-premium: 18% of original price, premium: 18% of discounted price)",
                    "2% transaction handling fee (from buyer; non-premium only)",
                    "Final settlement may vary slightly by payment method.",
                  ]} />
                </div>
              </div>
            </div>

            {/* ── Pricing Clause ── */}
            <div>
              <Section title="Pricing Clause" />

              <div className="space-y-4">
                <div>
                  <SubSection title="1. Seller Pricing Guidelines" />
                  <BulletList items={[
                    "Sellers may set their own prices",
                    "Minimum price per note: ₹20",
                    "Maximum price per note: ₹50",
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
                    "Minimum withdrawal: ₹100 · Maximum per transaction: ₹500",
                    "Processing time: 1–2 business days · Valid UPI ID mandatory",
                  ]} />
                </div>

                <div>
                  <SubSection title="4. Transaction Example (for a ₹100 note)" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">

                    <div className="rounded-lg border p-3 bg-indigo-50/60 dark:bg-indigo-950/20">
                      <p className="font-semibold text-sm mb-2">Non-Premium Buyer</p>
                      <div className="flex justify-between text-sm"><span>Note price</span><span>₹100</span></div>
                      <div className="flex justify-between text-sm"><span>Fee (2%)</span><span className="text-red-600 dark:text-red-400">−₹2</span></div>
                      <div className="flex justify-between text-sm font-bold mt-1 border-t pt-1"><span>Total payable</span><span>₹102</span></div>
                    </div>

                    <div className="rounded-lg border p-3 bg-violet-50/60 dark:bg-violet-950/20">
                      <p className="font-semibold text-sm mb-2">Seller Side (Non-Premium Buyer)</p>
                      <div className="flex justify-between text-sm"><span>Seller receives (80% of original)</span><span className="text-green-700 dark:text-green-400">₹80</span></div>
                      <div className="flex justify-between text-sm"><span>Platform commission (18% of original)</span><span className="text-red-600 dark:text-red-400">−₹18</span></div>
                    </div>

                    <div className="rounded-lg border p-3 bg-indigo-50/60 dark:bg-indigo-950/20">
                      <p className="font-semibold text-sm mb-2">Premium Buyer</p>
                      <div className="flex justify-between text-sm"><span>Note price</span><span>₹100</span></div>
                      <div className="flex justify-between text-sm"><span>Discount (5%)</span><span className="text-red-600 dark:text-red-400">−₹5</span></div>
                      <div className="flex justify-between text-sm font-bold mt-1 border-t pt-1"><span>Total payable</span><span>₹95</span></div>
                    </div>

                    <div className="rounded-lg border p-3 bg-violet-50/60 dark:bg-violet-950/20">
                      <p className="font-semibold text-sm mb-2">Seller Side (Premium Buyer)</p>
                      <div className="flex justify-between text-sm"><span>Seller receives (80% of original)</span><span className="text-green-700 dark:text-green-400">₹80</span></div>
                      <div className="flex justify-between text-sm"><span>Platform commission (18% of discounted)</span><span className="text-red-600 dark:text-red-400">−₹17.10</span></div>
                    </div>

                  </div>
                </div>
              </div>
            </div>

            {/* ── Notes Rating System ── */}
            <div>
              <Section title="Notes Rating System" />

              <div className="space-y-4">
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

            {/* ── General Terms ── */}
            <div>
              <Section title="General Terms" />

              <div className="space-y-4">
                <div>
                  <SubSection title="Account Security" />
                  <p className="text-sm text-muted-foreground">
                    Users are responsible for maintaining account confidentiality. All activity under an account is the user's responsibility.
                  </p>
                </div>

                <div>
                  <SubSection title="Content Ownership" />
                  <p className="text-sm text-muted-foreground">
                    Sellers retain ownership of uploaded notes but grant the platform a non-exclusive license to distribute them. Buyers receive a personal, non-transferable license for study purposes only.
                  </p>
                </div>

                <div>
                  <SubSection title="Prohibited Content" />
                  <p className="text-sm text-muted-foreground">
                    Copyrighted, plagiarized, or offensive material is strictly prohibited and may result in account suspension.
                  </p>
                </div>

                <div>
                  <SubSection title="Platform Rights" />
                  <p className="text-sm text-muted-foreground">
                    We reserve the right to modify these terms, suspend or terminate accounts, and remove content that violates platform policies.
                  </p>
                </div>

                <div>
                  <SubSection title="Dispute Resolution" />
                  <p className="text-sm text-muted-foreground">
                    Disputes will be handled through our support system. Serious disputes may be resolved through arbitration as per applicable laws.
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <p className="text-xs text-muted-foreground pt-2 border-t border-border">
              Last updated: March 15, 2026. By using this platform, you agree to these terms and conditions.
            </p>

          </div>
        </ScrollArea>

      </DialogContent>
    </Dialog>
  );
}