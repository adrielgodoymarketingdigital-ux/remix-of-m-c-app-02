import { dinheiro } from './formatoItemXml';
import type { ItemNfe } from '@/lib/nfe/lerXmlNfe';

/** Pedaços de exibição de um item da NF-e, usados na leitura (tabela) e no vínculo (cartões). */

export function Fiscal({ item }: { item: ItemNfe }) {
  return (
    <span className="text-xs text-muted-foreground">
      NCM {item.ncm || '—'}{item.cest ? ` · CEST ${item.cest}` : ''} · CFOP {item.cfop || '—'}
    </span>
  );
}

export function Extras({ item }: { item: ItemNfe }) {
  const partes = [
    item.vDesc && Number(item.vDesc) > 0 ? `desc. ${dinheiro(item.vDesc)}` : '',
    item.vFrete && Number(item.vFrete) > 0 ? `frete ${dinheiro(item.vFrete)}` : '',
    item.vSeg && Number(item.vSeg) > 0 ? `seguro ${dinheiro(item.vSeg)}` : '',
    item.vOutro && Number(item.vOutro) > 0 ? `outras ${dinheiro(item.vOutro)}` : '',
    item.vIPI && Number(item.vIPI) > 0 ? `IPI ${dinheiro(item.vIPI)}` : '',
    item.vST && Number(item.vST) > 0 ? `ST ${dinheiro(item.vST)}` : '',
  ].filter(Boolean);
  return partes.length ? <span className="text-xs text-muted-foreground">{partes.join(' · ')}</span> : null;
}

export function Imeis({ item }: { item: ItemNfe }) {
  if (item.imeisSugeridos.length === 0) return null;
  return (
    <div className="text-xs mt-1">
      <span className="text-muted-foreground">IMEI sugerido (confira): </span>
      <span className="font-mono break-all">{item.imeisSugeridos.join(', ')}</span>
    </div>
  );
}
