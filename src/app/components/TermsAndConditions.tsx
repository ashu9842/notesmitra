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
                        "18% per sale, charged to the seller (non-premium buyers: 18% of original price; premium buyers: 18% of discounted price)",
                        "Covers platform infrastructure, hosting, moderation, quality checks, admin review, and customer support"
                      ]} />
                    </div>
                    <div className="rounded-xl border border-violet-100 dark:border-violet-900/50 bg-violet-50/50 dark:bg-violet-950/20 p-3">
                      <p className="font-medium text-foreground mb-1.5">Platform Transaction Handling Fee</p>
                      <BulletList items={[
                        "2% platform handling fee (charged to buyer only for non-premium buyers)",
                        "No transaction fee for premium buyers",
                        "For platform-level order processing, transaction tracking, security monitoring, and settlement handling"
                      ]} />
                    </div>
                    <div className="rounded-xl border border-amber-100 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 p-3">
                      <p className="font-medium text-foreground mb-1.5">Payment Gateway Fee</p>
                      <BulletList items={[
                        return (
                          <Dialog open={isOpen} onOpenChange={onClose}>
                            <DialogContent className="sm:max-w-2xl max-h-[85vh] p-0 overflow-hidden">
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
                                <div className="space-y-7 pb-4 text-sm">
                                  <section>
                                    <h3 className="font-bold mb-2">Service Structure</h3>
                                    <div className="mb-3">
                                      <span className="font-semibold">Platform Fees</span>
                                      <ul className="list-disc ml-6">
                                        <li><b>Platform Service Charge (Seller-side):</b></li>
                                        <ul className="list-disc ml-6">
                                          <li>18% per sale, charged to the seller (non-premium buyers: 18% of original price; premium buyers: 18% of discounted price)</li>
                                          <li>Covers platform infrastructure, hosting, moderation, quality checks, admin review, and customer support</li>
                                        </ul>
                                        <li><b>Platform Transaction Handling Fee:</b></li>
                                        <ul className="list-disc ml-6">
                                          <li>2% platform handling fee (charged to buyer only for non-premium buyers)</li>
                                          <li>No transaction fee for premium buyers</li>
                                          <li>For platform-level order processing, transaction tracking, security monitoring, and settlement handling</li>
                                        </ul>
                                        <li><b>Payment Gateway Fee:</b></li>
                                        <ul className="list-disc ml-6">
                                          <li>Applied directly by third-party providers (Razorpay, Paytm, etc.)</li>
                                          <li>Vary by payment method — not controlled or fixed by the platform</li>
                                          <li>The platform does not guarantee exact settlement amounts</li>
                                        </ul>
                                      </ul>
                                    </div>
                                    <div className="mb-3">
                                      <span className="font-semibold">Earnings & Distribution (Indicative)</span>
                                      <ul className="list-disc ml-6">
                                        <li>Seller receives: <b>80% of original note price</b></li>
                                        <li>Platform earns:</li>
                                        <ul className="list-disc ml-6">
                                          <li>18% service charge (from seller; non-premium: 18% of original price, premium: 18% of discounted price)</li>
                                          <li>2% transaction handling fee (from buyer; non-premium only)</li>
                                        </ul>
                                        <li>Final settlement may vary slightly by payment method.</li>
                                      </ul>
                                    </div>
                                  </section>
                                  <section>
                                    <h3 className="font-bold mb-2">Pricing Clause</h3>
                                    <div className="mb-3">
                                      <span className="font-semibold">1. Seller Pricing Guidelines</span>
                                      <ul className="list-disc ml-6">
                                        <li>Sellers may set their own prices</li>
                                        <li>Minimum price per note: ₹20</li>
                                        <li>Maximum price per note: ₹50</li>
                                        <li>Prices must reasonably reflect content quality</li>
                                        <li>The admin reserves the right to reject notes with unreasonable pricing</li>
                                      </ul>
                                    </div>
                                    <div className="mb-3">
                                      <span className="font-semibold">2. Buyer Payment Terms</span>
                                      <ul className="list-disc ml-6">
                                        <li>Non-premium buyers: Listed note price + 2% platform transaction handling fee</li>
                                        <li>Premium buyers: 5% discount on listed price, no transaction fee</li>
                                        <li>Payments are processed via secure third-party gateways</li>
                                        <li>Instant access is granted after successful payment</li>
                                        <li>No refunds after download, except for verified quality issues approved by admin</li>
                                      </ul>
                                    </div>
                                    <div className="mb-3">
                                      <span className="font-semibold">3. Seller Payout Terms</span>
                                      <ul className="list-disc ml-6">
                                        <li>Sellers receive 80% of the original note price (regardless of buyer type)</li>
                                        <li>Platform commission: 18% of original price (non-premium buyers), 18% of discounted price (premium buyers)</li>
                                        <li>No 2% transaction fee is deducted from seller earnings for premium buyers</li>
                                        <li>Earnings are credited instantly to seller wallet after each sale</li>
                                        <li>Minimum withdrawal: ₹100 · Maximum per transaction: ₹500</li>
                                        <li>Processing time: 1–2 business days · Valid UPI ID mandatory</li>
                                      </ul>
                                    </div>
                                    <div className="mb-3">
                                      <span className="font-semibold">4. Transaction Example (for a ₹100 note)</span>
                                      <div className="mt-2">
                                        <div className="mb-2">
                                          <span className="font-semibold">Non-Premium Buyer</span>
                                          <ul className="list-disc ml-6">
                                            <li>Note price: ₹100</li>
                                            <li>Fee (2%): <span className="text-red-600">-₹2</span></li>
                                            <li><b>Total payable: ₹102</b></li>
                                          </ul>
                                          <span className="font-semibold">Seller Side (Non-Premium Buyer)</span>
                                          <ul className="list-disc ml-6">
                                            <li>Seller receives (80% of original): <span className="text-green-700">₹80</span></li>
                                            <li>Platform commission (18% of original): <span className="text-red-600">-₹18</span></li>
                                          </ul>
                                        </div>
                                        <span className="font-semibold">Premium Buyer</span>
                                        <ul className="list-disc ml-6">
                                          <li>Note price: ₹100</li>
                                          <li>Discount (5%): <span className="text-red-600">-₹5</span></li>
                                          <li><b>Total payable: ₹95</b></li>
                                        </ul>
                                        <span className="font-semibold">Seller Side (Premium Buyer)</span>
                                        <ul className="list-disc ml-6">
                                          <li>Seller receives (80% of original): <span className="text-green-700">₹80</span></li>
                                          <li>Platform commission (18% of discounted): <span className="text-red-600">-₹17.10</span></li>
                                        </ul>
                                      </div>
                                    </div>
                                  </section>
                                  <section>
                                    <h3 className="font-bold mb-2">Notes Rating System</h3>
                                    <div className="mb-3">
                                      <span className="font-semibold">1. Rating Criteria</span>
                                      <ul className="list-disc ml-6">
                                        <li>Buyers may rate notes from 1 to 5 stars</li>
                                        <li>Ratings based on quality, clarity, and usefulness</li>
                                        <li>Only verified buyers can rate — one rating per buyer per note</li>
                                      </ul>
                                    </div>
                                    <div className="mb-3">
                                      <span className="font-semibold">2. Quality Standards</span>
                                      <ul className="list-disc ml-6">
                                        <li>Minimum note length: 3 pages</li>
                                        <li>Automated checks: duplicate detection, blank page detection, quality scan, copyright check</li>
                                        <li>Admin approval required before notes go live</li>
                                        <li>Notes with average rating below 2 stars may be delisted</li>
                                        <li>Repeated low-quality uploads may result in seller restrictions</li>
                                      </ul>
                                    </div>
                                    <div className="mb-3">
                                      <span className="font-semibold">3. Fair Use Policy</span>
                                      <ul className="list-disc ml-6">
                                        <li>Fake or manipulated ratings are prohibited</li>
                                        <li>Sellers cannot rate their own notes</li>
                                        <li>Abusive or spam reviews will be removed</li>
                                        <li>Admin may suspend accounts violating rating policies</li>
                                      </ul>
                                    </div>
                                  </section>
                                  <section>
                                    <h3 className="font-bold mb-2">General Terms</h3>
                                    <div className="mb-3">
                                      <span className="font-semibold">Account Security</span>
                                      <div>Users are responsible for maintaining account confidentiality. All activity under an account is the user's responsibility.</div>
                                    </div>
                                    <div className="mb-3">
                                      <span className="font-semibold">Content Ownership</span>
                                      <div>Sellers retain ownership of uploaded notes but grant the platform a non-exclusive license to distribute them. Buyers receive a personal, non-transferable license for study purposes only.</div>
                                    </div>
                                    <div className="mb-3">
                                      <span className="font-semibold">Prohibited Content</span>
                                      <div>Copyrighted, plagiarized, or offensive material is strictly prohibited and may result in account suspension.</div>
                                    </div>
                                    <div className="mb-3">
                                      <span className="font-semibold">Platform Rights</span>
                                      <div>We reserve the right to modify these terms, suspend or terminate accounts, and remove content that violates platform policies.</div>
                                    </div>
                                    <div className="mb-3">
                                      <span className="font-semibold">Dispute Resolution</span>
                                      <div>Disputes will be handled through our support system. Serious disputes may be resolved through arbitration as per applicable laws.</div>
                                    </div>
                                  </section>
                                  <div className="rounded-xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 px-4 py-3 text-xs text-muted-foreground">
                                    Last updated: March 15, 2026. By using this platform, you agree to these terms and conditions.
                                  </div>
                                </div>
                              </ScrollArea>
                            </DialogContent>
                          </Dialog>
                        );
      </DialogContent>
