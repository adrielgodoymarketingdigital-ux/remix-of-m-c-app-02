import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useRemessasCorporativas, RemessaItem } from "@/hooks/useRemessasCorporativas";
import { supabase } from "@/integrations/supabase/client";
import { useOSStatusConfigContext } from "@/contexts/OSStatusConfigContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, ChevronDown, ChevronRight, Eye, ExternalLink, FileText, Plus, Printer, QrCode, Search, Trash2 } from "lucide-react";
import { getPrintScript, getAndroidPrintCSS } from "@/lib/print-utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCurrency } from "@/lib/formatters";

const STATUS_LABEL: Record<string, string> = {
  ativa: "Ativa",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

interface OSHistorico {
  id: string;
  numero_os: string;
  status: string | null;
  created_at: string | null;
  defeito_relatado: string | null;
  total: number | null;
  dispositivo_marca: string | null;
  dispositivo_modelo: string | null;
  dispositivo_imei: string | null;
  clientes: { nome: string | null } | null;
}

function urlEntrada(itemId: string) {
  return `https://appmec.in/entrada/${itemId}`;
}

function RemessaDetalheContent() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { remessas, loading, adicionarItem, removerItem } = useRemessasCorporativas();
  const { statusList } = useOSStatusConfigContext();

  const remessa = useMemo(() => remessas.find((r) => r.id === id), [remessas, id]);

  const statusColors = useMemo(
    () => Object.fromEntries(statusList.map((s) => [s.slug, s.cor])),
    [statusList]
  );
  const statusLabels = useMemo(
    () => Object.fromEntries(statusList.map((s) => [s.slug, s.nome])),
    [statusList]
  );

  const [dialogAberto, setDialogAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [cor, setCor] = useState("");
  const [imei, setImei] = useState("");
  const [numeroSerie, setNumeroSerie] = useState("");
  const [defeitoPadrao, setDefeitoPadrao] = useState("");

  const [itemQrCode, setItemQrCode] = useState<RemessaItem | null>(null);
  const printContainerRef = useRef<HTMLDivElement>(null);

  const [osPorId, setOsPorId] = useState<Record<string, OSHistorico>>({});
  const [itensExpandidos, setItensExpandidos] = useState<Record<string, boolean>>({});
  const [buscaImei, setBuscaImei] = useState("");
  const [osPreview, setOsPreview] = useState<OSHistorico | null>(null);

  const resetForm = () => {
    setMarca("");
    setModelo("");
    setCor("");
    setImei("");
    setNumeroSerie("");
    setDefeitoPadrao("");
  };

  const todosOsIds = useMemo(() => {
    const ids = (remessa?.itens || []).flatMap((item) => item.os_ids || []);
    return Array.from(new Set(ids));
  }, [remessa]);

  useEffect(() => {
    const buscarHistoricoOS = async () => {
      if (todosOsIds.length === 0) {
        setOsPorId({});
        return;
      }

      const { data, error } = await supabase
        .from("ordens_servico")
        .select(
          "id, numero_os, status, created_at, defeito_relatado, total, dispositivo_marca, dispositivo_modelo, dispositivo_imei, clientes(nome)"
        )
        .in("id", todosOsIds);

      if (error) {
        console.error("Erro ao carregar histórico de OS:", error);
        return;
      }

      const mapa: Record<string, OSHistorico> = {};
      (data || []).forEach((os) => {
        mapa[os.id] = os as OSHistorico;
      });
      setOsPorId(mapa);
    };

    buscarHistoricoOS();
  }, [todosOsIds]);

  const toggleHistorico = (itemId: string) => {
    setItensExpandidos((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const handleAdicionar = async () => {
    if (!remessa || !modelo.trim()) return;

    setSalvando(true);
    const novo = await adicionarItem(remessa.id, {
      marca: marca.trim() || undefined,
      modelo: modelo.trim(),
      cor: cor.trim() || undefined,
      imei: imei.trim() || undefined,
      numero_serie: numeroSerie.trim() || undefined,
      defeito_padrao: defeitoPadrao.trim() || undefined,
    });
    setSalvando(false);

    if (novo) {
      setDialogAberto(false);
      resetForm();
    }
  };

  const handleRemover = async (itemId: string) => {
    if (!confirm("Deseja realmente excluir este dispositivo da remessa?")) return;
    await removerItem(itemId);
  };

  const handleImprimir = () => {
    if (!remessa || !remessa.itens || remessa.itens.length === 0) return;

    const container = printContainerRef.current;
    if (!container) return;

    const serializer = new XMLSerializer();
    const svgs = Array.from(container.querySelectorAll("svg"));

    const blocosHtml = (remessa.itens || [])
      .map((item, index) => {
        const svg = svgs[index];
        const svgHtml = svg ? serializer.serializeToString(svg) : "";
        return `
          <div class="qr-item">
            ${svgHtml}
            <div class="qr-info">
              <p class="qr-modelo">${item.marca ? `${item.marca} ` : ""}${item.modelo}</p>
              ${item.imei ? `<p class="qr-imei">IMEI: ${item.imei}</p>` : ""}
            </div>
          </div>
        `;
      })
      .join("");

    const janelaImpressao = window.open("", "_blank");
    if (!janelaImpressao) return;

    janelaImpressao.document.write(`
      <html>
        <head>
          <title>QR Codes - ${remessa.nome}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
            }
            h1 {
              text-align: center;
              font-size: 18px;
              margin-bottom: 20px;
            }
            .qr-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 24px;
            }
            .qr-item {
              text-align: center;
              page-break-inside: avoid;
              border: 1px solid #ccc;
              padding: 12px;
              border-radius: 8px;
            }
            .qr-item svg {
              width: 140px;
              height: 140px;
            }
            .qr-info {
              margin-top: 8px;
            }
            .qr-modelo {
              font-weight: bold;
              font-size: 13px;
              margin: 0;
            }
            .qr-imei {
              font-size: 11px;
              color: #444;
              margin: 2px 0 0;
            }
            ${getAndroidPrintCSS()}
          </style>
        </head>
        <body>
          <h1>${remessa.nome}</h1>
          <div class="qr-grid">
            ${blocosHtml}
          </div>
          ${getPrintScript()}
        </body>
      </html>
    `);
    janelaImpressao.document.close();
  };

  if (loading) {
    return (
      <main className="flex-1 p-6">
        <p className="text-muted-foreground">Carregando remessa...</p>
      </main>
    );
  }

  if (!remessa) {
    return (
      <main className="flex-1 p-6 space-y-4">
        <Button variant="ghost" onClick={() => navigate("/remessas")} className="gap-1 -ml-2">
          <ArrowLeft className="h-4 w-4" /> Voltar para Remessas
        </Button>
        <p className="text-muted-foreground">Remessa não encontrada.</p>
      </main>
    );
  }

  const itens = remessa.itens || [];
  const itensFiltrados = buscaImei.trim()
    ? itens.filter((item) => {
        const termo = buscaImei.trim().toLowerCase();
        const imei = (item.imei || "").toLowerCase();
        const serie = (item.numero_serie || "").toLowerCase();
        return imei.includes(termo) || imei.endsWith(termo) || serie.includes(termo);
      })
    : itens;

  return (
    <main className="flex-1 p-6 space-y-6">
      <Button variant="ghost" onClick={() => navigate("/remessas")} className="gap-1 -ml-2">
        <ArrowLeft className="h-4 w-4" /> Voltar para Remessas
      </Button>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{remessa.nome}</h1>
            <Badge>{STATUS_LABEL[remessa.status] || remessa.status}</Badge>
          </div>
          <p className="text-muted-foreground">
            {remessa.cliente_nome || "Sem cliente vinculado"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleImprimir} disabled={itens.length === 0}>
            <Printer className="h-4 w-4 mr-2" />
            Imprimir QR Codes
          </Button>
          <Button onClick={() => setDialogAberto(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Dispositivo
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por IMEI completo, últimos 3 dígitos ou nº de série..."
          value={buscaImei}
          onChange={(e) => setBuscaImei(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {itensFiltrados.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              Nenhum dispositivo adicionado a esta remessa.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Marca</TableHead>
                  <TableHead>Modelo</TableHead>
                  <TableHead>Cor</TableHead>
                  <TableHead>IMEI</TableHead>
                  <TableHead>Nº Série</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Histórico de OS</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itensFiltrados.map((item) => {
                  const osIds = item.os_ids || [];
                  const osHistorico = osIds
                    .map((osId) => osPorId[osId])
                    .filter((os): os is OSHistorico => !!os);
                  const expandido = !!itensExpandidos[item.id];

                  return (
                  <Fragment key={item.id}>
                  <TableRow>
                    <TableCell>{item.marca || "-"}</TableCell>
                    <TableCell>{item.modelo}</TableCell>
                    <TableCell>{item.cor || "-"}</TableCell>
                    <TableCell>{item.imei || "-"}</TableCell>
                    <TableCell>{item.numero_serie || "-"}</TableCell>
                    <TableCell>
                      <Badge
                        className={
                          item.status === "recebido"
                            ? "bg-green-500 hover:bg-green-500"
                            : "bg-yellow-500 hover:bg-yellow-500"
                        }
                      >
                        {item.status === "recebido" ? "Recebido" : "Pendente"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {osIds.length === 0 ? (
                        <span className="text-sm text-muted-foreground">Nenhuma OS ainda</span>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1 -ml-2"
                          onClick={() => toggleHistorico(item.id)}
                        >
                          {expandido ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          Ver {osIds.length} OS
                        </Button>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setItemQrCode(item)}
                        title="Ver QR Code"
                      >
                        <QrCode className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemover(item.id)}
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                  {expandido && osIds.length > 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="bg-muted/30">
                        <div className="space-y-2 py-2">
                          {osHistorico.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Carregando histórico...</p>
                          ) : (
                            osHistorico.map((os) => {
                              const cor = statusColors[os.status || ""] || "#eab308";
                              const label = statusLabels[os.status || ""] || os.status || "-";
                              return (
                                <div
                                  key={os.id}
                                  className="flex items-center justify-between gap-4 text-sm bg-background rounded-md border px-3 py-2"
                                >
                                  <div className="flex items-center gap-4">
                                    <span className="font-medium">OS {os.numero_os}</span>
                                    <span className="text-muted-foreground">
                                      {os.created_at
                                        ? new Date(os.created_at).toLocaleDateString("pt-BR")
                                        : "-"}
                                    </span>
                                    <span
                                      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-semibold border"
                                      style={{ color: cor, borderColor: `${cor}35`, backgroundColor: `${cor}10` }}
                                    >
                                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cor }} />
                                      {label}
                                    </span>
                                  </div>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setOsPreview(os)}
                                  >
                                    <Eye className="h-3.5 w-3.5 mr-1" />
                                    Ver OS
                                  </Button>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  </Fragment>
                );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Container oculto usado para gerar o SVG de cada QR Code na hora de imprimir */}
      <div ref={printContainerRef} className="hidden">
        {itens.map((item) => (
          <QRCodeSVG key={item.id} value={urlEntrada(item.id)} size={140} />
        ))}
      </div>

      <Dialog
        open={dialogAberto}
        onOpenChange={(v) => {
          setDialogAberto(v);
          if (!v) resetForm();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Dispositivo</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Marca</Label>
                <Input
                  placeholder="Ex: Apple, Samsung..."
                  value={marca}
                  onChange={(e) => setMarca(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Modelo *</Label>
                <Input
                  placeholder="Ex: iPhone 13"
                  value={modelo}
                  onChange={(e) => setModelo(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Cor</Label>
              <Input
                placeholder="Ex: Preto"
                value={cor}
                onChange={(e) => setCor(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>IMEI</Label>
                <Input value={imei} onChange={(e) => setImei(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Número de Série</Label>
                <Input
                  value={numeroSerie}
                  onChange={(e) => setNumeroSerie(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Defeito Padrão</Label>
              <Input
                placeholder="Ex: Tela quebrada"
                value={defeitoPadrao}
                onChange={(e) => setDefeitoPadrao(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAdicionar} disabled={!modelo.trim() || salvando}>
              {salvando ? "Salvando..." : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!osPreview} onOpenChange={(open) => !open && setOsPreview(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {osPreview?.numero_os}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Status:</span>
              {osPreview && (() => {
                const cor = statusColors[osPreview.status || ""] || "#eab308";
                const label = statusLabels[osPreview.status || ""] || osPreview.status || "-";
                return (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-semibold border"
                    style={{ color: cor, borderColor: `${cor}35`, backgroundColor: `${cor}10` }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cor }} />
                    {label}
                  </span>
                );
              })()}
            </div>
            {osPreview?.clientes?.nome && (
              <div className="flex gap-2 text-sm">
                <span className="text-muted-foreground">Cliente:</span>
                <span className="font-medium">{osPreview.clientes.nome}</span>
              </div>
            )}
            {osPreview?.dispositivo_modelo && (
              <div className="flex gap-2 text-sm">
                <span className="text-muted-foreground">Dispositivo:</span>
                <span className="font-medium">
                  {osPreview.dispositivo_marca} {osPreview.dispositivo_modelo}
                </span>
              </div>
            )}
            {osPreview?.dispositivo_imei && (
              <div className="flex gap-2 text-sm">
                <span className="text-muted-foreground">IMEI:</span>
                <span className="font-mono text-xs">{osPreview.dispositivo_imei}</span>
              </div>
            )}
            {osPreview?.defeito_relatado && (
              <div className="flex gap-2 text-sm">
                <span className="text-muted-foreground">Defeito:</span>
                <span>{osPreview.defeito_relatado}</span>
              </div>
            )}
            {!!osPreview?.total && osPreview.total > 0 && (
              <div className="flex gap-2 text-sm">
                <span className="text-muted-foreground">Valor:</span>
                <span className="font-medium">{formatCurrency(osPreview.total)}</span>
              </div>
            )}
            <div className="flex gap-2 text-sm">
              <span className="text-muted-foreground">Criada em:</span>
              <span>
                {osPreview?.created_at
                  ? format(new Date(osPreview.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                  : ""}
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOsPreview(null)}>
              Fechar
            </Button>
            <Button
              onClick={() => {
                if (osPreview) navigate(`/os?numero=${encodeURIComponent(osPreview.numero_os)}`);
                setOsPreview(null);
              }}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Abrir OS Completa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!itemQrCode} onOpenChange={(v) => !v && setItemQrCode(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>
              {itemQrCode ? `${itemQrCode.marca ? `${itemQrCode.marca} ` : ""}${itemQrCode.modelo}` : ""}
            </DialogTitle>
          </DialogHeader>
          {itemQrCode && (
            <div className="flex flex-col items-center gap-3 py-2">
              <QRCodeSVG value={urlEntrada(itemQrCode.id)} size={200} />
              {itemQrCode.imei && (
                <p className="text-sm text-muted-foreground">IMEI: {itemQrCode.imei}</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}

export default function RemessaDetalhe() {
  return (
    <AppLayout>
      <RemessaDetalheContent />
    </AppLayout>
  );
}
