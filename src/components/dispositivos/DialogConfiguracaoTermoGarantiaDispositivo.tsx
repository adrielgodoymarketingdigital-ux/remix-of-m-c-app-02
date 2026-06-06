import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useConfiguracaoLoja } from "@/hooks/useConfiguracaoLoja";
import { toast } from "@/hooks/use-toast";
import { Loader2, RotateCcw, ChevronDown, ChevronUp, Eye, Pencil, Plus, Trash2, BookOpen, Check, X } from "lucide-react";

export interface SecaoTermo {
  id: string;
  titulo: string;
  conteudo: string;
  visivel: boolean;
}

export interface ModeloGarantia {
  id: string;
  nome: string;
  secoes_com_garantia: SecaoTermo[];
  secoes_sem_garantia: SecaoTermo[];
}

export interface TermoGarantiaDispositivoConfig {
  // Modo legado — texto livre único
  termo_com_garantia?: string;
  termo_sem_garantia?: string;
  // Modo seções (novo)
  modo?: "livre" | "secoes";
  secoes_com_garantia?: SecaoTermo[];
  secoes_sem_garantia?: SecaoTermo[];
  // Modelos de garantia salvos
  modelos?: ModeloGarantia[];
}

const VARIAVEIS_DISPONIVEIS = [
  { tag: "{{cliente}}", descricao: "Nome do cliente" },
  { tag: "{{cpf}}", descricao: "CPF do cliente" },
  { tag: "{{telefone}}", descricao: "Telefone do cliente" },
  { tag: "{{dispositivo}}", descricao: "Marca e modelo" },
  { tag: "{{imei}}", descricao: "IMEI do aparelho" },
  { tag: "{{numero_serie}}", descricao: "Número de série" },
  { tag: "{{cor}}", descricao: "Cor do aparelho" },
  { tag: "{{capacidade}}", descricao: "Capacidade (GB)" },
  { tag: "{{condicao}}", descricao: "Condição (Novo/Usado)" },
  { tag: "{{garantia_meses}}", descricao: "Meses de garantia" },
  { tag: "{{valor}}", descricao: "Valor da venda" },
  { tag: "{{data_venda}}", descricao: "Data da venda" },
  { tag: "{{loja}}", descricao: "Nome da loja" },
  { tag: "{{loja_telefone}}", descricao: "Telefone da loja" },
  { tag: "{{loja_cnpj}}", descricao: "CNPJ da loja" },
  { tag: "{{loja_endereco}}", descricao: "Endereço da loja" },
];

const SECOES_PADRAO_COM_GARANTIA: SecaoTermo[] = [
  {
    id: "cabecalho_loja",
    titulo: "Cabeçalho — Dados da Loja",
    visivel: true,
    conteudo: `Loja: {{loja}}
CNPJ: {{loja_cnpj}}
Endereço: {{loja_endereco}}
Telefone: {{loja_telefone}}`,
  },
  {
    id: "dados_comprador",
    titulo: "Dados do Comprador",
    visivel: true,
    conteudo: `COMPRADOR
Nome: {{cliente}}
CPF: {{cpf}}
Telefone: {{telefone}}`,
  },
  {
    id: "dados_produto",
    titulo: "Dados do Produto",
    visivel: true,
    conteudo: `PRODUTO
Aparelho: {{dispositivo}}
IMEI: {{imei}}
Nº Série: {{numero_serie}}
Cor: {{cor}}  |  Capacidade: {{capacidade}}
Condição: {{condicao}}
Data da venda: {{data_venda}}
Valor pago: {{valor}}`,
  },
  {
    id: "garantia_legal",
    titulo: "1. Garantia Legal (CDC)",
    visivel: true,
    conteudo: `1. GARANTIA LEGAL (CDC - Lei 8.078/90)
   • Garantia legal de 90 (noventa) dias, conforme Art. 26, II do CDC.
   • Cobre defeitos de fabricação ou vícios que comprometam o funcionamento.`,
  },
  {
    id: "garantia_contratual",
    titulo: "2. Garantia Contratual",
    visivel: true,
    conteudo: `2. GARANTIA CONTRATUAL ({{garantia_meses}} meses)
   • Garantia adicional de {{garantia_meses}} meses a partir da data desta venda.
   • Complementar à garantia legal, conforme Art. 50 do CDC.
   • Cobre defeitos de fabricação, excluindo mau uso, quedas ou oxidação.`,
  },
  {
    id: "direitos_consumidor",
    titulo: "3. Direitos do Consumidor",
    visivel: true,
    conteudo: `3. DIREITOS DO CONSUMIDOR
   • Vício do produto: substituição, devolução ou abatimento (Art. 18 CDC).
   • Prazo suspenso durante reparo (Art. 26, §2º CDC).
   • Conserve este documento como comprovante.`,
  },
  {
    id: "exclusoes",
    titulo: "4. Exclusões de Garantia",
    visivel: true,
    conteudo: `4. EXCLUSÕES
   • Quedas, impactos, contato com líquidos, uso inadequado.
   • Violação de lacres ou reparo por terceiros não autorizados.
   • Desgaste natural de uso.`,
  },
  {
    id: "rodape",
    titulo: "Rodapé / Instrução Final",
    visivel: true,
    conteudo: `Para acionamento da garantia, apresente este termo na loja.`,
  },
];

