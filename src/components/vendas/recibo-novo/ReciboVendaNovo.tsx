/**
 * Recibo de venda no layout novo (A4 e tela). Só desenha: tudo o que aparece
 * vem pronto de montarReciboVenda (src/lib/vendas/reciboVendaModelo.ts).
 * Estilos em cssReciboVendaNovo (classes rvn-*), ícones em SVG inline
 * (lucide-react e IconesRedesSociais) e QR com qrcode.react — nada externo,
 * para imprimir e gerar PDF sem rede. Foto ou logo que não carrega some.
 *
 * Ainda não é usado em nenhuma tela (etapa 2): PDV, Vendas e Dispositivos
 * seguem com os recibos de sempre.
 */
import { useState, type ReactNode } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowLeftRight,
  BadgeCheck,
  CalendarDays,
  CircleDollarSign,
  CircleX,
  CreditCard,
  FileText,
  Globe,
  Handshake,
  Hourglass,
  Mail,
  MapPin,
  PenLine,
  Phone,
  ShieldCheck,
  ShoppingCart,
  Store,
  User,
} from "lucide-react";
import type { ContatoRecibo, FormaRecibo, ReciboVendaModelo, RedeSocial, TipoContato } from "@/lib/vendas/reciboVendaModelo";
import { IconeFacebook, IconeInstagram, IconeWhatsApp } from "./IconesRedesSociais";

const ICONE = "rvn-icone";

function iconeContato(tipo: TipoContato): ReactNode {
  switch (tipo) {
    case "endereco":
      return <MapPin className={ICONE} aria-hidden />;
    case "telefone":
      return <Phone className={ICONE} aria-hidden />;
    case "whatsapp":
      return <IconeWhatsApp className={`${ICONE} rvn-rede-whatsapp`} />;
    case "email":
      return <Mail className={ICONE} aria-hidden />;
    case "site":
      return <Globe className={`${ICONE} rvn-rede-site`} aria-hidden />;
    case "instagram":
      return <IconeInstagram className={`${ICONE} rvn-rede-instagram`} />;
    case "facebook":
      return <IconeFacebook className={`${ICONE} rvn-rede-facebook`} />;
  }
}

const ICONE_REDE: Record<RedeSocial, (p: { className?: string }) => JSX.Element> = {
  instagram: IconeInstagram,
  facebook: IconeFacebook,
  whatsapp: IconeWhatsApp,
};

function Contato({ c }: { c: ContatoRecibo }) {
  return (
    <div className="rvn-contato">
      {iconeContato(c.tipo)}
      <span>{c.texto}</span>
    </div>
  );
}

function ChipForma({ forma }: { forma: FormaRecibo }) {
  const classe = forma.tom === "pendente" ? "rvn-chip rvn-chip--pendente" : forma.tom === "troca" ? "rvn-chip rvn-chip--troca" : "rvn-chip";
  return (
    <span className={classe}>
      {forma.tom === "pendente" ? <Hourglass className={ICONE} aria-hidden /> : forma.tom === "troca" ? <ArrowLeftRight className={ICONE} aria-hidden /> : <BadgeCheck className={ICONE} aria-hidden />}
      {forma.nome}
    </span>
  );
}

export interface ReciboVendaNovoProps {
  modelo: ReciboVendaModelo;
}

