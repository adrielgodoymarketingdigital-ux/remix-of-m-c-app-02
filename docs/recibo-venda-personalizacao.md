# Recibo de venda personalizado (A4) — quem vê o quê e o freio de emergência

## Regra (opt-in por loja)

A loja só passa a imprimir o recibo de venda **novo (A4)** depois que o dono
salva uma personalização em "Personalizar recibo de venda". Quem nunca salvou
continua com o recibo de sempre, sem nenhuma diferença (provado byte a byte
contra a origin/main 15bc8db no PDV, em Vendas com a reimpressão e em
Dispositivos vendidos).

Toda a regra mora em `src/lib/vendas/visibilidadeReciboNovo.ts`; os hooks de
`src/hooks/useReciboVendaNovoVisivel.ts` só chamam as funções de lá.

| Papel | Loja sem personalização | Loja com personalização |
|---|---|---|
| Admin do MecApp | recibo novo · vê a tela | recibo novo · vê a tela |
| Dono | recibo de sempre · vê a tela | recibo novo · vê a tela |
| Funcionário | recibo de sempre · não vê a tela | recibo novo (config do dono) · não vê a tela |
| Gerente de filial | recibo de sempre · não vê a tela | recibo novo (linha própria) · não vê a tela |

- "Personalizado" = `configuracoes_loja.recibo_venda_config` é um objeto, na
  mesma linha que o diálogo de recibo já lê (filial → a dela; filial sem linha
  própria → a da matriz; funcionário → a do dono). Nenhuma consulta a mais.
- NULL, coluna ausente, valor que não é objeto, configuração carregando ou que
  falhou → recibo de sempre.
- "Restaurar padrão" + Salvar grava NULL: a loja volta ao recibo de sempre. O
  diálogo avisa o que o Salvar fará (4 estados, `avisoAtivacaoReciboVenda`).
- 80 mm, 58 mm, "Copiar texto" e o modo "Termo de garantia" de Dispositivos
  continuam sempre no recibo antigo. No iPhone com o app instalado, Dispositivos
  continua saindo pelo PDF próprio (antigo), também para admin.
- Filial sem linha própria: o dono vê só a prévia, com a mensagem para
  configurar na matriz.

## Freio de emergência

Em `src/lib/vendas/visibilidadeReciboNovo.ts`:

```ts
export const PERSONALIZACAO_RECIBO_VENDA_LIBERADA = true;
```

Trocar para `false` e publicar: o recibo novo e a tela voltam a ser só do
admin, para todas as lojas (inclusive as que já personalizaram). Nada no banco
muda; o que as lojas salvaram volta a valer quando a constante voltar a `true`.
Teste: `scripts/testes-recibo-venda-novo/visibilidadeReciboNovo.test.ts`
confere o valor da constante (atualizar junto).

## Histórico

- 26/10 13:51 `f4b0619` recibo novo liberado a todos; 20:32 `eb10994` freio
  (só admin). O motivo não está escrito no commit. Evidência encontrada em
  `~/Downloads/recibo-pwa/resultado.json` (diagnóstico das 20:21–20:31): com o
  recibo liberado, o botão A4 ficava apagado para sempre quando a configuração
  da loja não chegava (ex.: funcionário cujo dono não tinha configuração) ou a
  leitura da venda travava; e no iPhone com o app instalado o recibo abria numa
  janela sem saída. Corrigido na mesma noite (`1a602c3..c5ac878`: camada do iOS
  instalado e tempo máximo de 8 s), já na main.
