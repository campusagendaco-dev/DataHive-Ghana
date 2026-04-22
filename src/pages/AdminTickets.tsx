import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LifeBuoy, Inbox, CheckCircle2, Loader2, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface Ticket {
  id: string;
  subject: string;
  description: string;
  status: string;
  admin_response: string | null;
  created_at: string;
  profiles: { phone: string } | null;
}

const AdminTickets = () => {
  const { toast } = useToast();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTicket, setActiveTicket] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchTickets = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("support_tickets")
      .select("*, profiles(phone)")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Failed to fetch tickets", variant: "destructive" });
    } else {
      setTickets(data as any[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const openTicketsCount = tickets.filter(t => t.status === 'open' || t.status === 'in_progress').length;
  const resolvedTicketsCount = tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length;

  const handleReplyAndResolve = async (id: string) => {
    if (!replyText.trim()) {
      toast({ title: "Please enter a response", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    const { error } = await supabase
      .from("support_tickets")
      .update({
        admin_response: replyText.trim(),
        status: "resolved",
      })
      .eq("id", id);

    if (error) {
      toast({ title: "Failed to resolve ticket", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Ticket resolved!" });
      setReplyText("");
      setActiveTicket(null);
      fetchTickets();
    }
    setSubmitting(false);
  };

  return (
    <div className="space-y-6 max-w-5xl pb-10">
      <div>
        <h1 className="font-display text-2xl font-bold">Support Tickets</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage user issues, failed orders, and refunds directly.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-amber-500/5 border-amber-500/20">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="bg-amber-500/10 p-3 rounded-full">
              <Inbox className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Open Tickets</p>
              <p className="text-2xl font-black">{openTicketsCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="bg-green-500/10 p-3 rounded-full">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Resolved</p>
              <p className="text-2xl font-black">{resolvedTicketsCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ticket Inbox</CardTitle>
          <CardDescription>Click a ticket to reply and resolve.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : tickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <LifeBuoy className="w-12 h-12 text-muted-foreground opacity-20 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">Inbox Zero!</p>
              <p className="text-xs text-muted-foreground mt-1">No open support tickets at the moment.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {tickets.map((ticket) => (
                <div key={ticket.id} className="border border-white/10 rounded-xl overflow-hidden">
                  <div 
                    className="p-4 bg-secondary/30 cursor-pointer hover:bg-secondary/50 transition-colors flex justify-between items-center"
                    onClick={() => setActiveTicket(activeTicket === ticket.id ? null : ticket.id)}
                  >
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="font-bold">{ticket.subject}</h3>
                        <Badge variant={ticket.status === 'resolved' ? 'default' : 'secondary'} className={ticket.status === 'resolved' ? 'bg-green-500/10 text-green-500' : ''}>
                          {ticket.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">From: {ticket.profiles?.phone || "Unknown User"} • {new Date(ticket.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                  
                  {activeTicket === ticket.id && (
                    <div className="p-4 border-t border-white/5 space-y-4 bg-black/20">
                      <div>
                        <p className="text-sm font-bold mb-1 text-white/50">User Message:</p>
                        <p className="text-sm bg-white/5 p-3 rounded-lg">{ticket.description}</p>
                      </div>
                      
                      {ticket.admin_response ? (
                        <div>
                          <p className="text-sm font-bold mb-1 text-amber-500">Your Response:</p>
                          <p className="text-sm bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg text-amber-100">{ticket.admin_response}</p>
                        </div>
                      ) : (
                        <div className="space-y-3 pt-2">
                          <Textarea 
                            placeholder="Write your response to the user..." 
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                          />
                          <Button onClick={() => handleReplyAndResolve(ticket.id)} disabled={submitting}>
                            {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                            Send Reply & Resolve Ticket
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminTickets;