const SECOES_PADRAO_SEM_GARANTIA: SecaoTermo[] = [
  {
    id: "cabecalho_loja",
    titulo: "Cabeçalho — Dados da Loja",
    visivel: true,
    conteudo: `Loja: {{loja}}
CNPJ: {{loja_cnpj}}`,
  },
  {
    id: "dados_comprador",
    titulo: "Dados do Comprador",
    visivel: true,
    conteudo: `COMPRADOR
Nome: {{cliente}}
CPF: {{cpf}}`,
  },
  {
    id: "dados_produto",
    titulo: "Dados do Produto",
    visivel: true,
    conteudo: `PRODUTO
Aparelho: {{dispositivo}}
IMEI: {{imei}}
Condição: {{condicao}}
Data da venda: {{data_venda}}
Valor pago: {{valor}}`,
  },
  {
    id: "aviso_sem_garantia",
    titulo: "Aviso — Sem Garantia Contratual",
    visivel: true,
    conteudo: `AVISO: Este produto é vendido sem garantia contratual adicional.
A garantia legal de 90 dias prevista no CDC (Art. 26, II) se aplica conforme a legislação.
O cliente declara estar ciente das condições do equipamento.`,
  },
];

const TEXTO_LIVRE_PADRAO = {
  termo_com_garantia: `TERMO DE GARANTIA

Loja: {{loja}}
CNPJ: {{loja_cnpj}}
Endereço: {{loja_endereco}}
Telefone: {{loja_telefone}}

COMPRADOR
Nome: {{cliente}}
CPF: {{cpf}}
Telefone: {{telefone}}

PRODUTO
Aparelho: {{dispositivo}}
IMEI: {{imei}}
Nº Série: {{numero_serie}}
Cor: {{cor}}  |  Capacidade: {{capacidade}}
Condição: {{condicao}}
Data da venda: {{data_venda}}
Valor pago: {{valor}}

1. GARANTIA LEGAL (CDC - Lei 8.078/90)
   • Garantia legal de 90 (noventa) dias, conforme Art. 26, II do CDC.
   • Cobre defeitos de fabricação ou vícios que comprometam o funcionamento.

2. GARANTIA CONTRATUAL ({{garantia_meses}} meses)
   • Garantia adicional de {{garantia_meses}} meses a partir da data desta venda.
   • Complementar à garantia legal, conforme Art. 50 do CDC.
   • Cobre defeitos de fabricação, excluindo mau uso, quedas ou oxidação.

3. DIREITOS DO CONSUMIDOR
   • Vício do produto: substituição, devolução ou abatimento (Art. 18 CDC).
   • Prazo suspenso durante reparo (Art. 26, §2º CDC).
   • Conserve este documento como comprovante.

4. EXCLUSÕES
   • Quedas, impactos, contato com líquidos, uso inadequado.
   • Violação de lacres ou reparo por terceiros não autorizados.
   • Desgaste natural de uso.

Para acionamento da garantia, apresente este termo na loja.`,

  termo_sem_garantia: `DECLARAÇÃO DE VENDA SEM GARANTIA CONTRATUAL

Loja: {{loja}}
CNPJ: {{loja_cnpj}}

COMPRADOR
Nome: {{cliente}}
CPF: {{cpf}}

PRODUTO
Aparelho: {{dispositivo}}
IMEI: {{imei}}
Condição: {{condicao}}
Data da venda: {{data_venda}}
Valor pago: {{valor}}

AVISO: Este produto é vendido sem garantia contratual adicional.
A garantia legal de 90 dias prevista no CDC (Art. 26, II) se aplica conforme a legislação.
O cliente declara estar ciente das condições do equipamento.`,
};

