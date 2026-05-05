import { useState, useEffect, useCallback } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const DashboardReportIssue = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [subject, setSubject] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTickets = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("support_tickets")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    
    if (!error && data) {
      setTickets(data);
    }
    setLoading(false);
  }, [user]);


  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);


  const handleSubmit = async () => {
    if (!subject.trim() || !details.trim()) {
      toast({ title: "Subject and details are required", variant: "destructive" });
      return;
    }
    if (!user) return;

    setSubmitting(true);
    const { error } = await supabase.from("support_tickets").insert({
      user_id: user.id,
      subject: subject.trim(),
      description: details.trim(),
    });

    if (error) {
      toast({ title: "Failed to submit ticket", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Ticket submitted successfully!" });
      setSubject("");
      setDetails("");
      fetchTickets();
    }
    setSubmitting(false);
  };

  return (
    <div className="p-6 md:p-8 max-w-4xl space-y-6">
      <h1 className="font-display text-2xl font-bold">Support & Issues</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Create a New Ticket</CardTitle>
            <CardDescription>Experiencing a failed order or bug? Let us know.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="issue-subject">Subject</Label>
              <Input id="issue-subject" value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1" placeholder="e.g. Failed MTN Data Order" />
            </div>
            <div>
              <Label htmlFor="issue-details">Details</Label>
              <Textarea
                id="issue-details"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                className="mt-1 min-h-[160px]"
                placeholder="Describe the issue, what you expected, and what happened instead."
              />
            </div>
            <Button onClick={handleSubmit} disabled={submitting} className="w-full">
              {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Submit Ticket
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <h2 className="text-lg font-bold">Your Tickets</h2>
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : tickets.length === 0 ? (
            <Card className="bg-transparent border-dashed">
              <CardContent className="py-10 text-center flex flex-col items-center">
                <MessageSquare className="w-8 h-8 opacity-20 mb-2" />
                <p className="text-sm text-muted-foreground">No support tickets found.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {tickets.map((ticket) => (
                <Card key={ticket.id}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <p className="font-semibold text-sm">{ticket.subject}</p>
                      <Badge variant={ticket.status === 'resolved' || ticket.status === 'closed' ? 'default' : 'secondary'} className={ticket.status === 'resolved' ? 'bg-green-500/10 text-green-500' : ''}>
                        {ticket.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{ticket.description}</p>
                    {ticket.admin_response && (
                      <div className="bg-amber-500/10 p-3 rounded-lg border border-amber-500/20">
                        <p className="text-xs font-bold text-amber-500 mb-1">Admin Response:</p>
                        <p className="text-sm text-white/80">{ticket.admin_response}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardReportIssue;
