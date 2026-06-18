import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrocaGarantia } from '@/hooks/useTrocasGarantia';
import { AlertTriangle } from 'lucide-react';

interface RankingProdutosDefeitoProps {
  trocas: TrocaGarantia[];
}

interface ItemRanking {
  nome: string;
  total: number;
}

export const RankingProdutosDefeito = ({ trocas }: RankingProdutosDefeitoProps) => {
  const ranking = useMemo(() => {
    const contagem = new Map<string, ItemRanking>();
    for (const troca of trocas) {
      if (troca.tipo !== 'garantia') continue;
      const chave = troca.produto_defeituoso_nome.trim().toLowerCase();
      if (!chave) continue;
      const atual = contagem.get(chave);
      if (atual) {
        atual.total += 1;
      } else {
        contagem.set(chave, { nome: troca.produto_defeituoso_nome.trim(), total: 1 });
      }
    }
    return Array.from(contagem.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [trocas]);

  if (ranking.length === 0) return null;

  const maiorTotal = ranking[0].total;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          Produtos que mais dão defeito
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {ranking.map((item) => (
          <div key={item.nome} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="font-medium truncate pr-2">{item.nome}</span>
              <span className="text-muted-foreground whitespace-nowrap">
                {item.total} {item.total === 1 ? 'troca' : 'trocas'}
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-amber-500"
                style={{ width: `${(item.total / maiorTotal) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
