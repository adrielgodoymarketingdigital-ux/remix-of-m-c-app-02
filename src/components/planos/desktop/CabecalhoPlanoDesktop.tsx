import { Link } from "react-router-dom";
import { Crown, House } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

/** Breadcrumb e título da tela de Plano no computador. */
export function CabecalhoPlanoDesktop() {
  return (
    <header className="mx-auto mb-5 max-w-[1700px]">
      <Breadcrumb className="mb-3">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link
                to="/dashboard"
                aria-label="Ir para o Dashboard"
                className="-ml-2 inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-muted"
              >
                <House className="h-4 w-4" />
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Plano do Sistema</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <div className="flex items-center gap-4">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-blue-700 to-blue-500 text-white shadow-sm">
          <Crown className="h-7 w-7" />
        </div>
        <div className="min-w-0">
          <h1 className="text-[28px] font-bold leading-tight tracking-tight text-foreground">Plano do Sistema</h1>
          <p className="text-sm text-muted-foreground">Gerencie sua assinatura</p>
        </div>
      </div>
    </header>
  );
}
