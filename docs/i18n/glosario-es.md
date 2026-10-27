# Glossário pt-BR → espanhol neutro latino-americano (MecApp, mercado ES_LATAM)

**Status:** proposta para validação do Adriel (etapa 4). Nada além do menu lateral foi traduzido ainda.

**Como ler:** a coluna **Recomendado** é o termo que vai para os arquivos `src/locales/es/*.ts`. **Alternativas regionais** existem para você decidir se algum país-chave pede outro termo. Regra geral: espanhol **latino-americano neutro**, com **"usted"** implícito (mensagens impessoais: "Guarde los cambios", nunca "Guarda" nem "vosotros"). Nada de termos da Espanha ("móvil", "ordenador", "vale", "coger").

Siglas de país: MX México, AR Argentina, CO Colômbia, CL Chile, PE Peru, UY Uruguai, CA América Central, ES Espanha.

> Os termos marcados com ❓ têm uma dúvida minha sobre o que a tela faz; a escolha depende da sua resposta.

## 1. Ordem de serviço e atendimento

| pt-BR | Recomendado (es) | Alternativas regionais | Observação |
|---|---|---|---|
| Ordem de Serviço (OS) | **Orden de servicio (OS)** | Orden de trabajo / OT (AR, CL, CO); Orden de reparación (MX) | Mantém a sigla "OS", que aparece no número impresso. "OT" é muito comum no Cone Sul; se o foco for AR/CL, vale trocar. |
| Nº da OS | **N.º de OS** | Folio (MX) | "Folio" é o normal no México para o número de um documento. |
| Orçamento | **Presupuesto** | Cotización (MX, CO, PE, CL) | "Cotización" é mais comum na prática comercial de MX/CO; "Presupuesto" é entendido em todos. |
| Aparelho | **Equipo** | Dispositivo; Celular (quando for só telefone) | "Equipo" é o termo de balcão de assistência ("recepción de equipos"). Por isso **Equipe ≠ "Equipo"** (ver seção 5). |
| Dispositivo (estoque de aparelhos à venda) | **Equipo** | Dispositivo | No menu ficou "Equipos". |
| Celular | **Celular** | Móvil (ES — evitar) | |
| IMEI | **IMEI** | — | Igual. |
| Número de série | **Número de serie** | N.º de serie | |
| Defeito / Defeito relatado | **Falla / Falla reportada** | Problema; Avería (ES — evitar) | "Defecto" soa como defeito de fábrica; para o que o cliente relata, "falla" é o usual. |
| Avarias (checklist de entrada) | **Daños visibles** | Detalles físicos; Golpes y rayones | O checklist de "avarias" na entrada vira "Daños". |
| Checklist | **Checklist** | Lista de verificación | "Checklist" é usado como empréstimo em toda a região. |
| Senha / padrão de desbloqueio | **Contraseña / patrón de desbloqueo** | Clave (CL, AR); PIN | |
| Laudo técnico / diagnóstico | **Diagnóstico** | Informe técnico; Dictamen (MX) | |
| Técnico | **Técnico** | — | |
| Entrada do aparelho | **Ingreso** / **Fecha de ingreso** | Recepción (MX); Recibido | |
| Saída / entrega | **Entrega** / **Fecha de entrega** | Retiro (AR, CL) | |
| Aguardando retirada | **Listo para retirar** | Listo para entregar; Para recoger (MX) | |
| Acompanhamento da OS (link do cliente) | **Seguimiento de la orden** | Estado de tu reparación | Tela pública do cliente: aqui caberia "tú"? Recomendo manter "usted". |
| Termo de garantia | **Términos de garantía** | Póliza de garantía (MX); Certificado de garantía (AR) | |
| Termo de responsabilidade | **Constancia de responsabilidad** | Carta responsiva (MX); Descargo de responsabilidad | |
| Garantia | **Garantía** | — | "En garantía" para o status. |

### Status padrão da OS (os_status_config)

