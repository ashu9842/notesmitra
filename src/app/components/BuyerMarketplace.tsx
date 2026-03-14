import { useState, useEffect, useRef } from "react";
import { Search, FileText, ShoppingCart, Star, Download, Eye, Loader2, Crown, Bookmark, BookmarkCheck } from "lucide-react";
import { NotePdfIcon } from "./NotePdfIcon";
import { ProtectedPdfCanvas } from "./ProtectedPdfCanvas";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { toast } from "sonner";
import { razorpayAPI, notesAPI, paymentAPI } from "../../utils/api-mern";
import { formatClientErrorMessage } from "../../utils/errorMessages";

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface Note {
  id: string;
  title: string;
  subject: string;
  course: string;
  price: number;
  pages?: number;
  uploadDate: string;
  status: string;
  sold?: boolean;
  rating?: number;
  downloads?: number;
  isFeatured?: boolean;
  sellerSubscriptionType?: string;
  ratings?: { userId: string; rating: number; comment?: string; date: string }[];
}

interface BuyerMarketplaceProps {
  notes: Note[];
  purchasedNotes: string[];
  onPurchase: (noteId: string) => void;
  isLoggedIn: boolean;
  onLoginRequired: () => void;
  buyerPremium?: { active: boolean };
  onUpgradePremium?: () => void;
  onRateNote?: (noteId: string, rating: number, comment?: string) => Promise<void> | void;
  currentUserId?: string;
  walletBalance?: number;
  userName?: string;
  userEmail?: string;
  userPhone?: string;
  onSavePhone?: (phone: string) => Promise<void>;
  isLoading?: boolean;
  errorMessage?: string | null;
  onDownloadSuccess?: (noteId: string, counted?: boolean) => void;
}

