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
                    <div className="prose prose-sm dark:prose-invert max-w-none pb-4">
                      <h3>Service Structure</h3>
                      <h4>Platform Fees</h4>
                      <b>Platform Service Charge (Seller-side)</b>
                      <ul>
                        <li>18% per sale, charged to the seller (non-premium buyers: 18% of original price; premium buyers: 18% of discounted price)</li>
                        <li>Covers platform infrastructure, hosting, moderation, quality checks, admin review, and customer support</li>
                      </ul>
                      <b>Platform Transaction Handling Fee</b>
                      <ul>
                        <li>2% platform handling fee (charged to buyer only for non-premium buyers)</li>
                        <li>No transaction fee for premium buyers</li>
                        <li>For platform-level order processing, transaction tracking, security monitoring, and settlement handling</li>
                      </ul>
                      <b>Payment Gateway Fee</b>
                      <ul>
                        <li>Applied directly by third-party providers (Razorpay, Paytm, etc.)</li>
                        <li>Vary by payment method — not controlled or fixed by the platform</li>
                        <li>The platform does not guarantee exact settlement amounts</li>
                      </ul>
                      <h4>Earnings & Distribution (Indicative)</h4>
                      <b>Seller receives</b>
                      <ul>
                        <li>80% of original note price</li>
                      </ul>
                      <b>Platform earns:</b>
                      <ul>
                        <li>18% service charge (from seller; non-premium: 18% of original price, premium: 18% of discounted price)</li>
                        <li>2% transaction handling fee (from buyer; non-premium only)</li>
                        <li>Final settlement may vary slightly by payment method.</li>
                      </ul>
                      <h3>Pricing Clause</h3>
                      <b>1. Seller Pricing Guidelines</b>
                      <ul>
                        <li>Sellers may set their own prices</li>
                        <li>Minimum price per note: ₹20</li>
                        <li>Maximum price per note: ₹50</li>
                        <li>Prices must reasonably reflect content quality</li>
                        <li>The admin reserves the right to reject notes with unreasonable pricing</li>
                      </ul>
                      <b>2. Buyer Payment Terms</b>
                      <ul>
                        <li>Non-premium buyers: Listed note price + 2% platform transaction handling fee</li>
                        <li>Premium buyers: 5% discount on listed price, no transaction fee</li>
                        <li>Payments are processed via secure third-party gateways</li>
                        <li>Instant access is granted after successful payment</li>
                        <li>No refunds after download, except for verified quality issues approved by admin</li>
                      </ul>
                      <b>3. Seller Payout Terms</b>
                      <ul>
                        <li>Sellers receive 80% of the original note price (regardless of buyer type)</li>
                        <li>Platform commission: 18% of original price (non-premium buyers), 18% of discounted price (premium buyers)</li>
                        <li>No 2% transaction fee is deducted from seller earnings for premium buyers</li>
                        <li>Earnings are credited instantly to seller wallet after each sale</li>
                        <li>Minimum withdrawal: ₹100 · Maximum per transaction: ₹500</li>
                        <li>Processing time: 1–2 business days · Valid UPI ID mandatory</li>
                      </ul>
                      <b>4. Transaction Example (for a ₹100 note)</b>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <b>Non-Premium Buyer</b>
                          <ul>
                            <li>Note price: ₹100</li>
                            <li>Fee (2%): ₹2</li>
                            <li><b>Total payable: ₹102</b></li>
                          </ul>
                          <b>Seller Side (Non-Premium Buyer)</b>
                          <ul>
                            <li>Seller receives (80% of original): ₹80</li>
                            <li>Platform commission (18% of original): <span className="text-red-600">−₹18</span></li>
                          </ul>
                        </div>
                        <div>
                          <b>Premium Buyer</b>
                          <ul>
                            <li>Note price: ₹100</li>
                            <li>Discount (5%): <span className="text-red-600">−₹5</span></li>
                            <li><b>Total payable: ₹95</b></li>
                          </ul>
                          <b>Seller Side (Premium Buyer)</b>
                          <ul>
                            <li>Seller receives (80% of original): ₹80</li>
                            <li>Platform commission (18% of discounted): <span className="text-red-600">−₹17.10</span></li>
                          </ul>
                        </div>
                      </div>
                      <h3>Notes Rating System</h3>
                      <b>1. Rating Criteria</b>
                      <ul>
                        <li>Buyers may rate notes from 1 to 5 stars</li>
                        <li>Ratings based on quality, clarity, and usefulness</li>
                        <li>Only verified buyers can rate — one rating per buyer per note</li>
                      </ul>
                      <b>2. Quality Standards</b>
                      <ul>
                        <li>Minimum note length: 3 pages</li>
                        <li>Automated checks: duplicate detection, blank page detection, quality scan, copyright check</li>
                        <li>Admin approval required before notes go live</li>
                        <li>Notes with average rating below 2 stars may be delisted</li>
                        <li>Repeated low-quality uploads may result in seller restrictions</li>
                      </ul>
                      <b>3. Fair Use Policy</b>
                      <ul>
                        <li>Fake or manipulated ratings are prohibited</li>
                        <li>Sellers cannot rate their own notes</li>
                        <li>Abusive or spam reviews will be removed</li>
                        <li>Admin may suspend accounts violating rating policies</li>
                      </ul>
                      <h3>General Terms</h3>
                      <b>Account Security</b>
                      <ul>
                        <li>Users are responsible for maintaining account confidentiality. All activity under an account is the user's responsibility.</li>
                      </ul>
                      <b>Content Ownership</b>
                      <ul>
                        <li>Sellers retain ownership of uploaded notes but grant the platform a non-exclusive license to distribute them. Buyers receive a personal, non-transferable license for study purposes only.</li>
                      </ul>
                      <b>Prohibited Content</b>
                      <ul>
                        <li>Copyrighted, plagiarized, or offensive material is strictly prohibited and may result in account suspension.</li>
                      </ul>
                      <b>Platform Rights</b>
                      <ul>
                        <li>We reserve the right to modify these terms, suspend or terminate accounts, and remove content that violates platform policies.</li>
                      </ul>
                      <b>Dispute Resolution</b>
                      <ul>
                        <li>Disputes will be handled through our support system. Serious disputes may be resolved through arbitration as per applicable laws.</li>
                      </ul>
                      <div className="text-xs text-muted-foreground mt-2">Last updated: March 15, 2026. By using this platform, you agree to these terms and conditions.</div>
                    </div>
                  </ScrollArea>
                </DialogContent>
              </Dialog>
            );
                    <div className="rounded-xl border border-amber-100 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 p-3">
                      <p className="font-medium text-foreground mb-1.5">Payment Gateway Fee</p>
                      <BulletList items={[
                        "1.8% + ₹3 per transaction (charged to seller)",
                        "Covers payment gateway processing, settlement, and refund handling"
                      ]} />
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
                                                <div className="prose prose-sm dark:prose-invert max-w-none pb-4">
                                                  <h3>Service Structure</h3>
                                                  <h4>Platform Fees</h4>
                                                  <ul>
                                                    <li><b>Platform Service Charge (Seller-side):</b> 18% per sale, charged to the seller (non-premium buyers: 18% of original price; premium buyers: 18% of discounted price). Covers platform infrastructure, hosting, moderation, quality checks, admin review, and customer support.</li>
                                                    <li><b>Platform Transaction Handling Fee:</b> 2% platform handling fee (charged to buyer only for non-premium buyers). No transaction fee for premium buyers. For platform-level order processing, transaction tracking, security monitoring, and settlement handling.</li>
                                                    <li><b>Payment Gateway Fee:</b> Applied directly by third-party providers (Razorpay, Paytm, etc.). Vary by payment method — not controlled or fixed by the platform. The platform does not guarantee exact settlement amounts.</li>
                                                  </ul>
                                                  <h4>Earnings & Distribution (Indicative)</h4>
                                                  <ul>
                                                    <li><b>Seller receives:</b> <span className="text-green-700 dark:text-green-400">80% of original note price</span></li>
                                                    <li><b>Platform earns:</b> 18% service charge (from seller; non-premium: 18% of original price, premium: 18% of discounted price), 2% transaction handling fee (from buyer; non-premium only)</li>
                                                    <li>Final settlement may vary slightly by payment method.</li>
                                                  </ul>
                                                  <h3>Pricing Clause</h3>
                                                  <h4>1. Seller Pricing Guidelines</h4>
                                                  <ul>
                                                    <li>Sellers may set their own prices</li>
                                                    <li>Minimum price per note: ₹20</li>
                                                    <li>Maximum price per note: ₹50</li>
                                                    <li>Prices must reasonably reflect content quality</li>
                                                    <li>The admin reserves the right to reject notes with unreasonable pricing</li>
                                                  </ul>
                                                  <h4>2. Buyer Payment Terms</h4>
                                                  <ul>
                                                    <li>Non-premium buyers: Listed note price + 2% platform transaction handling fee</li>
                                                    <li>Premium buyers: 5% discount on listed price, no transaction fee</li>
                                                    <li>Payments are processed via secure third-party gateways</li>
                                                    <li>Instant access is granted after successful payment</li>
                                                    <li>No refunds after download, except for verified quality issues approved by admin</li>
                                                  </ul>
                                                  <h4>3. Seller Payout Terms</h4>
                                                  <ul>
                                                    <li>Sellers receive 80% of the original note price (regardless of buyer type)</li>
                                                    <li>Platform commission: 18% of original price (non-premium buyers), 18% of discounted price (premium buyers)</li>
                                                    <li>No 2% transaction fee is deducted from seller earnings for premium buyers</li>
                                                    <li>Earnings are credited instantly to seller wallet after each sale</li>
                                                    <li>Minimum withdrawal: ₹100 · Maximum per transaction: ₹500</li>
                                                    <li>Processing time: 1–2 business days · Valid UPI ID mandatory</li>
                                                  </ul>
                                                  <h4>4. Transaction Example (for a ₹100 note)</h4>
                                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    <div className="rounded-lg border p-3 bg-indigo-50/60 dark:bg-indigo-950/20">
                                                      <div className="font-semibold mb-1">Non-Premium Buyer</div>
                                                      <div className="flex justify-between"><span>Note price</span><span>₹100</span></div>
                                                      <div className="flex justify-between"><span>Fee (2%)</span><span className="text-red-600 dark:text-red-400">−₹2</span></div>
                                                      <div className="flex justify-between font-bold"><span>Total payable</span><span>₹102</span></div>
                                                    </div>
                                                    <div className="rounded-lg border p-3 bg-violet-50/60 dark:bg-violet-950/20">
                                                      <div className="font-semibold mb-1">Seller Side (Non-Premium Buyer)</div>
                                                      <div className="flex justify-between"><span>Seller receives (80% of original)</span><span className="text-green-700 dark:text-green-400">₹80</span></div>
                                                      <div className="flex justify-between"><span>Platform commission (18% of original)</span><span className="text-red-600 dark:text-red-400">−₹18</span></div>
                                                    </div>
                                                    <div className="rounded-lg border p-3 bg-indigo-50/60 dark:bg-indigo-950/20">
                                                      <div className="font-semibold mb-1">Premium Buyer</div>
                                                      <div className="flex justify-between"><span>Note price</span><span>₹100</span></div>
                                                      <div className="flex justify-between"><span>Discount (5%)</span><span className="text-red-600 dark:text-red-400">−₹5</span></div>
                                                      <div className="flex justify-between font-bold"><span>Total payable</span><span>₹95</span></div>
                                                    </div>
                                                    <div className="rounded-lg border p-3 bg-violet-50/60 dark:bg-violet-950/20">
                                                      <div className="font-semibold mb-1">Seller Side (Premium Buyer)</div>
                                                      <div className="flex justify-between"><span>Seller receives (80% of original)</span><span className="text-green-700 dark:text-green-400">₹80</span></div>
                                                      <div className="flex justify-between"><span>Platform commission (18% of discounted)</span><span className="text-red-600 dark:text-red-400">−₹17.10</span></div>
                                                    </div>
                                                  </div>
                                                  <h3>Notes Rating System</h3>
                                                  <h4>1. Rating Criteria</h4>
                                                  <ul>
                                                    <li>Buyers may rate notes from 1 to 5 stars</li>
                                                    <li>Ratings based on quality, clarity, and usefulness</li>
                                                    <li>Only verified buyers can rate — one rating per buyer per note</li>
                                                  </ul>
                                                  <h4>2. Quality Standards</h4>
                                                  <ul>
                                                    <li>Minimum note length: 3 pages</li>
                                                    <li>Automated checks: duplicate detection, blank page detection, quality scan, copyright check</li>
                                                    <li>Admin approval required before notes go live</li>
                                                    <li>Notes with average rating below 2 stars may be delisted</li>
                                                    <li>Repeated low-quality uploads may result in seller restrictions</li>
                                                  </ul>
                                                  <h4>3. Fair Use Policy</h4>
                                                  <ul>
                                                    <li>Fake or manipulated ratings are prohibited</li>
                                                    <li>Sellers cannot rate their own notes</li>
                                                    <li>Abusive or spam reviews will be removed</li>
                                                    <li>Admin may suspend accounts violating rating policies</li>
                                                  </ul>
                                                  <h3>General Terms</h3>
                                                  <h4>Account Security</h4>
                                                  <p>Users are responsible for maintaining account confidentiality. All activity under an account is the user's responsibility.</p>
                                                  <h4>Content Ownership</h4>
                                                  <p>Sellers retain ownership of uploaded notes but grant the platform a non-exclusive license to distribute them. Buyers receive a personal, non-transferable license for study purposes only.</p>
                                                  <h4>Prohibited Content</h4>
                                                  <p>Copyrighted, plagiarized, or offensive material is strictly prohibited and may result in account suspension.</p>
                                                  <h4>Platform Rights</h4>
                                                  <p>We reserve the right to modify these terms, suspend or terminate accounts, and remove content that violates platform policies.</p>
                                                  <h4>Dispute Resolution</h4>
                                                  <p>Disputes will be handled through our support system. Serious disputes may be resolved through arbitration as per applicable laws.</p>
                                                  <div className="text-xs text-muted-foreground mt-2">Last updated: March 15, 2026. By using this platform, you agree to these terms and conditions.</div>
                                                </div>
                                              </ScrollArea>
      </DialogContent>
    </Dialog>
  );
