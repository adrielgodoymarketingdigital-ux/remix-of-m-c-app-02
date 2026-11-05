import { Clock, CreditCard, Headphones, Shield, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

const BENEFICIOS: { Icone: LucideIcon; cor: string; titulo: string; texto: string }[] = [
  { Icone: Shield, cor: "bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400", titulo: "7 Dias de Garantia", texto: "Ou seu dinheiro de volta" },
  { Icone: Clock, cor: "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400", titulo: "Ativação Imediata", texto: "Acesso liberado na hora" },
  { Icone: Headphones, cor: "bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-400", titulo: "Suporte em Português", texto: "Atendimento humanizado" },
  { Icone: CreditCard, cor: "bg-sky-100 text-sky-600 dark:bg-sky-900 dark:text-sky-400", titulo: "Pagamento Seguro", texto: "Seus dados protegidos e criptografados" },
];

export function BeneficiosPlanoDesktop() {
  return (
    <div className="mt-3 grid grid-cols-2 gap-3 min-[1484px]:grid-cols-4">
      {BENEFICIOS.map(({ Icone, cor, titulo, texto }) => (
        <Card key={titulo} className="flex min-w-0 items-center gap-3 p-3">
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${cor}`}>
            <Icone className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{titulo}</p>
            <p className="text-xs text-muted-foreground">{texto}</p>
          </div>
        </Card>
      ))}
    </div>
  );
}