export function ReciboVendaNovo({ modelo: m }: ReciboVendaNovoProps) {
  // Fotos e logo que falharam ao carregar: somem (e a coluna de foto, se nenhuma sobrar).
  const [quebradas, setQuebradas] = useState<ReadonlySet<string>>(new Set());
  const quebrar = (url: string) => setQuebradas((s) => new Set(s).add(url));
  const fotoOk = (url: string | null): url is string => !!url && !quebradas.has(url);

  const logoOk = fotoOk(m.cabecalho.logoUrl);
  const colunaFoto = m.itens.some((i) => fotoOk(i.fotoUrl));
  const fotoTroca = m.troca && fotoOk(m.troca.fotoUrl) ? m.troca.fotoUrl : null;
  const cancelada = m.situacao.tipo === "cancelada";

  return (
    <div className="rvn">
      <header className={m.qr ? "rvn-cab" : "rvn-cab rvn-cab--sem-qr"}>
        <div className="rvn-cab-marca">
          {logoOk ? (
            <div className="rvn-cab-logo">
              <img src={m.cabecalho.logoUrl as string} alt={m.cabecalho.nomeLoja} onError={() => quebrar(m.cabecalho.logoUrl as string)} />
            </div>
          ) : (
            <div className="rvn-cab-nome">{m.cabecalho.nomeLoja}</div>
          )}
        </div>
        {m.cabecalho.contatos.length > 0 && (
          <div className="rvn-cab-contatos">
            {m.cabecalho.contatos.map((c) => (
              <Contato key={c.tipo} c={c} />
            ))}
          </div>
        )}
        {m.qr && (
          <div className="rvn-cab-qr">
            <div className="rvn-qr-caixa">
              <QRCodeSVG value={m.qr.url} size={84} level="M" marginSize={0} title={m.qr.url} />
            </div>
            <div className="rvn-qr-legenda">{m.qr.legenda}</div>
            {m.qr.redes.length > 0 && (
              <div className="rvn-qr-redes">
                {m.qr.redes.map((r) => {
                  const Icone = ICONE_REDE[r];
                  return <Icone key={r} className={`${ICONE} rvn-rede-${r}`} />;
                })}
              </div>
            )}
          </div>
        )}
        <svg className="rvn-cab-curva" viewBox="0 0 850 34" preserveAspectRatio="none" aria-hidden>
          <path d="M0 34 L0 16 Q 300 40 560 22 T 850 6 L850 34 Z" fill="#2b6cf0" fillOpacity="0.35" />
          <path d="M0 34 L0 24 Q 320 44 600 28 T 850 16 L850 34 Z" fill="#ffffff" />
        </svg>
      </header>

      <main className="rvn-corpo">
        <section className="rvn-titulo">
          <div className="rvn-titulo-esq">
            <div className="rvn-titulo-icone">
              <FileText className={ICONE} aria-hidden />
            </div>
            <div>
              <h1>{m.titulo.texto}</h1>
              {m.titulo.numero && <div className="rvn-titulo-numero">Nº {m.titulo.numero}</div>}
              {m.titulo.dataHora && (
                <div className="rvn-titulo-data">
                  <CalendarDays className={ICONE} aria-hidden />
                  <span>{m.titulo.dataHora}</span>
                </div>
              )}
            </div>
          </div>
          <div className="rvn-situacao">
            <span className={cancelada ? "rvn-selo rvn-selo--cancelada" : "rvn-selo"}>
              {cancelada ? <CircleX className={ICONE} aria-hidden /> : <BadgeCheck className={ICONE} aria-hidden />}
              {m.situacao.rotulo}
            </span>
            <span className="rvn-situacao-frase">{m.situacao.frase}</span>
          </div>
        </section>

        <section className="rvn-painel rvn-pessoas">
          <div className="rvn-pessoa">
            <div className="rvn-pessoa-icone">
              <User className={ICONE} aria-hidden />
            </div>
            <div className="rvn-pessoa-dados">
              <div className="rvn-rotulo">Cliente</div>
              <div className="rvn-pessoa-nome">{m.cliente.nome}</div>
              {m.cliente.cpf && <div>CPF: {m.cliente.cpf}</div>}
              {m.cliente.telefone && <div>Telefone: {m.cliente.telefone}</div>}
              {m.cliente.endereco && <div className="rvn-muted">{m.cliente.endereco}</div>}
            </div>
          </div>
          <div className="rvn-pessoa">
            <div className="rvn-pessoa-icone">
              <Store className={ICONE} aria-hidden />
            </div>
            <div className="rvn-pessoa-dados">
              <div className="rvn-rotulo">Loja</div>
              <div className="rvn-pessoa-nome">{m.loja.nome}</div>
              {m.loja.cnpj && <div>CNPJ: {m.loja.cnpj}</div>}
              {m.vendedor && <div>Vendedor: {m.vendedor}</div>}
            </div>
          </div>
        </section>

        <section className="rvn-painel">
          <div className="rvn-painel-titulo">
            <ShoppingCart className={ICONE} aria-hidden />
            <span>{m.tituloItens}</span>
          </div>
          <table className="rvn-tabela">
            <thead>
              <tr>
                <th className="rvn-col-num">#</th>
                {colunaFoto && <th className="rvn-col-foto" aria-label="Foto" />}
                <th>Produto / Serviço</th>
                <th className="rvn-col-qtd">Qtde</th>
                <th className="rvn-col-valor rvn-col-unit">Valor unit.</th>
                <th className="rvn-col-valor">Total</th>
              </tr>
            </thead>
            <tbody>
              {m.itens.map((item) => (
                <tr key={item.numero}>
                  <td className="rvn-col-num">{item.numero}</td>
                  {colunaFoto && (
                    <td className="rvn-col-foto">
                      {fotoOk(item.fotoUrl) && <img className="rvn-foto" src={item.fotoUrl} alt="" onError={() => quebrar(item.fotoUrl as string)} />}
                    </td>
                  )}
                  <td>
                    <div className="rvn-item-nome">{item.nome}</div>
                    {item.detalhes.map((d) => (
                      <div key={d} className="rvn-item-detalhe">
                        {d}
                      </div>
                    ))}
                    {item.etiqueta && <span className="rvn-etiqueta">{item.etiqueta}</span>}
                  </td>
                  <td className="rvn-col-qtd">{item.quantidade}</td>
                  <td className="rvn-col-valor rvn-col-unit">{item.valorUnitario}</td>
                  <td className="rvn-col-valor rvn-negrito">{item.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="rvn-resumo">
            {m.resumo.map((l) => (
              <div key={l.rotulo} className={l.negativo ? "rvn-resumo-linha rvn-resumo-linha--negativo" : "rvn-resumo-linha"}>
                <span>{l.rotulo}:</span>
                <span>
                  {l.negativo ? "− " : ""}
                  {l.valor}
                </span>
              </div>
            ))}
          </div>
        </section>

        {m.troca && (
          <section className="rvn-painel rvn-troca">
            <div className="rvn-troca-titulo">
              <ArrowLeftRight className={ICONE} aria-hidden />
              <span>{m.troca.titulo}</span>
            </div>
            <div className="rvn-troca-grade">
              <div className="rvn-troca-aparelho">
                {fotoTroca && <img className="rvn-foto" src={fotoTroca} alt="" onError={() => quebrar(fotoTroca)} />}
                <div>
                  <p className="rvn-negrito">{m.troca.aparelhoTitulo}:</p>
                  <p>{m.troca.aparelhoDescricao}</p>
                  {m.troca.imei && (
                    <p>
                      <span className="rvn-negrito">IMEI:</span> {m.troca.imei}
                    </p>
                  )}
                  {m.troca.condicao && (
                    <p>
                      <span className="rvn-negrito">Condição:</span> {m.troca.condicao}
                    </p>
                  )}
                </div>
              </div>
              <div>
                {m.troca.linhas.map((l) => (
                  <div key={l.rotulo} className={l.destaque ? "rvn-linha-valor rvn-linha-valor--destaque" : "rvn-linha-valor"}>
                    <span>{l.rotulo}:</span>
                    <span>
                      {l.negativo ? "− " : ""}
                      {l.valor}
                    </span>
                  </div>
                ))}
                {m.troca.observacao && <div className="rvn-troca-obs">{m.troca.observacao}</div>}
              </div>
            </div>
          </section>
        )}

        <section className={m.faixaTotal.cancelada ? "rvn-total rvn-total--cancelada" : "rvn-total"}>
          <div className="rvn-total-faixa">
            <span className="rvn-total-rotulo">
              <CircleDollarSign className={ICONE} aria-hidden />
              {m.faixaTotal.rotulo}
            </span>
            <span className="rvn-total-valor">{m.faixaTotal.valor}</span>
          </div>
          <div className="rvn-pagamento">
            <div className="rvn-pagamento-cab">
              <CreditCard className={ICONE} aria-hidden />
              <span>{m.pagamento.formas.length > 1 ? "Formas de pagamento:" : "Forma de pagamento:"}</span>
            </div>
            <div className="rvn-formas">
              {m.pagamento.formas.map((f, i) => (
                <div key={`${f.nome}-${i}`}>
                  <div className="rvn-forma">
                    <div className="rvn-forma-esq">
                      <ChipForma forma={f} />
                      {f.detalhe && <span className="rvn-forma-detalhe">{f.detalhe}</span>}
                    </div>
                    {f.valor && <span className="rvn-forma-valor">{f.valor}</span>}
                  </div>
                  {f.parcelas.length > 0 && (
                    <table className="rvn-parcelas">
                      <thead>
                        <tr>
                          <th>Parcela</th>
                          <th>Vencimento</th>
                          <th className="rvn-direita">Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {f.parcelas.map((p) => (
                          <tr key={p.numero}>
                            <td>
                              {p.numero}/{f.parcelas.length}
                            </td>
                            <td>{p.vencimento ?? "—"}</td>
                            <td className="rvn-direita">{p.valor}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              ))}
            </div>
            {m.pagamento.observacao && <div className="rvn-pagamento-obs">{m.pagamento.observacao}</div>}
          </div>
        </section>

        {m.garantias.map((g, i) => (
          <section key={`${g.produto}-${i}`} className="rvn-painel rvn-garantia">
            <ShieldCheck className={ICONE} aria-hidden />
            <div>
              <div className="rvn-garantia-titulo">
                {g.titulo} — <span>{g.produto}</span>
              </div>
              <div className="rvn-garantia-texto">{g.texto}</div>
            </div>
          </section>
        ))}

        <section className="rvn-assinaturas">
          {[
            { nome: m.assinaturas.vendedor, rotulo: "Assinatura do Vendedor" },
            { nome: m.assinaturas.comprador, rotulo: "Assinatura do Comprador" },
          ].map((a) => (
            <div key={a.rotulo} className="rvn-assinatura">
              <PenLine className={ICONE} aria-hidden />
              <div className="rvn-assinatura-campo">
                <div className="rvn-assinatura-linha" />
                <div className="rvn-assinatura-nome">{a.nome}</div>
                <div className="rvn-assinatura-rotulo">{a.rotulo}</div>
              </div>
            </div>
          ))}
        </section>

        <footer className="rvn-rodape">
          <div className="rvn-rodape-esq">
            <Handshake className={ICONE} aria-hidden />
            <div>
              <div className="rvn-rodape-titulo">{m.rodape.agradecimento}</div>
              <div className="rvn-muted">{m.rodape.frase}</div>
            </div>
          </div>
          {m.rodape.contatos.length > 0 && (
            <div className="rvn-rodape-contatos">
              {m.rodape.contatos.map((c) => (
                <Contato key={c.tipo} c={c} />
              ))}
            </div>
          )}
        </footer>
      </main>
    </div>
  );
}
