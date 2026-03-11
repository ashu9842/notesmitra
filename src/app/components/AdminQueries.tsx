import { useState } from "react";
import { MessageSquare, Search, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Button } from "./ui/button";
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

interface AdminQueriesProps {
  tickets: SupportTicket[];
  onUpdateStatus: (ticketId: string, status: SupportTicket["status"]) => Promise<void> | void;
  isLoading?: boolean;
  errorMessage?: string | null;
}

export function AdminQueries({ tickets, onUpdateStatus, isLoading = false, errorMessage }: AdminQueriesProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

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

  const handleStatusChange = async (ticketId: string, newStatus: SupportTicket["status"]) => {
    try {
      await onUpdateStatus(ticketId, newStatus);
      toast.success("Ticket status updated");
    } catch (error) {
      toast.error(formatClientErrorMessage(error, "Failed to update ticket"));
    }
  };

  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = ticket.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         ticket.userEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         ticket.issueType.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         ticket.id.includes(searchQuery);
    
    const matchesFilter = filterStatus === "all" || ticket.status === filterStatus;
    
    return matchesSearch && matchesFilter;
  });

  const pendingCount = tickets.filter(t => t.status === "pending").length;
  const inProgressCount = tickets.filter(t => t.status === "in-progress").length;
  const resolvedCount = tickets.filter(t => t.status === "resolved").length;

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
          Loading tickets...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-yellow-600">{pendingCount}</p>
              <p className="text-sm text-muted-foreground">Pending Tickets</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-blue-600">{inProgressCount}</p>
              <p className="text-sm text-muted-foreground">In Progress</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-green-600">{resolvedCount}</p>
              <p className="text-sm text-muted-foreground">Resolved</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, ticket ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-full md:w-48">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tickets</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tickets List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Support Tickets ({filteredTickets.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredTickets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No tickets found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredTickets.map((ticket) => (
                <Card key={ticket.id} className="border-l-4 border-l-blue-500">
                  <CardContent className="pt-4">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold">Ticket #{ticket.id}</p>
                          <p className="text-sm text-muted-foreground">
                            {ticket.userName}{ticket.userEmail ? ` (${ticket.userEmail})` : ''}
                          </p>
                        </div>
                        {getStatusBadge(ticket.status)}
                      </div>

                      <div className="bg-gray-50 p-3 rounded-lg">
                        <p className="text-sm font-medium mb-1">Issue Type: {ticket.issueType}</p>
                        <p className="text-sm">{ticket.description}</p>
                      </div>

                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">
                          {new Date(ticket.date).toLocaleString()}
                        </p>
                        <div className="flex gap-2">
                          {ticket.status !== "in-progress" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStatusChange(ticket.id, "in-progress")}
                            >
                              Mark In Progress
                            </Button>
                          )}
                          {ticket.status !== "resolved" && (
                            <Button
                              size="sm"
                              onClick={() => handleStatusChange(ticket.id, "resolved")}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              Mark Resolved
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
