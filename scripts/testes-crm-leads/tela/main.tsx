// Monta SÓ o card "Funil do WhatsApp" com os mesmos provedores do app
// (React Query + toasts). Usado por tela.playwright.mjs, que simula o Supabase.
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { CardFunilWhatsApp } from "@/components/admin/marketing/CardFunilWhatsApp";
import "@/index.css";

const qc = new QueryClient();
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={qc}>
    <main className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <CardFunilWhatsApp />
    </main>
    <Toaster />
  </QueryClientProvider>,
);
