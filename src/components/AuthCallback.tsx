import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      const url = new URL(window.location.href);
      const code = url.searchParams.get('code');
      const hashParams = new URLSearchParams(window.location.hash.slice(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const hashType = hashParams.get('type');

      console.log('[AuthCallback] URL completa:', window.location.href);
      console.log('[AuthCallback] query params:', Object.fromEntries(url.searchParams));
      console.log('[AuthCallback] hash:', window.location.hash);
      console.log('[AuthCallback] hashType:', hashType);
      console.log('[AuthCallback] code:', code);
      console.log('[AuthCallback] accessToken:', !!accessToken);

      // Implicit flow (hash com tokens)
      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) {
          navigate('/auth?error=set_session_failed', { replace: true });
        } else if (hashType === 'recovery') {
          navigate('/reset-password', { replace: true });
        } else {
          navigate('/dashboard', { replace: true });
        }
        return;
      }

      // PKCE flow (code como query param)
      if (code) {
        let isRecovery = false;
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          console.log('[AuthCallback] onAuthStateChange event:', event, 'session:', !!session);
          if (event === 'PASSWORD_RECOVERY') isRecovery = true;
        });

        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        subscription.unsubscribe();

        console.log('[AuthCallback] exchangeCodeForSession error:', error);
        console.log('[AuthCallback] isRecovery após exchange:', isRecovery);
        console.log('[AuthCallback] session user amr:', JSON.stringify((data?.session as any)?.user?.amr));

        if (error) {
          navigate('/auth?error=exchange_failed', { replace: true });
          return;
        }

        if (isRecovery) {
          navigate('/reset-password', { replace: true });
          return;
        }

        // Fallback: checa amr (Authentication Methods References) da sessão retornada
        const amr = (data?.session as any)?.user?.amr;
        const amrRecovery = Array.isArray(amr) && amr.some((a: any) => a.method === 'recovery' || a.method === 'otp');
        console.log('[AuthCallback] amrRecovery:', amrRecovery, 'amr:', amr);

        navigate(amrRecovery ? '/reset-password' : '/dashboard', { replace: true });
        return;
      }

      // Fallback: sessão já existente
      const { data: { session } } = await supabase.auth.getSession();
      navigate(session ? '/dashboard' : '/auth?error=no_token', { replace: true });
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-sm">Verificando...</p>
      </div>
    </div>
  );
};

export default AuthCallback;
