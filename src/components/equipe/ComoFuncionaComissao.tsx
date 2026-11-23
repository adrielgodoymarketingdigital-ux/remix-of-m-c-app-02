import { useMemo, useState } from "react";
import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/formatters";
import { calcularExemploComissao } from "@/lib/comissao/exemploComissao";

/**
 * Ajuda "Como funciona a comissão" da tela de Equipe. Os números do exemplo
 * vêm de calcularExemploComissao (as mesmas regras do cálculo de verdade).
 */
export function ComoFuncionaComissao({ className }: { className?: string }) {
  const [aberto, setAberto] = useState(false);
  const ex = useMemo(() => calcularExemploComissao(), []);
  const r = (v: number) => formatCurrency(v);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={className ?? "h-8 gap-1.5 text-muted-foreground hover:text-foreground"}
        onClick={() => setAberto(true)}
      >
        <HelpCircle className="h-4 w-4" />
        Como funciona a comissão?
      </Button>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Como funciona a comissão</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 text-sm leading-relaxed">
            <section className="space-y-1.5">
              <h3 className="font-semibold">1. Quem ganha comissão</h3>
              <p className="text-muted-foreground">
                Cada ordem de serviço tem um Técnico Principal. Você também pode ligar um técnico diferente a cada
                serviço da OS, na etapa de serviços. Cada técnico ganha só sobre o serviço em que está ligado.
              </p>
            </section>

            <section className="space-y-1.5">
              <h3 className="font-semibold">2. Como o valor é calculado</h3>
              <p className="text-muted-foreground">A comissão sai da configuração de cada funcionário em Equipe. Tem duas formas:</p>
              <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                <li>
                  <span className="font-medium text-foreground">Comissão por Tipo de Serviço:</span> você define um
                  percentual ou um valor para cada tipo de serviço (por exemplo, troca de tela). A comissão é calculada
                  sobre o preço daquele serviço, ou sobre o lucro dele (preço menos custo), se você escolher "Lucro" no
                  cadastro do funcionário.
                </li>
                <li>
                  <span className="font-medium text-foreground">Comissão geral (por cargo):</span> um percentual sobre o
                  total das OS em que a pessoa é Técnico Principal, ou um valor fixo por OS. Serviços ligados a outros
                  técnicos com comissão por tipo de serviço configurada não entram nessa conta.
                </li>
              </ul>
              <p className="text-muted-foreground">
                Se o funcionário tiver Comissão por Tipo de Serviço, é ela que vale nas OS dele. A comissão geral dele
                passa a valer só para as vendas.
              </p>
            </section>

            <section className="space-y-1.5">
              <h3 className="font-semibold">3. Exemplo</h3>
              <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                <p className="text-muted-foreground">
                  OS de {r(ex.totalOS)} com dois serviços: Serviço A, {r(ex.servicoA)}, sem técnico ligado, e Serviço B,{" "}
                  {r(ex.servicoB)}, ligado ao técnico Bruno ({ex.percentualTecnico}% por tipo de serviço). O Técnico
                  Principal é a Ana ({ex.percentualPrincipal}%).
                </p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>
                    A Ana ganha {ex.percentualPrincipal}% sobre o Serviço A:{" "}
                    <span className="font-semibold" data-testid="exemplo-principal">{r(ex.principal)}</span>.
                  </li>
                  <li>
                    O Bruno ganha {ex.percentualTecnico}% sobre o Serviço B:{" "}
                    <span className="font-semibold" data-testid="exemplo-tecnico">{r(ex.tecnico)}</span>.
                  </li>
                  <li>Ninguém recebe duas vezes sobre o mesmo serviço.</li>
                </ul>
              </div>
            </section>

            <section className="space-y-1.5">
              <h3 className="font-semibold">4. Regras para lembrar</h3>
              <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                <li>Só OS entregues geram comissão.</li>
                <li>
                  Serviços sem técnico ligado ficam com o Técnico Principal. Se o próprio Técnico Principal também
                  estiver ligado a um serviço da OS, na Comissão por Tipo de Serviço ele ganha só pelos serviços em
                  que está ligado.
                </li>
                <li>
                  Se o técnico ligado ao serviço não tem comissão por tipo de serviço configurada, o serviço continua com
                  o Técnico Principal e esse técnico fica com {r(0)} nele.
                </li>
                <li>
                  Na Comissão por Tipo de Serviço, a comissão é calculada na hora em que a OS é salva. Mudar o percentual
                  do funcionário depois não altera OS já salvas, a não ser que você salve a OS de novo.
                </li>
                <li>Se você salvar uma OS de novo, a comissão dela é recalculada com a configuração atual.</li>
                <li>
                  A comissão geral (por cargo) é calculada na hora em que você abre a tela, com a configuração atual:
                  mudar o percentual muda também os meses anteriores.
                </li>
              </ul>
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
