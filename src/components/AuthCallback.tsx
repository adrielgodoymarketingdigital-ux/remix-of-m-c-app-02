import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) { navigate("/auth?error=oauth_failed"); return; }
        if (data.session) {
          navigate("/dashboard", { replace: true });
        } else {
          const { data: exchangeData, error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(window.location.href);
          if (exchangeError || !exchangeData.session) {
            navigate("/auth?error=session_exchange_failed");
          } else {
            navigate("/dashboard", { replace: true });
          }
        }
      } catch (err) {
        navigate("/auth?error=unexpected");
      }
    };
    handleAuthCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-muted-foreground text-sm">Autenticando com Google...</p>
      </div>
    </div>
  );
};

export default AuthCallback;
