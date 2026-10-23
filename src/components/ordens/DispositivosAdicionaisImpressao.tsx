import { CheckCircle2, Lock, Smartphone, XCircle } from "lucide-react";
import { LayoutOSConfig } from "@/types/configuracao-loja";
import { SilhuetaComAvarias } from "./SilhuetaComAvarias";
import { PatternLockVisualizacao } from "./PatternLockVisualizacao";
import { checklistIcons } from "@/lib/checklist-icons";
import { decryptSenhaDesbloqueio } from "@/lib/password-encryption";
import {
  imeiOuSerie,
  numeroAdicional,
  tituloDispositivo,
  type DispositivoAdicionalOS,
} from "@/lib/ordemServico/dispositivosAdicionaisOS";

/**
 * Blocos "Dispositivo 2", "Dispositivo 3"... da impressão A4 (Padrão e Tech,
 * inclusive duas OS por folha). Só classes impressao-* (o caminho do Android
 * copia apenas essas regras de CSS). Senha, checklist e avarias seguem as
 * mesmas chaves do layout do dispositivo 1. Sem adicionais não renderiza nada.
 *
 * O A4 da OS é travado em 1 página na impressão (index.css: max-height 277mm +
 * overflow hidden — o que passa é cortado). Com adicionais a trava sai, como já
 * acontece com as fotos (lib/os/fotosImpressaoOS), para nada ser cortado. Em
 * duas OS por folha cada metade tem tamanho fixo: o excesso continua cortado.
 */
const CSS_SEM_TRAVA = `@media print {
  .impressao-ordem-container:has(.impressao-dispositivos-adicionais) { max-height: none !important; overflow: visible !important; }
}`;

interface Props {
  adicionais: DispositivoAdicionalOS[];
  layoutConfig: LayoutOSConfig;
}

export function DispositivosAdicionaisImpressao({ adicionais, layoutConfig }: Props) {
  if (adicionais.length === 0) return null;
  return (
    <div className="impressao-dispositivos-adicionais">
      <style>{CSS_SEM_TRAVA}</style>
      {adicionais.map((a, i) => (
        <BlocoDispositivoAdicional key={a.id} adicional={a} numero={numeroAdicional(i)} layoutConfig={layoutConfig} />
      ))}
    </div>
  );
}

