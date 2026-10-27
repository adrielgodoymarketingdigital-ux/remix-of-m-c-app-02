import { Fragment } from "react";

/**
 * Frase traduzida com trechos em <b>…</b> (já interpolada pelo t()) → texto com
 * <strong>. Faz o mesmo que <Trans components={{ b: <strong /> }} /> para esse
 * caso simples sem puxar o Trans do react-i18next (um chunk à parte) para as
 * telas de PDV e Vendas: as requisições delas ficam as mesmas de antes.
 */
export function ComNegrito({ texto }: { texto: string }) {
  const partes = texto.split(/<b>(.*?)<\/b>/);
  return (
    <>
      {partes.map((parte, i) => (i % 2 === 1 ? <strong key={i}>{parte}</strong> : parte ? <Fragment key={i}>{parte}</Fragment> : null))}
    </>
  );
}
