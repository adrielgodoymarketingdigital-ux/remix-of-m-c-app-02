import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useCupons } from "@/hooks/useCupons";
import { TabelaCupons } from "@/components/cupons/TabelaCupons";
import { DialogCadastroCupom } from "@/components/cupons/DialogCadastroCupom";
import { Cupom } from "@/types/cupom";
import { AppLayout } from "@/components/layout/AppLayout";

const Cupons = () => {
  const { cupons, loading } = useCupons();
  const [dialogAberto, setDialogAberto] = useState(false);
  const [cupomEditando, setCupomEditando] = useState<Cupom | null>(null);

  return (
    <AppLayout>
      <main className="flex-1 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Cupons de Desconto</h1>
            <p className="text-muted-foreground mt-1 text-sm sm:text-base">
              Gerencie cupons promocionais para suas vendas
            </p>
          </div>
          <Button onClick={() => setDialogAberto(true)} className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            Novo Cupom
          </Button>
        </div>

        <TabelaCupons
          cupons={cupons}
          loading={loading}
          onEditar={(cupom) => {
            setCupomEditando(cupom);
            setDialogAberto(true);
          }}
        />

        <DialogCadastroCupom
          aberto={dialogAberto}
          onFechar={() => {
            setDialogAberto(false);
            setCupomEditando(null);
          }}
          cupomInicial={cupomEditando}
        />
      </main>
    </AppLayout>
  );
};

export default Cupons;