export function BuyerMarketplace({ notes, purchasedNotes, onPurchase, isLoggedIn, onLoginRequired, buyerPremium, onUpgradePremium, onRateNote, currentUserId, walletBalance = 0, userName, userEmail, userPhone, onSavePhone, isLoading = false, errorMessage, onDownloadSuccess }: BuyerMarketplaceProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("all");
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [showRatingDialog, setShowRatingDialog] = useState(false);
  const [ratingValue, setRatingValue] = useState(5);
  const [ratingComment, setRatingComment] = useState("");
  const [paymentStep, setPaymentStep] = useState<"confirm" | "processing" | "success">("confirm");
  const [activeTab, setActiveTab] = useState<"marketplace" | "purchases" | "downloads">("marketplace");
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());
  const [localPhone, setLocalPhone] = useState(userPhone || '');
  const [bookmarkedNotes, setBookmarkedNotes] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('nm-bookmarks') || '[]'); } catch { return []; }
  });

  const FREE_BOOKMARK_LIMIT = 10;
  const now = Date.now();
  const EARLY_ACCESS_MS = 24 * 60 * 60 * 1000;
  const isEarlyAccess = (note: Note) => now - new Date(note.uploadDate).getTime() < EARLY_ACCESS_MS;

  const liveNotes = notes.filter(note => note.status === "approved");

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Search Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-10 bg-gray-100 rounded" />
          </CardContent>
        </Card>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((idx) => (
            <Card key={`skeleton-${idx}`} className="animate-pulse">
              <CardHeader>
                <div className="h-6 w-3/4 bg-gray-100 rounded" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-100 rounded" />
                  <div className="h-4 w-2/3 bg-gray-100 rounded" />
                  <div className="h-10 bg-gray-100 rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-red-600">
          {formatClientErrorMessage(errorMessage)}
        </CardContent>
      </Card>
    );
  }

  const filteredNotes = liveNotes
    .filter(note => {
      const matchesSearch = note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           note.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           note.course.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesSubject = selectedSubject === "all" || note.subject === selectedSubject;
      return matchesSearch && matchesSubject;
    })
    // Featured notes first, then by date (early-access hidden for non-premium is handled in card render)
    .sort((a, b) => {
      if (a.isFeatured && !b.isFeatured) return -1;
      if (!a.isFeatured && b.isFeatured) return 1;
      return 0;
    });

  const subjects = ["all", ...Array.from(new Set(liveNotes.map(n => n.subject)))];

  const handleBuyClick = (note: Note) => {
    if (!isLoggedIn) {
      toast.error(formatClientErrorMessage("Please login to purchase notes"));
      onLoginRequired();
      return;
    }
    setSelectedNote(note);
    setLocalPhone(userPhone || '');
    setPaymentStep("confirm");
    setShowPaymentDialog(true);
  };

  const handleWalletPayment = async () => {
    if (!selectedNote) return;
    setPaymentStep("processing");
    try {
      await paymentAPI.purchase(selectedNote.id, 'wallet');
      if (localPhone && localPhone !== userPhone) {
        onSavePhone?.(localPhone).catch(() => {});
      }
      setPaymentStep("success");
      await new Promise(resolve => setTimeout(resolve, 1500));
      onPurchase(selectedNote.id);
      toast.success("Purchase successful! Notes are now available for download.");
      setShowPaymentDialog(false);
      setSelectedNote(null);
    } catch (error) {
      toast.error(formatClientErrorMessage(error, 'Payment failed. Please try again.'));
      setPaymentStep("confirm");
    }
  };

  const handleRazorpayPayment = async () => {
    if (!selectedNote) return;
    setPaymentStep("processing");

    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    const reconcileCompletedPurchase = async (noteId: string) => {
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          const purchasesData = await paymentAPI.getPurchases();
          const purchases = purchasesData.purchases || [];
          const purchased = purchases.some((purchase: any) => {
            const purchasedNoteId = purchase.noteId?._id || purchase.noteId;
            return purchasedNoteId === noteId;
          });

          if (purchased) {
            onPurchase(noteId);
            return true;
          }
        } catch {
          // ignore and retry briefly
        }

        if (attempt < 3) {
          await sleep(1500);
        }
      }

      return false;
    };

    try {
      const keyResponse = await razorpayAPI.getKey();
      const razorpayKey = keyResponse.key;
      const orderResponse = await razorpayAPI.createNoteOrder(selectedNote.id);
      const orderId = orderResponse.order.id;
      const options = {
        key: razorpayKey,
        amount: orderResponse.order.amount,
        currency: 'INR',
        name: 'NotesMitra',
        description: `Purchase: ${selectedNote.title}`,
        order_id: orderId,
        handler: async (response: any) => {
          try {
            await razorpayAPI.verifyNotePayment(
              selectedNote.id,
              response.razorpay_order_id,
              response.razorpay_payment_id,
              response.razorpay_signature
            );
            if (localPhone && localPhone !== userPhone) {
              onSavePhone?.(localPhone).catch(() => {});
            }
            setPaymentStep("success");
            await new Promise(resolve => setTimeout(resolve, 1500));
            onPurchase(selectedNote.id);
            toast.success("Purchase successful! Notes are now available for download.");
            setShowPaymentDialog(false);
            setSelectedNote(null);
          } catch (error) {
            const message = formatClientErrorMessage(error, 'Payment verification failed. Please try again.');
            const normalized = message.toLowerCase();

            if (normalized.includes('already purchased') || normalized.includes('already verified') || normalized.includes('already completed') || normalized.includes('already been processed')) {
              if (localPhone && localPhone !== userPhone) {
                onSavePhone?.(localPhone).catch(() => {});
              }
              setPaymentStep("success");
              await new Promise(resolve => setTimeout(resolve, 1200));
              onPurchase(selectedNote.id);
              toast.success("Payment was already processed. Notes are now available for download.");
              setShowPaymentDialog(false);
              setSelectedNote(null);
              return;
            }

            // Reconcile with backend in case payment was captured and webhook completed
            // while client-side verification returned an error/race.
            const reconciled = await reconcileCompletedPurchase(selectedNote.id);
            if (reconciled) {
              if (localPhone && localPhone !== userPhone) {
                onSavePhone?.(localPhone).catch(() => {});
              }
              setPaymentStep("success");
              await sleep(1200);
              toast.success("Payment captured successfully. Notes are now available for download.");
              setShowPaymentDialog(false);
              setSelectedNote(null);
              return;
            }

            toast.error(message);
            setPaymentStep("confirm");
          }
        },
        prefill: { name: userName || '', email: userEmail || '', contact: localPhone || '' },
        theme: { color: '#3B82F6' }
      };
      if (!window.Razorpay) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://checkout.razorpay.com/v1/checkout.js';
          s.onload = () => resolve();
          s.onerror = () => reject(new Error('Failed to load payment SDK'));
          document.head.appendChild(s);
        });
      }

      const rzp = new window.Razorpay(options);
      rzp.open();
      setPaymentStep("confirm");
    } catch (error) {
      toast.error(formatClientErrorMessage(error, 'Failed to initiate payment. Please try again.'));
      setPaymentStep("confirm");
    }
  };

  const handleDownload = async (note: Note) => {
    if (downloadingIds.has(note.id)) return;
    setDownloadingIds(prev => new Set(prev).add(note.id));
    try {
      const result = await notesAPI.download(note.id);
      onDownloadSuccess?.(note.id, result.counted);
      toast.success(`✓ Download successful! You can now access "${note.title}" offline.`, {
        duration: 5000,
      });
    } catch (error) {
      toast.error(formatClientErrorMessage(error, 'Download failed. Please try again.'));
    } finally {
      setDownloadingIds(prev => {
        const next = new Set(prev);
        next.delete(note.id);
        return next;
      });
    }
  };

  const handlePreview = async (note: Note) => {
    setSelectedNote(note);
    setPreviewUrl(null);
    setPreviewError(null);
    setPreviewLoading(true);
    setShowPreviewDialog(true);

    try {
      // Step 1: ask the server to generate the 7-page preview and return the file URL
      const data = await notesAPI.preview(note.id);
      const fileUrl: string = data.previewUrl;

      // Step 2: fetch the PDF bytes through the server with credentials so the
      // httpOnly auth cookie is sent.  Then create a blob: URL for the iframe.
      // Using a blob: URL instead of a direct server URL avoids two problems:
      //  • X-Frame-Options: SAMEORIGIN blocks iframes when the server port ≠ the
      //    Vite dev-server port (different origins, even though both are localhost)
      //  • Hard-coded absolute server URLs break in production behind a reverse proxy
      const pdfResponse = await fetch(fileUrl, { credentials: 'include', redirect: 'follow' });
      if (!pdfResponse.ok) {
        throw new Error(`Server returned ${pdfResponse.status} while loading preview`);
      }
      const blob = await pdfResponse.blob();
      const blobUrl = URL.createObjectURL(blob);
      setPreviewUrl(blobUrl);
    } catch (error) {
      setPreviewError(formatClientErrorMessage(error, "Failed to load preview"));
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleRateNote = (note: Note) => {
    if (!isLoggedIn) {
      toast.error(formatClientErrorMessage("Please login to rate notes"));
      onLoginRequired();
      return;
    }
    setSelectedNote(note);
    setRatingValue(5); // Reset to default 5 stars
    setRatingComment(""); // Reset comment
    setShowRatingDialog(true);
  };

  const handleRatingSubmit = async () => {
    if (!selectedNote || !onRateNote) return;
    try {
      await onRateNote(selectedNote.id, ratingValue, ratingComment);
      setShowRatingDialog(false);
      setSelectedNote(null);
    } catch (error) {
      toast.error(formatClientErrorMessage(error, "Failed to submit rating"));
    }
  };

  const isPurchased = (noteId: string) => purchasedNotes.includes(noteId);

  const isBookmarked = (noteId: string) => bookmarkedNotes.includes(noteId);

  const handleBookmark = (noteId: string) => {
    if (!isLoggedIn) { onLoginRequired(); return; }
    setBookmarkedNotes(prev => {
      let next: string[];
      if (prev.includes(noteId)) {
        next = prev.filter(id => id !== noteId);
      } else {
        if (!buyerPremium?.active && prev.length >= FREE_BOOKMARK_LIMIT) {
          toast.error(`Upgrade to Premium for unlimited bookmarks! (Free plan: ${FREE_BOOKMARK_LIMIT} max)`);
          return prev;
        }
        next = [...prev, noteId];
        toast.success('Note bookmarked!');
      }
      localStorage.setItem('nm-bookmarks', JSON.stringify(next));
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle>Search Notes</CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              {buyerPremium?.active && (
                <Badge className="bg-yellow-500 text-white flex items-center gap-1 px-2 py-0.5">
                  <Crown className="w-3 h-3" />
                  Premium Buyer
                </Badge>
              )}
              {isLoggedIn && (
                <button
                  onClick={() => setShowBookmarks(v => !v)}
                  title={showBookmarks ? 'Show all notes' : 'View bookmarked notes'}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-colors ${
                    showBookmarks
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'border-input text-muted-foreground hover:border-indigo-400 hover:text-indigo-600'
                  }`}
                >
                  {showBookmarks
                    ? <BookmarkCheck className="w-3.5 h-3.5" />
                    : <Bookmark className="w-3.5 h-3.5" />}
                  {buyerPremium?.active ? 'Bookmarks' : `${bookmarkedNotes.length}/${FREE_BOOKMARK_LIMIT}`}
                </button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by title, subject, or course..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm mb-2 block">Subject</label>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="w-full h-10 px-3 border rounded-md bg-white dark:bg-zinc-900 text-foreground border-input dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {subjects.map(subject => (
                  <option key={subject} value={subject}>
                    {subject === "all" ? "All Subjects" : subject}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {showBookmarks && bookmarkedNotes.length === 0 && (
        <div className="text-center py-12 text-muted-foreground border rounded-lg">
          <Bookmark className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No bookmarks yet</p>
          <p className="text-sm mt-1">Click the bookmark icon on any note card to save it here.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {!showBookmarks && filteredNotes.length === 0 ? (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            No notes found matching your criteria
          </div>
        ) : (
          (showBookmarks ? filteredNotes.filter(n => bookmarkedNotes.includes(n.id)) : filteredNotes).map((note) => (
            <Card key={note.id} className={`hover:shadow-lg transition-shadow ${note.isFeatured ? 'ring-2 ring-yellow-400 dark:ring-yellow-600/60' : ''}`}>
              {note.isFeatured && (
                <div className="bg-gradient-to-r from-yellow-400 to-amber-500 text-white text-xs font-bold px-3 py-1 flex items-center gap-1 rounded-t-lg">
                  <Star className="w-3 h-3 fill-white" /> Featured Note
                  {(note.sellerSubscriptionType === 'premium_seller' || note.sellerSubscriptionType === 'combo') && (
                    <span className="ml-auto flex items-center gap-0.5"><Crown className="w-3 h-3" /> Premium Seller</span>
                  )}
                </div>
              )}
              <CardHeader>
                <div className="flex items-start justify-between">
                  <NotePdfIcon size={40} featured={note.isFeatured} />
                  <div className="flex items-center gap-1 flex-wrap justify-end">
                    {isLoggedIn && (
                      <button
                        onClick={() => handleBookmark(note.id)}
                        title={isBookmarked(note.id) ? 'Bookmarked' : 'Bookmark'}
                        className="p-1 rounded hover:bg-muted transition-colors"
                      >
                        {isBookmarked(note.id)
                          ? <BookmarkCheck className="w-4 h-4 text-blue-600" />
                          : <Bookmark className="w-4 h-4 text-muted-foreground" />}
                      </button>
                    )}
                    {!note.isFeatured && (note.sellerSubscriptionType === 'premium_seller' || note.sellerSubscriptionType === 'combo') && (
                      <Badge className="bg-yellow-500 text-white flex items-center gap-0.5 px-1.5 py-0.5 text-xs">
                        <Crown className="w-3 h-3" /> Premium Seller
                      </Badge>
                    )}
                    {isEarlyAccess(note) && buyerPremium?.active && (
                      <Badge className="bg-green-600 text-white flex items-center gap-1 text-xs px-1.5 py-0.5">
                        <Crown className="w-3 h-3" /> Early Access
                      </Badge>
                    )}
                    {isEarlyAccess(note) && !buyerPremium?.active && (
                      <Badge variant="outline" className="text-orange-600 border-orange-300 text-xs px-1.5 py-0.5">
                        🔒 {Math.max(1, Math.ceil((EARLY_ACCESS_MS - (now - new Date(note.uploadDate).getTime())) / 3600000))}h left
                      </Badge>
                    )}
                    {isPurchased(note.id) && (
                      <Badge variant="default">Purchased</Badge>
                    )}
                  </div>
                </div>
                <CardTitle className="text-lg mt-2 truncate" title={note.title}>{note.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1 text-sm">
                  <p className="truncate" title={note.subject}><span className="text-muted-foreground">Subject:</span> {note.subject}</p>
                  <p className="truncate" title={note.course}><span className="text-muted-foreground">Course:</span> {note.course}</p>
                  {note.pages && (
                    <p><span className="text-muted-foreground">Pages:</span> {note.pages}</p>
                  )}
                </div>

                {/* Always show rating section */}
                <div className="flex items-center gap-1">
                  {note.rating ? (
                    <>
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm font-medium">{note.rating.toFixed(1)}</span>
                    </>
                  ) : (
                    <>
                      <Star className="w-4 h-4 text-gray-300" />
                      <span className="text-sm text-muted-foreground">No ratings yet</span>
                    </>
                  )}
                </div>

                {/* Always show downloads count */}
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Download className="w-4 h-4" />
                  <span>{(note.downloads || 0) >= 100 ? '100+' : (note.downloads || 0)} {(note.downloads || 0) === 1 ? 'download' : 'downloads'}</span>
                </div>

                <div className="pt-3 border-t">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-2xl">₹{note.price}</span>
                  </div>
                  {isPurchased(note.id) ? (
                    <div className="space-y-2">
                      <Button 
                        className="w-full" 
                        variant="outline"
                        onClick={() => handleDownload(note)}
                        disabled={downloadingIds.has(note.id)}
                      >
                        {downloadingIds.has(note.id) ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Downloading...</>
                        ) : (
                          <><Download className="w-4 h-4 mr-2" />Download</>
                        )}
                      </Button>
                      {onRateNote && (
                        <Button 
                          className="w-full"
                          variant="secondary"
                          onClick={() => handleRateNote(note)}
                        >
                          <Star className="w-4 h-4 mr-2" />
                          Rate Note
                        </Button>
                      )}
                    </div>
                  ) : isEarlyAccess(note) && !buyerPremium?.active ? (
                    <div className="space-y-2">
                      <Button
                        className="w-full"
                        variant="outline"
                        onClick={() => handlePreview(note)}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Preview (7 Pages)
                      </Button>
                      <Button className="w-full" variant="outline" disabled>
                        🔒 Premium Early Access Only
                      </Button>
                      {onUpgradePremium && (
                        <Button
                          className="w-full text-xs border-yellow-400 text-yellow-700 hover:bg-yellow-50"
                          variant="outline"
                          onClick={onUpgradePremium}
                        >
                          <Crown className="w-3 h-3 mr-1" /> Upgrade for Early Access
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Button 
                        className="w-full"
                        variant="outline"
                        onClick={() => handlePreview(note)}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Preview (7 Pages)
                      </Button>
                      <Button 
                        className="w-full"
                        onClick={() => handleBuyClick(note)}
                      >
                        <ShoppingCart className="w-4 h-4 mr-2" />
                        Buy Now
                      </Button>
                      {onRateNote && (
                        <Button 
                          className="w-full"
                          variant="secondary"
                          onClick={() => handleRateNote(note)}
                        >
                          <Star className="w-4 h-4 mr-2" />
                          Rate Note
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {paymentStep === "confirm" && "Confirm Purchase"}
              {paymentStep === "processing" && "Processing Payment"}
              {paymentStep === "success" && "Payment Successful!"}
            </DialogTitle>
            <DialogDescription>
              {paymentStep === "confirm" && "Review your purchase details and proceed to payment"}
              {paymentStep === "processing" && "Please wait while we process your payment"}
              {paymentStep === "success" && "Your notes have been purchased successfully"}
            </DialogDescription>
          </DialogHeader>

          {selectedNote && (
            <div className="space-y-4">
              {paymentStep === "confirm" && (
                <>
                  <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
                    <h4 className="text-base font-semibold leading-snug break-words">{selectedNote.title}</h4>
                    <p className="text-sm text-muted-foreground break-words">
                      {selectedNote.subject} • {selectedNote.course}
                    </p>
                  </div>

                  <div className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3 text-sm">
                      <span className="text-muted-foreground">Note Price:</span>
                      <span className="shrink-0">₹{selectedNote.price.toFixed(2)}</span>
                    </div>
                    <div className={`flex items-start justify-between gap-3 text-sm ${buyerPremium?.active ? 'text-green-600' : 'text-muted-foreground'}`}>
                      <span className="min-w-0 break-words">{buyerPremium?.active ? 'Transaction Fee (0% — Premium! 🎉)' : 'Transaction Fee (2%):'}</span>
                      <span className="shrink-0">{buyerPremium?.active ? '₹0.00' : `₹${(selectedNote.price * 0.02).toFixed(2)}`}</span>
                    </div>
                    {buyerPremium?.active && (
                      <div className="flex items-start justify-between gap-3 text-green-600 text-sm">
                        <span>Exclusive Discount:</span>
                        <span className="text-right">5–10% applied at checkout</span>
                      </div>
                    )}
                    <div className="border-t pt-2 flex items-start justify-between gap-3 font-semibold">
                      <span>Total:</span>
                      <span className="flex items-baseline gap-1">
                        {buyerPremium?.active ? (
                          <>
                            <span className="line-through text-muted-foreground text-sm font-normal">
                              ₹{(selectedNote.price * 1.02).toFixed(2)}
                            </span>
                            <span className="text-green-600">₹{selectedNote.price.toFixed(2)}</span>
                            <span className="text-green-600 text-xs font-normal">(5–10% off)</span>
                          </>
                        ) : `₹${(selectedNote.price * 1.02).toFixed(2)}`}
                      </span>
                    </div>
                    {buyerPremium?.active && (
                      <div className="text-xs text-green-600 bg-green-50 dark:bg-green-950/30 rounded px-2 py-1 flex items-start gap-1 mt-1">
                        <Crown className="w-3 h-3 mt-0.5 shrink-0" />
                        <span className="leading-relaxed break-words">Premium: Zero gateway fee + exclusive discount applied!</span>
                      </div>
                    )}
                  </div>

                  <div className="border rounded-lg p-3 space-y-1">
                    <label className="text-sm font-medium">Mobile Number</label>
                    <Input
                      type="tel"
                      placeholder="10-digit mobile number"
                      maxLength={10}
                      value={localPhone}
                      onChange={e => setLocalPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    />
                    <p className="text-xs text-muted-foreground">Pre-filled in the payment form. Saved for future purchases.</p>
                  </div>

                  <div className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Wallet Balance</span>
                      <span className={`text-sm font-semibold ${walletBalance >= (buyerPremium?.active ? selectedNote.price : selectedNote.price * 1.02) ? 'text-green-600' : 'text-red-500'}`}>
                        ₹{walletBalance.toFixed(2)}
                      </span>
                    </div>
                    <Button
                      onClick={handleWalletPayment}
                      className="w-full"
                      disabled={walletBalance < (buyerPremium?.active ? selectedNote.price : selectedNote.price * 1.02)}
                    >
                      Pay with Wallet
                    </Button>
                    {walletBalance < (buyerPremium?.active ? selectedNote.price : selectedNote.price * 1.02) && (
                      <p className="text-xs text-amber-500 dark:text-amber-400 text-center">
                        Insufficient balance — please top up your wallet first
                      </p>
                    )}
                  </div>

                  <div className="border rounded-lg p-3 space-y-2">
                    <p className="text-sm font-medium">Pay with Card / UPI / Net Banking</p>
                    <Button onClick={handleRazorpayPayment} variant="outline" className="w-full">
                      Proceed to Payment
                    </Button>
                  </div>
                </>
              )}

              {paymentStep === "processing" && (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p>Processing your payment...</p>
                  <p className="text-sm text-muted-foreground mt-2">Please wait</p>
                </div>
              )}

              {paymentStep === "success" && (
                <div className="text-center py-8">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Download className="w-6 h-6 text-green-600" />
                  </div>
                  <p>Payment successful!</p>
                  <p className="text-sm text-muted-foreground mt-2">Your notes are ready to download</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showPreviewDialog} onOpenChange={(open) => {
          if (!open && previewUrl && previewUrl.startsWith('blob:')) {
            URL.revokeObjectURL(previewUrl);
            setPreviewUrl(null);
          }
          setShowPreviewDialog(open);
        }}
      >
        <DialogContent
          className="max-w-3xl max-h-[80vh] overflow-y-auto"
          onKeyDown={(e) => {
            // Block Ctrl+S (save), Ctrl+P (print), Ctrl+A (select-all) in preview
            if (e.ctrlKey && ['s', 'p', 'a', 'S', 'P', 'A'].includes(e.key)) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {selectedNote && isPurchased(selectedNote.id) 
                ? `Full Access - ${selectedNote.title}` 
                : "Preview Note - First 7 Pages"}
            </DialogTitle>
            <DialogDescription>
              {selectedNote && isPurchased(selectedNote.id)
                ? "You have full access to all pages of this note"
                : "You can view the first 7 pages for free. Login and purchase to access all pages."}
            </DialogDescription>
          </DialogHeader>
          
          {selectedNote && (
            <div className="space-y-4">
              <div className="space-y-2">
                <h4>{selectedNote.title}</h4>
                <p className="text-sm text-muted-foreground">
                  {selectedNote.subject} • {selectedNote.course}
                </p>
                {selectedNote.pages && (
                  <p className="text-sm">
                    Total Pages: {selectedNote.pages} • {isPurchased(selectedNote.id) ? "Full Access" : "Previewing: 7 pages"}
                  </p>
                )}
              </div>
              
              {/* Preview Pages */}
              <div className="space-y-4 border rounded-lg p-4 bg-gray-50">
                {previewLoading && (
                  <div className="text-center text-muted-foreground py-8">
                    Loading preview...
                  </div>
                )}
                {previewError && (
                  <div className="text-center text-red-600 py-8">
                    {formatClientErrorMessage(previewError)}
                  </div>
                )}
                {!previewLoading && !previewError && previewUrl && (
                  <ProtectedPdfCanvas
                    blobUrl={previewUrl}
                    className="max-h-[520px] overflow-y-auto bg-gray-100 rounded p-2"
                  />
                )}
                <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-center">
                  <p className="text-sm text-yellow-900">
                    📚 Purchase to unlock all {selectedNote.pages || "remaining"} pages with full content
                  </p>
                </div>
              </div>
              
              <div className="border rounded p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Note Price:</span>
                  <span>₹{selectedNote.price.toFixed(2)}</span>
                </div>
                <div className={`flex justify-between text-sm ${buyerPremium?.active ? 'text-green-600' : 'text-muted-foreground'}`}>
                  <span>{buyerPremium?.active ? 'Transaction Fee (0% — Premium! 🎉)' : 'Transaction Fee (2%):'}</span>
                  <span>{buyerPremium?.active ? '₹0.00' : `₹${(selectedNote.price * 0.02).toFixed(2)}`}</span>
                </div>
                {buyerPremium?.active && (
                  <div className="flex justify-between text-green-600 text-sm">
                    <span>Exclusive Discount:</span>
                    <span>5–10% applied at checkout</span>
                  </div>
                )}
                <div className="border-t pt-2 flex justify-between font-semibold">
                  <span>Total:</span>
                  <span className="flex items-baseline gap-1">
                    {buyerPremium?.active ? (
                      <>
                        <span className="line-through text-muted-foreground text-sm font-normal">
                          ₹{(selectedNote.price * 1.02).toFixed(2)}
                        </span>
                        <span className="text-green-600">₹{selectedNote.price.toFixed(2)}</span>
                        <span className="text-green-600 text-xs font-normal">(5–10% off)</span>
                      </>
                    ) : `₹${(selectedNote.price * 1.02).toFixed(2)}`}
                  </span>
                </div>
                {buyerPremium?.active && (
                  <div className="text-xs text-green-600 bg-green-50 dark:bg-green-950/30 rounded px-2 py-1 flex items-center gap-1 mt-1">
                    <Crown className="w-3 h-3" />
                    <span>Premium: Zero gateway fee + exclusive discount applied!</span>
                  </div>
                )}
                {selectedNote.rating > 0 && (
                  <div className="flex items-center justify-between">
                    <span>Rating:</span>
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm">{selectedNote.rating.toFixed(1)}</span>
                      {selectedNote.downloads > 0 && (
                        <span className="text-sm text-muted-foreground ml-2">
                          ({selectedNote.downloads >= 100 ? '100+' : selectedNote.downloads} downloads)
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <Button 
                onClick={() => {
                  setShowPreviewDialog(false);
                  handleBuyClick(selectedNote);
                }} 
                className="w-full"
              >
                <ShoppingCart className="w-4 h-4 mr-2" />
                Purchase Full Notes - ₹{buyerPremium?.active ? selectedNote.price.toFixed(2) : (selectedNote.price * 1.02).toFixed(2)}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showRatingDialog} onOpenChange={setShowRatingDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rate Note</DialogTitle>
            <DialogDescription>
              Please provide your rating and comment for the note.
            </DialogDescription>
          </DialogHeader>
          
          {selectedNote && (
            <div className="space-y-4">
              <div className="space-y-2">
                <h4>{selectedNote.title}</h4>
                <p className="text-sm text-muted-foreground">
                  {selectedNote.subject} • {selectedNote.course}
                </p>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm mb-2 block">Rating</label>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map(value => (
                    <Star
                      key={value}
                      className={`w-8 h-8 cursor-pointer transition-colors ${value <= ratingValue ? "fill-yellow-400 text-yellow-400" : "text-gray-300 hover:text-yellow-200"}`}
                      onClick={() => setRatingValue(value)}
                    />
                  ))}
                  <span className="ml-2 text-sm text-muted-foreground">({ratingValue}/5)</span>
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm mb-2 block">Comment (optional)</label>
                <Input
                  placeholder="Add your comment here..."
                  value={ratingComment}
                  onChange={(e) => setRatingComment(e.target.value)}
                />
              </div>
              
              <Button 
                onClick={handleRatingSubmit} 
                className="w-full"
              >
                Submit Rating
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}