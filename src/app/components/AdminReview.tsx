import { useState } from "react";
import { CheckCircle, XCircle, Clock, AlertCircle, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import { Note } from "../App";
import { NotePreviewDialog } from "./NotePreviewDialog";
import { toast } from "sonner";
import { formatClientErrorMessage } from "../../utils/errorMessages";

interface AdminReviewProps {
  notes: Note[];
  onApprove: (noteId: string) => Promise<void> | void;
  onReject: (noteId: string, reason: string) => Promise<void> | void;
  isLoading?: boolean;
  errorMessage?: string | null;
}

export function AdminReview({ notes, onApprove, onReject, isLoading = false, errorMessage }: AdminReviewProps) {
  const [selectedNote, setSelectedNote] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [previewNote, setPreviewNote] = useState<Note | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [visibleCount, setVisibleCount] = useState(10);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const pendingNotes = notes.filter(
    (note) => note.status === "pending_review"
  );

  const handleApprove = async (noteId: string) => {
    setProcessingId(noteId);
    try {
      await onApprove(noteId);
      toast.success("Note approved and published successfully!");
      setSelectedNote(null);
    } catch (error) {
      toast.error(formatClientErrorMessage(error, "Failed to approve note. Please try again."));
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (noteId: string) => {
    if (!rejectionReason.trim()) {
      toast.error(formatClientErrorMessage("Please provide a reason for rejection"));
      return;
    }
    setProcessingId(noteId);
    try {
      await onReject(noteId, rejectionReason);
      toast.success("Note rejected. Seller has been notified.");
      setRejectionReason("");
      setSelectedNote(null);
    } catch (error) {
      toast.error(formatClientErrorMessage(error, "Failed to reject note. Please try again."));
    } finally {
      setProcessingId(null);
    }
  };

  const handlePreview = (note: Note) => {
    setPreviewNote(note);
    setShowPreview(true);
  };

  if (errorMessage) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-red-600">
          {formatClientErrorMessage(errorMessage)}
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Loading notes for review...
        </CardContent>
      </Card>
    );
  }

  if (pendingNotes.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">
            <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
            <p className="text-lg">No notes pending review</p>
            <p className="text-sm">All notes have been processed</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {pendingNotes.slice(0, visibleCount).map((note) => (
          <Card key={note.id} className="border-l-4 border-l-yellow-500">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg mb-2">{note.title}</CardTitle>
                  <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                    <Badge variant="secondary">{note.subject}</Badge>
                    <Badge variant="secondary">{note.course}</Badge>
                    <Badge variant="outline">₹{note.price}</Badge>
                    <Badge variant="outline">{note.pages} pages</Badge>
                  </div>
                  <p className="text-sm mt-2">Seller: {note.sellerName}</p>
                </div>
                <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">
                  <Clock className="w-3 h-3 mr-1" />
                  Pending Review
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Quality Checks */}
              <div>
                <p className="text-sm font-semibold mb-2">
                  Automated Quality Checks:
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  <div
                    className={`flex items-center gap-2 text-sm ${
                      note.qualityChecks?.fileType
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {note.qualityChecks?.fileType ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <XCircle className="w-4 h-4" />
                    )}
                    File Type Check
                  </div>
                  <div
                    className={`flex items-center gap-2 text-sm ${
                      note.qualityChecks?.fileSize
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {note.qualityChecks?.fileSize ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <XCircle className="w-4 h-4" />
                    )}
                    File Size Check
                  </div>
                  <div
                    className={`flex items-center gap-2 text-sm ${
                      note.qualityChecks?.hasTitle
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {note.qualityChecks?.hasTitle ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <XCircle className="w-4 h-4" />
                    )}
                    Title Check
                  </div>
                  <div
                    className={`flex items-center gap-2 text-sm ${
                      note.qualityChecks?.hasDescription
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {note.qualityChecks?.hasDescription ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <XCircle className="w-4 h-4" />
                    )}
                    Description Check
                  </div>
                  <div
                    className={`flex items-center gap-2 text-sm ${
                      note.qualityChecks?.pageCount
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {note.qualityChecks?.pageCount ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <XCircle className="w-4 h-4" />
                    )}
                    Page Count (Min 3)
                  </div>
                </div>
              </div>

              {/* Preview Button */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Eye className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="text-sm font-semibold">Preview All Pages</p>
                      <p className="text-xs text-muted-foreground">
                        Review all {note.pages} pages before approval
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => handlePreview(note)}
                    variant="outline"
                    className="border-blue-300 hover:bg-blue-100"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Preview Notes
                  </Button>
                </div>
              </div>

              {/* Rejection Form */}
              {selectedNote === note.id && (
                <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                  <Label htmlFor={`reason-${note.id}`} className="text-sm font-semibold mb-2 block">
                    Rejection Reason
                  </Label>
                  <Textarea
                    id={`reason-${note.id}`}
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Please provide a detailed reason for rejection..."
                    className="mb-3"
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedNote(null);
                        setRejectionReason("");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleReject(note.id)}
                      disabled={processingId === note.id}
                    >
                      {processingId === note.id ? "Rejecting..." : "Confirm Rejection"}
                    </Button>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <Button
                  onClick={() => handleApprove(note.id)}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  disabled={processingId === note.id}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  {processingId === note.id ? "Processing..." : "Approve & Publish"}
                </Button>
                <Button
                  onClick={() => setSelectedNote(note.id)}
                  variant="destructive"
                  className="flex-1"
                  disabled={selectedNote === note.id || processingId === note.id}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Reject
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {visibleCount < pendingNotes.length && (
          <div className="flex justify-center pt-2">
            <Button variant="outline" onClick={() => setVisibleCount(v => v + 10)}>
              View More ({pendingNotes.length - visibleCount} remaining)
            </Button>
          </div>
        )}
      </div>

      {/* Preview Dialog */}
      <NotePreviewDialog
        isOpen={showPreview}
        onClose={() => {
          setShowPreview(false);
          setPreviewNote(null);
        }}
        note={previewNote}
      />
    </>
  );
}