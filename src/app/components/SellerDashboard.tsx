import { useState, useRef } from "react";
import { Upload, FileText, AlertCircle, CheckCircle2, XCircle, Crown, Zap, Star, BarChart2, TrendingUp, Lock } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { toast } from "sonner";
import { formatClientErrorMessage } from "../../utils/errorMessages";

interface QualityCheckItem {
  key: string;
  label: string;
  passed: boolean;
  failReason?: string | null;
}

interface Note {
  id: string;
  title: string;
  subject: string;
  course: string;
  price: number;
  pages?: number;
  file: string;
  status: "pending_review" | "approved" | "rejected" | "failed_quality_check";
  uploadDate: string;
  rejectionReason?: string;
  isFeatured?: boolean;
  isPriorityApproval?: boolean;
  qualityChecks?: {
    pageCount?: boolean;
    blankPageCheck?: boolean;
    qualityCheck?: boolean;
    copyrightCheck?: boolean;
    duplicateCheck?: boolean;
  };
}

const CHECK_DEFINITIONS: { key: keyof NonNullable<Note['qualityChecks']>; label: string; failReason: string }[] = [
  { key: 'duplicateCheck',  label: 'Duplicate Detection',    failReason: 'Similar notes already exist in the system' },
  { key: 'blankPageCheck', label: 'Blank Page Check',        failReason: 'Document contains blank or empty pages' },
  { key: 'qualityCheck',   label: 'Low Quality Scan',        failReason: 'Document is a low quality scan or has readability issues' },
  { key: 'copyrightCheck', label: 'Copyright Check',         failReason: 'Copyrighted material detected' },
  { key: 'pageCount',      label: 'Page Count Validation',   failReason: 'Document must have at least 3 pages' },
];

function QualityCheckPanel({ checks, checkResults, rejectionReason, usedAI }: {
  checks?: Note['qualityChecks'];
  checkResults?: QualityCheckItem[];
  rejectionReason?: string;
  usedAI?: boolean;
}) {
  const items: QualityCheckItem[] = checkResults ?? CHECK_DEFINITIONS.map(def => ({
    key: def.key,
    label: def.label,
    passed: checks?.[def.key as keyof typeof checks] !== false,
    failReason: checks?.[def.key as keyof typeof checks] === false ? def.failReason : null,
  }));

  return (
    <div className="space-y-2 mt-2">
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium">Quality Checks:</p>
      </div>
      <div className="space-y-1">
        {items.map(item => (
          <div key={item.key} className="flex items-center gap-2 text-sm">
            {item.passed
              ? <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
              : <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />}
            <span className={item.passed ? '' : 'font-medium'}>{item.label}</span>
            {!item.passed && item.failReason && (
              <span className="text-muted-foreground"> - {item.failReason}</span>
            )}
          </div>
        ))}
      </div>
      {rejectionReason && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded mt-2">
          <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium">Rejection Reason:</p>
            <p className="text-sm text-red-800">{rejectionReason}</p>
          </div>
        </div>
      )}
    </div>
  );
}

interface SellerDashboardProps {
  notes: Note[];
  onUploadNote: (formData: FormData) => Promise<any>;
  isLoading?: boolean;
  errorMessage?: string | null;
  sellerPremium?: { active: boolean; expiryDate?: string };
  monthlyUploads?: number;
  onUpgradePremium?: () => void;
}

