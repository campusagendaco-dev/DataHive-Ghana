import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { MessageCircle, Clock, CheckCircle, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";

const ADMIN_WHATSAPP = "+233203256540";
const APPROVAL_PAYMENT_NUMBER = "0547116139";
const APPROVAL_PAYMENT_NAME = "Samuel Owusu Bensarfo Kofi";
const APPROVAL_PAYMENT_AMOUNT = "GHS 50";
const WHATSAPP_MESSAGE = encodeURIComponent(
  `Hello, I have signed up as a reseller on QuickData GH and paid ${APPROVAL_PAYMENT_AMOUNT} to ${APPROVAL_PAYMENT_NUMBER} (${APPROVAL_PAYMENT_NAME}). Please approve my reseller account. Thank you!`
);

const AgentPending = () => {
  const { profile, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const approvedButSetupIncomplete = Boolean(profile?.agent_approved && !profile?.onboarding_complete);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen pt-24 pb-16 px-4 flex items-center justify-center">
      <div className="w-full max-w-md text-center">
        <Clock className="w-16 h-16 text-primary mx-auto mb-6" />
        <h1 className="font-display text-2xl font-bold mb-3">
          {approvedButSetupIncomplete ? "Approval Granted" : "Reseller Account Pending Approval"}
        </h1>
        <p className="text-muted-foreground mb-8">
          {approvedButSetupIncomplete
            ? "Your reseller request is approved. Click check status to continue with setup."
            : "Your reseller account request has been created successfully. To get approved, please make payment and contact customer service."}
        </p>

        {!approvedButSetupIncomplete && (
          <div className="bg-card border border-border rounded-2xl p-6 mb-6 glow-yellow">
          <div className="text-sm text-left space-y-2 mb-4">
            <p className="text-muted-foreground">Approval steps:</p>
            <p>1. Send <span className="font-semibold">{APPROVAL_PAYMENT_AMOUNT}</span> to <span className="font-semibold">{APPROVAL_PAYMENT_NUMBER}</span>.</p>
            <p>2. Account Name: <span className="font-semibold">{APPROVAL_PAYMENT_NAME}</span>.</p>
            <p>3. Contact customer service on WhatsApp for approval.</p>
          </div>
          <a
            href={`https://wa.me/${ADMIN_WHATSAPP.replace("+", "")}?text=${WHATSAPP_MESSAGE}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2"
          >
            <Button size="lg" className="w-full">
              <MessageCircle className="w-5 h-5 mr-2" />
              Message on WhatsApp
            </Button>
          </a>
          <p className="text-xs text-muted-foreground mt-3">
            {ADMIN_WHATSAPP}
          </p>
          </div>
        )}

        <div className="space-y-3">
          <Button variant="outline" onClick={refreshProfile} className="w-full">
            <CheckCircle className="w-4 h-4 mr-2" />
            Check Approval Status
          </Button>
          <Button variant="ghost" onClick={handleSignOut} className="w-full text-muted-foreground">
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AgentPending;
