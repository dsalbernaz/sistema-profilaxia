// =====================================================
// CONFIGURAÇÃO SUPABASE - ORTHODONTIC
// =====================================================

const SUPABASE_CONFIG = {
    url: 'https://fqexgwpitmopeapntnqb.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxZXhnd3BpdG1vcGVhcG50bnFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIwNTEyMDAsImV4cCI6MjA3NzYyNzIwMH0.AOYI4-DmcA1jgW3O9wvaJvvUOuRCazM2ToyGESD7jVw'
};

// Inicializar cliente Supabase
const supabaseClient = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);

// =====================================================
// CLASSE DE SERVIÇOS SUPABASE
// =====================================================

class SupabaseService {
    constructor() {
        this.client = supabaseClient;
    }

    // ========== DENTISTAS ==========
    
    async getDentistas() {
        const { data, error } = await this.client
            .from('dentistas')
            .select('*')
            .order('nome');
        
        if (error) {
            console.error('Erro ao buscar dentistas:', error);
            return [];
        }
        return data || [];
    }

    async addDentista(dentista) {
        const { data, error } = await this.client
            .from('dentistas')
            .insert([{
                nome: dentista.nome,
                tipo: dentista.tipo || 'ortodontista'
            }])
            .select()
            .single();
        
        if (error) {
            console.error('Erro ao adicionar dentista:', error);
            throw error;
        }
        return data;
    }

    async updateDentista(id, dados) {
        const { data, error } = await this.client
            .from('dentistas')
            .update(dados)
            .eq('id', id)
            .select()
            .single();
        
        if (error) {
            console.error('Erro ao atualizar dentista:', error);
            throw error;
        }
        return data;
    }

    async deleteDentista(id) {
        const { error } = await this.client
            .from('dentistas')
            .delete()
            .eq('id', id);
        
        if (error) {
            console.error('Erro ao deletar dentista:', error);
            throw error;
        }
        return true;
    }

    // ========== USUÁRIOS ==========
    
    async getUsuarios() {
        const { data, error } = await this.client
            .from('usuarios')
            .select('*')
            .order('nome');
        
        if (error) {
            console.error('Erro ao buscar usuários:', error);
            return [];
        }
        return data || [];
    }

    async login(username, password) {
        const { data, error } = await this.client
            .from('usuarios')
            .select('*')
            .eq('username', username)
            .eq('password', password)
            .single();
        
        if (error || !data) {
            return null;
        }
        return data;
    }

    async addUsuario(usuario) {
        const { data, error } = await this.client
            .from('usuarios')
            .insert([usuario])
            .select()
            .single();
        
        if (error) {
            console.error('Erro ao adicionar usuário:', error);
            throw error;
        }
        return data;
    }

    async updateUsuario(id, dados) {
        const { data, error } = await this.client
            .from('usuarios')
            .update(dados)
            .eq('id', id)
            .select()
            .single();
        
        if (error) {
            console.error('Erro ao atualizar usuário:', error);
            throw error;
        }
        return data;
    }

    async deleteUsuario(id) {
        const { error } = await this.client
            .from('usuarios')
            .delete()
            .eq('id', id);
        
        if (error) {
            console.error('Erro ao deletar usuário:', error);
            throw error;
        }
        return true;
    }

    // ========== ENCAMINHAMENTOS ==========
    
    async getEncaminhamentos() {
        const { data, error } = await this.client
            .from('encaminhamentos')
            .select('*')
            .order('data_registro', { ascending: false });
        
        if (error) {
            console.error('Erro ao buscar encaminhamentos:', error);
            return [];
        }
        return this.normalizarEncaminhamentos(data || []);
    }

    async getEncaminhamentosCompletos() {
        const { data, error } = await this.client
            .from('vw_encaminhamentos_completos')
            .select('*')
            .order('data_registro', { ascending: false });
        
        if (error) {
            console.error('Erro ao buscar encaminhamentos completos:', error);
            return [];
        }
        return this.normalizarEncaminhamentos(data || []);
    }

    async addEncaminhamento(encaminhamento) {
        const dadosSupabase = this.converterParaSupabase(encaminhamento);
        
        const { data, error } = await this.client
            .from('encaminhamentos')
            .insert([dadosSupabase])
            .select()
            .single();
        
        if (error) {
            console.error('Erro ao adicionar encaminhamento:', error);
            throw error;
        }
        return this.normalizarEncaminhamento(data);
    }

    async updateEncaminhamento(id, dados) {
        const dadosSupabase = this.converterParaSupabase(dados);
        
        const { data, error } = await this.client
            .from('encaminhamentos')
            .update(dadosSupabase)
            .eq('id', id)
            .select()
            .single();
        
        if (error) {
            console.error('Erro ao atualizar encaminhamento:', error);
            throw error;
        }
        return this.normalizarEncaminhamento(data);
    }

    async deleteEncaminhamento(id) {
        const { error } = await this.client
            .from('encaminhamentos')
            .delete()
            .eq('id', id);
        
        if (error) {
            console.error('Erro ao deletar encaminhamento:', error);
            throw error;
        }
        return true;
    }

    // ========== HELPERS ==========

    converterParaSupabase(obj) {
        // Converte camelCase para snake_case
        const mapeamento = {
            'codigoPaciente': 'codigo_paciente',
            'nomePaciente': 'nome_paciente',
            'dentistaId': 'dentista_id',
            'recepcionistaId': 'recepcionista_id',
            'pagoImediatamente': 'pago_imediatamente',
            'pagouNaHora': 'pagou_na_hora',
            'dataRegistro': 'data_registro',
            'dataPagamento': 'data_pagamento',
            'mesPagamento': 'mes_pagamento'
        };

        const resultado = {};
        for (let [key, value] of Object.entries(obj)) {
            const novaKey = mapeamento[key] || key;
            resultado[novaKey] = value;
        }
        return resultado;
    }

    normalizarEncaminhamento(obj) {
        // Converte snake_case para camelCase
        if (!obj) return null;
        
        return {
            id: obj.id,
            codigoPaciente: obj.codigo_paciente,
            nomePaciente: obj.nome_paciente,
            dentistaId: obj.dentista_id,
            recepcionistaId: obj.recepcionista_id,
            status: obj.status,
            pago: obj.pago,
            pagoImediatamente: obj.pago_imediatamente,
            pagouNaHora: obj.pagou_na_hora,
            observacoes: obj.observacoes,
            dataRegistro: obj.data_registro,
            dataPagamento: obj.data_pagamento,
            mesPagamento: obj.mes_pagamento,
            // Dados extras da view
            dentistaNome: obj.dentista_nome,
            dentistaTipo: obj.dentista_tipo,
            recepcionistaNome: obj.recepcionista_nome
        };
    }

    normalizarEncaminhamentos(array) {
        return array.map(obj => this.normalizarEncaminhamento(obj));
    }
}

// Instância global do serviço
const supabaseService = new SupabaseService();