Os nomes ficam gravados no banco por loja; só os **8 padrões** (pelo `slug`) seriam traduzidos. Nome que o lojista digitou fica como ele digitou.

| slug | pt-BR | Recomendado (es) | Alternativas |
|---|---|---|---|
| aguardando_aprovacao | Aguardando Aprovação | **Esperando aprobación** | Pendiente de aprobación |
| em_andamento | Serviço em Andamento | **En reparación** | En proceso; Servicio en curso |
| finalizado | Serviço Finalizado | **Reparación terminada** | Servicio terminado; Listo |
| aguardando_retirada | Aguardando Retirada | **Listo para retirar** | Para recoger (MX) |
| entregue | Serviço Entregue | **Entregado** | Servicio entregado |
| cancelada | Cancelada | **Cancelada** | — |
| garantia | Em Garantia | **En garantía** | — |
| estornado | Estornado | **Reembolsado** | Devuelto; Reintegrado (AR) |

## 2. Estoque, produtos e peças

| pt-BR | Recomendado (es) | Alternativas regionais | Observação |
|---|---|---|---|
| Estoque | **Inventario** | Stock (AR, CL, UY); Existencias | No menu ficou "Inventario". Para a quantidade ("tem 3 em estoque") pode ser "en stock" mesmo em MX. |
| Peça | **Repuesto** | Refacción (MX); Pieza; Parte | "Refacción" é forte no México; "repuesto" é entendido em toda a região. |
| Produto | **Producto** | — | |
| Acessório | **Accesorio** | — | |
| Película | **Mica** ❓ | Protector de pantalla (neutro); Film/Lámina (AR, CL); Templado (AR) | "Mica" é o termo de MX/CA/CO. Se o foco for Cone Sul, "Protector de pantalla" é mais seguro. |
| Vidro (compatibilidade) | **Vidrio** ❓ | Vidrio templado; Cristal | Dúvida: "vidro" no MecApp é o vidro de reposição da tela ou a película de vidro? Se for película de vidro: "Vidrio templado". |
| Seminovo | **Seminuevo** | Reacondicionado; Usado | |
| Fornecedor | **Proveedor** | — | |
| Etiqueta (de preço/código) | **Etiqueta** | — | |
| Código de barras | **Código de barras** | — | |
| Catálogo | **Catálogo** | — | |
| Origem de dispositivos ❓ | **Origen de equipos** | Compra de equipos | Se a tela é a compra de aparelhos de terceiros (trade-in/compra de usados), "Compra de equipos" é mais claro. |
| Remessas corporativas ❓ | **Envíos corporativos** | Lotes corporativos | Preciso entender a tela para escolher. |
| Compatibilidade | **Compatibilidad** | — | |

## 3. Venda, caixa e financeiro

| pt-BR | Recomendado (es) | Alternativas regionais | Observação |
|---|---|---|---|
| PDV | **Punto de venta** | POS; Caja | No menu: "Punto de venta". "PDV" sozinho não é sigla usada lá. |
| Venda | **Venta** | — | |
| Recibo | **Recibo** | Comprobante; Ticket; Nota de venta (MX) | **Evitar "Factura"**: é documento fiscal em toda a região. |
| Caixa (abrir/fechar) | **Caja** — Apertura / Cierre de caja | Corte de caja (MX); Arqueo de caja | |
| Troco | **Cambio** | Vuelto (AR, PE, CL, UY); Feria (MX coloquial) | |
| Dinheiro (forma de pagamento) | **Efectivo** | Contado | |
| Cartão de crédito / débito | **Tarjeta de crédito / débito** | — | |
| Parcelado | **En cuotas** | A meses / Meses sin intereses (MX) | |
| Pix | — | — | Não existe fora do Brasil (capacidade `temPix = false`). Mais próximo: **Transferencia**. |
| Desconto | **Descuento** | — | |
| Troca (aparelho do cliente como parte do pagamento) | **Equipo como parte de pago** | Permuta; Canje (AR); Toma de usado | |
| Comissão | **Comisión** | — | |
| Contas a pagar / receber | **Cuentas por pagar / por cobrar** | — | |
| Financeiro | **Finanzas** | — | |
| Extrato | **Movimientos** | Estado de cuenta; Extracto (ES — evitar) | |
| Relatórios | **Reportes** | Informes | "Reportes" é o padrão latino-americano. |
| Lucro | **Ganancia** | Utilidad (MX, CO, CL) | |
| Custo | **Costo** | Coste (ES — evitar) | |
| Precificador | **Calculadora de precios** | — | |
| Fidelidade | **Fidelización** | Programa de puntos | |
| Pedido / Encomenda | **Pedido / Encargo** | — | |

