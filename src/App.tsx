import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useSessionRestore } from "@/hooks/useSessionRestore";
import { ThemeProvider } from "next-themes";
import { lazy, Suspense } from "react";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import { TrialEndWarning } from "./components/trial/TrialEndWarning";
import { ComVerificacaoPlano } from "./components/auth/ComVerificacaoPlano";
import { ComVerificacaoFuncionario } from "./components/auth/ComVerificacaoFuncionario";
import { ProtectedAppRoute } from "./components/auth/ProtectedAppRoute";
import { InstallPrompt } from "./components/pwa/InstallPrompt";
import AuthCallback from "@/components/AuthCallback";
import { EmpresaProvider } from "@/contexts/EmpresaContext";

// Lazy-loaded pages — split into per-route bundles so o app inicial fica leve no mobile
const LandingLP1 = lazy(() => import("./pages/LandingLP1"));
const LandingLP2 = lazy(() => import("./pages/LandingLP2"));
const VideoBoasVindas = lazy(() => import("./pages/VideoBoasVindas"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Obrigado = lazy(() => import("./pages/Obrigado"));
const PDV = lazy(() => import("./pages/PDV"));
const OrdemServico = lazy(() => import("./pages/OrdemServico"));
const Produtos = lazy(() => import("./pages/Produtos"));
const Servicos = lazy(() => import("./pages/Servicos"));
const Dispositivos = lazy(() => import("./pages/Dispositivos"));
const CatalogoDispositivos = lazy(() => import("./pages/CatalogoDispositivos"));
const CatalogoPublico = lazy(() => import("./pages/CatalogoPublico"));
const LandingPagePublica = lazy(() => import("./pages/LandingPagePublica"));
const OrigemDispositivos = lazy(() => import("./pages/OrigemDispositivos"));
const Fornecedores = lazy(() => import("./pages/Fornecedores"));
const Contas = lazy(() => import("./pages/Contas"));
const Clientes = lazy(() => import("./pages/Clientes"));
const Plano = lazy(() => import("./pages/Plano"));
const Financeiro = lazy(() => import("./pages/Financeiro"));
const Relatorios = lazy(() => import("./pages/Relatorios"));
const Vendas = lazy(() => import("./pages/Vendas"));
const Configuracoes = lazy(() => import("./pages/Configuracoes"));
const Suporte = lazy(() => import("./pages/Suporte"));
const AdminUsuarios = lazy(() => import("./pages/AdminUsuarios"));
const AdminNotificacoes = lazy(() => import("./pages/AdminNotificacoes"));
const AdminAvisos = lazy(() => import("./pages/AdminAvisos"));
const AdminFeedbacks = lazy(() => import("./pages/AdminFeedbacks"));
const AdminChatSuporte = lazy(() => import("./pages/AdminChatSuporte"));
const AdminOnboarding = lazy(() => import("./pages/AdminOnboarding"));
const AdminPushNotifications = lazy(() => import("./pages/AdminPushNotifications"));
const AdminNovidades = lazy(() => import("./pages/AdminNovidades"));
const AdminFinanceiro = lazy(() => import("./pages/AdminFinanceiro"));
const TesteStripe = lazy(() => import("./pages/TesteStripe"));
const CompletarCadastro = lazy(() => import("./pages/CompletarCadastro"));
const CadastroPlano = lazy(() => import("./pages/CadastroPlano"));
const Novidades = lazy(() => import("./pages/Novidades"));
const OnboardingObrigatorio = lazy(() => import("./pages/OnboardingObrigatorio"));
const InstalarApp = lazy(() => import("./pages/InstalarApp"));
const Tutoriais = lazy(() => import("./pages/Tutoriais"));
const Equipe = lazy(() => import("./pages/Equipe"));
const Orcamentos = lazy(() => import("./pages/Orcamentos"));
const Fidelidade = lazy(() => import("./pages/Fidelidade"));
const MultiEmpresas = lazy(() => import("./pages/MultiEmpresas"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AcompanharOS = lazy(() => import("./pages/AcompanharOS"));

const RouteFallback = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="w-10 h-10 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutos — dados são "frescos" e não re-buscados ao navegar
      gcTime: 1000 * 60 * 10,   // 10 minutos — cache permanece em memória
      refetchOnWindowFocus: false, // Não re-buscar ao alternar janelas
      retry: 1, // Apenas 1 retry em caso de erro
    },
  },
});

