/**
 * Tipo unificado para itens do catálogo (dispositivos, produtos e peças)
 */
export type TipoItemCatalogo = 'dispositivo' | 'produto' | 'peca';

export interface ItemCatalogo {
  id: string;
  tipo_item: TipoItemCatalogo;
  nome: string;
  subtitulo?: string;
  preco?: number | null;
  preco_promocional?: number | null;
  fotos: string[];
  foto_url?: string;
  quantidade: number;
  created_at: string;
  // Device-specific fields
  marca?: string;
  modelo?: string;
  tipo_dispositivo?: string;
  cor?: string;
  capacidade_gb?: number;
  condicao?: 'novo' | 'semi_novo' | 'usado';
  garantia?: boolean;
  tempo_garantia?: number;
  saude_bateria?: number;
  subtipo_computador?: string;
  vendido?: boolean;
  // Product-specific
  sku?: string | null;
  codigo_barras?: string | null;
}

// Helper to convert Dispositivo to ItemCatalogo
import { Dispositivo } from './dispositivo';
import { ItemEstoque } from './produto';

export function dispositivoParaItemCatalogo(d: Dispositivo): ItemCatalogo {
  const fotos: string[] = [];
  if (d.foto_url) fotos.push(d.foto_url);
  if (d.fotos && Array.isArray(d.fotos)) {
    d.fotos.forEach(f => { if (f && !fotos.includes(f)) fotos.push(f); });
  }

  return {
    id: d.id,
    tipo_item: 'dispositivo',
    nome: `${d.marca} ${d.modelo}`,
    subtitulo: d.tipo,
    preco: d.preco,
    preco_promocional: d.preco_promocional,
    fotos,
    foto_url: d.foto_url,
    quantidade: d.quantidade,
    created_at: d.created_at,
    marca: d.marca,
    modelo: d.modelo,
    tipo_dispositivo: d.tipo,
    cor: d.cor,
    capacidade_gb: d.capacidade_gb,
    condicao: d.condicao,
    garantia: d.garantia,
    tempo_garantia: d.tempo_garantia,
    saude_bateria: d.saude_bateria,
    subtipo_computador: d.subtipo_computador,
    vendido: d.vendido,
  };
}

export function produtoParaItemCatalogo(item: ItemEstoque): ItemCatalogo {
  const fotos = Array.isArray(item.fotos) ? item.fotos : [];

  return {
    id: item.id,
    tipo_item: item.tipo === 'produto' ? 'produto' : 'peca',
    nome: item.nome,
    subtitulo: item.tipo === 'produto' ? (item as any).sku || undefined : undefined,
    preco: item.preco,
    preco_promocional: null,
    fotos,
    foto_url: fotos[0] || undefined,
    quantidade: item.quantidade,
    created_at: item.created_at,
    sku: item.tipo === 'produto' ? (item as any).sku : undefined,
    codigo_barras: item.codigo_barras,
  };
}