## 4. Cadastro de cliente e loja

| pt-BR | Recomendado (es) | Alternativas regionais | Observação |
|---|---|---|---|
| Cliente | **Cliente** | — | |
| CPF | **Documento** | DNI (AR, PE); INE/CURP (MX); RUT (CL); CC (CO); CI (UY) | Capacidade `documentoPessoa = "documento"`: rótulo genérico, sem validação de dígito. |
| CNPJ | **ID fiscal** | RFC (MX); CUIT (AR); RUT (CL, UY); NIT (CO); RUC (PE) | Só com `temFiscal`; fora do Brasil fica escondido. |
| CEP | **Código postal** | — | Sem busca automática (`temCep = false`). |
| Bairro | **Barrio** | Colonia (MX); Comuna (CL) | |
| Celular / WhatsApp | **Celular / WhatsApp** | — | Máscara internacional (`mascaraTelefone = "internacional"`). |
| Loja | **Tienda** | Local; Negocio | |
| Assistência técnica | **Servicio técnico** | Taller (AR, CL); Centro de reparación | |
| Cadastro | **Registro** | Alta | "Cadastrar cliente" → "Registrar cliente". |

## 5. Conta, equipe e sistema

| pt-BR | Recomendado (es) | Alternativas regionais | Observação |
|---|---|---|---|
| Equipe | **Personal** | Colaboradores; Equipo (conflita com aparelho) | No menu ficou "Personal". |
| Funcionário | **Empleado** | Colaborador | |
| Dono / proprietário | **Dueño** | Propietario | |
| Filial / matriz | **Sucursal / Casa matriz** | — | |
| Multi Empresas | **Multiempresa** | Varias sucursales | |
| Plano / assinatura | **Plan / Suscripción** | — | |
| Painel (Dashboard) | **Panel** | Inicio; Tablero (MX) | |
| Configurações | **Configuración** | Ajustes | |
| Suporte | **Soporte** | Ayuda | |
| Sair | **Salir** | Cerrar sesión | |
| Notificações | **Notificaciones** | — | |
| Tutoriais | **Tutoriales** | — | |
| Baixar app | **Descargar app** | Bajar la app (AR) | |

## Decisões que preciso de você

1. **OS × OT**: manter "Orden de servicio (OS)" ou usar "Orden de trabajo (OT)"?
2. **Orçamento**: "Presupuesto" ou "Cotización"?
3. **Peça**: "Repuesto" (neutro) ou "Refacción" (México)?
4. **Película**: "Mica" (MX/CA/CO) ou "Protector de pantalla" (neutro)? E o que é "vidro" na compatibilidade?
5. **Equipe → "Personal"** (para não chocar com "Equipo" = aparelho): ok?
6. **Hora em espanhol**: o Intl em `es-419` mostra 12 h ("06:55 p.m."). Manter o relógio do país ou forçar 24 h como no Brasil?
7. **Moeda**: o Intl em `es-419` escreve "USD 1,234.50"; em `es-AR`/`es-CO`, "US$ 1.234,50". Quando o `pais` da conta estiver preenchido, cada país usa o seu formato. Prefere forçar "US$" em todos?
