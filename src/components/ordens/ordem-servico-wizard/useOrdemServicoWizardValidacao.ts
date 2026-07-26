import { FormData, ResultadoValidacaoEtapa, EtapaWizard } from "./tipos";

const VALIDO: ResultadoValidacaoEtapa = { valido: true };

/**
 * Etapa 1 — Origem do Cliente. Sem required no formulário original
 * (linhas 1141-1182 do DialogOrdemServico.tsx antes da extração) — sempre válida.
 */
function validarEtapa1(): ResultadoValidacaoEtapa {
  return VALIDO;
}

/**
 * Etapa 2 — Dados do Cliente. Réplica do required de clienteNome
 * (linha 1205 original — único required desta seção).
 */
function validarEtapa2(formData: FormData): ResultadoValidacaoEtapa {
  if (!formData.clienteNome.trim()) {
    return { valido: false, mensagem: "Informe o nome do cliente.", campoComErro: "clienteNome" };
  }
  return VALIDO;
}

/**
 * Etapa 3 — Dispositivo, Fotos e Senha. Réplica dos required de
 * dispositivoTipo (linha 1378), dispositivoMarca (1400) e dispositivoModelo
 * (1411) originais. Fotos e senha não têm required.
 */
function validarEtapa3(formData: FormData): ResultadoValidacaoEtapa {
  if (!formData.dispositivoTipo) {
    return { valido: false, mensagem: "Selecione o tipo de dispositivo.", campoComErro: "dispositivoTipo" };
  }
  if (!formData.dispositivoMarca.trim()) {
    return { valido: false, mensagem: "Informe a marca do dispositivo.", campoComErro: "dispositivoMarca" };
  }
  if (!formData.dispositivoModelo.trim()) {
    return { valido: false, mensagem: "Informe o modelo do dispositivo.", campoComErro: "dispositivoModelo" };
  }
  return VALIDO;
}

/**
 * Etapa 4 — Informações do Serviço. Réplica do required de defeitoRelatado
 * (linha 1495) + guard de técnico obrigatório (réplica das linhas 558-567
 * originais, mesma condição e mesmo texto de erro).
 */
function validarEtapa4(
  formData: FormData,
  tecnicoId: string | null,
  tecnicoObrigatorioOS: boolean,
  funcionarioId: string | null
): ResultadoValidacaoEtapa {
  if (!formData.defeitoRelatado.trim()) {
    return { valido: false, mensagem: "Informe o defeito relatado.", campoComErro: "defeitoRelatado" };
  }
  if (tecnicoObrigatorioOS && !tecnicoId && !funcionarioId) {
    return { valido: false, mensagem: "Selecione um técnico responsável antes de continuar.", campoComErro: "tecnicoId" };
  }
  return VALIDO;
}

/**
 * Etapas 5, 6 e 7 — Checklist/Avarias, Serviços/Produtos, Resumo/Assinatura.
 * Nenhuma tinha required no formulário original — sempre válidas.
 */
function validarEtapa5(): ResultadoValidacaoEtapa {
  return VALIDO;
}
function validarEtapa6(): ResultadoValidacaoEtapa {
  return VALIDO;
}
function validarEtapa7(): ResultadoValidacaoEtapa {
  return VALIDO;
}

interface ValidarEtapaParams {
  etapa: EtapaWizard;
  formData: FormData;
  tecnicoId: string | null;
  tecnicoObrigatorioOS: boolean;
  funcionarioId: string | null;
}

export function validarEtapa({
  etapa,
  formData,
  tecnicoId,
  tecnicoObrigatorioOS,
  funcionarioId,
}: ValidarEtapaParams): ResultadoValidacaoEtapa {
  switch (etapa) {
    case 1: return validarEtapa1();
    case 2: return validarEtapa2(formData);
    case 3: return validarEtapa3(formData);
    case 4: return validarEtapa4(formData, tecnicoId, tecnicoObrigatorioOS, funcionarioId);
    case 5: return validarEtapa5();
    case 6: return validarEtapa6();
    case 7: return validarEtapa7();
  }
}
