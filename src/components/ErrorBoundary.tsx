import { Component, ReactNode, ErrorInfo } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

// Sem isso, qualquer exceção de render (ex: localStorage bloqueado em
// WebViews in-app, falha de inicialização de algum provider) desmonta a
// árvore inteira e deixa tela branca sem nenhum fallback visível.
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
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
