import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const DashboardReportIssue = () => {
  const { toast } = useToast();
  const [subject, setSubject] = useState("");
  const [details, setDetails] = useState("");

  const handleSubmit = () => {
    if (!subject.trim() || !details.trim()) {
      toast({ title: "Subject and details are required", variant: "destructive" });
      return;
    }

    const mailto = `mailto:support@swiftdatagh.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(details)}`;
    window.location.href = mailto;
    toast({ title: "Issue draft opened", description: "Your email app has been opened with the issue details." });
  };

  return (
    <div className="p-6 md:p-8 max-w-3xl space-y-6">
      <h1 className="font-display text-2xl font-bold">Report Issue</h1>

      <Card>
        <CardHeader>
          <CardTitle>Tell us what went wrong</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="issue-subject">Subject</Label>
            <Input id="issue-subject" value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1" />
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
          <Button onClick={handleSubmit}>Send Issue Report</Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardReportIssue;