export function SellerDashboard({ notes, onUploadNote, isLoading = false, errorMessage, sellerPremium, monthlyUploads = 0, onUpgradePremium }: SellerDashboardProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [showAllNotes, setShowAllNotes] = useState(false);
  const [uploadQualityResult, setUploadQualityResult] = useState<any>(null);
  const NOTES_PREVIEW_COUNT = 5;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    subject: "",
    course: "",
    pages: "",
    price: "",
    file: null as File | null,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.file) {
      toast.error(formatClientErrorMessage("Please select a file"));
      return;
    }

    const price = parseFloat(formData.price);
    if (price < 20) {
      toast.error(formatClientErrorMessage("Minimum price is ₹20"));
      return;
    }
    if (price > 50) {
      toast.error(formatClientErrorMessage("Maximum price is ₹50"));
      return;
    }

    setIsUploading(true);

    try {
      const payload = new FormData();
      payload.append("title", formData.title);
      payload.append("description", formData.description);
      payload.append("subject", formData.subject);
      payload.append("semester", formData.course);
      payload.append("price", formData.price);
      payload.append("pages", formData.pages);
      payload.append("file", formData.file);

      const result = await onUploadNote(payload);
      const qcs = result?.qualityCheckSummary;

      if (qcs && !qcs.allPassed) {
        setUploadQualityResult(qcs);
        // Don't show success toast — quality panel will explain what failed
      } else {
        setUploadQualityResult(null);
        toast.success("Upload successful! Your notes are now pending admin approval.");
      }
      
      // Reset form AND clear file input element
      setFormData({
        title: "",
        description: "",
        subject: "",
        course: "",
        pages: "",
        price: "",
        file: null,
      });
      
      // Clear the file input element itself
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      toast.error(formatClientErrorMessage(error, "Upload failed. Please try again."));
    } finally {
      setIsUploading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending_review: "outline",
      approved: "default",
      rejected: "destructive",
      failed_quality_check: "destructive"
    };
    const labels: Record<string, string> = {
      pending_review: "Pending Review",
      approved: "Approved",
      rejected: "Rejected",
      failed_quality_check: "Rejected"
    };
    return <Badge variant={variants[status] || "default"}>{labels[status] || status.toUpperCase()}</Badge>;
  };

  return (
    <div className="space-y-6">
      {errorMessage && (
        <Card>
          <CardContent className="py-4 text-center text-red-600">
            {formatClientErrorMessage(errorMessage)}
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Upload className="w-5 h-5" />
              Upload New Notes
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap sm:justify-end">
              {sellerPremium?.active ? (
                <Badge className="bg-yellow-500 text-white flex items-center gap-1 px-2 py-0.5 text-xs sm:text-sm">
                  <Crown className="w-3 h-3" /> Premium Seller
                </Badge>
              ) : null}
              <Badge
                variant={sellerPremium?.active ? "default" : "outline"}
                className={`flex items-center gap-1 px-2 py-0.5 text-xs ${
                  !sellerPremium?.active && monthlyUploads >= 5
                    ? 'border-red-400 text-red-600'
                    : !sellerPremium?.active
                    ? 'border-amber-400 text-amber-700'
                    : 'bg-green-600'
                }`}
              >
                <Upload className="w-3 h-3" />
                {sellerPremium?.active ? 'Unlimited Uploads ✨' : `${monthlyUploads}/5 Uploads This Month`}
              </Badge>
              {!sellerPremium?.active && monthlyUploads >= 4 && (
                <button
                  onClick={onUpgradePremium}
                  className="text-xs text-yellow-700 underline hover:text-yellow-900"
                >
                  Upgrade for unlimited
                </button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Advanced Calculus Complete Notes"
                  required
                  disabled={isUploading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  placeholder="e.g., Mathematics"
                  required
                  disabled={isUploading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="course">Semester / Course</Label>
                <Input
                  id="course"
                  value={formData.course}
                  onChange={(e) => setFormData({ ...formData, course: e.target.value })}
                  placeholder="e.g., B.Sc Mathematics"
                  required
                  disabled={isUploading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Briefly describe your notes"
                  required
                  disabled={isUploading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pages">Pages</Label>
                <Input
                  id="pages"
                  type="number"
                  value={formData.pages}
                  onChange={(e) => setFormData({ ...formData, pages: e.target.value })}
                  placeholder="e.g., 30"
                  required
                  disabled={isUploading}
                  min="3"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Price (₹)</Label>
                <Input
                  id="price"
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="e.g., 30"
                  required
                  disabled={isUploading}
                  min="20"
                  max="50"
                  step="1"
                />
                <p className="text-xs text-muted-foreground">Min: ₹20 | Max: ₹50</p>
              </div>
              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="file">PDF File</Label>
                <Input
                  ref={fileInputRef}
                  id="file"
                  type="file"
                  className="text-base file:text-sm"
                  accept=".pdf"
                  onChange={(e) => setFormData({ ...formData, file: e.target.files?.[0] || null })}
                  required
                  disabled={isUploading}
                />
              </div>
            </div>
            <Button type="submit" disabled={isUploading} className="w-full">
              {isUploading ? "Running Quality Checks..." : "Upload Notes"}
            </Button>
          </form>

          {/* Immediate quality check result after upload */}
          {uploadQualityResult && (
            <div className="mt-4 border border-red-200 rounded-lg p-4 bg-red-50">
              <QualityCheckPanel
                checkResults={uploadQualityResult.checkResults}
                rejectionReason="Auto-rejected: Quality checks failed"
                usedAI={uploadQualityResult.usedAI}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Advanced Sales Analytics — Premium Seller only */}
      {sellerPremium?.active && notes.length > 0 && (() => {
        const approved = notes.filter(n => n.status === 'approved');
        const pending = notes.filter(n => n.status === 'pending_review');
        const rejected = notes.filter(n => n.status === 'rejected' || n.status === 'failed_quality_check');
        const featured = notes.filter(n => n.isFeatured);
        const avgPrice = approved.length > 0 ? approved.reduce((s, n) => s + n.price, 0) / approved.length : 0;
        const approvalRate = notes.length > 0 ? Math.round((approved.length / notes.length) * 100) : 0;
        return (
          <Card className="border-yellow-300 dark:border-yellow-700/50 bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-950/20 dark:to-amber-950/20">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-yellow-800 dark:text-yellow-400">
                <BarChart2 className="w-5 h-5" />
                Advanced Sales Analytics
                <Badge className="bg-yellow-500 text-white text-xs ml-1"><Crown className="w-3 h-3 mr-0.5 inline" />Premium</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Approved Notes', value: approved.length, icon: CheckCircle2, color: 'text-green-700' },
                  { label: 'Pending Review', value: pending.length, icon: Zap, color: 'text-blue-700', note: 'Priority ⚡' },
                  { label: 'Approval Rate', value: `${approvalRate}%`, icon: TrendingUp, color: 'text-indigo-700' },
                  { label: 'Avg Note Price', value: `₹${avgPrice.toFixed(0)}`, icon: Star, color: 'text-amber-700' },
                  { label: 'Featured Notes', value: featured.length, icon: Star, color: 'text-yellow-600' },
                  { label: 'Rejected Notes', value: rejected.length, icon: XCircle, color: 'text-red-600' },
                  { label: 'Total Portfolio', value: notes.length, icon: FileText, color: 'text-purple-700' },
                  { label: 'Priority Queue', value: pending.filter(n => n.isPriorityApproval).length, icon: Zap, color: 'text-orange-600' },
                ].map(({ label, value, icon: Icon, color }) => (
                  <div key={label} className="bg-white/70 dark:bg-white/5 rounded-lg p-3 space-y-1">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className={`text-xl font-bold ${color}`}>{value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      <Card>
        <CardHeader>
          <CardTitle>My Uploaded Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {isLoading ? (
              <div className="space-y-3 animate-pulse">
                <div className="h-16 bg-gray-100 rounded" />
                <div className="h-16 bg-gray-100 rounded" />
              </div>
            ) : notes.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No notes uploaded yet</p>
            ) : (
              <>
                {(showAllNotes ? notes : notes.slice(0, NOTES_PREVIEW_COUNT)).map((note) => (
                  <div key={note.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          {note.title}
                          {note.isFeatured && (
                            <span title="Featured — boosted visibility" className="inline-flex items-center gap-0.5 text-yellow-600">
                              <Star className="w-3.5 h-3.5 fill-yellow-400" />
                            </span>
                          )}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {note.subject} • {note.course}
                        </p>
                        <p className="text-sm">₹{note.price}</p>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          {note.isPriorityApproval && note.status === 'pending_review' && (
                            <span className="inline-flex items-center gap-1 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5">
                              <Zap className="w-3 h-3" /> Priority Review
                            </span>
                          )}
                          {note.isFeatured && (
                            <span className="inline-flex items-center gap-1 text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-1.5 py-0.5">
                              <Star className="w-3 h-3" /> Featured
                            </span>
                          )}
                        </div>
                      </div>
                      {getStatusBadge(note.status)}
                    </div>

                    {/* Quality check panel for failed notes */}
                    {(note.status === 'failed_quality_check' || note.status === 'rejected') && (
                      <QualityCheckPanel
                        checks={note.qualityChecks}
                        rejectionReason={note.rejectionReason}
                        usedAI={true}
                      />
                    )}
                  </div>
                ))}

                {notes.length > NOTES_PREVIEW_COUNT && (
                  <button
                    onClick={() => setShowAllNotes((prev) => !prev)}
                    className="w-full py-2 text-sm text-blue-600 hover:text-blue-700 font-medium border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
                  >
                    {showAllNotes
                      ? "Show less"
                      : `Show ${notes.length - NOTES_PREVIEW_COUNT} more note${notes.length - NOTES_PREVIEW_COUNT === 1 ? "" : "s"}`}
                  </button>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}