function AppRoutes() {
  const { isRestoring } = useSessionRestore();

  if (isRestoring) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <InstallPrompt />
      <TrialEndWarning />
      <Suspense fallback={<RouteFallback />}>
      <Routes>
          {/* Rotas públicas */}
          <Route path="/" element={<Landing />} />
          <Route path="/lp1" element={<LandingLP1 />} />
          <Route path="/lp2" element={<LandingLP2 />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/auth" element={<Auth />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/obrigado" element={<Obrigado />} />
          <Route path="/completar-cadastro" element={<CompletarCadastro />} />
          <Route path="/cadastro-plano" element={<CadastroPlano />} />
          <Route path="/instalar-app" element={<InstalarApp />} />
          <Route path="/video-boas-vindas" element={<VideoBoasVindas />} />
          <Route path="/onboarding-inicial" element={<OnboardingObrigatorio />} />
          {/* Rotas legadas - redirecionar para auth */}
          <Route path="/cadastro-trial" element={<Auth />} />
          <Route path="/ativar-trial" element={<Auth />} />
          <Route path="/c/:slug" element={<CatalogoPublico />} />
          <Route path="/lp/:slug" element={<LandingPagePublica />} />
          <Route path="/acompanhar/:token" element={<AcompanharOS />} />
          
          {/* Rotas protegidas - exigem autenticação + onboarding + trial/assinatura + permissão funcionário */}
          <Route path="/dashboard" element={
            <ProtectedAppRoute>
              <Dashboard />
            </ProtectedAppRoute>
          } />
          <Route path="/novidades" element={
            <ProtectedAppRoute>
              <ComVerificacaoFuncionario modulo="novidades">
                <Novidades />
              </ComVerificacaoFuncionario>
            </ProtectedAppRoute>
          } />
          <Route path="/pdv" element={
            <ProtectedAppRoute>
              <ComVerificacaoFuncionario modulo="pdv">
                <ComVerificacaoPlano modulo="pdv">
                  <PDV />
                </ComVerificacaoPlano>
              </ComVerificacaoFuncionario>
            </ProtectedAppRoute>
          } />
          <Route path="/os" element={
            <ProtectedAppRoute>
              <ComVerificacaoFuncionario modulo="ordem_servico">
                <ComVerificacaoPlano modulo="ordem_servico">
                  <OrdemServico />
                </ComVerificacaoPlano>
              </ComVerificacaoFuncionario>
            </ProtectedAppRoute>
          } />
          <Route path="/produtos" element={
            <ProtectedAppRoute>
              <ComVerificacaoFuncionario modulo="produtos_pecas">
                <ComVerificacaoPlano modulo="produtos_pecas">
                  <Produtos />
                </ComVerificacaoPlano>
              </ComVerificacaoFuncionario>
            </ProtectedAppRoute>
          } />
          <Route path="/servicos" element={
            <ProtectedAppRoute>
              <ComVerificacaoFuncionario modulo="servicos">
                <ComVerificacaoPlano modulo="servicos">
                  <Servicos />
                </ComVerificacaoPlano>
              </ComVerificacaoFuncionario>
            </ProtectedAppRoute>
          } />
          <Route path="/dispositivos" element={
            <ProtectedAppRoute>
              <ComVerificacaoFuncionario modulo="dispositivos">
                <ComVerificacaoPlano modulo="dispositivos">
                  <Dispositivos />
                </ComVerificacaoPlano>
              </ComVerificacaoFuncionario>
            </ProtectedAppRoute>
          } />
          <Route path="/catalogo" element={
            <ProtectedAppRoute>
              <ComVerificacaoFuncionario modulo="catalogo">
                <ComVerificacaoPlano modulo="dispositivos">
                  <CatalogoDispositivos />
                </ComVerificacaoPlano>
              </ComVerificacaoFuncionario>
            </ProtectedAppRoute>
          } />
          <Route path="/origem-dispositivos" element={
            <ProtectedAppRoute>
              <ComVerificacaoFuncionario modulo="origem_dispositivos">
                <ComVerificacaoPlano modulo="dispositivos">
                  <OrigemDispositivos />
                </ComVerificacaoPlano>
              </ComVerificacaoFuncionario>
            </ProtectedAppRoute>
          } />
          <Route path="/fornecedores" element={
            <ProtectedAppRoute>
              <ComVerificacaoFuncionario modulo="fornecedores">
                <ComVerificacaoPlano modulo="fornecedores">
                  <Fornecedores />
                </ComVerificacaoPlano>
              </ComVerificacaoFuncionario>
            </ProtectedAppRoute>
          } />
          <Route path="/contas" element={
            <ProtectedAppRoute>
              <ComVerificacaoFuncionario modulo="contas">
                <ComVerificacaoPlano modulo="contas">
                  <Contas />
                </ComVerificacaoPlano>
              </ComVerificacaoFuncionario>
            </ProtectedAppRoute>
          } />
          <Route path="/clientes" element={
            <ProtectedAppRoute>
              <ComVerificacaoFuncionario modulo="clientes">
                <ComVerificacaoPlano modulo="clientes">
                  <Clientes />
                </ComVerificacaoPlano>
              </ComVerificacaoFuncionario>
            </ProtectedAppRoute>
          } />
          <Route path="/fidelidade" element={
            <ProtectedAppRoute>
              <Fidelidade />
            </ProtectedAppRoute>
          } />
          <Route path="/multi-empresas" element={
            <ProtectedAppRoute>
              <MultiEmpresas />
            </ProtectedAppRoute>
          } />
          <Route path="/plano" element={
            <ProtectedAppRoute>
              <Plano />
            </ProtectedAppRoute>
          } />
          <Route path="/vendas" element={
            <ProtectedAppRoute>
              <ComVerificacaoFuncionario modulo="vendas">
                <ComVerificacaoPlano modulo="vendas">
                  <Vendas />
                </ComVerificacaoPlano>
              </ComVerificacaoFuncionario>
            </ProtectedAppRoute>
          } />
          <Route path="/relatorios" element={
            <ProtectedAppRoute>
              <ComVerificacaoFuncionario modulo="relatorios">
                <ComVerificacaoPlano modulo="vendas">
                  <Relatorios />
                </ComVerificacaoPlano>
              </ComVerificacaoFuncionario>
            </ProtectedAppRoute>
          } />
          <Route path="/financeiro" element={
            <ProtectedAppRoute>
              <ComVerificacaoFuncionario modulo="financeiro">
                <ComVerificacaoPlano modulo="financeiro">
                  <Financeiro />
                </ComVerificacaoPlano>
              </ComVerificacaoFuncionario>
            </ProtectedAppRoute>
          } />
          <Route path="/configuracoes" element={
            <ProtectedAppRoute>
              <ComVerificacaoFuncionario modulo="configuracoes">
                <ComVerificacaoPlano modulo="configuracoes">
                  <Configuracoes />
                </ComVerificacaoPlano>
              </ComVerificacaoFuncionario>
            </ProtectedAppRoute>
          } />
          <Route path="/orcamentos" element={
            <ProtectedAppRoute>
              <ComVerificacaoFuncionario modulo="orcamentos">
                <ComVerificacaoPlano modulo="orcamentos">
                  <Orcamentos />
                </ComVerificacaoPlano>
              </ComVerificacaoFuncionario>
            </ProtectedAppRoute>
          } />
          <Route path="/suporte" element={
            <ProtectedAppRoute>
              <ComVerificacaoFuncionario modulo="suporte">
                <Suporte />
              </ComVerificacaoFuncionario>
            </ProtectedAppRoute>
          } />
          <Route path="/equipe" element={
            <ProtectedAppRoute>
              <ComVerificacaoFuncionario modulo="equipe">
                <Equipe />
              </ComVerificacaoFuncionario>
            </ProtectedAppRoute>
          } />
          <Route path="/tutoriais" element={
            <ProtectedAppRoute>
              <ComVerificacaoFuncionario modulo="tutoriais">
                <Tutoriais />
              </ComVerificacaoFuncionario>
            </ProtectedAppRoute>
          } />
          
          {/* Rotas admin - também protegidas */}
          <Route path="/admin/financeiro" element={
            <ProtectedAppRoute>
              <AdminFinanceiro />
            </ProtectedAppRoute>
          } />
          <Route path="/admin/usuarios" element={
            <ProtectedAppRoute>
              <AdminUsuarios />
            </ProtectedAppRoute>
          } />
          <Route path="/admin/notificacoes" element={
            <ProtectedAppRoute>
              <AdminNotificacoes />
            </ProtectedAppRoute>
          } />
          <Route path="/admin/avisos" element={
            <ProtectedAppRoute>
              <AdminAvisos />
            </ProtectedAppRoute>
          } />
          <Route path="/admin/feedbacks" element={
            <ProtectedAppRoute>
              <AdminFeedbacks />
            </ProtectedAppRoute>
          } />
          <Route path="/admin/chat" element={
            <ProtectedAppRoute>
              <AdminChatSuporte />
            </ProtectedAppRoute>
          } />
          <Route path="/admin/onboarding" element={
            <ProtectedAppRoute>
              <AdminOnboarding />
            </ProtectedAppRoute>
          } />
          <Route path="/admin/push" element={
            <ProtectedAppRoute>
              <AdminPushNotifications />
            </ProtectedAppRoute>
          } />
          <Route path="/admin/novidades" element={
            <ProtectedAppRoute>
              <AdminNovidades />
            </ProtectedAppRoute>
          } />
          <Route path="/admin/stripe/teste" element={
            <ProtectedAppRoute>
              <TesteStripe />
            </ProtectedAppRoute>
          } />
          
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TooltipProvider>
        <EmpresaProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </EmpresaProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;