import { useState } from "react";
import { MessageSquare, Send, Loader2, Check, Clock } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Badge } from "./ui/badge";
import { toast } from "sonner";
import { formatClientErrorMessage } from "../../utils/errorMessages";

interface SupportTicket {
  id: string;
  userName: string;
  userEmail: string;
  issueType: string;
  description: string;
  status: "pending" | "in-progress" | "resolved";
  date: string;
}

interface SupportProps {
  userName?: string;
  userEmail?: string;
  onSubmitTicket: (ticket: Omit<SupportTicket, "id" | "date" | "status">) => Promise<void> | void;
  tickets: SupportTicket[];
  isGuest?: boolean; // Add flag to identify guest users
  isLoading?: boolean;
  errorMessage?: string | null;
}

export function Support({ userName = "Guest", userEmail = "", onSubmitTicket, tickets, isGuest = false, isLoading = false, errorMessage }: SupportProps) {
  const [issueType, setIssueType] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [guestEmail, setGuestEmail] = useState(""); // For guest users

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!issueType) {
      toast.error(formatClientErrorMessage("Please select an issue type"));
      return;
    }

    // Validate guest email if user is a guest
    if (isGuest) {
      if (!guestEmail.trim()) {
        toast.error(formatClientErrorMessage("Please enter your email for communication"));
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)) {
        toast.error(formatClientErrorMessage("Please enter a valid email address"));
        return;
      }
    }

    if (!description.trim()) {
      toast.error(formatClientErrorMessage("Please describe your issue"));
      return;
    }

    setIsSubmitting(true);

    try {
      await onSubmitTicket({
        userName,
        userEmail: isGuest ? guestEmail : userEmail,
        issueType,
        description,
      });

      toast.success("Support ticket created successfully! We'll contact you via email.");
    } catch (error) {
      toast.error(formatClientErrorMessage(error, "Failed to submit ticket"));
      setIsSubmitting(false);
      return;
    }
    
    setIssueType("");
    setDescription("");
    if (isGuest) {
      setGuestEmail("");
    }
    setIsSubmitting(false);
  };

  const getStatusBadge = (status: SupportTicket["status"]) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case "in-progress":
        return <Badge className="bg-blue-100 text-blue-800">In Progress</Badge>;
      case "resolved":
        return <Badge className="bg-green-100 text-green-800">Resolved</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Submit New Query */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Submit Support Query
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={userName} disabled />
            </div>

            {userEmail && (
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={userEmail} disabled />
              </div>
            )}

            {isGuest && (
              <div className="space-y-2">
                <Label htmlFor="guestEmail">Email</Label>
                <Input
                  id="guestEmail"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  placeholder="Enter your email"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="issueType">Issue Type</Label>
              <Select value={issueType} onValueChange={setIssueType}>
                <SelectTrigger id="issueType">
                  <SelectValue placeholder="Select issue type" />
                </SelectTrigger>
                <SelectContent>
                  {isGuest ? (
                    <>
                      <SelectItem value="Account Issue">Account Issue</SelectItem>
                      <SelectItem value="Notes Quality Concern">Notes Quality Concern</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="Payment Issue">Payment Issue</SelectItem>
                      <SelectItem value="Upload Problem">Upload Problem</SelectItem>
                      <SelectItem value="Download Issue">Download Issue</SelectItem>
                      <SelectItem value="Note Quality Concern">Note Quality Concern</SelectItem>
                      <SelectItem value="Account Issue">Account Issue</SelectItem>
                      <SelectItem value="Refund Request">Refund Request</SelectItem>
                      <SelectItem value="Premium Subscription">Premium Subscription</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe your issue in detail..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
              />
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Submit Ticket
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* My Tickets */}
      {!isGuest && (
        <Card>
          <CardHeader>
            <CardTitle>My Support Tickets</CardTitle>
          </CardHeader>
          <CardContent>
            {errorMessage ? (
              <div className="text-center py-8 text-red-600">
                {formatClientErrorMessage(errorMessage)}
              </div>
            ) : isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading tickets...
              </div>
            ) : tickets.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No support tickets yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {tickets.map((ticket) => (
                  <Card key={ticket.id} className="border-l-4 border-l-blue-500">
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-medium">Ticket #{ticket.id}</p>
                          <p className="text-sm text-muted-foreground">{ticket.issueType}</p>
                        </div>
                        {getStatusBadge(ticket.status)}
                      </div>
                      <p className="text-sm mb-2">{ticket.description}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {new Date(ticket.date).toLocaleString()}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}