Initialising login role...
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admin_alteracoes_correcoes: {
        Row: {
          concluido: boolean
          created_at: string
          descricao: string | null
          id: string
          prioridade: string
          titulo: string
          updated_at: string
        }
        Insert: {
          concluido?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          prioridade: string
          titulo: string
          updated_at?: string
        }
        Update: {
          concluido?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          prioridade?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      admin_notifications: {
        Row: {
          created_at: string
          dados: Json | null
          id: string
          lida: boolean | null
          mensagem: string
          tipo: string
          titulo: string
        }
        Insert: {
          created_at?: string
          dados?: Json | null
          id?: string
          lida?: boolean | null
          mensagem: string
          tipo: string
          titulo: string
        }
        Update: {
          created_at?: string
          dados?: Json | null
          id?: string
          lida?: boolean | null
          mensagem?: string
          tipo?: string
          titulo?: string
        }
        Relationships: []
      }
      admin_whatsapp_templates: {
        Row: {
          created_at: string
          id: string
          mensagens: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          mensagens?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          mensagens?: Json
          updated_at?: string
        }
        Relationships: []
      }
      assinaturas: {
        Row: {
          bloqueado_admin: boolean | null
          bloqueado_admin_em: string | null
          bloqueado_admin_motivo: string | null
          bloqueado_tipo: string | null
          cancelado_em: string | null
          created_at: string | null
          cupom_stripe_id: string | null
          data_fim: string | null
          data_inicio: string | null
          data_proxima_cobranca: string | null
          free_trial_ends_at: string | null
          id: string
          modulos_extras: Json | null
          motivo_cancelamento: string | null
          pagarme_card_id: string | null
          pagarme_customer_id: string | null
          pagarme_subscription_id: string | null
          payment_method: string | null
          payment_provider: string | null
          plano_tipo: Database["public"]["Enums"]["plano_tipo"]
          status: Database["public"]["Enums"]["status_assinatura"]
          stripe_customer_id: string | null
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          ticto_order_id: string | null
          trial_canceled: boolean | null
          trial_canceled_at: string | null
          trial_converted: boolean | null
          trial_converted_at: string | null
          trial_end_at: string | null
          trial_started_at: string | null
          trial_with_card: boolean | null
          updated_at: string | null
          user_id: string
          valor_desconto: number | null
        }
        Insert: {
          bloqueado_admin?: boolean | null
          bloqueado_admin_em?: string | null
          bloqueado_admin_motivo?: string | null
          bloqueado_tipo?: string | null
          cancelado_em?: string | null
          created_at?: string | null
          cupom_stripe_id?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          data_proxima_cobranca?: string | null
          free_trial_ends_at?: string | null
          id?: string
          modulos_extras?: Json | null
          motivo_cancelamento?: string | null
          pagarme_card_id?: string | null
          pagarme_customer_id?: string | null
          pagarme_subscription_id?: string | null
          payment_method?: string | null
          payment_provider?: string | null
          plano_tipo?: Database["public"]["Enums"]["plano_tipo"]
          status?: Database["public"]["Enums"]["status_assinatura"]
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          ticto_order_id?: string | null
          trial_canceled?: boolean | null
          trial_canceled_at?: string | null
          trial_converted?: boolean | null
          trial_converted_at?: string | null
          trial_end_at?: string | null
          trial_started_at?: string | null
          trial_with_card?: boolean | null
          updated_at?: string | null
          user_id: string
          valor_desconto?: number | null
        }
        Update: {
          bloqueado_admin?: boolean | null
          bloqueado_admin_em?: string | null
          bloqueado_admin_motivo?: string | null
          bloqueado_tipo?: string | null
          cancelado_em?: string | null
          created_at?: string | null
          cupom_stripe_id?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          data_proxima_cobranca?: string | null
          free_trial_ends_at?: string | null
          id?: string
          modulos_extras?: Json | null
          motivo_cancelamento?: string | null
          pagarme_card_id?: string | null
          pagarme_customer_id?: string | null
          pagarme_subscription_id?: string | null
          payment_method?: string | null
          payment_provider?: string | null
          plano_tipo?: Database["public"]["Enums"]["plano_tipo"]
          status?: Database["public"]["Enums"]["status_assinatura"]
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          ticto_order_id?: string | null
          trial_canceled?: boolean | null
          trial_canceled_at?: string | null
          trial_converted?: boolean | null
          trial_converted_at?: string | null
          trial_end_at?: string | null
          trial_started_at?: string | null
          trial_with_card?: boolean | null
          updated_at?: string | null
          user_id?: string
          valor_desconto?: number | null
        }
        Relationships: []
      }
      avisos_sistema: {
        Row: {
          ativo: boolean
          cor_botao: string | null
          cor_fundo: string | null
          cor_icone: string | null
          cor_texto: string | null
          created_at: string
          created_by: string | null
          data_fim: string | null
          data_inicio: string
          icone: string | null
          id: string
          imagem_posicao: string | null
          imagem_url: string | null
          link_texto: string | null
          link_url: string | null
          mensagem: string
          prioridade: number
          publico_alvo: string[]
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cor_botao?: string | null
          cor_fundo?: string | null
          cor_icone?: string | null
          cor_texto?: string | null
          created_at?: string
          created_by?: string | null
          data_fim?: string | null
          data_inicio?: string
          icone?: string | null
          id?: string
          imagem_posicao?: string | null
          imagem_url?: string | null
          link_texto?: string | null
          link_url?: string | null
          mensagem: string
          prioridade?: number
          publico_alvo?: string[]
          tipo?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cor_botao?: string | null
          cor_fundo?: string | null
          cor_icone?: string | null
          cor_texto?: string | null
          created_at?: string
          created_by?: string | null
          data_fim?: string | null
          data_inicio?: string
          icone?: string | null
          id?: string
          imagem_posicao?: string | null
          imagem_url?: string | null
          link_texto?: string | null
          link_url?: string | null
          mensagem?: string
          prioridade?: number
          publico_alvo?: string[]
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      backups: {
        Row: {
          created_at: string | null
          dados: Json
          id: string
          tabela: string
          tipo: string
        }
        Insert: {
          created_at?: string | null
          dados: Json
          id?: string
          tabela: string
          tipo: string
        }
        Update: {
          created_at?: string | null
          dados?: Json
          id?: string
          tabela?: string
          tipo?: string
        }
        Relationships: []
      }
      caixas: {
        Row: {
          created_at: string | null
          data_abertura: string
          data_fechamento: string | null
          empresa_id: string | null
          id: string
          observacoes: string | null
          proprietario_id: string | null
          saldo_final: number | null
          saldo_inicial: number
          status: string
          total_a_receber: number | null
          total_cartao: number | null
          total_dinheiro: number | null
          total_pix: number | null
          total_vendas: number | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          data_abertura?: string
          data_fechamento?: string | null
          empresa_id?: string | null
          id?: string
          observacoes?: string | null
          proprietario_id?: string | null
          saldo_final?: number | null
          saldo_inicial?: number
          status?: string
          total_a_receber?: number | null
          total_cartao?: number | null
          total_dinheiro?: number | null
          total_pix?: number | null
          total_vendas?: number | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          data_abertura?: string
          data_fechamento?: string | null
          empresa_id?: string | null
          id?: string
          observacoes?: string | null
          proprietario_id?: string | null
          saldo_final?: number | null
          saldo_inicial?: number
          status?: string
          total_a_receber?: number | null
          total_cartao?: number | null
          total_dinheiro?: number | null
          total_pix?: number | null
          total_vendas?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "caixas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias_despesas: {
        Row: {
          created_at: string
          id: string
          nome: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          user_id?: string
        }
        Relationships: []
      }
      categorias_funcionarios: {
        Row: {
          created_at: string
          id: string
          loja_user_id: string
          nome: string
        }
        Insert: {
          created_at?: string
          id?: string
          loja_user_id: string
          nome: string
        }
        Update: {
          created_at?: string
          id?: string
          loja_user_id?: string
          nome?: string
        }
        Relationships: []
      }
      categorias_produtos: {
        Row: {
          cor: string
          created_at: string | null
          id: string
          nome: string
          user_id: string
        }
        Insert: {
          cor?: string
          created_at?: string | null
          id?: string
          nome: string
          user_id: string
        }
        Update: {
          cor?: string
          created_at?: string | null
          id?: string
          nome?: string
          user_id?: string
        }
        Relationships: []
      }
      categorias_sistema_excluidas: {
        Row: {
          created_at: string
          id: string
          nome: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          user_id?: string
        }
        Relationships: []
      }
      clientes: {
        Row: {
          cnpj: string | null
          cpf: string | null
          created_at: string | null
          data_nascimento: string | null
          deleted_at: string | null
          empresa_id: string | null
          endereco: string | null
          id: string
          nome: string
          telefone: string | null
          user_id: string
        }
        Insert: {
          cnpj?: string | null
          cpf?: string | null
          created_at?: string | null
          data_nascimento?: string | null
          deleted_at?: string | null
          empresa_id?: string | null
          endereco?: string | null
          id?: string
          nome: string
          telefone?: string | null
          user_id: string
        }
        Update: {
          cnpj?: string | null
          cpf?: string | null
          created_at?: string | null
          data_nascimento?: string | null
          deleted_at?: string | null
          empresa_id?: string | null
          endereco?: string | null
          id?: string
          nome?: string
          telefone?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clientes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      comissoes_tipo_servico: {
        Row: {
          comissao_tipo: string
          comissao_valor: number
          created_at: string
          funcionario_id: string
          id: string
          tipo_servico_id: string
          updated_at: string
        }
        Insert: {
          comissao_tipo?: string
          comissao_valor?: number
          created_at?: string
          funcionario_id: string
          id?: string
          tipo_servico_id: string
          updated_at?: string
        }
        Update: {
          comissao_tipo?: string
          comissao_valor?: number
          created_at?: string
          funcionario_id?: string
          id?: string
          tipo_servico_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comissoes_tipo_servico_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "loja_funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_tipo_servico_tipo_servico_id_fkey"
            columns: ["tipo_servico_id"]
            isOneToOne: false
            referencedRelation: "tipos_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      compras_dispositivos: {
        Row: {
          assinatura_cliente: string | null
          assinatura_cliente_data: string | null
          assinatura_cliente_ip: string | null
          assinatura_vendedor: string | null
          assinatura_vendedor_data: string | null
          assinatura_vendedor_ip: string | null
          checklist: Json | null
          condicao_aparelho: string
          created_at: string | null
          data_compra: string
          dispositivo_id: string
          documento_vendedor_frente: string | null
          documento_vendedor_verso: string | null
          empresa_id: string | null
          forma_pagamento: string
          fornecedor_id: string | null
          fotos: Json | null
          funcionario_responsavel: string | null
          id: string
          observacoes: string | null
          pessoa_id: string | null
          situacao_conta: string | null
          termo_pdf_url: string | null
          unidade: string | null
          updated_at: string | null
          user_id: string
          valor_pago: number
        }
        Insert: {
          assinatura_cliente?: string | null
          assinatura_cliente_data?: string | null
          assinatura_cliente_ip?: string | null
          assinatura_vendedor?: string | null
          assinatura_vendedor_data?: string | null
          assinatura_vendedor_ip?: string | null
          checklist?: Json | null
          condicao_aparelho?: string
          created_at?: string | null
          data_compra?: string
          dispositivo_id: string
          documento_vendedor_frente?: string | null
          documento_vendedor_verso?: string | null
          empresa_id?: string | null
          forma_pagamento: string
          fornecedor_id?: string | null
          fotos?: Json | null
          funcionario_responsavel?: string | null
          id?: string
          observacoes?: string | null
          pessoa_id?: string | null
          situacao_conta?: string | null
          termo_pdf_url?: string | null
          unidade?: string | null
          updated_at?: string | null
          user_id: string
          valor_pago: number
        }
        Update: {
          assinatura_cliente?: string | null
          assinatura_cliente_data?: string | null
          assinatura_cliente_ip?: string | null
          assinatura_vendedor?: string | null
          assinatura_vendedor_data?: string | null
          assinatura_vendedor_ip?: string | null
          checklist?: Json | null
          condicao_aparelho?: string
          created_at?: string | null
          data_compra?: string
          dispositivo_id?: string
          documento_vendedor_frente?: string | null
          documento_vendedor_verso?: string | null
          empresa_id?: string | null
          forma_pagamento?: string
          fornecedor_id?: string | null
          fotos?: Json | null
          funcionario_responsavel?: string | null
          id?: string
          observacoes?: string | null
          pessoa_id?: string | null
          situacao_conta?: string | null
          termo_pdf_url?: string | null
          unidade?: string | null
          updated_at?: string | null
          user_id?: string
          valor_pago?: number
        }
        Relationships: [
          {
            foreignKeyName: "compras_dispositivos_dispositivo_id_fkey"
            columns: ["dispositivo_id"]
            isOneToOne: false
            referencedRelation: "dispositivos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compras_dispositivos_dispositivo_id_fkey"
            columns: ["dispositivo_id"]
            isOneToOne: false
            referencedRelation: "dispositivos_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compras_dispositivos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compras_dispositivos_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compras_dispositivos_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "origem_pessoas"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracoes_loja: {
        Row: {
          bairro: string | null
          catalogo_ativo: boolean | null
          catalogo_config: Json | null
          catalogo_slug: string | null
          cep: string | null
          cidade: string | null
          cnpj: string | null
          complemento: string | null
          cores_personalizadas: Json | null
          created_at: string | null
          email: string | null
          empresa_id: string | null
          endereco: string | null
          estado: string | null
          facebook: string | null
          horario_funcionamento: string | null
          id: string
          inscricao_estadual: string | null
          inscricao_municipal: string | null
          instagram: string | null
          landing_page_ativa: boolean | null
          landing_page_config: Json | null
          layout_dispositivos_config: Json | null
          layout_orcamento_config: Json | null
          layout_os_config: Json | null
          layout_pdv_config: Json | null
          layout_vendas_config: Json | null
          logo_url: string | null
          logradouro: string | null
          mensagens_whatsapp_os: Json | null
          nome_loja: string
          numero: string | null
          razao_social: string | null
          site: string | null
          telefone: string | null
          termo_garantia_config: Json | null
          termo_garantia_dispositivo_config: Json | null
          termo_responsabilidade_config: Json | null
          updated_at: string | null
          user_id: string
          whatsapp: string | null
        }
        Insert: {
          bairro?: string | null
          catalogo_ativo?: boolean | null
          catalogo_config?: Json | null
          catalogo_slug?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          complemento?: string | null
          cores_personalizadas?: Json | null
          created_at?: string | null
          email?: string | null
          empresa_id?: string | null
          endereco?: string | null
          estado?: string | null
          facebook?: string | null
          horario_funcionamento?: string | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          instagram?: string | null
          landing_page_ativa?: boolean | null
          landing_page_config?: Json | null
          layout_dispositivos_config?: Json | null
          layout_orcamento_config?: Json | null
          layout_os_config?: Json | null
          layout_pdv_config?: Json | null
          layout_vendas_config?: Json | null
          logo_url?: string | null
          logradouro?: string | null
          mensagens_whatsapp_os?: Json | null
          nome_loja: string
          numero?: string | null
          razao_social?: string | null
          site?: string | null
          telefone?: string | null
          termo_garantia_config?: Json | null
          termo_garantia_dispositivo_config?: Json | null
          termo_responsabilidade_config?: Json | null
          updated_at?: string | null
          user_id: string
          whatsapp?: string | null
        }
        Update: {
          bairro?: string | null
          catalogo_ativo?: boolean | null
          catalogo_config?: Json | null
          catalogo_slug?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          complemento?: string | null
          cores_personalizadas?: Json | null
          created_at?: string | null
          email?: string | null
          empresa_id?: string | null
          endereco?: string | null
          estado?: string | null
          facebook?: string | null
          horario_funcionamento?: string | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          instagram?: string | null
          landing_page_ativa?: boolean | null
          landing_page_config?: Json | null
          layout_dispositivos_config?: Json | null
          layout_orcamento_config?: Json | null
          layout_os_config?: Json | null
          layout_pdv_config?: Json | null
          layout_vendas_config?: Json | null
          logo_url?: string | null
          logradouro?: string | null
          mensagens_whatsapp_os?: Json | null
          nome_loja?: string
          numero?: string | null
          razao_social?: string | null
          site?: string | null
          telefone?: string | null
          termo_garantia_config?: Json | null
          termo_garantia_dispositivo_config?: Json | null
          termo_responsabilidade_config?: Json | null
          updated_at?: string | null
          user_id?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "configuracoes_loja_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      contas: {
        Row: {
          categoria: string | null
          created_at: string | null
          data: string
          data_pagamento: string | null
          data_vencimento: string | null
          descricao: string | null
          empresa_id: string | null
          fornecedor_id: string | null
          id: string
          nome: string
          os_numero: string | null
          recorrente: boolean | null
          status: Database["public"]["Enums"]["status_conta"] | null
          tipo: Database["public"]["Enums"]["tipo_conta"]
          user_id: string
          valor: number
          valor_pago: number | null
        }
        Insert: {
          categoria?: string | null
          created_at?: string | null
          data: string
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          empresa_id?: string | null
          fornecedor_id?: string | null
          id?: string
          nome: string
          os_numero?: string | null
          recorrente?: boolean | null
          status?: Database["public"]["Enums"]["status_conta"] | null
          tipo: Database["public"]["Enums"]["tipo_conta"]
          user_id: string
          valor: number
          valor_pago?: number | null
        }
        Update: {
          categoria?: string | null
          created_at?: string | null
          data?: string
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          empresa_id?: string | null
          fornecedor_id?: string | null
          id?: string
          nome?: string
          os_numero?: string | null
          recorrente?: boolean | null
          status?: Database["public"]["Enums"]["status_conta"] | null
          tipo?: Database["public"]["Enums"]["tipo_conta"]
          user_id?: string
          valor?: number
          valor_pago?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      conversas_suporte: {
        Row: {
          assunto: string
          atendido_por: string | null
          created_at: string
          id: string
          status: Database["public"]["Enums"]["status_conversa_suporte"]
          updated_at: string
          user_id: string
        }
        Insert: {
          assunto: string
          atendido_por?: string | null
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["status_conversa_suporte"]
          updated_at?: string
          user_id: string
        }
        Update: {
          assunto?: string
          atendido_por?: string | null
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["status_conversa_suporte"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      crm_automacoes: {
        Row: {
          ativo: boolean | null
          condicao: string
          condicao_label: string
          created_at: string | null
          estagio_destino_id: string | null
          id: string
          prioridade: number | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          condicao: string
          condicao_label: string
          created_at?: string | null
          estagio_destino_id?: string | null
          id?: string
          prioridade?: number | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          condicao?: string
          condicao_label?: string
          created_at?: string | null
          estagio_destino_id?: string | null
          id?: string
          prioridade?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_automacoes_estagio_destino_id_fkey"
            columns: ["estagio_destino_id"]
            isOneToOne: false
            referencedRelation: "crm_estagios"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_configuracoes: {
        Row: {
          campos_visiveis: string[] | null
          cards_compactos: boolean | null
          colunas_por_linha: number | null
          created_at: string | null
          id: string
          layout_tipo: string | null
          mostrar_avatar: boolean | null
          mostrar_badges: boolean | null
          ordenacao: string | null
          ordenacao_direcao: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          campos_visiveis?: string[] | null
          cards_compactos?: boolean | null
          colunas_por_linha?: number | null
          created_at?: string | null
          id?: string
          layout_tipo?: string | null
          mostrar_avatar?: boolean | null
          mostrar_badges?: boolean | null
          ordenacao?: string | null
          ordenacao_direcao?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          campos_visiveis?: string[] | null
          cards_compactos?: boolean | null
          colunas_por_linha?: number | null
          created_at?: string | null
          id?: string
          layout_tipo?: string | null
          mostrar_avatar?: boolean | null
          mostrar_badges?: boolean | null
          ordenacao?: string | null
          ordenacao_direcao?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      crm_estagios: {
        Row: {
          cor: string
          created_at: string | null
          descricao: string | null
          filtro: Json | null
          id: string
          nome: string
          ordem: number
          updated_at: string | null
        }
        Insert: {
          cor?: string
          created_at?: string | null
          descricao?: string | null
          filtro?: Json | null
          id?: string
          nome: string
          ordem?: number
          updated_at?: string | null
        }
        Update: {
          cor?: string
          created_at?: string | null
          descricao?: string | null
          filtro?: Json | null
          id?: string
          nome?: string
          ordem?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      crm_usuarios: {
        Row: {
          atribuido_para: string | null
          created_at: string | null
          estagio_id: string | null
          id: string
          notas: string | null
          prioridade: string | null
          proximo_contato: string | null
          tags: string[] | null
          ultima_interacao: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          atribuido_para?: string | null
          created_at?: string | null
          estagio_id?: string | null
          id?: string
          notas?: string | null
          prioridade?: string | null
          proximo_contato?: string | null
          tags?: string[] | null
          ultima_interacao?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          atribuido_para?: string | null
          created_at?: string | null
          estagio_id?: string | null
          id?: string
          notas?: string | null
          prioridade?: string | null
          proximo_contato?: string | null
          tags?: string[] | null
          ultima_interacao?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_usuarios_estagio_id_fkey"
            columns: ["estagio_id"]
            isOneToOne: false
            referencedRelation: "crm_estagios"
            referencedColumns: ["id"]
          },
        ]
      }
      cupons: {
        Row: {
          ativo: boolean
          codigo: string
          created_at: string
          expira_em: string | null
          id: string
          tipo: string
          usos_atuais: number
          usos_maximos: number | null
          valor: number
        }
        Insert: {
          ativo?: boolean
          codigo: string
          created_at?: string
          expira_em?: string | null
          id?: string
          tipo: string
          usos_atuais?: number
          usos_maximos?: number | null
          valor: number
        }
        Update: {
          ativo?: boolean
          codigo?: string
          created_at?: string
          expira_em?: string | null
          id?: string
          tipo?: string
          usos_atuais?: number
          usos_maximos?: number | null
          valor?: number
        }
        Relationships: []
      }
      dispositivo_imeis: {
        Row: {
          created_at: string | null
          dispositivo_id: string
          id: string
          imei: string
          venda_id: string | null
          vendido: boolean
        }
        Insert: {
          created_at?: string | null
          dispositivo_id: string
          id?: string
          imei: string
          venda_id?: string | null
          vendido?: boolean
        }
        Update: {
          created_at?: string | null
          dispositivo_id?: string
          id?: string
          imei?: string
          venda_id?: string | null
          vendido?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "dispositivo_imeis_dispositivo_id_fkey"
            columns: ["dispositivo_id"]
            isOneToOne: false
            referencedRelation: "dispositivos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispositivo_imeis_dispositivo_id_fkey"
            columns: ["dispositivo_id"]
            isOneToOne: false
            referencedRelation: "dispositivos_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispositivo_imeis_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispositivo_imeis_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas_ativas"
            referencedColumns: ["id"]
          },
        ]
      }
      dispositivos: {
        Row: {
          capacidade_gb: number | null
          checklist: Json | null
          codigo_barras: string | null
          compra_id: string | null
          condicao: string
          cor: string | null
          created_at: string | null
          custo: number | null
          deleted_at: string | null
          empresa_id: string | null
          fornecedor_id: string | null
          foto_url: string | null
          fotos: Json | null
          garantia: boolean | null
          id: string
          imei: string | null
          lucro: number | null
          marca: string
          modelo: string
          numero_serie: string | null
          origem_tipo: string | null
          preco: number | null
          preco_promocional: number | null
          quantidade: number
          saude_bateria: number | null
          subtipo_computador: string | null
          tempo_garantia: number | null
          tipo: string
          user_id: string
          vendido: boolean | null
        }
        Insert: {
          capacidade_gb?: number | null
          checklist?: Json | null
          codigo_barras?: string | null
          compra_id?: string | null
          condicao?: string
          cor?: string | null
          created_at?: string | null
          custo?: number | null
          deleted_at?: string | null
          empresa_id?: string | null
          fornecedor_id?: string | null
          foto_url?: string | null
          fotos?: Json | null
          garantia?: boolean | null
          id?: string
          imei?: string | null
          lucro?: number | null
          marca: string
          modelo: string
          numero_serie?: string | null
          origem_tipo?: string | null
          preco?: number | null
          preco_promocional?: number | null
          quantidade?: number
          saude_bateria?: number | null
          subtipo_computador?: string | null
          tempo_garantia?: number | null
          tipo: string
          user_id: string
          vendido?: boolean | null
        }
        Update: {
          capacidade_gb?: number | null
          checklist?: Json | null
          codigo_barras?: string | null
          compra_id?: string | null
          condicao?: string
          cor?: string | null
          created_at?: string | null
          custo?: number | null
          deleted_at?: string | null
          empresa_id?: string | null
          fornecedor_id?: string | null
          foto_url?: string | null
          fotos?: Json | null
          garantia?: boolean | null
          id?: string
          imei?: string | null
          lucro?: number | null
          marca?: string
          modelo?: string
          numero_serie?: string | null
          origem_tipo?: string | null
          preco?: number | null
          preco_promocional?: number | null
          quantidade?: number
          saude_bateria?: number | null
          subtipo_computador?: string | null
          tempo_garantia?: number | null
          tipo?: string
          user_id?: string
          vendido?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "dispositivos_compra_id_fkey"
            columns: ["compra_id"]
            isOneToOne: false
            referencedRelation: "compras_dispositivos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispositivos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispositivos_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
      empresa_metas: {
        Row: {
          ano: number | null
          created_at: string | null
          empresa_id: string | null
          id: string
          mes: number | null
          periodo: string
          proprietario_id: string | null
          tipo: string
          valor: number
        }
        Insert: {
          ano?: number | null
          created_at?: string | null
          empresa_id?: string | null
          id?: string
          mes?: number | null
          periodo: string
          proprietario_id?: string | null
          tipo: string
          valor: number
        }
        Update: {
          ano?: number | null
          created_at?: string | null
          empresa_id?: string | null
          id?: string
          mes?: number | null
          periodo?: string
          proprietario_id?: string | null
          tipo?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "empresa_metas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      empresa_usuarios: {
        Row: {
          ativa: boolean | null
          created_at: string | null
          empresa_id: string | null
          gerente_id: string | null
          id: string
          permissoes: Json | null
          proprietario_id: string | null
        }
        Insert: {
          ativa?: boolean | null
          created_at?: string | null
          empresa_id?: string | null
          gerente_id?: string | null
          id?: string
          permissoes?: Json | null
          proprietario_id?: string | null
        }
        Update: {
          ativa?: boolean | null
          created_at?: string | null
          empresa_id?: string | null
          gerente_id?: string | null
          id?: string
          permissoes?: Json | null
          proprietario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "empresa_usuarios_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          ativa: boolean | null
          cidade: string | null
          cnpj: string | null
          created_at: string | null
          endereco: string | null
          estado: string | null
          id: string
          logo_url: string | null
          nome: string
          proprietario_id: string | null
          telefone: string | null
          tipo: string
          updated_at: string | null
        }
        Insert: {
          ativa?: boolean | null
          cidade?: string | null
          cnpj?: string | null
          created_at?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          logo_url?: string | null
          nome: string
          proprietario_id?: string | null
          telefone?: string | null
          tipo?: string
          updated_at?: string | null
        }
        Update: {
          ativa?: boolean | null
          cidade?: string | null
          cnpj?: string | null
          created_at?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          logo_url?: string | null
          nome?: string
          proprietario_id?: string | null
          telefone?: string | null
          tipo?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      feedbacks: {
        Row: {
          created_at: string
          descricao: string
          id: string
          respondido_por: string | null
          resposta_admin: string | null
          status: Database["public"]["Enums"]["status_feedback"]
          tipo: Database["public"]["Enums"]["tipo_feedback"]
          titulo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          descricao: string
          id?: string
          respondido_por?: string | null
          resposta_admin?: string | null
          status?: Database["public"]["Enums"]["status_feedback"]
          tipo: Database["public"]["Enums"]["tipo_feedback"]
          titulo: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          descricao?: string
          id?: string
          respondido_por?: string | null
          resposta_admin?: string | null
          status?: Database["public"]["Enums"]["status_feedback"]
          tipo?: Database["public"]["Enums"]["tipo_feedback"]
          titulo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      fidelidade_config: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          id: string
          pontos_por_real_os: number | null
          pontos_por_real_venda: number | null
          tipo_resgate: string | null
          updated_at: string | null
          user_id: string | null
          validade_pontos_dias: number | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          pontos_por_real_os?: number | null
          pontos_por_real_venda?: number | null
          tipo_resgate?: string | null
          updated_at?: string | null
          user_id?: string | null
          validade_pontos_dias?: number | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          pontos_por_real_os?: number | null
          pontos_por_real_venda?: number | null
          tipo_resgate?: string | null
          updated_at?: string | null
          user_id?: string | null
          validade_pontos_dias?: number | null
        }
        Relationships: []
      }
      fidelidade_niveis: {
        Row: {
          beneficio: string | null
          cor: string | null
          created_at: string | null
          id: string
          nome: string
          ordem: number | null
          pontos_minimos: number
          user_id: string | null
        }
        Insert: {
          beneficio?: string | null
          cor?: string | null
          created_at?: string | null
          id?: string
          nome: string
          ordem?: number | null
          pontos_minimos: number
          user_id?: string | null
        }
        Update: {
          beneficio?: string | null
          cor?: string | null
          created_at?: string | null
          id?: string
          nome?: string
          ordem?: number | null
          pontos_minimos?: number
          user_id?: string | null
        }
        Relationships: []
      }
      fidelidade_pontos: {
        Row: {
          cliente_id: string | null
          created_at: string | null
          descricao: string | null
          expires_at: string | null
          id: string
          pontos: number
          referencia_id: string | null
          tipo: string
          user_id: string | null
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string | null
          descricao?: string | null
          expires_at?: string | null
          id?: string
          pontos: number
          referencia_id?: string | null
          tipo: string
          user_id?: string | null
        }
        Update: {
          cliente_id?: string | null
          created_at?: string | null
          descricao?: string | null
          expires_at?: string | null
          id?: string
          pontos?: number
          referencia_id?: string | null
          tipo?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fidelidade_pontos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fidelidade_pontos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes_ativos"
            referencedColumns: ["id"]
          },
        ]
      }
      fidelidade_resgates: {
        Row: {
          cliente_id: string | null
          created_at: string | null
          cupom_codigo: string | null
          descricao: string | null
          id: string
          pontos_resgatados: number
          tipo_resgate: string
          user_id: string | null
          valor_desconto: number | null
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string | null
          cupom_codigo?: string | null
          descricao?: string | null
          id?: string
          pontos_resgatados: number
          tipo_resgate: string
          user_id?: string | null
          valor_desconto?: number | null
        }
        Update: {
          cliente_id?: string | null
          created_at?: string | null
          cupom_codigo?: string | null
          descricao?: string | null
          id?: string
          pontos_resgatados?: number
          tipo_resgate?: string
          user_id?: string | null
          valor_desconto?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fidelidade_resgates_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fidelidade_resgates_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes_ativos"
            referencedColumns: ["id"]
          },
        ]
      }
      followup_control: {
        Row: {
          enviado_em: string | null
          etapa: string
          id: string
          user_id: string
        }
        Insert: {
          enviado_em?: string | null
          etapa: string
          id?: string
          user_id: string
        }
        Update: {
          enviado_em?: string | null
          etapa?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      fornecedores: {
        Row: {
          ativo: boolean | null
          celular: string | null
          cep: string | null
          cidade: string | null
          cnpj: string | null
          cpf: string | null
          created_at: string | null
          deleted_at: string | null
          email: string | null
          empresa_id: string | null
          endereco: string | null
          estado: string | null
          id: string
          nome: string
          nome_fantasia: string | null
          observacoes: string | null
          telefone: string | null
          tipo: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          ativo?: boolean | null
          celular?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          cpf?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          empresa_id?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          nome: string
          nome_fantasia?: string | null
          observacoes?: string | null
          telefone?: string | null
          tipo: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          ativo?: boolean | null
          celular?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          cpf?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          empresa_id?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          nome?: string
          nome_fantasia?: string | null
          observacoes?: string | null
          telefone?: string | null
          tipo?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fornecedores_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      historico_bloqueios: {
        Row: {
          acao: string
          admin_email: string | null
          admin_id: string
          admin_nome: string | null
          created_at: string
          id: string
          motivo: string | null
          tipo_bloqueio: string | null
          user_email: string | null
          user_id: string
          user_nome: string | null
        }
        Insert: {
          acao: string
          admin_email?: string | null
          admin_id: string
          admin_nome?: string | null
          created_at?: string
          id?: string
          motivo?: string | null
          tipo_bloqueio?: string | null
          user_email?: string | null
          user_id: string
          user_nome?: string | null
        }
        Update: {
          acao?: string
          admin_email?: string | null
          admin_id?: string
          admin_nome?: string | null
          created_at?: string
          id?: string
          motivo?: string | null
          tipo_bloqueio?: string | null
          user_email?: string | null
          user_id?: string
          user_nome?: string | null
        }
        Relationships: []
      }
      kirvano_eventos: {
        Row: {
          created_at: string | null
          dados: Json
          email_usuario: string | null
          id: string
          kirvano_event_id: string
          plano_tipo: string | null
          processado: boolean | null
          tipo: string
        }
        Insert: {
          created_at?: string | null
          dados: Json
          email_usuario?: string | null
          id?: string
          kirvano_event_id: string
          plano_tipo?: string | null
          processado?: boolean | null
          tipo: string
        }
        Update: {
          created_at?: string | null
          dados?: Json
          email_usuario?: string | null
          id?: string
          kirvano_event_id?: string
          plano_tipo?: string | null
          processado?: boolean | null
          tipo?: string
        }
        Relationships: []
      }
      lista_compras: {
        Row: {
          concluido: boolean
          created_at: string
          id: string
          lista_id: string | null
          nome: string
          ordem: number
          quantidade: string
          user_id: string
        }
        Insert: {
          concluido?: boolean
          created_at?: string
          id?: string
          lista_id?: string | null
          nome: string
          ordem?: number
          quantidade?: string
          user_id: string
        }
        Update: {
          concluido?: boolean
          created_at?: string
          id?: string
          lista_id?: string | null
          nome?: string
          ordem?: number
          quantidade?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lista_compras_lista_id_fkey"
            columns: ["lista_id"]
            isOneToOne: false
            referencedRelation: "listas_compras"
            referencedColumns: ["id"]
          },
        ]
      }
      listas_compras: {
        Row: {
          created_at: string
          id: string
          nome: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      loja_funcionarios: {
        Row: {
          ativo: boolean | null
          cargo: string | null
          comissao_escopo: string | null
          comissao_tipo: string | null
          comissao_valor: number | null
          comissoes_por_cargo: Json | null
          convite_aceito_em: string | null
          convite_expira_em: string | null
          convite_token: string | null
          created_at: string | null
          email: string
          empresa_id: string | null
          funcionario_user_id: string | null
          id: string
          loja_user_id: string
          nome: string
          permissoes: Json
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          cargo?: string | null
          comissao_escopo?: string | null
          comissao_tipo?: string | null
          comissao_valor?: number | null
          comissoes_por_cargo?: Json | null
          convite_aceito_em?: string | null
          convite_expira_em?: string | null
          convite_token?: string | null
          created_at?: string | null
          email: string
          empresa_id?: string | null
          funcionario_user_id?: string | null
          id?: string
          loja_user_id: string
          nome: string
          permissoes?: Json
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          cargo?: string | null
          comissao_escopo?: string | null
          comissao_tipo?: string | null
          comissao_valor?: number | null
          comissoes_por_cargo?: Json | null
          convite_aceito_em?: string | null
          convite_expira_em?: string | null
          convite_token?: string | null
          created_at?: string | null
          email?: string
          empresa_id?: string | null
          funcionario_user_id?: string | null
          id?: string
          loja_user_id?: string
          nome?: string
          permissoes?: Json
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loja_funcionarios_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      mensagens_suporte: {
        Row: {
          conversa_id: string
          created_at: string
          id: string
          is_admin: boolean
          lida: boolean
          mensagem: string
          remetente_id: string
        }
        Insert: {
          conversa_id: string
          created_at?: string
          id?: string
          is_admin?: boolean
          lida?: boolean
          mensagem: string
          remetente_id: string
        }
        Update: {
          conversa_id?: string
          created_at?: string
          id?: string
          is_admin?: boolean
          lida?: boolean
          mensagem?: string
          remetente_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mensagens_suporte_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "conversas_suporte"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_rules: {
        Row: {
          active: boolean
          body_template: string
          condition: Json | null
          condition_label: string | null
          created_at: string
          event_type: string
          id: string
          sound: string | null
          target: string
          title_template: string
          updated_at: string
          url_template: string | null
        }
        Insert: {
          active?: boolean
          body_template: string
          condition?: Json | null
          condition_label?: string | null
          created_at?: string
          event_type: string
          id?: string
          sound?: string | null
          target?: string
          title_template: string
          updated_at?: string
          url_template?: string | null
        }
        Update: {
          active?: boolean
          body_template?: string
          condition?: Json | null
          condition_label?: string | null
          created_at?: string
          event_type?: string
          id?: string
          sound?: string | null
          target?: string
          title_template?: string
          updated_at?: string
          url_template?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string | null
          id: string
          opened_at: string | null
          sent_at: string | null
          title: string
          type: string | null
          url: string | null
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string | null
          id?: string
          opened_at?: string | null
          sent_at?: string | null
          title: string
          type?: string | null
          url?: string | null
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string | null
          id?: string
          opened_at?: string | null
          sent_at?: string | null
          title?: string
          type?: string | null
          url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      novidades: {
        Row: {
          ativo: boolean
          conteudo: Json
          created_at: string
          created_by: string | null
          data_fim: string | null
          data_inicio: string
          descricao: string | null
          id: string
          layout_config: Json | null
          prioridade: number
          publico_alvo: string[]
          thumbnail_url: string | null
          titulo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          conteudo?: Json
          created_at?: string
          created_by?: string | null
          data_fim?: string | null
          data_inicio?: string
          descricao?: string | null
          id?: string
          layout_config?: Json | null
          prioridade?: number
          publico_alvo?: string[]
          thumbnail_url?: string | null
          titulo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          conteudo?: Json
          created_at?: string
          created_by?: string | null
          data_fim?: string | null
          data_inicio?: string
          descricao?: string | null
          id?: string
          layout_config?: Json | null
          prioridade?: number
          publico_alvo?: string[]
          thumbnail_url?: string | null
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      onboarding_config: {
        Row: {
          ativo: boolean
          config_passos: Json
          flow_config: Json | null
          id: string
          mostrar_para_usuarios_ativos: boolean
          publico_alvo: string[]
          textos_personalizados: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          ativo?: boolean
          config_passos?: Json
          flow_config?: Json | null
          id?: string
          mostrar_para_usuarios_ativos?: boolean
          publico_alvo?: string[]
          textos_personalizados?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          ativo?: boolean
          config_passos?: Json
          flow_config?: Json | null
          id?: string
          mostrar_para_usuarios_ativos?: boolean
          publico_alvo?: string[]
          textos_personalizados?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      orcamentos: {
        Row: {
          checklist: Json | null
          cliente_email: string | null
          cliente_id: string | null
          cliente_nome: string | null
          cliente_telefone: string | null
          cor_dispositivo: string | null
          created_at: string
          data_validade: string | null
          deleted_at: string | null
          desconto: number
          empresa_id: string | null
          fabricante: string | null
          id: string
          itens: Json
          marca_dispositivo: string | null
          modelo_dispositivo: string | null
          numero_orcamento: string
          observacoes: string | null
          sistema_operacional: string | null
          status: string
          subtotal: number
          termos_condicoes: string | null
          tipo_dispositivo: string | null
          updated_at: string
          user_id: string
          validade_dias: number
          valor_total: number
        }
        Insert: {
          checklist?: Json | null
          cliente_email?: string | null
          cliente_id?: string | null
          cliente_nome?: string | null
          cliente_telefone?: string | null
          cor_dispositivo?: string | null
          created_at?: string
          data_validade?: string | null
          deleted_at?: string | null
          desconto?: number
          empresa_id?: string | null
          fabricante?: string | null
          id?: string
          itens?: Json
          marca_dispositivo?: string | null
          modelo_dispositivo?: string | null
          numero_orcamento: string
          observacoes?: string | null
          sistema_operacional?: string | null
          status?: string
          subtotal?: number
          termos_condicoes?: string | null
          tipo_dispositivo?: string | null
          updated_at?: string
          user_id: string
          validade_dias?: number
          valor_total?: number
        }
        Update: {
          checklist?: Json | null
          cliente_email?: string | null
          cliente_id?: string | null
          cliente_nome?: string | null
          cliente_telefone?: string | null
          cor_dispositivo?: string | null
          created_at?: string
          data_validade?: string | null
          deleted_at?: string | null
          desconto?: number
          empresa_id?: string | null
          fabricante?: string | null
          id?: string
          itens?: Json
          marca_dispositivo?: string | null
          modelo_dispositivo?: string | null
          numero_orcamento?: string
          observacoes?: string | null
          sistema_operacional?: string | null
          status?: string
          subtotal?: number
          termos_condicoes?: string | null
          tipo_dispositivo?: string | null
          updated_at?: string
          user_id?: string
          validade_dias?: number
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "orcamentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes_ativos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      ordens_servico: {
        Row: {
          avarias: Json | null
          cliente_id: string | null
          comissao_calculada_snapshot: number | null
          comissao_tipo_snapshot: string | null
          comissao_valor_snapshot: number | null
          created_at: string | null
          data_saida: string | null
          defeito_relatado: string
          deleted_at: string | null
          deleted_by: string | null
          dispositivo_cor: string | null
          dispositivo_imei: string | null
          dispositivo_marca: string
          dispositivo_modelo: string
          dispositivo_numero_serie: string | null
          dispositivo_tipo: string
          empresa_id: string | null
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"] | null
          funcionario_id: string | null
          id: string
          is_teste: boolean
          localizacao_fisica: string | null
          numero_os: string
          origem_cliente: string | null
          senha_desbloqueio: string | null
          servico_data_pagamento: string | null
          servico_fornecedor_id: string | null
          servico_id: string | null
          servico_status_pagamento: string | null
          status: string | null
          tempo_garantia: number | null
          tipo_midia: string | null
          tipo_os: string
          tipo_servico_id: string | null
          tipo_servico_nome_snapshot: string | null
          total: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          avarias?: Json | null
          cliente_id?: string | null
          comissao_calculada_snapshot?: number | null
          comissao_tipo_snapshot?: string | null
          comissao_valor_snapshot?: number | null
          created_at?: string | null
          data_saida?: string | null
          defeito_relatado: string
          deleted_at?: string | null
          deleted_by?: string | null
          dispositivo_cor?: string | null
          dispositivo_imei?: string | null
          dispositivo_marca: string
          dispositivo_modelo: string
          dispositivo_numero_serie?: string | null
          dispositivo_tipo: string
          empresa_id?: string | null
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          funcionario_id?: string | null
          id?: string
          is_teste?: boolean
          localizacao_fisica?: string | null
          numero_os: string
          origem_cliente?: string | null
          senha_desbloqueio?: string | null
          servico_data_pagamento?: string | null
          servico_fornecedor_id?: string | null
          servico_id?: string | null
          servico_status_pagamento?: string | null
          status?: string | null
          tempo_garantia?: number | null
          tipo_midia?: string | null
          tipo_os?: string
          tipo_servico_id?: string | null
          tipo_servico_nome_snapshot?: string | null
          total?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          avarias?: Json | null
          cliente_id?: string | null
          comissao_calculada_snapshot?: number | null
          comissao_tipo_snapshot?: string | null
          comissao_valor_snapshot?: number | null
          created_at?: string | null
          data_saida?: string | null
          defeito_relatado?: string
          deleted_at?: string | null
          deleted_by?: string | null
          dispositivo_cor?: string | null
          dispositivo_imei?: string | null
          dispositivo_marca?: string
          dispositivo_modelo?: string
          dispositivo_numero_serie?: string | null
          dispositivo_tipo?: string
          empresa_id?: string | null
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          funcionario_id?: string | null
          id?: string
          is_teste?: boolean
          localizacao_fisica?: string | null
          numero_os?: string
          origem_cliente?: string | null
          senha_desbloqueio?: string | null
          servico_data_pagamento?: string | null
          servico_fornecedor_id?: string | null
          servico_id?: string | null
          servico_status_pagamento?: string | null
          status?: string | null
          tempo_garantia?: number | null
          tipo_midia?: string | null
          tipo_os?: string
          tipo_servico_id?: string | null
          tipo_servico_nome_snapshot?: string | null
          total?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ordens_servico_cliente_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_servico_cliente_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes_ativos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_servico_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_servico_servico_fornecedor_id_fkey"
            columns: ["servico_fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_servico_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "servicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_servico_tipo_servico_id_fkey"
            columns: ["tipo_servico_id"]
            isOneToOne: false
            referencedRelation: "tipos_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      origem_pessoas: {
        Row: {
          ativo: boolean | null
          cep: string | null
          cidade: string | null
          cpf_cnpj: string | null
          created_at: string | null
          data_nascimento: string | null
          documento_frente_url: string | null
          documento_verso_url: string | null
          email: string | null
          empresa_id: string | null
          endereco: string | null
          estado: string | null
          id: string
          nome: string
          nome_fantasia: string | null
          observacoes: string | null
          rg: string | null
          telefone: string | null
          tipo: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          ativo?: boolean | null
          cep?: string | null
          cidade?: string | null
          cpf_cnpj?: string | null
          created_at?: string | null
          data_nascimento?: string | null
          documento_frente_url?: string | null
          documento_verso_url?: string | null
          email?: string | null
          empresa_id?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          nome: string
          nome_fantasia?: string | null
          observacoes?: string | null
          rg?: string | null
          telefone?: string | null
          tipo: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          ativo?: boolean | null
          cep?: string | null
          cidade?: string | null
          cpf_cnpj?: string | null
          created_at?: string | null
          data_nascimento?: string | null
          documento_frente_url?: string | null
          documento_verso_url?: string | null
          email?: string | null
          empresa_id?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          nome?: string
          nome_fantasia?: string | null
          observacoes?: string | null
          rg?: string | null
          telefone?: string | null
          tipo?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "origem_pessoas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      os_audit_log: {
        Row: {
          acao: string
          created_at: string
          dados_antes: Json | null
          dados_depois: Json | null
          id: string
          os_id: string
          user_id: string
        }
        Insert: {
          acao: string
          created_at?: string
          dados_antes?: Json | null
          dados_depois?: Json | null
          id?: string
          os_id: string
          user_id: string
        }
        Update: {
          acao?: string
          created_at?: string
          dados_antes?: Json | null
          dados_depois?: Json | null
          id?: string
          os_id?: string
          user_id?: string
        }
        Relationships: []
      }
      os_localizacoes: {
        Row: {
          created_at: string | null
          id: string
          nome: string
          ordem: number | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          nome: string
          ordem?: number | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          nome?: string
          ordem?: number | null
          user_id?: string
        }
        Relationships: []
      }
      os_metas: {
        Row: {
          ano: number
          created_at: string | null
          id: string
          mes: number
          meta: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          ano: number
          created_at?: string | null
          id?: string
          mes: number
          meta: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          ano?: number
          created_at?: string | null
          id?: string
          mes?: number
          meta?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      os_status_config: {
        Row: {
          ativo: boolean
          cor: string
          created_at: string | null
          gera_conta: boolean
          id: string
          is_sistema: boolean
          nome: string
          ordem: number
          pedir_data_vencimento: boolean
          slug: string
          tipo_conta: string | null
          user_id: string
        }
        Insert: {
          ativo?: boolean
          cor?: string
          created_at?: string | null
          gera_conta?: boolean
          id?: string
          is_sistema?: boolean
          nome: string
          ordem?: number
          pedir_data_vencimento?: boolean
          slug: string
          tipo_conta?: string | null
          user_id: string
        }
        Update: {
          ativo?: boolean
          cor?: string
          created_at?: string | null
          gera_conta?: boolean
          id?: string
          is_sistema?: boolean
          nome?: string
          ordem?: number
          pedir_data_vencimento?: boolean
          slug?: string
          tipo_conta?: string | null
          user_id?: string
        }
        Relationships: []
      }
      os_tecnicos: {
        Row: {
          comissao_calculada_snapshot: number | null
          comissao_tipo_snapshot: string | null
          comissao_valor_snapshot: number | null
          created_at: string
          descricao_servico: string | null
          funcionario_id: string
          id: string
          os_id: string
        }
        Insert: {
          comissao_calculada_snapshot?: number | null
          comissao_tipo_snapshot?: string | null
          comissao_valor_snapshot?: number | null
          created_at?: string
          descricao_servico?: string | null
          funcionario_id: string
          id?: string
          os_id: string
        }
        Update: {
          comissao_calculada_snapshot?: number | null
          comissao_tipo_snapshot?: string | null
          comissao_valor_snapshot?: number | null
          created_at?: string
          descricao_servico?: string | null
          funcionario_id?: string
          id?: string
          os_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "os_tecnicos_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "loja_funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "os_tecnicos_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "os_tecnicos_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico_ativas"
            referencedColumns: ["id"]
          },
        ]
      }
      os_tracking_links: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          id: string
          os_id: string | null
          token: string
          user_id: string | null
          visualizacoes: number | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          os_id?: string | null
          token?: string
          user_id?: string | null
          visualizacoes?: number | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          os_id?: string | null
          token?: string
          user_id?: string | null
          visualizacoes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "os_tracking_links_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "os_tracking_links_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico_ativas"
            referencedColumns: ["id"]
          },
        ]
      }
      os_tracking_uso: {
        Row: {
          ano: number
          id: string
          mes: number
          total_compartilhamentos: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          ano: number
          id?: string
          mes: number
          total_compartilhamentos?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          ano?: number
          id?: string
          mes?: number
          total_compartilhamentos?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      pagamentos_pix: {
        Row: {
          created_at: string
          expired_at: string | null
          id: string
          pagarme_charge_id: string | null
          pagarme_order_id: string | null
          pagarme_transaction_id: string | null
          paid_at: string | null
          pix_expiration: string | null
          pix_qr_code: string | null
          pix_qr_code_url: string | null
          plano_tipo: string
          status: string
          updated_at: string
          user_id: string
          valor_centavos: number
        }
        Insert: {
          created_at?: string
          expired_at?: string | null
          id?: string
          pagarme_charge_id?: string | null
          pagarme_order_id?: string | null
          pagarme_transaction_id?: string | null
          paid_at?: string | null
          pix_expiration?: string | null
          pix_qr_code?: string | null
          pix_qr_code_url?: string | null
          plano_tipo: string
          status?: string
          updated_at?: string
          user_id: string
          valor_centavos: number
        }
        Update: {
          created_at?: string
          expired_at?: string | null
          id?: string
          pagarme_charge_id?: string | null
          pagarme_order_id?: string | null
          pagarme_transaction_id?: string | null
          paid_at?: string | null
          pix_expiration?: string | null
          pix_qr_code?: string | null
          pix_qr_code_url?: string | null
          plano_tipo?: string
          status?: string
          updated_at?: string
          user_id?: string
          valor_centavos?: number
        }
        Relationships: []
      }
      pecas: {
        Row: {
          categoria_id: string | null
          codigo_barras: string | null
          created_at: string | null
          custo: number | null
          deleted_at: string | null
          empresa_id: string | null
          fornecedor_id: string | null
          fotos: Json | null
          id: string
          nome: string
          preco: number | null
          preco_atacado: number | null
          quantidade: number | null
          user_id: string
        }
        Insert: {
          categoria_id?: string | null
          codigo_barras?: string | null
          created_at?: string | null
          custo?: number | null
          deleted_at?: string | null
          empresa_id?: string | null
          fornecedor_id?: string | null
          fotos?: Json | null
          id?: string
          nome: string
          preco?: number | null
          preco_atacado?: number | null
          quantidade?: number | null
          user_id: string
        }
        Update: {
          categoria_id?: string | null
          codigo_barras?: string | null
          created_at?: string | null
          custo?: number | null
          deleted_at?: string | null
          empresa_id?: string | null
          fornecedor_id?: string | null
          fotos?: Json | null
          id?: string
          nome?: string
          preco?: number | null
          preco_atacado?: number | null
          quantidade?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pecas_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pecas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pecas_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos: {
        Row: {
          cliente_nome: string
          cliente_telefone: string | null
          created_at: string | null
          descricao: string
          id: string
          observacoes: string | null
          pago: boolean
          previsao_chegada: string | null
          status: string
          updated_at: string | null
          user_id: string
          valor_total: number | null
        }
        Insert: {
          cliente_nome: string
          cliente_telefone?: string | null
          created_at?: string | null
          descricao: string
          id?: string
          observacoes?: string | null
          pago?: boolean
          previsao_chegada?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
          valor_total?: number | null
        }
        Update: {
          cliente_nome?: string
          cliente_telefone?: string | null
          created_at?: string | null
          descricao?: string
          id?: string
          observacoes?: string | null
          pago?: boolean
          previsao_chegada?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
          valor_total?: number | null
        }
        Relationships: []
      }
      produtos: {
        Row: {
          categoria_id: string | null
          codigo_barras: string | null
          created_at: string | null
          custo: number | null
          deleted_at: string | null
          empresa_id: string | null
          fornecedor_id: string | null
          fotos: Json | null
          id: string
          lucro: number | null
          nome: string
          preco: number | null
          preco_atacado: number | null
          produto_pai_id: string | null
          quantidade: number | null
          sku: string | null
          user_id: string
          variacao_label: string | null
        }
        Insert: {
          categoria_id?: string | null
          codigo_barras?: string | null
          created_at?: string | null
          custo?: number | null
          deleted_at?: string | null
          empresa_id?: string | null
          fornecedor_id?: string | null
          fotos?: Json | null
          id?: string
          lucro?: number | null
          nome: string
          preco?: number | null
          preco_atacado?: number | null
          produto_pai_id?: string | null
          quantidade?: number | null
          sku?: string | null
          user_id: string
          variacao_label?: string | null
        }
        Update: {
          categoria_id?: string | null
          codigo_barras?: string | null
          created_at?: string | null
          custo?: number | null
          deleted_at?: string | null
          empresa_id?: string | null
          fornecedor_id?: string | null
          fotos?: Json | null
          id?: string
          lucro?: number | null
          nome?: string
          preco?: number | null
          preco_atacado?: number | null
          produto_pai_id?: string | null
          quantidade?: number | null
          sku?: string | null
          user_id?: string
          variacao_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "produtos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produtos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produtos_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produtos_produto_pai_id_fkey"
            columns: ["produto_pai_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produtos_produto_pai_id_fkey"
            columns: ["produto_pai_id"]
            isOneToOne: false
            referencedRelation: "produtos_ativos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produtos_produto_pai_id_fkey"
            columns: ["produto_pai_id"]
            isOneToOne: false
            referencedRelation: "produtos_catalogo"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          celular: string | null
          created_at: string | null
          crm_stage: string | null
          email: string
          fbc: string | null
          fbclid: string | null
          fbp: string | null
          first_os_created_at: string | null
          id: string
          last_login_at: string | null
          login_count: number | null
          nome: string
          preferencias_os: Json | null
          purchase_event_id: string | null
          registration_tracked: boolean | null
          updated_at: string | null
          user_id: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          whatsapp_enviado: boolean | null
          whatsapp_followup_stage: number | null
          whatsapp_last_sent_at: string | null
          whatsapp_numero_valido: boolean | null
          whatsapp_response: boolean | null
          whatsapp_status: string | null
          whatsapp_ultima_mensagem: string | null
        }
        Insert: {
          celular?: string | null
          created_at?: string | null
          crm_stage?: string | null
          email: string
          fbc?: string | null
          fbclid?: string | null
          fbp?: string | null
          first_os_created_at?: string | null
          id?: string
          last_login_at?: string | null
          login_count?: number | null
          nome: string
          preferencias_os?: Json | null
          purchase_event_id?: string | null
          registration_tracked?: boolean | null
          updated_at?: string | null
          user_id: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          whatsapp_enviado?: boolean | null
          whatsapp_followup_stage?: number | null
          whatsapp_last_sent_at?: string | null
          whatsapp_numero_valido?: boolean | null
          whatsapp_response?: boolean | null
          whatsapp_status?: string | null
          whatsapp_ultima_mensagem?: string | null
        }
        Update: {
          celular?: string | null
          created_at?: string | null
          crm_stage?: string | null
          email?: string
          fbc?: string | null
          fbclid?: string | null
          fbp?: string | null
          first_os_created_at?: string | null
          id?: string
          last_login_at?: string | null
          login_count?: number | null
          nome?: string
          preferencias_os?: Json | null
          purchase_event_id?: string | null
          registration_tracked?: boolean | null
          updated_at?: string | null
          user_id?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          whatsapp_enviado?: boolean | null
          whatsapp_followup_stage?: number | null
          whatsapp_last_sent_at?: string | null
          whatsapp_numero_valido?: boolean | null
          whatsapp_response?: boolean | null
          whatsapp_status?: string | null
          whatsapp_ultima_mensagem?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth_key: string
          created_at: string
          device: string | null
          endpoint: string
          id: string
          is_active: boolean
          is_pwa_installed: boolean | null
          p256dh_key: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth_key: string
          created_at?: string
          device?: string | null
          endpoint: string
          id?: string
          is_active?: boolean
          is_pwa_installed?: boolean | null
          p256dh_key: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth_key?: string
          created_at?: string
          device?: string | null
          endpoint?: string
          id?: string
          is_active?: boolean
          is_pwa_installed?: boolean | null
          p256dh_key?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      reactivation_messages: {
        Row: {
          campaign_step: number
          channel: string | null
          created_at: string | null
          id: string
          message_text: string | null
          provider_message_id: string | null
          sent_at: string | null
          status: string | null
          template_key: string | null
          user_id: string
        }
        Insert: {
          campaign_step: number
          channel?: string | null
          created_at?: string | null
          id?: string
          message_text?: string | null
          provider_message_id?: string | null
          sent_at?: string | null
          status?: string | null
          template_key?: string | null
          user_id: string
        }
        Update: {
          campaign_step?: number
          channel?: string | null
          created_at?: string | null
          id?: string
          message_text?: string | null
          provider_message_id?: string | null
          sent_at?: string | null
          status?: string | null
          template_key?: string | null
          user_id?: string
        }
        Relationships: []
      }
      servicos: {
        Row: {
          codigo: string | null
          created_at: string | null
          custo: number | null
          empresa_id: string | null
          id: string
          lucro: number | null
          nome: string
          peca_id: string | null
          preco: number | null
          quantidade: number
          user_id: string
        }
        Insert: {
          codigo?: string | null
          created_at?: string | null
          custo?: number | null
          empresa_id?: string | null
          id?: string
          lucro?: number | null
          nome: string
          peca_id?: string | null
          preco?: number | null
          quantidade?: number
          user_id: string
        }
        Update: {
          codigo?: string | null
          created_at?: string | null
          custo?: number | null
          empresa_id?: string | null
          id?: string
          lucro?: number | null
          nome?: string
          peca_id?: string | null
          preco?: number | null
          quantidade?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "servicos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servicos_peca_id_fkey"
            columns: ["peca_id"]
            isOneToOne: false
            referencedRelation: "pecas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servicos_peca_id_fkey"
            columns: ["peca_id"]
            isOneToOne: false
            referencedRelation: "pecas_catalogo"
            referencedColumns: ["id"]
          },
        ]
      }
      servicos_avulsos: {
        Row: {
          created_at: string
          custo: number
          empresa_id: string | null
          id: string
          lucro: number
          nome: string
          observacoes: string | null
          preco: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          custo?: number
          empresa_id?: string | null
          id?: string
          lucro?: number
          nome: string
          observacoes?: string | null
          preco?: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          custo?: number
          empresa_id?: string | null
          id?: string
          lucro?: number
          nome?: string
          observacoes?: string | null
          preco?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "servicos_avulsos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      taxas_cartao: {
        Row: {
          ativo: boolean | null
          bandeira: string
          created_at: string | null
          empresa_id: string | null
          id: string
          taxa_credito: number | null
          taxa_debito: number | null
          taxas_parcelado: Json | null
          user_id: string
        }
        Insert: {
          ativo?: boolean | null
          bandeira: string
          created_at?: string | null
          empresa_id?: string | null
          id?: string
          taxa_credito?: number | null
          taxa_debito?: number | null
          taxas_parcelado?: Json | null
          user_id: string
        }
        Update: {
          ativo?: boolean | null
          bandeira?: string
          created_at?: string | null
          empresa_id?: string | null
          id?: string
          taxa_credito?: number | null
          taxa_debito?: number | null
          taxas_parcelado?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "taxas_cartao_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      tiny_integrations: {
        Row: {
          access_token: string
          auto_refresh_interval: number | null
          connected_at: string | null
          expires_at: string
          id: string
          nome_assistencia: string | null
          refresh_token: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          auto_refresh_interval?: number | null
          connected_at?: string | null
          expires_at: string
          id?: string
          nome_assistencia?: string | null
          refresh_token: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          auto_refresh_interval?: number | null
          connected_at?: string | null
          expires_at?: string
          id?: string
          nome_assistencia?: string | null
          refresh_token?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      tipos_garantia: {
        Row: {
          ativo: boolean
          created_at: string
          empresa_id: string | null
          id: string
          meses: number
          nome: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          empresa_id?: string | null
          id?: string
          meses: number
          nome: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          empresa_id?: string | null
          id?: string
          meses?: number
          nome?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tipos_garantia_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      tipos_servico: {
        Row: {
          ativo: boolean
          created_at: string
          empresa_id: string | null
          id: string
          nome: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          empresa_id?: string | null
          id?: string
          nome: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          empresa_id?: string | null
          id?: string
          nome?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tipos_servico_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      trial_emails_sent: {
        Row: {
          created_at: string | null
          email_type: string
          id: string
          opened_at: string | null
          sent_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email_type: string
          id?: string
          opened_at?: string | null
          sent_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email_type?: string
          id?: string
          opened_at?: string | null
          sent_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      trocas_garantia: {
        Row: {
          cliente_nome: string | null
          created_at: string
          empresa_id: string | null
          id: string
          motivo_defeito: string | null
          observacao: string | null
          produto_defeituoso_nome: string
          produto_devolvido_id: string | null
          produto_novo_id: string
          produto_novo_nome: string
          tipo: string
          user_id: string
          venda_id: string | null
        }
        Insert: {
          cliente_nome?: string | null
          created_at?: string
          empresa_id?: string | null
          id?: string
          motivo_defeito?: string | null
          observacao?: string | null
          produto_defeituoso_nome: string
          produto_devolvido_id?: string | null
          produto_novo_id: string
          produto_novo_nome: string
          tipo?: string
          user_id: string
          venda_id?: string | null
        }
        Update: {
          cliente_nome?: string | null
          created_at?: string
          empresa_id?: string | null
          id?: string
          motivo_defeito?: string | null
          observacao?: string | null
          produto_defeituoso_nome?: string
          produto_devolvido_id?: string | null
          produto_novo_id?: string
          produto_novo_nome?: string
          tipo?: string
          user_id?: string
          venda_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trocas_garantia_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trocas_garantia_produto_devolvido_id_fkey"
            columns: ["produto_devolvido_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trocas_garantia_produto_devolvido_id_fkey"
            columns: ["produto_devolvido_id"]
            isOneToOne: false
            referencedRelation: "produtos_ativos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trocas_garantia_produto_devolvido_id_fkey"
            columns: ["produto_devolvido_id"]
            isOneToOne: false
            referencedRelation: "produtos_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trocas_garantia_produto_novo_id_fkey"
            columns: ["produto_novo_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trocas_garantia_produto_novo_id_fkey"
            columns: ["produto_novo_id"]
            isOneToOne: false
            referencedRelation: "produtos_ativos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trocas_garantia_produto_novo_id_fkey"
            columns: ["produto_novo_id"]
            isOneToOne: false
            referencedRelation: "produtos_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trocas_garantia_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trocas_garantia_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas_ativas"
            referencedColumns: ["id"]
          },
        ]
      }
      tutoriais_videos: {
        Row: {
          ativo: boolean | null
          capa_url: string | null
          categoria: string
          created_at: string | null
          descricao: string | null
          id: string
          ordem: number | null
          tags: string[] | null
          titulo: string
          video_upload_url: string | null
          youtube_url: string
        }
        Insert: {
          ativo?: boolean | null
          capa_url?: string | null
          categoria: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          ordem?: number | null
          tags?: string[] | null
          titulo: string
          video_upload_url?: string | null
          youtube_url: string
        }
        Update: {
          ativo?: boolean | null
          capa_url?: string | null
          categoria?: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          ordem?: number | null
          tags?: string[] | null
          titulo?: string
          video_upload_url?: string | null
          youtube_url?: string
        }
        Relationships: []
      }
      user_events: {
        Row: {
          created_at: string | null
          event_data: Json | null
          event_type: string
          id: string
          user_id: string
          user_status: string | null
        }
        Insert: {
          created_at?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
          user_id: string
          user_status?: string | null
        }
        Update: {
          created_at?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
          user_id?: string
          user_status?: string | null
        }
        Relationships: []
      }
      user_notification_preferences: {
        Row: {
          created_at: string | null
          empresa_id: string | null
          id: string
          preferences: Json
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          empresa_id?: string | null
          id?: string
          preferences?: Json
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          empresa_id?: string | null
          id?: string
          preferences?: Json
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_notification_preferences_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      user_onboarding: {
        Row: {
          aha_moment_reached: boolean | null
          aha_moment_reached_at: string | null
          cidade: string | null
          created_at: string | null
          estado: string | null
          id: string
          nome_assistencia: string | null
          objetivo_onboarding: string | null
          onboarding_completed: boolean | null
          onboarding_completed_at: string | null
          onboarding_dismissed: boolean | null
          onboarding_dismissed_at: string | null
          onboarding_obrigatorio_completed: boolean | null
          onboarding_obrigatorio_completed_at: string | null
          onboarding_skipped: boolean | null
          onboarding_skipped_at: string | null
          primeira_os_simulada: boolean | null
          primeira_os_simulada_at: string | null
          primeiro_cliente_id: string | null
          step_cliente_cadastrado: boolean | null
          step_cliente_cadastrado_at: string | null
          step_dispositivo_cadastrado: boolean | null
          step_dispositivo_cadastrado_at: string | null
          step_lucro_visualizado: boolean | null
          step_lucro_visualizado_at: string | null
          step_os_criada: boolean | null
          step_os_criada_at: string | null
          step_peca_cadastrada: boolean | null
          step_peca_cadastrada_at: string | null
          tipo_negocio: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          aha_moment_reached?: boolean | null
          aha_moment_reached_at?: string | null
          cidade?: string | null
          created_at?: string | null
          estado?: string | null
          id?: string
          nome_assistencia?: string | null
          objetivo_onboarding?: string | null
          onboarding_completed?: boolean | null
          onboarding_completed_at?: string | null
          onboarding_dismissed?: boolean | null
          onboarding_dismissed_at?: string | null
          onboarding_obrigatorio_completed?: boolean | null
          onboarding_obrigatorio_completed_at?: string | null
          onboarding_skipped?: boolean | null
          onboarding_skipped_at?: string | null
          primeira_os_simulada?: boolean | null
          primeira_os_simulada_at?: string | null
          primeiro_cliente_id?: string | null
          step_cliente_cadastrado?: boolean | null
          step_cliente_cadastrado_at?: string | null
          step_dispositivo_cadastrado?: boolean | null
          step_dispositivo_cadastrado_at?: string | null
          step_lucro_visualizado?: boolean | null
          step_lucro_visualizado_at?: string | null
          step_os_criada?: boolean | null
          step_os_criada_at?: string | null
          step_peca_cadastrada?: boolean | null
          step_peca_cadastrada_at?: string | null
          tipo_negocio?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          aha_moment_reached?: boolean | null
          aha_moment_reached_at?: string | null
          cidade?: string | null
          created_at?: string | null
          estado?: string | null
          id?: string
          nome_assistencia?: string | null
          objetivo_onboarding?: string | null
          onboarding_completed?: boolean | null
          onboarding_completed_at?: string | null
          onboarding_dismissed?: boolean | null
          onboarding_dismissed_at?: string | null
          onboarding_obrigatorio_completed?: boolean | null
          onboarding_obrigatorio_completed_at?: string | null
          onboarding_skipped?: boolean | null
          onboarding_skipped_at?: string | null
          primeira_os_simulada?: boolean | null
          primeira_os_simulada_at?: string | null
          primeiro_cliente_id?: string | null
          step_cliente_cadastrado?: boolean | null
          step_cliente_cadastrado_at?: string | null
          step_dispositivo_cadastrado?: boolean | null
          step_dispositivo_cadastrado_at?: string | null
          step_lucro_visualizado?: boolean | null
          step_lucro_visualizado_at?: string | null
          step_os_criada?: boolean | null
          step_os_criada_at?: string | null
          step_peca_cadastrada?: boolean | null
          step_peca_cadastrada_at?: string | null
          tipo_negocio?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_os_counters: {
        Row: {
          created_at: string
          ultimo_numero: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ultimo_numero?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          ultimo_numero?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vendas: {
        Row: {
          cancelada: boolean | null
          cliente_id: string | null
          cupom_codigo: string | null
          custo_unitario: number | null
          data: string | null
          data_cancelamento: string | null
          data_prevista_recebimento: string | null
          data_recebimento: string | null
          deleted_at: string | null
          dispositivo_id: string | null
          empresa_id: string | null
          estorno_estoque: boolean | null
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"]
          funcionario_id: string | null
          grupo_venda: string | null
          id: string
          imei_dispositivo: string | null
          motivo_cancelamento: string | null
          observacoes: string | null
          parcela_numero: number | null
          peca_id: string | null
          produto_id: string | null
          quantidade: number | null
          recebido: boolean | null
          segunda_forma_pagamento: string | null
          tempo_garantia: number | null
          tipo: Database["public"]["Enums"]["tipo_produto"]
          total: number
          total_parcelas: number | null
          user_id: string | null
          valor_desconto_cupom: number | null
          valor_desconto_manual: number | null
          valor_segunda_forma: number | null
        }
        Insert: {
          cancelada?: boolean | null
          cliente_id?: string | null
          cupom_codigo?: string | null
          custo_unitario?: number | null
          data?: string | null
          data_cancelamento?: string | null
          data_prevista_recebimento?: string | null
          data_recebimento?: string | null
          deleted_at?: string | null
          dispositivo_id?: string | null
          empresa_id?: string | null
          estorno_estoque?: boolean | null
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"]
          funcionario_id?: string | null
          grupo_venda?: string | null
          id?: string
          imei_dispositivo?: string | null
          motivo_cancelamento?: string | null
          observacoes?: string | null
          parcela_numero?: number | null
          peca_id?: string | null
          produto_id?: string | null
          quantidade?: number | null
          recebido?: boolean | null
          segunda_forma_pagamento?: string | null
          tempo_garantia?: number | null
          tipo: Database["public"]["Enums"]["tipo_produto"]
          total: number
          total_parcelas?: number | null
          user_id?: string | null
          valor_desconto_cupom?: number | null
          valor_desconto_manual?: number | null
          valor_segunda_forma?: number | null
        }
        Update: {
          cancelada?: boolean | null
          cliente_id?: string | null
          cupom_codigo?: string | null
          custo_unitario?: number | null
          data?: string | null
          data_cancelamento?: string | null
          data_prevista_recebimento?: string | null
          data_recebimento?: string | null
          deleted_at?: string | null
          dispositivo_id?: string | null
          empresa_id?: string | null
          estorno_estoque?: boolean | null
          forma_pagamento?: Database["public"]["Enums"]["forma_pagamento"]
          funcionario_id?: string | null
          grupo_venda?: string | null
          id?: string
          imei_dispositivo?: string | null
          motivo_cancelamento?: string | null
          observacoes?: string | null
          parcela_numero?: number | null
          peca_id?: string | null
          produto_id?: string | null
          quantidade?: number | null
          recebido?: boolean | null
          segunda_forma_pagamento?: string | null
          tempo_garantia?: number | null
          tipo?: Database["public"]["Enums"]["tipo_produto"]
          total?: number
          total_parcelas?: number | null
          user_id?: string | null
          valor_desconto_cupom?: number | null
          valor_desconto_manual?: number | null
          valor_segunda_forma?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vendas_cliente_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_cliente_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes_ativos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_dispositivo_id_fkey"
            columns: ["dispositivo_id"]
            isOneToOne: false
            referencedRelation: "dispositivos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_dispositivo_id_fkey"
            columns: ["dispositivo_id"]
            isOneToOne: false
            referencedRelation: "dispositivos_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_peca_id_fkey"
            columns: ["peca_id"]
            isOneToOne: false
            referencedRelation: "pecas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_peca_id_fkey"
            columns: ["peca_id"]
            isOneToOne: false
            referencedRelation: "pecas_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos_ativos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos_catalogo"
            referencedColumns: ["id"]
          },
        ]
      }
      vendas_avulsas: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          descricao: string
          forma_pagamento: string
          id: string
          observacao: string | null
          updated_at: string | null
          user_id: string
          valor: number
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          descricao: string
          forma_pagamento: string
          id?: string
          observacao?: string | null
          updated_at?: string | null
          user_id: string
          valor: number
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          descricao?: string
          forma_pagamento?: string
          id?: string
          observacao?: string | null
          updated_at?: string | null
          user_id?: string
          valor?: number
        }
        Relationships: []
      }
      vendas_cupons: {
        Row: {
          codigo_cupom: string
          created_at: string | null
          cupom_id: string
          id: string
          valor_desconto: number
          venda_id: string
        }
        Insert: {
          codigo_cupom: string
          created_at?: string | null
          cupom_id: string
          id?: string
          valor_desconto: number
          venda_id: string
        }
        Update: {
          codigo_cupom?: string
          created_at?: string | null
          cupom_id?: string
          id?: string
          valor_desconto?: number
          venda_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendas_cupons_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_cupons_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas_ativas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      assinantes_ativos: {
        Row: {
          data_fim: string | null
          data_inicio: string | null
          payment_method: string | null
          payment_provider: string | null
          plano_tipo: Database["public"]["Enums"]["plano_tipo"] | null
          status: Database["public"]["Enums"]["status_assinatura"] | null
          user_id: string | null
        }
        Insert: {
          data_fim?: string | null
          data_inicio?: string | null
          payment_method?: string | null
          payment_provider?: string | null
          plano_tipo?: Database["public"]["Enums"]["plano_tipo"] | null
          status?: Database["public"]["Enums"]["status_assinatura"] | null
          user_id?: string | null
        }
        Update: {
          data_fim?: string | null
          data_inicio?: string | null
          payment_method?: string | null
          payment_provider?: string | null
          plano_tipo?: Database["public"]["Enums"]["plano_tipo"] | null
          status?: Database["public"]["Enums"]["status_assinatura"] | null
          user_id?: string | null
        }
        Relationships: []
      }
      avisos_sistema_publico: {
        Row: {
          ativo: boolean | null
          cor_botao: string | null
          cor_fundo: string | null
          cor_icone: string | null
          cor_texto: string | null
          created_at: string | null
          data_fim: string | null
          data_inicio: string | null
          icone: string | null
          id: string | null
          imagem_posicao: string | null
          imagem_url: string | null
          link_texto: string | null
          link_url: string | null
          mensagem: string | null
          prioridade: number | null
          publico_alvo: string[] | null
          tipo: string | null
          titulo: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          cor_botao?: string | null
          cor_fundo?: string | null
          cor_icone?: string | null
          cor_texto?: string | null
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          icone?: string | null
          id?: string | null
          imagem_posicao?: string | null
          imagem_url?: string | null
          link_texto?: string | null
          link_url?: string | null
          mensagem?: string | null
          prioridade?: number | null
          publico_alvo?: string[] | null
          tipo?: string | null
          titulo?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          cor_botao?: string | null
          cor_fundo?: string | null
          cor_icone?: string | null
          cor_texto?: string | null
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          icone?: string | null
          id?: string | null
          imagem_posicao?: string | null
          imagem_url?: string | null
          link_texto?: string | null
          link_url?: string | null
          mensagem?: string | null
          prioridade?: number | null
          publico_alvo?: string[] | null
          tipo?: string | null
          titulo?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      clientes_ativos: {
        Row: {
          cnpj: string | null
          cpf: string | null
          created_at: string | null
          data_nascimento: string | null
          deleted_at: string | null
          endereco: string | null
          id: string | null
          nome: string | null
          telefone: string | null
          user_id: string | null
        }
        Insert: {
          cnpj?: string | null
          cpf?: string | null
          created_at?: string | null
          data_nascimento?: string | null
          deleted_at?: string | null
          endereco?: string | null
          id?: string | null
          nome?: string | null
          telefone?: string | null
          user_id?: string | null
        }
        Update: {
          cnpj?: string | null
          cpf?: string | null
          created_at?: string | null
          data_nascimento?: string | null
          deleted_at?: string | null
          endereco?: string | null
          id?: string | null
          nome?: string | null
          telefone?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      configuracoes_loja_publico: {
        Row: {
          catalogo_ativo: boolean | null
          catalogo_config: Json | null
          catalogo_slug: string | null
          cidade: string | null
          estado: string | null
          facebook: string | null
          id: string | null
          instagram: string | null
          logo_url: string | null
          nome_loja: string | null
          site: string | null
          whatsapp: string | null
        }
        Insert: {
          catalogo_ativo?: boolean | null
          catalogo_config?: Json | null
          catalogo_slug?: string | null
          cidade?: string | null
          estado?: string | null
          facebook?: string | null
          id?: string | null
          instagram?: string | null
          logo_url?: string | null
          nome_loja?: string | null
          site?: string | null
          whatsapp?: string | null
        }
        Update: {
          catalogo_ativo?: boolean | null
          catalogo_config?: Json | null
          catalogo_slug?: string | null
          cidade?: string | null
          estado?: string | null
          facebook?: string | null
          id?: string | null
          instagram?: string | null
          logo_url?: string | null
          nome_loja?: string | null
          site?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      dispositivos_catalogo: {
        Row: {
          capacidade_gb: number | null
          catalogo_slug: string | null
          condicao: string | null
          cor: string | null
          created_at: string | null
          foto_url: string | null
          fotos: Json | null
          garantia: boolean | null
          id: string | null
          marca: string | null
          modelo: string | null
          preco: number | null
          preco_promocional: number | null
          quantidade: number | null
          saude_bateria: number | null
          subtipo_computador: string | null
          tempo_garantia: number | null
          tipo: string | null
          vendido: boolean | null
        }
        Relationships: []
      }
      landing_page_publico: {
        Row: {
          catalogo_config: Json | null
          catalogo_slug: string | null
          cidade: string | null
          endereco: string | null
          estado: string | null
          landing_page_ativa: boolean | null
          landing_page_config: Json | null
          logo_url: string | null
          nome_loja: string | null
          whatsapp: string | null
        }
        Insert: {
          catalogo_config?: Json | null
          catalogo_slug?: string | null
          cidade?: string | null
          endereco?: string | null
          estado?: string | null
          landing_page_ativa?: boolean | null
          landing_page_config?: Json | null
          logo_url?: string | null
          nome_loja?: string | null
          whatsapp?: string | null
        }
        Update: {
          catalogo_config?: Json | null
          catalogo_slug?: string | null
          cidade?: string | null
          endereco?: string | null
          estado?: string | null
          landing_page_ativa?: boolean | null
          landing_page_config?: Json | null
          logo_url?: string | null
          nome_loja?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      novidades_publico: {
        Row: {
          conteudo: Json | null
          created_at: string | null
          data_fim: string | null
          data_inicio: string | null
          descricao: string | null
          id: string | null
          layout_config: Json | null
          prioridade: number | null
          publico_alvo: string[] | null
          thumbnail_url: string | null
          titulo: string | null
        }
        Insert: {
          conteudo?: Json | null
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          id?: string | null
          layout_config?: Json | null
          prioridade?: number | null
          publico_alvo?: string[] | null
          thumbnail_url?: string | null
          titulo?: string | null
        }
        Update: {
          conteudo?: Json | null
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          id?: string | null
          layout_config?: Json | null
          prioridade?: number | null
          publico_alvo?: string[] | null
          thumbnail_url?: string | null
          titulo?: string | null
        }
        Relationships: []
      }
      onboarding_config_public: {
        Row: {
          ativo: boolean | null
          config_passos: Json | null
          mostrar_para_usuarios_ativos: boolean | null
          publico_alvo: string[] | null
          textos_personalizados: Json | null
        }
        Relationships: []
      }
      ordens_servico_ativas: {
        Row: {
          avarias: Json | null
          cliente_id: string | null
          comissao_calculada_snapshot: number | null
          comissao_tipo_snapshot: string | null
          comissao_valor_snapshot: number | null
          created_at: string | null
          data_saida: string | null
          defeito_relatado: string | null
          deleted_at: string | null
          deleted_by: string | null
          dispositivo_cor: string | null
          dispositivo_imei: string | null
          dispositivo_marca: string | null
          dispositivo_modelo: string | null
          dispositivo_numero_serie: string | null
          dispositivo_tipo: string | null
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"] | null
          funcionario_id: string | null
          id: string | null
          is_teste: boolean | null
          numero_os: string | null
          senha_desbloqueio: string | null
          servico_data_pagamento: string | null
          servico_fornecedor_id: string | null
          servico_id: string | null
          servico_status_pagamento: string | null
          status: string | null
          tempo_garantia: number | null
          tipo_servico_id: string | null
          tipo_servico_nome_snapshot: string | null
          total: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          avarias?: Json | null
          cliente_id?: string | null
          comissao_calculada_snapshot?: number | null
          comissao_tipo_snapshot?: string | null
          comissao_valor_snapshot?: number | null
          created_at?: string | null
          data_saida?: string | null
          defeito_relatado?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          dispositivo_cor?: string | null
          dispositivo_imei?: string | null
          dispositivo_marca?: string | null
          dispositivo_modelo?: string | null
          dispositivo_numero_serie?: string | null
          dispositivo_tipo?: string | null
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          funcionario_id?: string | null
          id?: string | null
          is_teste?: boolean | null
          numero_os?: string | null
          senha_desbloqueio?: string | null
          servico_data_pagamento?: string | null
          servico_fornecedor_id?: string | null
          servico_id?: string | null
          servico_status_pagamento?: string | null
          status?: string | null
          tempo_garantia?: number | null
          tipo_servico_id?: string | null
          tipo_servico_nome_snapshot?: string | null
          total?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          avarias?: Json | null
          cliente_id?: string | null
          comissao_calculada_snapshot?: number | null
          comissao_tipo_snapshot?: string | null
          comissao_valor_snapshot?: number | null
          created_at?: string | null
          data_saida?: string | null
          defeito_relatado?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          dispositivo_cor?: string | null
          dispositivo_imei?: string | null
          dispositivo_marca?: string | null
          dispositivo_modelo?: string | null
          dispositivo_numero_serie?: string | null
          dispositivo_tipo?: string | null
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          funcionario_id?: string | null
          id?: string | null
          is_teste?: boolean | null
          numero_os?: string | null
          senha_desbloqueio?: string | null
          servico_data_pagamento?: string | null
          servico_fornecedor_id?: string | null
          servico_id?: string | null
          servico_status_pagamento?: string | null
          status?: string | null
          tempo_garantia?: number | null
          tipo_servico_id?: string | null
          tipo_servico_nome_snapshot?: string | null
          total?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ordens_servico_cliente_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_servico_cliente_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes_ativos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_servico_servico_fornecedor_id_fkey"
            columns: ["servico_fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_servico_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "servicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_servico_tipo_servico_id_fkey"
            columns: ["tipo_servico_id"]
            isOneToOne: false
            referencedRelation: "tipos_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      pecas_catalogo: {
        Row: {
          catalogo_slug: string | null
          categoria_cor: string | null
          categoria_id: string | null
          categoria_nome: string | null
          codigo_barras: string | null
          created_at: string | null
          fotos: Json | null
          id: string | null
          nome: string | null
          preco: number | null
          quantidade: number | null
          tipo_item: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pecas_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos_ativos: {
        Row: {
          categoria_id: string | null
          codigo_barras: string | null
          created_at: string | null
          custo: number | null
          deleted_at: string | null
          fornecedor_id: string | null
          fotos: Json | null
          id: string | null
          lucro: number | null
          nome: string | null
          preco: number | null
          quantidade: number | null
          sku: string | null
          user_id: string | null
        }
        Insert: {
          categoria_id?: string | null
          codigo_barras?: string | null
          created_at?: string | null
          custo?: number | null
          deleted_at?: string | null
          fornecedor_id?: string | null
          fotos?: Json | null
          id?: string | null
          lucro?: number | null
          nome?: string | null
          preco?: number | null
          quantidade?: number | null
          sku?: string | null
          user_id?: string | null
        }
        Update: {
          categoria_id?: string | null
          codigo_barras?: string | null
          created_at?: string | null
          custo?: number | null
          deleted_at?: string | null
          fornecedor_id?: string | null
          fotos?: Json | null
          id?: string | null
          lucro?: number | null
          nome?: string | null
          preco?: number | null
          quantidade?: number | null
          sku?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "produtos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produtos_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos_catalogo: {
        Row: {
          catalogo_slug: string | null
          categoria_cor: string | null
          categoria_id: string | null
          categoria_nome: string | null
          codigo_barras: string | null
          created_at: string | null
          fotos: Json | null
          id: string | null
          nome: string | null
          preco: number | null
          quantidade: number | null
          sku: string | null
          tipo_item: string | null
        }
        Relationships: [
          {
            foreignKeyName: "produtos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      vendas_ativas: {
        Row: {
          cancelada: boolean | null
          cliente_id: string | null
          cupom_codigo: string | null
          custo_unitario: number | null
          data: string | null
          data_cancelamento: string | null
          data_prevista_recebimento: string | null
          data_recebimento: string | null
          deleted_at: string | null
          dispositivo_id: string | null
          estorno_estoque: boolean | null
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"] | null
          funcionario_id: string | null
          grupo_venda: string | null
          id: string | null
          motivo_cancelamento: string | null
          observacoes: string | null
          parcela_numero: number | null
          peca_id: string | null
          produto_id: string | null
          quantidade: number | null
          recebido: boolean | null
          tipo: Database["public"]["Enums"]["tipo_produto"] | null
          total: number | null
          total_parcelas: number | null
          user_id: string | null
          valor_desconto_cupom: number | null
          valor_desconto_manual: number | null
        }
        Insert: {
          cancelada?: boolean | null
          cliente_id?: string | null
          cupom_codigo?: string | null
          custo_unitario?: number | null
          data?: string | null
          data_cancelamento?: string | null
          data_prevista_recebimento?: string | null
          data_recebimento?: string | null
          deleted_at?: string | null
          dispositivo_id?: string | null
          estorno_estoque?: boolean | null
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          funcionario_id?: string | null
          grupo_venda?: string | null
          id?: string | null
          motivo_cancelamento?: string | null
          observacoes?: string | null
          parcela_numero?: number | null
          peca_id?: string | null
          produto_id?: string | null
          quantidade?: number | null
          recebido?: boolean | null
          tipo?: Database["public"]["Enums"]["tipo_produto"] | null
          total?: number | null
          total_parcelas?: number | null
          user_id?: string | null
          valor_desconto_cupom?: number | null
          valor_desconto_manual?: number | null
        }
        Update: {
          cancelada?: boolean | null
          cliente_id?: string | null
          cupom_codigo?: string | null
          custo_unitario?: number | null
          data?: string | null
          data_cancelamento?: string | null
          data_prevista_recebimento?: string | null
          data_recebimento?: string | null
          deleted_at?: string | null
          dispositivo_id?: string | null
          estorno_estoque?: boolean | null
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          funcionario_id?: string | null
          grupo_venda?: string | null
          id?: string | null
          motivo_cancelamento?: string | null
          observacoes?: string | null
          parcela_numero?: number | null
          peca_id?: string | null
          produto_id?: string | null
          quantidade?: number | null
          recebido?: boolean | null
          tipo?: Database["public"]["Enums"]["tipo_produto"] | null
          total?: number | null
          total_parcelas?: number | null
          user_id?: string | null
          valor_desconto_cupom?: number | null
          valor_desconto_manual?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vendas_cliente_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_cliente_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes_ativos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_dispositivo_id_fkey"
            columns: ["dispositivo_id"]
            isOneToOne: false
            referencedRelation: "dispositivos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_dispositivo_id_fkey"
            columns: ["dispositivo_id"]
            isOneToOne: false
            referencedRelation: "dispositivos_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_peca_id_fkey"
            columns: ["peca_id"]
            isOneToOne: false
            referencedRelation: "pecas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_peca_id_fkey"
            columns: ["peca_id"]
            isOneToOne: false
            referencedRelation: "pecas_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos_ativos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos_catalogo"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _export_auth_users_temp: { Args: never; Returns: Json }
      aplicar_automacao_crm: { Args: { p_user_id: string }; Returns: undefined }
      aplicar_automacao_crm_todos: { Args: never; Returns: number }
      can_insert_client: { Args: { _user_id: string }; Returns: boolean }
      can_insert_device: { Args: { _user_id: string }; Returns: boolean }
      can_insert_order: { Args: { _user_id: string }; Returns: boolean }
      count_user_clients: { Args: { _user_id: string }; Returns: number }
      count_user_devices: { Args: { _user_id: string }; Returns: number }
      count_user_orders: { Args: { _user_id: string }; Returns: number }
      determinar_condicao_usuario: {
        Args: { p_user_id: string }
        Returns: string
      }
      generate_os_number:
        | { Args: never; Returns: string }
        | { Args: { p_user_id: string }; Returns: string }
      generate_os_number_safe: { Args: { p_user_id: string }; Returns: string }
      gerar_catalogo_slug: { Args: { nome: string }; Returns: string }
      get_loja_owner_id: { Args: never; Returns: string }
      get_next_os_number:
        | { Args: never; Returns: number }
        | { Args: { p_user_id?: string }; Returns: number }
      get_user_by_id: {
        Args: { p_user_id: string }
        Returns: {
          celular: string
          crm_stage: string
          nome: string
          plano_tipo: string
          user_id: string
        }[]
      }
      get_user_client_limit: { Args: { _user_id: string }; Returns: number }
      get_user_device_limit: { Args: { _user_id: string }; Returns: number }
      get_user_order_limit: { Args: { _user_id: string }; Returns: number }
      get_users_by_crm_stage: {
        Args: { p_crm_stage: string }
        Returns: {
          celular: string
          created_at: string
          crm_stage: string
          nome: string
          plano_tipo: string
          user_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      incrementar_uso_cupom: { Args: { cupom_id: string }; Returns: undefined }
      is_colleague_of: {
        Args: { target_loja_user_id: string }
        Returns: boolean
      }
      is_funcionario_of: { Args: { owner_user_id: string }; Returns: boolean }
      mark_as_client: { Args: { p_user_id: string }; Returns: boolean }
      registrar_pontos_fidelidade: {
        Args: {
          p_cliente_id: string
          p_referencia_id: string
          p_tipo: string
          p_user_id: string
          p_valor: number
        }
        Returns: undefined
      }
      set_os_sequence_start:
        | { Args: { novo_inicio: number }; Returns: undefined }
        | {
            Args: { novo_inicio: number; p_user_id: string }
            Returns: undefined
          }
      track_user_event: {
        Args: { _event_data?: Json; _event_type: string }
        Returns: string
      }
      update_crm_stage: {
        Args: { p_crm_stage: string; p_user_id: string }
        Returns: boolean
      }
      update_onboarding_step: {
        Args: { _step: string; _user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "tecnico" | "vendedor"
      forma_pagamento:
        | "dinheiro"
        | "pix"
        | "debito"
        | "credito"
        | "credito_parcelado"
        | "a_receber"
        | "a_prazo"
      plano_tipo:
        | "demonstracao"
        | "trial"
        | "basico_mensal"
        | "intermediario_mensal"
        | "profissional_mensal"
        | "basico_anual"
        | "intermediario_anual"
        | "profissional_anual"
        | "admin"
        | "free"
        | "profissional_ultra_mensal"
        | "profissional_ultra_anual"
      status_assinatura:
        | "active"
        | "canceled"
        | "incomplete"
        | "incomplete_expired"
        | "past_due"
        | "trialing"
        | "unpaid"
      status_conta: "pendente" | "pago" | "recebido"
      status_conversa_suporte:
        | "aberta"
        | "em_atendimento"
        | "resolvida"
        | "fechada"
      status_cupom: "ativo" | "inativo" | "expirado"
      status_feedback: "pendente" | "em_analise" | "resolvido" | "arquivado"
      status_os:
        | "pendente"
        | "em_andamento"
        | "concluida"
        | "cancelada"
        | "aguardando_aprovacao"
        | "finalizado"
        | "entregue"
        | "aguardando_retirada"
        | "garantia"
        | "estornado"
      tipo_conta: "pagar" | "receber"
      tipo_desconto: "percentual" | "valor_fixo"
      tipo_feedback: "sugestao" | "reclamacao" | "melhoria"
      tipo_produto: "produto" | "dispositivo"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "tecnico", "vendedor"],
      forma_pagamento: [
        "dinheiro",
        "pix",
        "debito",
        "credito",
        "credito_parcelado",
        "a_receber",
        "a_prazo",
      ],
      plano_tipo: [
        "demonstracao",
        "trial",
        "basico_mensal",
        "intermediario_mensal",
        "profissional_mensal",
        "basico_anual",
        "intermediario_anual",
        "profissional_anual",
        "admin",
        "free",
        "profissional_ultra_mensal",
        "profissional_ultra_anual",
      ],
      status_assinatura: [
        "active",
        "canceled",
        "incomplete",
        "incomplete_expired",
        "past_due",
        "trialing",
        "unpaid",
      ],
      status_conta: ["pendente", "pago", "recebido"],
      status_conversa_suporte: [
        "aberta",
        "em_atendimento",
        "resolvida",
        "fechada",
      ],
      status_cupom: ["ativo", "inativo", "expirado"],
      status_feedback: ["pendente", "em_analise", "resolvido", "arquivado"],
      status_os: [
        "pendente",
        "em_andamento",
        "concluida",
        "cancelada",
        "aguardando_aprovacao",
        "finalizado",
        "entregue",
        "aguardando_retirada",
        "garantia",
        "estornado",
      ],
      tipo_conta: ["pagar", "receber"],
      tipo_desconto: ["percentual", "valor_fixo"],
      tipo_feedback: ["sugestao", "reclamacao", "melhoria"],
      tipo_produto: ["produto", "dispositivo"],
    },
  },
} as const
posthog 2026/06/27 11:06:26 WARN: sending request - Post "https://eu.i.posthog.com/batch/": context deadline exceeded (Client.Timeout exceeded while awaiting headers)
A new version of Supabase CLI is available: v2.108.0 (currently installed v2.90.0)
We recommend updating regularly for new features and bug fixes: https://supabase.com/docs/guides/cli/getting-started#updating-the-supabase-cli
