import * as XLSX from 'xlsx';

export const baixarTemplateOS = () => {
  const dados = [
    ['Cliente', 'Telefone Cliente', 'Tipo Dispositivo', 'Marca', 'Modelo', 'IMEI', 'Cor', 'Defeito Relatado', 'Status', 'Valor Total', 'Data Abertura'],
    ['João Silva', '(11) 99999-0000', 'celular', 'Apple', 'iPhone 12', '123456789012345', 'Preto', 'Tela quebrada', 'em_andamento', 250.00, '2024-01-15'],
    ['Maria Santos', '(21) 98888-7777', 'celular', 'Samsung', 'Galaxy S21', '', 'Branco', 'Não liga', 'orcamento', 180.00, '2024-01-16'],
    ['Pedro Oliveira', '(31) 97777-6666', 'notebook', 'Dell', 'Inspiron 15', '', '', 'Lento, travar', 'aberta', 300.00, '2024-01-17'],
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(dados);

  ws['!cols'] = [
    { wch: 25 },  // Cliente
    { wch: 18 },  // Telefone
    { wch: 15 },  // Tipo Dispositivo
    { wch: 12 },  // Marca
    { wch: 18 },  // Modelo
    { wch: 20 },  // IMEI
    { wch: 10 },  // Cor
    { wch: 30 },  // Defeito
    { wch: 15 },  // Status
    { wch: 12 },  // Valor
    { wch: 15 },  // Data
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Ordens de Servico');
  XLSX.writeFile(wb, 'modelo_importacao_os.xlsx');
};

export const MAPEAMENTO_COLUNAS_OS: Record<string, string[]> = {
  cliente_nome: ['cliente', 'nome_cliente', 'nome do cliente', 'customer', 'name'],
  cliente_telefone: ['telefone_cliente', 'telefone cliente', 'tel_cliente', 'telefone', 'phone', 'celular', 'whatsapp'],
  dispositivo_tipo: ['tipo_dispositivo', 'tipo dispositivo', 'tipo', 'device_type', 'aparelho'],
  dispositivo_marca: ['marca', 'brand', 'fabricante'],
  dispositivo_modelo: ['modelo', 'model', 'aparelho', 'dispositivo'],
  dispositivo_imei: ['imei', 'serial', 'numero_serie', 'número de série'],
  dispositivo_cor: ['cor', 'color', 'cor_dispositivo'],
  defeito_relatado: ['defeito', 'defeito_relatado', 'problema', 'reclamacao', 'reclamação', 'descricao', 'descrição', 'observacao', 'issue'],
  status: ['status', 'situacao', 'situação', 'estado'],
  total: ['valor', 'total', 'preco', 'preço', 'valor_total', 'price'],
  data_abertura: ['data', 'data_abertura', 'created_at', 'data abertura', 'date', 'data_criacao'],
};

export const detectarMapeamentoOS = (headers: string[]): Record<string, number> => {
  const mapeamento: Record<string, number> = {};

  headers.forEach((header, index) => {
    if (!header) return;
    const headerNorm = String(header).toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    for (const [campo, aliases] of Object.entries(MAPEAMENTO_COLUNAS_OS)) {
      const aliasesNorm = aliases.map(a => a.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
      if (aliasesNorm.includes(headerNorm)) {
        mapeamento[campo] = index;
        break;
      }
    }
  });

  return mapeamento;
};
