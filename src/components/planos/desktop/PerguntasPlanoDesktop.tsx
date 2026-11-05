import { CircleHelp } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card } from "@/components/ui/card";
import { PERGUNTAS_PLANO } from "@/components/planos/perguntasPlano";

/** Perguntas frequentes em 2 colunas; abrir uma não estica a vizinha. */
export function PerguntasPlanoDesktop() {
  return (
    <Card className="p-4">
      <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-foreground">
        <CircleHelp className="h-[18px] w-[18px]" />
        Perguntas Frequentes
      </h2>
      <Accordion type="single" collapsible className="grid grid-cols-2 items-start gap-x-3 gap-y-2">
        {PERGUNTAS_PLANO.map(({ id, pergunta, resposta }) => (
          <AccordionItem key={id} value={id} className="min-w-0 rounded-lg border border-border px-3">
            <AccordionTrigger className="min-h-10 gap-2 py-2 text-left text-[13px] font-medium leading-snug tracking-normal text-foreground hover:no-underline">
              {pergunta}
            </AccordionTrigger>
            <AccordionContent className="text-[13px] leading-relaxed text-muted-foreground">{resposta}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </Card>
  );
}
