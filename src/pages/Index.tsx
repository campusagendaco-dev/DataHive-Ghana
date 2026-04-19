import { ArrowRight, MessageCircle, ShieldCheck, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PhoneOrderTracker from "@/components/PhoneOrderTracker";

const Index = () => {
  const [supportChannelLink, setSupportChannelLink] = useState("https://whatsapp.com/channel/0029Vb6Xwed60eBaztkH2B3m");

  useEffect(() => {
    const loadSupportLink = async () => {
      const { data } = await supabase.functions.invoke("system-settings", {
        body: { action: "get" },
      });
      const link = String((data as any)?.support_channel_link || "").trim();
      if (link) setSupportChannelLink(link);
    };
    loadSupportLink();
  }, []);

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,hsl(48_96%_53%/0.1),transparent_55%)]">
      <section className="pt-28 pb-14 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <h1 className="font-display text-4xl md:text-6xl font-black leading-tight">
            Buy Data Fast.
            <br />
            Manage Everything In One Dashboard.
          </h1>
          <p className="text-muted-foreground mt-4 max-w-2xl mx-auto text-base md:text-lg">
            Sign in to buy data from your wallet, track transactions, manage your account,
            and upgrade to agent access when you are ready.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" asChild>
              <Link to="/login">Sign In / Create Account <ArrowRight className="ml-2 w-4 h-4" /></Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/buy-data"><Wifi className="mr-2 w-4 h-4" /> Buy Data As Guest</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/agent-program">Become an Agent</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="pb-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 md:p-5 flex items-start gap-3 mb-6">
            <ShieldCheck className="w-5 h-5 text-primary mt-0.5" />
            <p className="text-sm md:text-base text-foreground">
              Agent accounts unlock lower bundle rates and your own public store where customers can pay directly via Paystack.
            </p>
          </div>

          <PhoneOrderTracker
            title="Track Data Delivery by Phone"
            subtitle="Enter your purchase number to check payment and delivery status instantly."
          />
        </div>
      </section>

      {/* Floating WhatsApp Button */}
      <a
        href={supportChannelLink}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-[#25D366] hover:bg-[#1da851] text-[hsl(0,0%,100%)] font-semibold px-5 py-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 animate-fade-in"
      >
        <MessageCircle className="w-5 h-5" />
        <span className="hidden sm:inline">Join WhatsApp Channel</span>
        <span className="sm:hidden">WhatsApp</span>
      </a>
    </div>
  );
};

export default Index;
