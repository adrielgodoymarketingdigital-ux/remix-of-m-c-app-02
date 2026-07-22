import { Component, ReactNode, ErrorInfo } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// Sem isso, qualquer exceção de render (ex: localStorage bloqueado em
// WebViews in-app, falha de inicialização de algum provider) desmonta a
// árvore inteira e deixa tela branca sem nenhum fallback visível.
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // DEBUG TEMPORÁRIO — remover após identificar a causa raiz do erro "_id"
    console.error("Erro não tratado capturado pelo ErrorBoundary:", error);
    console.error("[DEBUG] error.message:", error?.message);
    console.error("[DEBUG] error.stack:", error?.stack);
    console.error("[DEBUG] component stack:", errorInfo?.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
          <h1 className="text-xl font-semibold text-foreground">Algo deu errado</h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            Ocorreu um erro inesperado ao carregar a página. Tente recarregar.
          </p>
          {/* TEMPORÁRIO: mostrar erro para debug (inclusive em produção, até achar a causa raiz do "_id") */}
          {this.state.error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-xs text-red-800 max-w-full overflow-auto">
              <p className="font-bold mb-1">{this.state.error.message}</p>
              <pre className="whitespace-pre-wrap">{this.state.error.stack}</pre>
            </div>
          )}
          <button
            onClick={() => window.location.reload()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Recarregar página
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