const MODELOS_PADRAO: ModeloGarantia[] = [
  {
    id: "padrao_90dias",
    nome: "Garantia 90 dias",
    secoes_com_garantia: SECOES_PADRAO_COM_GARANTIA.map((s) =>
      s.id === "garantia_contratual"
        ? {
            ...s,
            conteudo: `2. GARANTIA CONTRATUAL ({{garantia_meses}} meses)
   • Garantia adicional de {{garantia_meses}} meses a partir da data desta venda.
   • Complementar à garantia legal, conforme Art. 50 do CDC.
   • Cobre defeitos de fabricação, excluindo mau uso, quedas ou oxidação.`,
          }
        : s
    ),
    secoes_sem_garantia: SECOES_PADRAO_SEM_GARANTIA,
  },
  {
    id: "padrao_6meses",
    nome: "Garantia 6 meses",
    secoes_com_garantia: SECOES_PADRAO_COM_GARANTIA.map((s) =>
      s.id === "garantia_contratual"
        ? {
            ...s,
            conteudo: `2. GARANTIA CONTRATUAL (6 meses)
   • Garantia adicional de 6 (seis) meses a partir da data desta venda.
   • Complementar à garantia legal de 90 dias (CDC Art. 26, II).
   • Cobre defeitos de fabricação, excluindo mau uso, quedas ou oxidação.`,
          }
        : s
    ),
    secoes_sem_garantia: SECOES_PADRAO_SEM_GARANTIA,
  },
  {
    id: "padrao_1ano",
    nome: "Garantia 1 ano",
    secoes_com_garantia: SECOES_PADRAO_COM_GARANTIA.map((s) =>
      s.id === "garantia_contratual"
        ? {
            ...s,
            conteudo: `2. GARANTIA CONTRATUAL (12 meses)
   • Garantia adicional de 12 (doze) meses a partir da data desta venda.
   • Complementar à garantia legal de 90 dias (CDC Art. 26, II).
   • Cobre defeitos de fabricação, excluindo mau uso, quedas ou oxidação.`,
          }
        : s
    ),
    secoes_sem_garantia: SECOES_PADRAO_SEM_GARANTIA,
  },
];

