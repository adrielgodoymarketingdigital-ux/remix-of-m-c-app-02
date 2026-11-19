# Pendências — Ordem de Serviço A4 em uma folha

Diagnóstico de 19/11/2026 (branch `fix/os-a4-uma-folha`). A **fase 1** (layout
Personalizado: compactação medida em níveis 0 a 3 e, quando nem assim cabe,
2 folhas com termo + assinaturas inteiros) está nesta branch. Ficaram de fora,
por decisão, as fases abaixo.

Harness com dados fictícios para medir e provar: `~/Downloads/harness-os-a4`
(`medir.cjs` mede cada seção em mm e conta as folhas nos 3 caminhos de impressão).

## Fase 2 — Padrão e Tech cortam conteúdo acima de 277 mm no computador (prioridade ALTA)

**O problema.** Na impressão do navegador (computador e iPhone pelo Safari), o
`index.css` prende o recibo em uma folha com `max-height: 277mm; overflow: hidden`
(`src/index.css`, regra `.impressao-ordem-container` dentro de `@media print`).
O que passa de 277 mm **não vai para a folha 2: some sem aviso.**

Provado no harness:
- Padrão, OS "grande" (checklist de entrada e saída + 10 avarias + senha padrão):
  333 mm de conteúdo, 1 folha impressa, **sem garantia e sem assinaturas**.
- Tech, mesma OS: 300 mm, **sem assinaturas**.
- No Android (documento isolado do iframe) a mesma OS sai em 2 folhas, inteira.

**Caminho sugerido** (mesmo princípio da fase 1, nível 0 = HTML/CSS de hoje):
1. Tirar o corte silencioso (paginar, como o Android) só quando o conteúdo passar da folha.
2. Compactar por colunas: senha, checklists e avarias numa linha só e cabeçalho
   dos blocos mais baixo. No experimento: Padrão "grande" 333 → 258 mm, Tech 300 → 239 mm.
   **Sem reduzir fonte**: o Padrão/Tech já imprime campos em 7 pt e o termo em 5,5 pt.
3. Termo + assinaturas inteiros, juntos, levando o bloco anterior (como na fase 1).

**Risco a resolver antes:** o computador e o Android usam CSS diferentes para
o Padrão/Tech (o Android copia só algumas regras e tem 4 mm de folga a mais).
A medição precisaria montar um documento de prova num iframe com as regras de
impressão, como já se faz no cupom de 80 mm (`medirAlturaCupom80mmPx`).

**Achado junto (vale para os 3 layouts no Android):** o documento isolado do
iframe (`handlePrintAndroid` em `ImpressaoOrdemServico.tsx`) só copia algumas
regras de CSS e **não leva o Tailwind**. O desenho das avarias
(`SilhuetaComAvarias`) depende de classes do Tailwind: no Android as marcações
saem empilhadas fora do desenho e a legenda quebra em várias linhas, o que
deixa o cartão bem mais alto. Na fase 1 isso foi resolvido **só no Personalizado
quando há ajuste** (o recibo leva as mesmas regras). No Padrão, no Tech e no
Personalizado sem ajuste o defeito continua; a correção natural é a mesma
réplica (ou levar essas classes no filtro de CSS do Android), junto com a fase 2.

## Fase 3 — PDF jsPDF (iPhone com app instalado no Padrão/Tech e envio por WhatsApp)

`src/lib/gerarOrdemServicoPDF.ts` desenha a OS por conta própria (margens de
15 mm, área útil de 260 mm):
- sai **sempre com 2 páginas ou mais**, mesmo na OS sem checklist nem avarias
  (as assinaturas vão para a página 2);
- o termo é escrito linha a linha com quebra de página no meio, então **a garantia
  pode ser partida entre duas páginas**;
- o bloco de avarias pede muito espaço livre e empurra tudo que vem depois.

É um desenho separado do HTML; precisa de uma etapa própria (medidas, regra de
quebra que não parta o termo e, se for o caso, compactação).
