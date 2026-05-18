import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, MessageSquare, UploadCloud, X, FileImage } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const DashboardReportIssue = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [subject, setSubject] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // File Upload State
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.size > 5 * 1024 * 1024) {
        toast({ title: "File too large", description: "Please select an image smaller than 5MB.", variant: "destructive" });
        return;
      }
      setFile(selectedFile);
      setFilePreview(URL.createObjectURL(selectedFile));
    }
  };

  const removeFile = () => {
    setFile(null);
    setFilePreview(null);
  };

  const handleSubmit = async () => {
    if (!subject.trim() || !details.trim()) {
      toast({ title: "Subject and details are required", variant: "destructive" });
      return;
    }
    if (!user) return;

    setSubmitting(true);
    setUploading(true);

    try {
      let attachmentUrl = null;

      // Handle Image Upload if selected
      if (file) {
        const fileExt = file.name.split(".").pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        const { data, error: uploadError } = await supabase.storage
          .from("support-attachments")
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("support-attachments")
          .getPublicUrl(fileName);

        attachmentUrl = publicUrl;
      }

      // Create Ticket
      const { error: ticketError } = await supabase.from("support_tickets").insert({
        user_id: user.id,
        subject: subject.trim(),
        description: details.trim(),
        attachment_url: attachmentUrl,
        status: "open"
      });

      if (ticketError) throw ticketError;

      toast({ title: "Ticket submitted successfully!", description: "AI Agent has initiated auto-resolution." });
      setSubject("");
      setDetails("");
      setFile(null);
      setFilePreview(null);
      fetchTickets();
    } catch (err: any) {
      toast({ title: "Failed to submit ticket", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
      setUploading(false);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-5xl space-y-8">
      <div>
        <h1 className="font-black text-3xl tracking-tighter uppercase italic text-white flex items-center gap-3">
          <MessageSquare className="w-8 h-8 text-primary animate-pulse" />
          Autonomous Support Suite
        </h1>
        <p className="text-muted-foreground text-xs font-bold tracking-widest uppercase mt-1">24/7 AI-Agent Automated Resolution & Helpdesk</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <Card className="lg:col-span-3 border-none bg-white/5 backdrop-blur-xl shadow-2xl">
          <CardHeader>
            <CardTitle className="text-lg font-black uppercase text-primary">Open Ticket</CardTitle>
            <CardDescription className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Submit details and receipts for lightning-fast analysis.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="issue-subject" className="text-xs font-black uppercase tracking-wider">Subject</Label>
              <Input 
                id="issue-subject" 
                value={subject} 
                onChange={(e) => setSubject(e.target.value)} 
                className="bg-white/5 border-none h-12 rounded-xl font-bold placeholder:text-muted-foreground/30" 
                placeholder="e.g. Failed GHS 50 MoMo Deposit" 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="issue-details" className="text-xs font-black uppercase tracking-wider">Problem Description</Label>
              <Textarea
                id="issue-details"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                className="bg-white/5 border-none min-h-[140px] rounded-xl font-medium placeholder:text-muted-foreground/30 leading-relaxed"
                placeholder="Describe your issue. If relevant, include date, provider, or phone number used."
              />
            </div>

            {/* Premium Interactive Image Dropzone */}
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-wider">Attach Receipt / screenshot (Optional)</Label>
              {filePreview ? (
                <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-white/5 p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img src={filePreview} className="w-16 h-16 rounded-xl object-cover border border-white/5 shadow-inner" />
                    <div>
                      <p className="text-sm font-black truncate max-w-[200px] text-white">{file?.name}</p>
                      <p className="text-[10px] font-black text-muted-foreground uppercase">{(file!.size / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={removeFile} className="rounded-xl text-red-400 hover:bg-red-400/10 hover:text-red-300">
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              ) : (
                <label className="border-2 border-dashed border-white/5 hover:border-primary/30 transition-all rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer gap-2 bg-black/20 hover:bg-white/[0.02]">
                  <UploadCloud className="w-10 h-10 text-primary animate-bounce" />
                  <span className="text-xs font-black text-center text-white/80">Upload Screenshot or Receipt</span>
                  <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">PNG, JPG, WEBP (MAX. 5MB)</span>
                  <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                </label>
              )}
            </div>

            <Button 
              onClick={handleSubmit} 
              disabled={submitting} 
              className="w-full h-14 rounded-xl font-black text-lg bg-primary hover:bg-primary/90 shadow-2xl shadow-primary/20 gap-2"
            >
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
              Dispatch Support Agent
            </Button>
          </CardContent>
        </Card>

        {/* Live Ticket History Fleet */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-black uppercase tracking-tight text-white flex items-center gap-2">
            <Badge className="bg-primary/20 text-primary border-none text-[10px] font-black rounded-lg py-1 px-2">LIVE</Badge>
            Your Helpdesk Inbox
          </h2>
          
          {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : tickets.length === 0 ? (
            <Card className="bg-white/5 border-dashed border-white/5">
              <CardContent className="py-16 text-center flex flex-col items-center">
                <MessageSquare className="w-12 h-12 opacity-20 mb-4 text-primary" />
                <p className="text-sm font-black text-muted-foreground uppercase tracking-widest">Inbox Clean</p>
                <p className="text-[10px] text-muted-foreground font-bold mt-1">No active or resolved support tickets.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
              {tickets.map((ticket) => (
                <Card key={ticket.id} className="border-none bg-white/5 hover:bg-white/[0.07] transition-all duration-300">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-sm text-white leading-tight">{ticket.subject}</p>
                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-wider mt-1">
                          {new Date(ticket.created_at).toLocaleString()}
                        </p>
                      </div>
                      <Badge 
                        className={`rounded-lg border-none text-[8px] font-black px-2 h-5 shrink-0 ${
                          ticket.status === 'resolved' 
                            ? 'bg-emerald-500/10 text-emerald-500' 
                            : ticket.status === 'in_progress' 
                            ? 'bg-amber-500/10 text-amber-500' 
                            : 'bg-indigo-500/10 text-indigo-500'
                        }`}
                      >
                        {ticket.status.replace('_', ' ').toUpperCase()}
                      </Badge>
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed font-medium">{ticket.description}</p>

                    {/* Screenshot attachment preview */}
                    {ticket.attachment_url && (
                      <div className="relative rounded-xl overflow-hidden border border-white/5 max-h-[140px] bg-black/20 p-1 flex items-center justify-center">
                        <img src={ticket.attachment_url} className="max-h-[130px] rounded-lg object-contain w-full" alt="Attachment" />
                        <a 
                          href={ticket.attachment_url} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="absolute bottom-2 right-2 bg-black/70 hover:bg-black/90 p-1.5 rounded-lg text-[8px] font-black text-white uppercase tracking-widest border border-white/10"
                        >
                          View Fullsize
                        </a>
                      </div>
                    )}

                    {ticket.admin_response && (
                      <div className="bg-primary/5 p-4 rounded-xl border border-primary/10 space-y-1">
                        <div className="flex items-center gap-1.5 text-primary">
                          <Badge className="bg-primary text-black font-black text-[8px] px-1.5 rounded-sm">AI RESOLVER</Badge>
                        </div>
                        <p className="text-xs text-white/90 leading-relaxed font-medium italic">"{ticket.admin_response}"</p>
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
