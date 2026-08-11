import { Navigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { CompatibilidadePeliculaAdmin } from "@/components/admin/CompatibilidadePeliculaAdmin";
import { useIsAdminMecApp } from "@/hooks/useCompatibilidadePelicula";

export default function AdminCompatibilidadePelicula() {
  const { data: isAdmin, isLoading } = useIsAdminMecApp();

  if (!isLoading && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <AppLayout>
      <main className="flex-1 p-4 sm:p-6 overflow-auto space-y-6">
        <CompatibilidadePeliculaAdmin />
      </main>
    </AppLayout>
  );
}
