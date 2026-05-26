import { AppLayout } from "@/components/layout/AppLayout";
import { CuponsAdmin } from "@/components/admin/CuponsAdmin";

export default function AdminCupons() {
  return (
    <AppLayout>
      <main className="flex-1 p-4 sm:p-6 overflow-auto space-y-6">
        <CuponsAdmin />
      </main>
    </AppLayout>
  );
}
