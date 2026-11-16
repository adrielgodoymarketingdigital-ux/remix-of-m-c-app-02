# Pendências — Recibo Legal de compra (Origem de Dispositivos)

Anotadas durante a correção "fotos atuais no recibo legal" (branch `fix/recibo-legal-fotos`, nov/2026).
Nenhuma delas é corrigida nessa correção.

## 1. Remover foto na edição apaga do storage antes de salvar

`UploadFotosCompra.removerFoto` (src/components/origem/UploadFotosCompra.tsx) apaga o arquivo do
bucket `compras-fotos` **na hora do clique**, antes de a pessoa salvar a edição da compra.

- Se a pessoa remove uma foto e depois **cancela** a edição, `compras_dispositivos.fotos` continua com
  a URL, mas o arquivo já não existe: a foto aparece como "Expirada" na visualização e vira quadro
  cinza no recibo.
- O mesmo componente é usado no cadastro (`DialogCadastroCompra`).
- Correção sugerida: só marcar para remoção na tela e apagar do storage depois que o update gravar.

## 2. URLs públicas antigas com bucket privado

Os buckets `compras-fotos` e `compras-documentos` nasceram públicos e viraram privados em
`20260306162003` (06/03/2026). Se alguma compra anterior gravou URL pública (`/object/public/...`),
essa URL hoje responde erro e a imagem não carrega (nem na tela, nem no recibo).

- Não conferido na produção. Medir com consulta só de leitura, filtrada por período, antes de decidir.
- Correção possível: na hora de gerar, extrair o caminho do arquivo da URL e criar uma URL assinada nova.

## 3. URLs assinadas de 1 ano expiram

`UploadFotosCompra` e `UploadDocumentosVendedor` gravam `createSignedUrl(..., 1 ano)`. Depois de um
ano a URL gravada na compra expira: a foto aparece como "Expirada" e sai como quadro cinza no recibo.
As primeiras compras com URL assinada começam a expirar por volta de mar/2027.

- Correção possível: gravar o caminho do arquivo (não a URL) ou renovar a URL assinada na hora de
  exibir/gerar (mesma solução do item 2).

## 4. Recibos antigos acumulando em `termos-compra`

`salvarReciboStorage` (src/lib/gerarReciboLegalPDF.ts) cria sempre um arquivo novo
(`recibo-legal-{compraId}-{Date.now()}.pdf`, `upsert: false`) e o `termo_pdf_url` passa a apontar
para ele. O arquivo anterior **fica no storage** sem nenhuma referência no banco (decisão de nov/2026:
sem histórico de recibos, sem coluna nem tabela nova).

- Cada novo "gerar recibo" deixa um PDF órfão no bucket (com imagens reduzidas, ~100–400 KB cada).
- A URL antiga (assinada, 1 ano) continua abrindo o PDF antigo até expirar.
- Se um dia for preciso limpar: listar `termos-compra/{user_id}/recibo-legal-{compraId}-*` e manter só o
  do `termo_pdf_url` atual — conferir antes se o "Começar do zero" (`_zerar_catalogo`) já cobre esse bucket.
