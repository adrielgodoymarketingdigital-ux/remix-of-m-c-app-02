import { Component, type ReactNode } from "react";
import type { ReciboVendaModelo } from "@/lib/vendas/reciboVendaModelo";
import { ReciboVendaNovo } from "./ReciboVendaNovo";

interface Props {
  modelo: ReciboVendaModelo;
  /** Chamado uma vez se o recibo novo quebrar ao desenhar: a tela volta ao recibo antigo. */
  onFalha: () => void;
}

/**
 * ReciboVendaNovo com rede de segurança: qualquer erro ao desenhar não deixa
 * tela em branco nem toast — avisa quem usa (onFalha), que volta ao recibo de
 * sempre, e só registra no console.
 */
export class ReciboVendaNovoSeguro extends Component<Props, { falhou: boolean }> {
  state = { falhou: false };

  static getDerivedStateFromError() {
    return { falhou: true };
  }

  componentDidCatch(erro: unknown) {
    console.error("[recibo novo] falha ao desenhar; usando o recibo antigo", erro);
    this.props.onFalha();
  }

  render(): ReactNode {
    return this.state.falhou ? null : <ReciboVendaNovo modelo={this.props.modelo} />;
  }
}
