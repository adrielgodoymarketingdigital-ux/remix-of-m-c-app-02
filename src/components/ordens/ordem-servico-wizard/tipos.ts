import {
  SenhaDesbloqueio as SenhaDesbloqueioType,
  Checklist,
  AvariaVisual,
  ProdutoUtilizado,
  CustoAdicional,
  TipoAssinatura,
} from "@/types/ordem-servico";
import { Servico } from "@/types/servico";

export type EtapaWizard = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface FormData {
  // Cliente
  clienteNome: string;
  clienteTelefone: string;
  clienteCPF: string;
  clienteEndereco: string;
  clienteBairro: string;
  clienteNumero: string;
  clienteCidade: string;
  clienteEstado: string;
  clienteCEP: string;
  clienteDataNascimento: string;
  origemCliente: string;
  tipoMidia: string;
  // Dispositivo
  dispositivoTipo: string;
  dispositivoMarca: string;
  dispositivoModelo: string;
  dispositivoCor: string;
  dispositivoNumeroSerie: string;
  dispositivoIMEI: string;
  dispositivoSistema: string;
  dispositivoFabricante: string;
  dispositivoSubtipo: string;
  fotosDispositivo: string[];
  // Serviço
  localizacaoFisica: string;
  defeitoRelatado: string;
  observacoesInternas: string;
  mostrarObsInternasImpressao: boolean;
  senhaDesbloqueio: SenhaDesbloqueioType;
  checklist: Checklist;
  avarias: AvariaVisual[];
  servicos: Servico[];
  produtos: ProdutoUtilizado[];
  custosAdicionais: CustoAdicional[];
  tempoGarantia: number | null;
  // Pagamento
  formaPagamento: string;
  numeroParcelas: number;
  desconto: number;
  valorEntrada: number;
  mostrarEntrada: boolean;
  formaPagamentoEntrada: string;
  total: number;
  entrada?: number;
  saldo?: number;
  status: string;
  assinaturaEntrada?: string;
  tipoAssinaturaEntrada?: TipoAssinatura;
  assinaturaSaida?: string;
  tipoAssinaturaSaida?: TipoAssinatura;
  dataVencimentoPrazo?: Date;
  semDataDefinida: boolean;
  dataEntrada: Date;
  dataSaida?: Date;
}

export interface TecnicoOS {
  funcionario_id: string;
  descricao_servico: string;
  servico_id?: string;
}

export interface ResultadoValidacaoEtapa {
  valido: boolean;
  mensagem?: string;
  campoComErro?: string;
}
