import * as XLSX from 'xlsx';

/**
 * Gera e baixa um template de planilha para importação de produtos
 */
export const baixarTemplatePlanilha = () => {
  // Dados de exemplo
  const dados = [
    ['Tipo', 'Nome', 'SKU', 'Código de Barras', 'Quantidade', 'Custo', 'Preço'],
    ['produto', 'iPhone 12 Pro 128GB', 'IP12P-001', '7891234567890', 5, 2500.00, 3200.00],
    ['produto', 'Samsung Galaxy S21', 'SGS21-001', '7891234567891', 3, 1800.00, 2300.00],
    ['peca', 'Tela LCD iPhone X', '', '', 10, 80.00, 150.00],
    ['peca', 'Bateria iPhone 11', '', '', 15, 45.00, 90.00],
  ];

  // Cria workbook e worksheet
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(dados);

  // Define largura das colunas
  ws['!cols'] = [
    { wch: 10 },  // Tipo
    { wch: 30 },  // Nome
    { wch: 15 },  // SKU
    { wch: 18 },  // Código de Barras
    { wch: 12 },  // Quantidade
    { wch: 12 },  // Custo
    { wch: 12 },  // Preço
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Produtos');

  // Gera arquivo e faz download
  XLSX.writeFile(wb, 'modelo_importacao_produtos.xlsx');
};

// Aliases de colunas reconhecidos automaticamente
export const MAPEAMENTO_COLUNAS: Record<string, string[]> = {
  nome: ['nome', 'name', 'produto', 'descricao', 'item', 'description', 'produto/peça', 'descrição'],
  tipo: ['tipo', 'type', 'categoria', 'category'],
  quantidade: ['quantidade', 'qtd', 'qty', 'estoque', 'stock', 'quant', 'qtde'],
  custo: ['custo', 'cost', 'preco_custo', 'valor_custo', 'price_cost', 'preço de custo', 'preço custo', 'valor de custo'],
  preco: ['preco', 'preço', 'price', 'valor', 'preco_venda', 'valor_venda', 'preço de venda', 'preço venda'],
  sku: ['sku', 'codigo', 'código', 'code', 'cod', 'ref', 'referencia', 'referência'],
  codigo_barras: ['codigo_barras', 'código de barras', 'ean', 'upc', 'barcode', 'gtin', 'cod_barras'],
};

/**
 * Detecta automaticamente o mapeamento de colunas baseado nos headers
 */
export const detectarMapeamento = (headers: string[]): Record<string, number> => {
  const mapeamento: Record<string, number> = {};
  
  headers.forEach((header, index) => {
    if (!header) return;
    
    const headerNormalizado = String(header)
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, ''); // Remove acentos
    
    for (const [campo, aliases] of Object.entries(MAPEAMENTO_COLUNAS)) {
      const aliasesNormalizados = aliases.map(a => 
        a.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      );
      
      if (aliasesNormalizados.includes(headerNormalizado)) {
        mapeamento[campo] = index;
        break;
      }
    }
  });
  
  return mapeamento;
};

/**
 * Lê uma planilha e retorna os dados como array de arrays
 */
export const lerPlanilha = (file: File): Promise<{ headers: string[]; dados: any[][] }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const primeiraAba = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData: any[][] = XLSX.utils.sheet_to_json(primeiraAba, { header: 1 });
        
        if (jsonData.length === 0) {
          reject(new Error('Planilha vazia'));
          return;
        }
        
        const headers = (jsonData[0] || []).map(h => String(h || ''));
        const dados = jsonData.slice(1).filter(row => row.some(cell => cell !== undefined && cell !== ''));
        
        resolve({ headers, dados });
      } catch (error) {
        reject(new Error('Erro ao ler planilha. Verifique se o arquivo é válido.'));
      }
    };
    
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    reader.readAsArrayBuffer(file);
  });
};
