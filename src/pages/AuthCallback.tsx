import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const AuthCallback = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [statusText, setStatusText] = useState("Completing sign in...");

  useEffect(() => {
    let mounted = true;

    const handleCallback = async () => {
      const search = new URLSearchParams(window.location.search);
      const role = search.get("role") === "agent" ? "agent" : "user";
      const code = search.get("code");
      const callbackError = search.get("error") || search.get("error_description");

      if (callbackError) {
        if (mounted) {
          toast({
            title: "Sign in failed",
            description: "OAuth sign in was canceled or failed. Please try again.",
            variant: "destructive",
          });
          navigate(role === "agent" ? "/agent/login" : "/login", { replace: true });
        }
        return;
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          if (mounted) {
            toast({
              title: "Sign in failed",
              description: "Could not complete OAuth sign in. Please try again.",
              variant: "destructive",
            });
            navigate(role === "agent" ? "/agent/login" : "/login", { replace: true });
          }
          return;
        }
      }

      if (!mounted) return;
      setStatusText("Signed in. Redirecting...");
      navigate(role === "agent" ? "/dashboard" : "/buy-data", { replace: true });
    };

    handleCallback();

    return () => {
      mounted = false;
    };
  }, [navigate, toast]);

  return <div className="min-h-screen flex items-center justify-center text-muted-foreground">{statusText}</div>;
};

export default AuthCallback;
