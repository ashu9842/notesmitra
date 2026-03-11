import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";
import { FileText } from "lucide-react";
import { useState, useEffect } from "react";
import { Note } from "../App";
import { Badge } from "./ui/badge";
import { adminAPI } from "../../utils/api-mern";
import { formatClientErrorMessage } from "../../utils/errorMessages";
import { ProtectedPdfCanvas } from "./ProtectedPdfCanvas";

interface NotePreviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  note: Note | null;
}

export function NotePreviewDialog({ isOpen, onClose, note }: NotePreviewDialogProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthError, setIsAuthError] = useState(false);

  // Revoke any blob URL when the dialog closes or the note changes
  useEffect(() => {
    return () => {
      if (pdfUrl && pdfUrl.startsWith('blob:')) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  useEffect(() => {
    if (note && isOpen) {
      fetchPDFUrl();
    }
    // Clean up when dialog is closed
    if (!isOpen && pdfUrl && pdfUrl.startsWith('blob:')) {
      URL.revokeObjectURL(pdfUrl);
      setPdfUrl(null);
    }
  }, [note, isOpen]);

  const fetchPDFUrl = async () => {
    if (!note) return;
    
    setLoading(true);
    setError(null);
    setIsAuthError(false);
    
    try {
      // Step 1: get the proxy URL from the backend
      const response = await adminAPI.getFullPDFUrl(note.id);
      const pdfSrc: string = response.downloadUrl;

      // Step 2: fetch the PDF bytes through the backend proxy with credentials.
      // The proxy generates a signed Cloudinary URL server-side and fetches it in Node,
      // then returns the raw PDF bytes — bypassing the 401 that occurs on client-side
      // fetches of Cloudinary signed URLs.
      const pdfResponse = await fetch(pdfSrc, { credentials: 'include', redirect: 'follow' });
      if (!pdfResponse.ok) {
        throw new Error(`Server returned ${pdfResponse.status} while loading PDF`);
      }
      const blob = await pdfResponse.blob();
      const blobUrl = URL.createObjectURL(blob);
      setPdfUrl(blobUrl);
    } catch (err: any) {
      const errorMessage = formatClientErrorMessage(err, 'Failed to load PDF');
      setError(errorMessage);
      
      // Check if this is an authentication error
      const isSessionExpired = errorMessage.toLowerCase().includes('session expired') || 
                               errorMessage.toLowerCase().includes('not authorized') ||
                               errorMessage.toLowerCase().includes('please sign in');
      setIsAuthError(isSessionExpired);
    } finally {
      setLoading(false);
    }
  };

  const handleReauthenticate = () => {
    // Close the dialog instead of reloading the page.
    // window.location.reload() would reset all React state (isAdminLoggedIn, notes, etc.)
    // The session cookie is still valid — re-opening the dialog will retry successfully.
    onClose();
  };

  if (!note) return null;

  const totalPages = note.pages || 10;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="max-w-5xl w-[95vw] max-h-[92vh] flex flex-col overflow-hidden"
        onKeyDown={(e) => {
          if (e.ctrlKey && ['s', 'p', 'a', 'S', 'P', 'A'].includes(e.key)) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 min-w-0">
            <FileText className="w-5 h-5 text-blue-600 shrink-0" />
            <span className="truncate">Admin Preview — {note.title}</span>
          </DialogTitle>
          <DialogDescription>
            Review all {totalPages} pages of this note before approval or rejection
          </DialogDescription>
        </DialogHeader>

        {/* Note Info */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg border border-blue-200">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Badge variant="secondary">{note.subject}</Badge>
            <Badge variant="secondary">{note.course}</Badge>
            <Badge variant="secondary">₹{note.price}</Badge>
            <Badge variant="secondary">{totalPages} pages</Badge>
            <span className="text-muted-foreground">by {note.sellerName}</span>
          </div>
        </div>

        {/* Preview Area */}
        <div className="flex-1 overflow-auto min-h-0">
          {loading && (
            <div className="bg-white border-2 border-gray200 rounded-lg p-8 min-h-[500px] flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading PDF...</p>
              </div>
            </div>
          )}
          
          {error && (
            <div className="bg-white border-2 border-red-200 rounded-lg p-8 min-h-[500px] flex items-center justify-center">
              <div className="text-center">
                <div className="text-red-600 mb-4">
                  <p className="font-semibold mb-2">
                    {isAuthError ? '🔒 Session Expired' : '⚠️ Error Loading PDF'}
                  </p>
                  <p className="text-sm">{formatClientErrorMessage(error)}</p>
                </div>
                <div className="flex gap-2 justify-center">
                  {isAuthError ? (
                    <Button onClick={handleReauthenticate} variant="default" className="bg-blue-600 hover:bg-blue-700">
                      Close &amp; Retry
                    </Button>
                  ) : (
                    <Button onClick={fetchPDFUrl} variant="outline">
                      Retry
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {!loading && !error && pdfUrl && (
            <ProtectedPdfCanvas
              blobUrl={pdfUrl}
              className="bg-gray-100 rounded-lg p-3 overflow-y-auto max-h-[60vh]"
            />
          )}
        </div>

        {/* Navigation Controls - Removed as PDF viewer has built-in controls */}

        {/* Quality Check Status */}
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <p className="text-sm font-semibold mb-2">Quality Check Status:</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
            <div className={`flex items-center gap-1 ${note.qualityChecks?.duplicateCheck ? 'text-green-600' : 'text-red-600'}`}>
              <span>{note.qualityChecks?.duplicateCheck ? '✓' : '✗'}</span>
              <span>No Duplicates</span>
            </div>
            <div className={`flex items-center gap-1 ${note.qualityChecks?.blankPageCheck ? 'text-green-600' : 'text-red-600'}`}>
              <span>{note.qualityChecks?.blankPageCheck ? '✓' : '✗'}</span>
              <span>No Blank Pages</span>
            </div>
            <div className={`flex items-center gap-1 ${note.qualityChecks?.qualityCheck ? 'text-green-600' : 'text-red-600'}`}>
              <span>{note.qualityChecks?.qualityCheck ? '✓' : '✗'}</span>
              <span>Quality OK</span>
            </div>
            <div className={`flex items-center gap-1 ${note.qualityChecks?.copyrightCheck ? 'text-green-600' : 'text-red-600'}`}>
              <span>{note.qualityChecks?.copyrightCheck ? '✓' : '✗'}</span>
              <span>No Copyright</span>
            </div>
            <div className={`flex items-center gap-1 ${note.qualityChecks?.pageCount ? 'text-green-600' : 'text-red-600'}`}>
              <span>{note.qualityChecks?.pageCount ? '✓' : '✗'}</span>
              <span>Min 3 Pages</span>
            </div>
          </div>
        </div>

        <p className="text-xs text-center text-muted-foreground">
          👆 Admin Full Preview - All {totalPages} pages available for review
        </p>
      </DialogContent>
    </Dialog>
  );
}