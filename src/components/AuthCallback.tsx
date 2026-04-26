import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      const url = new URL(window.location.href);
      const code = url.searchParams.get('code');
      const accessToken = new URLSearchParams(window.location.hash.slice(1)).get('access_token');
      const refreshToken = new URLSearchParams(window.location.hash.slice(1)).get('refresh_token');

      console.log('[AuthCallback] code:', code);
      console.log('[AuthCallback] access_token:', accessToken);

      // Implicit flow
      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) {
          console.error('[AuthCallback] setSession error:', error.message);
          navigate('/auth?error=set_session_failed', { replace: true });
        } else {
          navigate('/dashboard', { replace: true });
        }
        return;
      }

      // PKCE flow
      if (code) {
        console.log('[AuthCallback] Trocando code por sessão...');
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        console.log('[AuthCallback] exchangeCodeForSession result:', data, error);
        if (error) {
          console.error('[AuthCallback] exchange error:', error.message);
          navigate('/auth?error=exchange_failed', { replace: true });
        } else {
          navigate('/dashboard', { replace: true });
        }
        return;
      }

      // Sessão já existe?
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate('/dashboard', { replace: true });
      } else {
        console.error('[AuthCallback] Nenhum code, token ou sessão encontrada');
        navigate('/auth?error=no_token', { replace: true });
      }
    };

    handleCallback();
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