function gerarIdModelo(): string {
  return `modelo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function secoesParaTexto(secoes: SecaoTermo[]): string {
  return secoes
    .filter((s) => s.visivel)
    .map((s) => s.conteudo.trim())
    .join("\n\n");
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: () => void;
}

export function DialogConfiguracaoTermoGarantiaDispositivo({ open, onOpenChange, onSave }: Props) {
  const { config, atualizarConfiguracao } = useConfiguracaoLoja();
  const [modo, setModo] = useState<"livre" | "secoes">("secoes");
  const [textoLivreComGarantia, setTextoLivreComGarantia] = useState(TEXTO_LIVRE_PADRAO.termo_com_garantia);
  const [textoLivreSemGarantia, setTextoLivreSemGarantia] = useState(TEXTO_LIVRE_PADRAO.termo_sem_garantia);
  const [secoesComGarantia, setSecoesComGarantia] = useState<SecaoTermo[]>(SECOES_PADRAO_COM_GARANTIA);
  const [secoesSemGarantia, setSecoesSemGarantia] = useState<SecaoTermo[]>(SECOES_PADRAO_SEM_GARANTIA);
  const [modelos, setModelos] = useState<ModeloGarantia[]>(MODELOS_PADRAO);
  const [novoModeloNome, setNovoModeloNome] = useState("");
  const [modeloParaExcluir, setModeloParaExcluir] = useState<string | null>(null);
  const [modeloEditandoId, setModeloEditandoId] = useState<string | null>(null);
  const [modeloEditNome, setModeloEditNome] = useState("");
  const [modeloEditSecoesComGarantia, setModeloEditSecoesComGarantia] = useState<SecaoTermo[]>([]);
  const [modeloEditSecoesSemGarantia, setModeloEditSecoesSemGarantia] = useState<SecaoTermo[]>([]);
  const [modeloEditSecaoEditando, setModeloEditSecaoEditando] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [mostrarVariaveis, setMostrarVariaveis] = useState(false);
  const [secaoEditando, setSecaoEditando] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const termoConfig = config?.termo_garantia_dispositivo_config as TermoGarantiaDispositivoConfig | undefined;
    if (termoConfig) {
      const modoSalvo = termoConfig.modo || "secoes";
      setModo(modoSalvo);
      if (modoSalvo === "secoes") {
        setSecoesComGarantia(termoConfig.secoes_com_garantia || SECOES_PADRAO_COM_GARANTIA);
        setSecoesSemGarantia(termoConfig.secoes_sem_garantia || SECOES_PADRAO_SEM_GARANTIA);
      } else {
        setTextoLivreComGarantia(termoConfig.termo_com_garantia || TEXTO_LIVRE_PADRAO.termo_com_garantia);
        setTextoLivreSemGarantia(termoConfig.termo_sem_garantia || TEXTO_LIVRE_PADRAO.termo_sem_garantia);
      }
    } else {
      setModo("secoes");
      setSecoesComGarantia(SECOES_PADRAO_COM_GARANTIA);
      setSecoesSemGarantia(SECOES_PADRAO_SEM_GARANTIA);
    }
    setModelos(termoConfig?.modelos?.length ? termoConfig.modelos : MODELOS_PADRAO);
    setSecaoEditando(null);
    setNovoModeloNome("");
  }, [config, open]);

  const handleSalvar = async () => {
    try {
      setSalvando(true);

      const payload: TermoGarantiaDispositivoConfig = { modo, modelos };

      if (modo === "secoes") {
        payload.secoes_com_garantia = secoesComGarantia;
        payload.secoes_sem_garantia = secoesSemGarantia;
        // Gerar texto livre de compatibilidade para o DialogReciboVenda (legado)
        payload.termo_com_garantia = secoesParaTexto(secoesComGarantia);
        payload.termo_sem_garantia = secoesParaTexto(secoesSemGarantia);
      } else {
        payload.termo_com_garantia = textoLivreComGarantia;
        payload.termo_sem_garantia = textoLivreSemGarantia;
      }

      const sucesso = await atualizarConfiguracao({ termo_garantia_dispositivo_config: payload as any });
      if (!sucesso) throw new Error("Falha ao salvar");

      toast({ title: "Termos salvos", description: "Termos de garantia do dispositivo atualizados." });
      onSave?.();
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast({ title: "Erro ao salvar", description: "Não foi possível salvar os termos.", variant: "destructive" });
    } finally {
      setSalvando(false);
    }
  };

  const restaurarPadrao = () => {
    if (modo === "secoes") {
      setSecoesComGarantia(SECOES_PADRAO_COM_GARANTIA);
      setSecoesSemGarantia(SECOES_PADRAO_SEM_GARANTIA);
    } else {
      setTextoLivreComGarantia(TEXTO_LIVRE_PADRAO.termo_com_garantia);
      setTextoLivreSemGarantia(TEXTO_LIVRE_PADRAO.termo_sem_garantia);
    }
    setSecaoEditando(null);
  };

  const aplicarModelo = (modelo: ModeloGarantia) => {
    setSecoesComGarantia(modelo.secoes_com_garantia);
    setSecoesSemGarantia(modelo.secoes_sem_garantia);
    setSecaoEditando(null);
    toast({ title: `Modelo "${modelo.nome}" aplicado`, description: "Revise e salve para confirmar." });
  };

  const salvarComoModelo = () => {
    const nome = novoModeloNome.trim();
    if (!nome) return;
    const novoModelo: ModeloGarantia = {
      id: gerarIdModelo(),
      nome,
      secoes_com_garantia: secoesComGarantia,
      secoes_sem_garantia: secoesSemGarantia,
    };
    setModelos((prev) => [...prev, novoModelo]);
    setNovoModeloNome("");
    toast({ title: "Modelo salvo", description: `"${nome}" adicionado à lista de modelos.` });
  };

  const excluirModelo = (id: string) => {
    setModelos((prev) => prev.filter((m) => m.id !== id));
    setModeloParaExcluir(null);
    if (modeloEditandoId === id) setModeloEditandoId(null);
  };

  const abrirEdicaoModelo = (modelo: ModeloGarantia) => {
    setModeloEditandoId(modelo.id);
    setModeloEditNome(modelo.nome);
    setModeloEditSecoesComGarantia(modelo.secoes_com_garantia);
    setModeloEditSecoesSemGarantia(modelo.secoes_sem_garantia);
    setModeloEditSecaoEditando(null);
  };

  const confirmarEdicaoModelo = () => {
    if (!modeloEditandoId) return;
    setModelos((prev) =>
      prev.map((m) =>
        m.id === modeloEditandoId
          ? {
              ...m,
              nome: modeloEditNome.trim() || m.nome,
              secoes_com_garantia: modeloEditSecoesComGarantia,
              secoes_sem_garantia: modeloEditSecoesSemGarantia,
            }
          : m
      )
    );
    setModeloEditandoId(null);
    toast({ title: "Modelo atualizado", description: "As alterações foram salvas no modelo." });
  };

  const cancelarEdicaoModelo = () => {
    setModeloEditandoId(null);
    setModeloEditSecaoEditando(null);
  };

  const toggleSecao = (lista: SecaoTermo[], setLista: (v: SecaoTermo[]) => void, id: string) => {
    setLista(lista.map((s) => s.id === id ? { ...s, visivel: !s.visivel } : s));
  };

  const editarConteudoSecao = (lista: SecaoTermo[], setLista: (v: SecaoTermo[]) => void, id: string, conteudo: string) => {
    setLista(lista.map((s) => s.id === id ? { ...s, conteudo } : s));
  };

  const ListaSecoes = ({
    secoes,
    setSecoes,
    prefixo,
  }: {
    secoes: SecaoTermo[];
    setSecoes: (v: SecaoTermo[]) => void;
    prefixo: string;
  }) => (
    <div className="space-y-3">
      {secoes.map((secao) => (
        <div
          key={secao.id}
          className={`border rounded-lg overflow-hidden transition-colors ${!secao.visivel ? "opacity-60" : ""}`}
        >
          <div className="flex items-center justify-between px-4 py-3 bg-muted/40">
            <div className="flex items-center gap-3">
              <Switch
                id={`${prefixo}-${secao.id}`}
                checked={secao.visivel}
                onCheckedChange={() => toggleSecao(secoes, setSecoes, secao.id)}
              />
              <Label htmlFor={`${prefixo}-${secao.id}`} className="text-sm font-medium cursor-pointer select-none">
                {secao.titulo}
              </Label>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-muted-foreground"
              onClick={() => setSecaoEditando(secaoEditando === `${prefixo}-${secao.id}` ? null : `${prefixo}-${secao.id}`)}
            >
              <Pencil className="h-3.5 w-3.5 mr-1" />
              Editar texto
            </Button>
          </div>

          {secaoEditando === `${prefixo}-${secao.id}` && (
            <div className="p-3 border-t bg-background">
              <Textarea
                value={secao.conteudo}
                onChange={(e) => editarConteudoSecao(secoes, setSecoes, secao.id, e.target.value)}
                rows={Math.min(Math.max(secao.conteudo.split("\n").length + 1, 3), 10)}
                className="text-xs font-mono"
              />
            </div>
          )}

          {!secaoEditando?.startsWith(`${prefixo}-${secao.id}`) && secao.visivel && (
            <div className="px-4 py-2 border-t bg-background/50">
              <p className="text-xs text-muted-foreground font-mono whitespace-pre-line line-clamp-3">
                {secao.conteudo}
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  );

  const PreviewTexto = ({ secoes }: { secoes: SecaoTermo[] }) => {
    const texto = secoesParaTexto(secoes);
    return (
      <div className="border rounded-lg p-4 bg-muted/30">
        <div className="flex items-center gap-2 mb-3">
          <Eye className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">Pré-visualização do texto final</span>
        </div>
        <pre className="text-xs font-mono whitespace-pre-wrap text-foreground/80 max-h-48 overflow-y-auto">
          {texto || "(nenhuma seção ativa)"}
        </pre>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Termo de Garantia — Dispositivos Vendidos</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Variáveis disponíveis */}
          <div className="border rounded-lg overflow-hidden">
            <button
              type="button"
              className="w-full flex items-center justify-between px-4 py-3 bg-muted/50 text-sm font-medium hover:bg-muted transition-colors"
              onClick={() => setMostrarVariaveis((v) => !v)}
            >
              <span>Variáveis disponíveis — clique para copiar</span>
              {mostrarVariaveis ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {mostrarVariaveis && (
              <div className="p-3 flex flex-wrap gap-2">
                {VARIAVEIS_DISPONIVEIS.map(({ tag, descricao }) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors font-mono text-xs"
                    title={descricao}
                    onClick={() => {
                      navigator.clipboard?.writeText(tag).catch(() => {});
                      toast({ title: "Copiado!", description: `${tag} — ${descricao}` });
                    }}
                  >
                    {tag}
                  </Badge>
                ))}
                <p className="w-full text-xs text-muted-foreground mt-1">
                  Clique para copiar. Cole no texto — será substituída pelos dados reais na impressão.
                </p>
              </div>
            )}
          </div>

          {/* Modo de edição */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Switch
                id="modo-secoes"
                checked={modo === "secoes"}
                onCheckedChange={(v) => {
                  setModo(v ? "secoes" : "livre");
                  setSecaoEditando(null);
                }}
              />
              <div>
                <Label htmlFor="modo-secoes" className="text-sm font-medium cursor-pointer">
                  Modo por seções
                </Label>
                <p className="text-xs text-muted-foreground">
                  {modo === "secoes"
                    ? "Ative/desative blocos individualmente e edite cada um separadamente."
                    : "Texto livre completo — você controla tudo diretamente."}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Conteúdo */}
          <Tabs defaultValue="com_garantia">
            <TabsList className="w-full">
              <TabsTrigger value="com_garantia" className="flex-1">
                Com Garantia
              </TabsTrigger>
              <TabsTrigger value="sem_garantia" className="flex-1">
                Sem Garantia
              </TabsTrigger>
              <TabsTrigger value="modelos" className="flex-1 gap-1.5">
                <BookOpen className="h-3.5 w-3.5" />
                Modelos
              </TabsTrigger>
            </TabsList>

            <TabsContent value="com_garantia" className="space-y-4 mt-4">
              <p className="text-xs text-muted-foreground">
                Usado quando o dispositivo possui garantia cadastrada.
              </p>

              {modo === "secoes" ? (
                <>
                  <ListaSecoes
                    secoes={secoesComGarantia}
                    setSecoes={setSecoesComGarantia}
                    prefixo="com"
                  />
                  <PreviewTexto secoes={secoesComGarantia} />
                </>
              ) : (
                <div className="space-y-2">
                  <Textarea
                    value={textoLivreComGarantia}
                    onChange={(e) => setTextoLivreComGarantia(e.target.value)}
                    rows={20}
                    className="text-xs font-mono"
                  />
                </div>
              )}
            </TabsContent>

            <TabsContent value="sem_garantia" className="space-y-4 mt-4">
              <p className="text-xs text-muted-foreground">
                Usado quando o dispositivo não possui garantia contratual.
              </p>

              {modo === "secoes" ? (
                <>
                  <ListaSecoes
                    secoes={secoesSemGarantia}
                    setSecoes={setSecoesSemGarantia}
                    prefixo="sem"
                  />
                  <PreviewTexto secoes={secoesSemGarantia} />
                </>
              ) : (
                <div className="space-y-2">
                  <Textarea
                    value={textoLivreSemGarantia}
                    onChange={(e) => setTextoLivreSemGarantia(e.target.value)}
                    rows={12}
                    className="text-xs font-mono"
                  />
                </div>
              )}
            </TabsContent>

            {/* ABA MODELOS */}
            <TabsContent value="modelos" className="space-y-4 mt-4">
              <p className="text-xs text-muted-foreground">
                Modelos salvam as seções de Com Garantia e Sem Garantia atuais. Ao aplicar um modelo, as seções ativas serão substituídas pelo modelo escolhido.
              </p>

              {/* Salvar seções atuais como modelo */}
              <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
                <p className="text-sm font-medium">Salvar configuração atual como modelo</p>
                <div className="flex gap-2">
                  <Input
                    placeholder="Nome do modelo (ex: Garantia 6 meses)"
                    value={novoModeloNome}
                    onChange={(e) => setNovoModeloNome(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && salvarComoModelo()}
                    className="text-sm"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="shrink-0 gap-1.5"
                    onClick={salvarComoModelo}
                    disabled={!novoModeloNome.trim()}
                  >
                    <Plus className="h-4 w-4" />
                    Salvar
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  As seções editadas nas abas "Com Garantia" e "Sem Garantia" serão salvas neste modelo.
                </p>
              </div>

              <Separator />

              {/* Lista de modelos */}
              <div className="space-y-2">
                {modelos.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum modelo salvo. Crie o primeiro modelo acima.
                  </p>
                )}
                {modelos.map((modelo) => {
                  const editando = modeloEditandoId === modelo.id;
                  return (
                    <div key={modelo.id} className="border rounded-lg overflow-hidden">
                      {/* Cabeçalho do card */}
                      <div className="flex items-center justify-between px-4 py-3 gap-3 bg-muted/20">
                        {editando ? (
                          <Input
                            value={modeloEditNome}
                            onChange={(e) => setModeloEditNome(e.target.value)}
                            className="text-sm h-8 flex-1"
                            autoFocus
                          />
                        ) : (
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{modelo.nome}</p>
                            <p className="text-xs text-muted-foreground">
                              {modelo.secoes_com_garantia.filter((s) => s.visivel).length} seções c/ garantia
                              {" · "}
                              {modelo.secoes_sem_garantia.filter((s) => s.visivel).length} seções s/ garantia
                            </p>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {editando ? (
                            <>
                              <Button
                                type="button"
                                variant="default"
                                size="sm"
                                className="gap-1.5 h-8"
                                onClick={confirmarEdicaoModelo}
                              >
                                <Check className="h-3.5 w-3.5" />
                                Salvar
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-muted-foreground"
                                onClick={cancelarEdicaoModelo}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="gap-1.5 h-8"
                                onClick={() => aplicarModelo(modelo)}
                              >
                                <Check className="h-3.5 w-3.5" />
                                Aplicar
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-muted-foreground"
                                onClick={() => abrirEdicaoModelo(modelo)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                onClick={() => setModeloParaExcluir(modelo.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Painel de edição das seções */}
                      {editando && (
                        <div className="border-t p-4 space-y-4 bg-background">
                          <Tabs defaultValue="edit_com">
                            <TabsList className="w-full">
                              <TabsTrigger value="edit_com" className="flex-1 text-xs">Com Garantia</TabsTrigger>
                              <TabsTrigger value="edit_sem" className="flex-1 text-xs">Sem Garantia</TabsTrigger>
                            </TabsList>
                            <TabsContent value="edit_com" className="mt-3 space-y-2">
                              {modeloEditSecoesComGarantia.map((secao) => (
                                <div key={secao.id} className="border rounded-lg overflow-hidden">
                                  <div className="flex items-center justify-between px-3 py-2 bg-muted/30">
                                    <div className="flex items-center gap-2">
                                      <Switch
                                        checked={secao.visivel}
                                        onCheckedChange={() =>
                                          setModeloEditSecoesComGarantia((prev) =>
                                            prev.map((s) => s.id === secao.id ? { ...s, visivel: !s.visivel } : s)
                                          )
                                        }
                                      />
                                      <span className="text-xs font-medium">{secao.titulo}</span>
                                    </div>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 px-2 text-muted-foreground"
                                      onClick={() =>
                                        setModeloEditSecaoEditando(
                                          modeloEditSecaoEditando === `editcom-${secao.id}` ? null : `editcom-${secao.id}`
                                        )
                                      }
                                    >
                                      <Pencil className="h-3 w-3 mr-1" />
                                      <span className="text-xs">Editar</span>
                                    </Button>
                                  </div>
                                  {modeloEditSecaoEditando === `editcom-${secao.id}` && (
                                    <div className="p-2 border-t">
                                      <Textarea
                                        value={secao.conteudo}
                                        onChange={(e) =>
                                          setModeloEditSecoesComGarantia((prev) =>
                                            prev.map((s) => s.id === secao.id ? { ...s, conteudo: e.target.value } : s)
                                          )
                                        }
                                        rows={Math.min(Math.max(secao.conteudo.split("\n").length + 1, 3), 8)}
                                        className="text-xs font-mono"
                                      />
                                    </div>
                                  )}
                                </div>
                              ))}
                            </TabsContent>
                            <TabsContent value="edit_sem" className="mt-3 space-y-2">
                              {modeloEditSecoesSemGarantia.map((secao) => (
                                <div key={secao.id} className="border rounded-lg overflow-hidden">
                                  <div className="flex items-center justify-between px-3 py-2 bg-muted/30">
                                    <div className="flex items-center gap-2">
                                      <Switch
                                        checked={secao.visivel}
                                        onCheckedChange={() =>
                                          setModeloEditSecoesSemGarantia((prev) =>
                                            prev.map((s) => s.id === secao.id ? { ...s, visivel: !s.visivel } : s)
                                          )
                                        }
                                      />
                                      <span className="text-xs font-medium">{secao.titulo}</span>
                                    </div>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 px-2 text-muted-foreground"
                                      onClick={() =>
                                        setModeloEditSecaoEditando(
                                          modeloEditSecaoEditando === `editsem-${secao.id}` ? null : `editsem-${secao.id}`
                                        )
                                      }
                                    >
                                      <Pencil className="h-3 w-3 mr-1" />
                                      <span className="text-xs">Editar</span>
                                    </Button>
                                  </div>
                                  {modeloEditSecaoEditando === `editsem-${secao.id}` && (
                                    <div className="p-2 border-t">
                                      <Textarea
                                        value={secao.conteudo}
                                        onChange={(e) =>
                                          setModeloEditSecoesSemGarantia((prev) =>
                                            prev.map((s) => s.id === secao.id ? { ...s, conteudo: e.target.value } : s)
                                          )
                                        }
                                        rows={Math.min(Math.max(secao.conteudo.split("\n").length + 1, 3), 8)}
                                        className="text-xs font-mono"
                                      />
                                    </div>
                                  )}
                                </div>
                              ))}
                            </TabsContent>
                          </Tabs>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Confirmação exclusão de modelo */}
        <AlertDialog open={!!modeloParaExcluir} onOpenChange={(open) => !open && setModeloParaExcluir(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir modelo?</AlertDialogTitle>
              <AlertDialogDescription>
                O modelo "{modelos.find((m) => m.id === modeloParaExcluir)?.nome}" será removido permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => modeloParaExcluir && excluirModelo(modeloParaExcluir)}
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button type="button" variant="ghost" onClick={restaurarPadrao} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Restaurar padrão
          </Button>
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSalvar} disabled={salvando}>
              {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