function BlocoDispositivoAdicional({ adicional: a, numero, layoutConfig }: { adicional: DispositivoAdicionalOS; numero: number; layoutConfig: LayoutOSConfig }) {
  const senha = decryptSenhaDesbloqueio(a.senha_desbloqueio ?? undefined);
  const entrada = a.checklist?.entrada || {};
  const saida = a.checklist?.saida || {};
  const frente = a.avarias_visuais.filter((v) => v.lado === "frente");
  const traseira = a.avarias_visuais.filter((v) => v.lado === "traseira");
  const mostrarSenha = !!layoutConfig.mostrar_senha && !!senha;
  const mostrarSemTeste = !!layoutConfig.mostrar_checklist && !!a.checklist?.sem_teste;
  const mostrarEntrada = !!layoutConfig.mostrar_checklist && Object.keys(entrada).length > 0;
  const mostrarSaida = !!layoutConfig.mostrar_checklist && Object.keys(saida).length > 0;
  const mostrarAvarias = !!layoutConfig.mostrar_avarias && a.avarias_visuais.length > 0;

  return (
    <div className="impressao-block">
      <div className="impressao-block-header">
        <Smartphone className="impressao-icon" />
        <h2 className="impressao-block-title">{tituloDispositivo(numero)}</h2>
      </div>
      <div className="impressao-block-content">
        <div className="impressao-field">
          <span className="impressao-label">Tipo/Marca:</span>
          <span className="impressao-value">{a.dispositivo_tipo} {a.dispositivo_marca}</span>
        </div>
        <div className="impressao-field">
          <span className="impressao-label">Modelo/Cor:</span>
          <span className="impressao-value">{a.dispositivo_modelo} ({a.dispositivo_cor || "N/A"})</span>
        </div>
        <div className="impressao-field">
          <span className="impressao-label">IMEI/Série:</span>
          <span className="impressao-value">{imeiOuSerie(a) || "N/A"}</span>
        </div>
        {a.defeito_relatado && (
          <div className="impressao-field">
            <span className="impressao-label">Defeito:</span>
            <span className="impressao-value">{a.defeito_relatado}</span>
          </div>
        )}
        {a.observacoes && (
          <div className="impressao-field">
            <span className="impressao-label">Obs.:</span>
            <span className="impressao-value">{a.observacoes}</span>
          </div>
        )}

        {(mostrarSenha || mostrarSemTeste || mostrarEntrada || mostrarSaida || mostrarAvarias) && (
          <div className="impressao-grid-adaptativo">
            {mostrarSenha && senha && (
              <div className="impressao-block">
                <div className="impressao-block-header">
                  <Lock className="impressao-icon" />
                  <h2 className="impressao-block-title">Senha de Desbloqueio</h2>
                </div>
                <div className="impressao-block-content impressao-senha-content">
                  <div className="impressao-senha-info">
                    {senha.nao_informada ? (
                      <div className="impressao-field">
                        <span className="impressao-value">Cliente não quis passar a senha</span>
                      </div>
                    ) : (
                      <>
                        <div className="impressao-field">
                          <span className="impressao-label">Tipo:</span>
                          <span className="impressao-value">
                            {senha.tipo === "numero" && "PIN"}
                            {senha.tipo === "letra" && "Texto"}
                            {senha.tipo === "padrao" && "Padrão Android"}
                          </span>
                        </div>
                        {senha.tipo !== "padrao" && (
                          <div className="impressao-field">
                            <span className="impressao-label">Senha:</span>
                            <span className="impressao-value impressao-senha-valor">{senha.valor || "N/A"}</span>
                          </div>
                        )}
                        {senha.tipo === "padrao" && senha.padrao && (
                          <div className="impressao-field">
                            <PatternLockVisualizacao pattern={senha.padrao} size={80} />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {(mostrarSemTeste || mostrarEntrada) && (
              <div className="impressao-block">
                <div className="impressao-block-header">
                  <CheckCircle2 className="impressao-icon" />
                  <h2 className="impressao-block-title">Checklist de Entrada</h2>
                </div>
                <div className="impressao-block-content">
                  {mostrarSemTeste && (
                    <p style={{ fontSize: "9pt", fontStyle: "italic", margin: "4px 0" }}>
                      ⚠️ Sem teste: Não foi possível realizar os testes porque o aparelho chegou desligado.
                    </p>
                  )}
                  {mostrarEntrada && <ChecklistImpressao itens={entrada} descricaoPeca={a.checklist?.peca_trocada_descricao_entrada} />}
                </div>
              </div>
            )}

            {mostrarSaida && (
              <div className="impressao-block">
                <div className="impressao-block-header">
                  <CheckCircle2 className="impressao-icon" />
                  <h2 className="impressao-block-title">Checklist de Saída</h2>
                </div>
                <div className="impressao-block-content">
                  <ChecklistImpressao itens={saida} descricaoPeca={a.checklist?.peca_trocada_descricao_saida} />
                </div>
              </div>
            )}

            {mostrarAvarias && (
              <div className="impressao-block">
                <div className="impressao-block-header">
                  <Smartphone className="impressao-icon" />
                  <h2 className="impressao-block-title">Avarias Visuais</h2>
                </div>
                <div className="impressao-block-content">
                  <div className="impressao-avarias-container">
                    {frente.length > 0 && (
                      <div className="impressao-silhueta">
                        <div className="impressao-silhueta-label">Frente</div>
                        <SilhuetaComAvarias tipoDispositivo={a.dispositivo_tipo} subtipoRelogio={a.dispositivo_subtipo ?? undefined} lado="frente" avarias={frente} printMode={true} />
                      </div>
                    )}
                    {traseira.length > 0 && (
                      <div className="impressao-silhueta">
                        <div className="impressao-silhueta-label">Traseira</div>
                        <SilhuetaComAvarias tipoDispositivo={a.dispositivo_tipo} subtipoRelogio={a.dispositivo_subtipo ?? undefined} lado="traseira" avarias={traseira} printMode={true} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ChecklistImpressao({ itens, descricaoPeca }: { itens: Record<string, boolean>; descricaoPeca?: string }) {
  return (
    <div className="impressao-checklist">
      {Object.entries(itens).map(([item, status]) => {
        const Icon = checklistIcons[item] || Smartphone;
        return (
          <div key={item}>
            <div className="impressao-checklist-item">
              <Icon className="impressao-checklist-icon" />
              <span className="impressao-checklist-label">{item.replace(/_/g, " ")}</span>
              {status ? <CheckCircle2 className="impressao-check-ok" /> : <XCircle className="impressao-check-erro" />}
            </div>
            {item === "peca_trocada" && status && descricaoPeca && (
              <div style={{ fontSize: "8pt", paddingLeft: "20px", fontStyle: "italic", marginBottom: "4px" }}>
                Peça: {descricaoPeca}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
