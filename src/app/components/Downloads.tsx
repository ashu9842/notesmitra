import { Download, FileText, Calendar, Star, Eye, Folder, FolderOpen, ExternalLink, Loader2, Sparkles } from "lucide-react";
import { NotePdfIcon } from "./NotePdfIcon";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Note } from "../App";
import { formatClientErrorMessage } from "../../utils/errorMessages";
import { useState } from "react";
import { AINoteAssistant } from "./AINoteAssistant";

interface DownloadsProps {
  notes: Note[];
  purchasedNotes: string[];
  onDownload: (note: Note) => Promise<void>;
  isLoading?: boolean;
  errorMessage?: string | null;
}

export function Downloads({ notes, purchasedNotes, onDownload, isLoading = false, errorMessage }: DownloadsProps) {
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());
  const [aiOpenIds, setAiOpenIds] = useState<Set<string>>(new Set());
  const downloadedNotes = notes.filter(note => purchasedNotes.includes(note.id));

  const toggleAI = (id: string) =>
    setAiOpenIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const handleDownload = async (note: Note) => {
    if (downloadingIds.has(note.id)) return;
    setDownloadingIds(prev => new Set(prev).add(note.id));
    try {
      await onDownload(note);
    } finally {
      setDownloadingIds(prev => {
        const next = new Set(prev);
        next.delete(note.id);
        return next;
      });
    }
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
          Loading your downloads...
        </CardContent>
      </Card>
    );
  }
  
  if (downloadedNotes.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">
            <FolderOpen className="w-20 h-20 mx-auto mb-4 opacity-30 text-blue-500" />
            <h3 className="text-xl font-semibold mb-2">Downloads Folder Empty</h3>
            <p className="text-sm">Notes you purchase will be saved here for easy access</p>
            <p className="text-xs mt-2 text-blue-600">💾 All your purchased notes in one place</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Downloads Folder Header */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Folder className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-xl">My Downloads Folder</p>
              <p className="text-sm font-normal text-muted-foreground">
                {downloadedNotes.length} {downloadedNotes.length === 1 ? "note" : "notes"} saved
              </p>
            </div>
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Downloaded Notes Grid */}
      <div className="grid gap-4">
        {downloadedNotes.map((note) => (
          <Card key={note.id} className="hover:shadow-lg transition-all border-l-4 border-l-blue-500">
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row gap-4">
                {/* Note Icon */}
                <div className="flex-shrink-0">
                  <NotePdfIcon size={64} />
                </div>

                {/* Note Details */}
                <div className="flex-1 space-y-3">
                  <div>
                    <h3 className="font-semibold text-lg mb-1">{note.title}</h3>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <span className="font-medium text-blue-600">{note.subject}</span>
                      <span>•</span>
                      <span>{note.course}</span>
                      <span>•</span>
                      <span>by {note.sellerName}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <Badge variant="secondary" className="flex items-center gap-1 bg-blue-100 text-blue-700">
                      <FileText className="w-3 h-3" />
                      {note.pages} pages
                    </Badge>
                    {note.rating > 0 && (
                      <Badge variant="secondary" className="flex items-center gap-1 bg-yellow-100 text-yellow-700">
                        <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                        {note.rating}
                      </Badge>
                    )}
                    {note.downloads > 0 && (
                      <Badge variant="secondary" className="flex items-center gap-1 bg-green-100 text-green-700">
                        <Eye className="w-3 h-3" />
                        {note.downloads >= 100 ? '100+' : note.downloads} downloads
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground bg-gray-50 p-2 rounded">
                    <Calendar className="w-3 h-3" />
                    Purchased on {new Date(note.uploadDate).toLocaleDateString('en-US', { 
                      day: 'numeric', 
                      month: 'long', 
                      year: 'numeric' 
                    })}
                  </div>
                </div>

                {/* Action Section */}
                <div className="flex flex-col justify-between items-end gap-3 md:min-w-[140px]">
                  <div className="text-right">
                    <p className="text-2xl font-bold text-blue-600">₹{note.price}</p>
                    <p className="text-xs text-green-600 font-medium">✓ Purchased</p>
                  </div>
                  <Button 
                    onClick={() => handleDownload(note)}
                    disabled={downloadingIds.has(note.id)}
                    className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 disabled:opacity-70"
                  >
                    {downloadingIds.has(note.id) ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Downloading...</>
                    ) : (
                      <><ExternalLink className="w-4 h-4 mr-2" />View Notes</>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant={aiOpenIds.has(note.id) ? "default" : "outline"}
                    onClick={() => toggleAI(note.id)}
                    className={`w-full md:w-auto text-xs ${aiOpenIds.has(note.id) ? "bg-purple-600 hover:bg-purple-700 text-white" : "border-purple-300 text-purple-700 hover:bg-purple-50"}`}
                  >
                    <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                    {aiOpenIds.has(note.id) ? "Hide AI" : "AI Study"}
                  </Button>
                </div>
              </div>

              {/* AI Study Assistant Panel */}
              {aiOpenIds.has(note.id) && (
                <div className="mt-4">
                  <AINoteAssistant note={note} />
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Storage Info */}
      <Card className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Download className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-semibold">Lifetime Access</p>
              <p className="text-xs text-muted-foreground">
                All purchased notes are stored permanently. View anytime!
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}