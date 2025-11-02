// =====================================================
// SISTEMA PROFILAXIA ORTHODONTIC V4.0 - COM SUPABASE
// =====================================================

class ProfilaxiaApp {
    constructor() {
        this.currentUser = null;
        this.currentMonth = new Date().getMonth();
        this.currentYear = new Date().getFullYear();
        this.data = { dentistas: [], usuarios: [], encaminhamentos: [] };
        this.charts = {};
        this.mesAtualDashboard = 'all';
        this.db = supabaseService; // Serviço Supabase
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.checkAuth();
    }

    // =====================================================
    // GERENCIAMENTO DE DADOS - SUPABASE
    // =====================================================

    async loadAllData() {
        try {
            // Carregar dados em paralelo
            const [dentistas, usuarios, encaminhamentos] = await Promise.all([
                this.db.getDentistas(),
                this.db.getUsuarios(),
                this.db.getEncaminhamentos()
            ]);

            this.data = {
                dentistas: dentistas || [],
                usuarios: usuarios || [],
                encaminhamentos: encaminhamentos || []
            };

            console.log('✅ Dados carregados do Supabase:', this.data);
            return this.data;
        } catch (error) {
            console.error('❌ Erro ao carregar dados:', error);
            alert('Erro ao carregar dados do servidor. Verifique sua conexão.');
            return this.data;
        }
    }

    // =====================================================
    // AUTENTICAÇÃO
    // =====================================================

    setupEventListeners() {
        // Login
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin();
            });
        }

        // Logout
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.handleLogout());
        }

        // Navegação
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const page = e.target.dataset.page;
                this.showPage(page);
            });
        });

        // Refresh Dashboard
        const refreshBtn = document.getElementById('refreshDashboard');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.updateDashboard());
        }

        // Cadastro
        this.setupCadastroListeners();
    }

    async checkAuth() {
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
            this.currentUser = JSON.parse(savedUser);
            await this.showMainApp();
        } else {
            this.showLoginScreen();
        }
    }

    async handleLogin() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        try {
            const user = await this.db.login(username, password);
            
            if (user) {
                this.currentUser = user;
                localStorage.setItem('currentUser', JSON.stringify(user));
                await this.showMainApp();
            } else {
                alert('Usuário ou senha incorretos!');
            }
        } catch (error) {
            console.error('Erro no login:', error);
            alert('Erro ao fazer login. Tente novamente.');
        }
    }

    handleLogout() {
        this.currentUser = null;
        localStorage.removeItem('currentUser');
        this.showLoginScreen();
    }

    showLoginScreen() {
        document.getElementById('loginScreen').classList.add('active');
        document.getElementById('mainApp').classList.remove('active');
    }

    async showMainApp() {
        document.getElementById('loginScreen').classList.remove('active');
        document.getElementById('mainApp').classList.add('active');
        
        document.getElementById('userNameDisplay').textContent = this.currentUser.nome;
        
        // Mostrar gestão apenas para gestores
        const btnGestao = document.querySelector('.nav-btn-gestao');
        if (btnGestao) {
            btnGestao.style.display = this.currentUser.perfil === 'gestor' ? 'block' : 'none';
        }

        // Carregar dados
        await this.loadAllData();
        
        // Atualizar interface
        this.updateDashboard();
        this.populateSelects();
    }

    // =====================================================
    // NAVEGAÇÃO ENTRE PÁGINAS - CORREÇÃO DO BUG
    // =====================================================

    async showPage(page) {
        // Atualizar botões de navegação
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.page === page) {
                btn.classList.add('active');
            }
        });

        // Atualizar páginas
        document.querySelectorAll('.page').forEach(p => {
            p.classList.remove('active');
        });

        const pageElement = document.getElementById(`${page}Page`);
        if (pageElement) {
            pageElement.classList.add('active');

            // ✅ CORREÇÃO DO BUG: Carregar dados ao alternar páginas
            switch(page) {
                case 'dashboard':
                    await this.updateDashboard();
                    break;
                case 'naoAgendados':
                    await this.loadNaoAgendados();
                    break;
                case 'agendados':
                    // ✅ CORREÇÃO PRINCIPAL: Adicionar carregamento dos agendados
                    await this.loadAgendados();
                    break;
                case 'pagamentos':
                    await this.loadPagamentos();
                    break;
                case 'gestao':
                    await this.loadGestao();
                    break;
            }
        }
    }

    // =====================================================
    // CADASTRO DE ENCAMINHAMENTOS
    // =====================================================

    setupCadastroListeners() {
        // Botões de status
        document.querySelectorAll('.btn-status').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                document.querySelectorAll('.btn-status').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                document.getElementById('statusEncaminhamento').value = btn.dataset.status;
                
                // Mostrar opção de pagamento imediato apenas para agendadas
                const grp = document.getElementById('groupPagouNaHora');
                if (grp) {
                    grp.style.display = (btn.dataset.status === 'agendada') ? 'block' : 'none';
                }
            });
        });

        // Form de cadastro
        const form = document.getElementById('cadastroForm');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.salvarEncaminhamento();
            });
        }
    }

    async salvarEncaminhamento() {
        const codigo = document.getElementById('codigoPaciente').value.trim();
        const nome = document.getElementById('nomePaciente').value.trim();
        const dentistaId = parseInt(document.getElementById('dentista').value);
        const status = document.getElementById('statusEncaminhamento').value || 'nao_agendada';
        const obs = document.getElementById('observacoes').value.trim();
        const pagoImediatamente = document.getElementById('pagouNaHora')?.checked || false;

        if (!codigo || !nome || !dentistaId) {
            alert('Preencha os campos obrigatórios!');
            return;
        }

        const encaminhamento = {
            codigoPaciente: codigo,
            nomePaciente: nome,
            dentistaId: dentistaId,
            recepcionistaId: this.currentUser.id,
            status: status,
            pago: pagoImediatamente,
            pagoImediatamente: pagoImediatamente,
            pagouNaHora: pagoImediatamente,
            observacoes: obs,
            dataRegistro: new Date().toISOString(),
            dataPagamento: pagoImediatamente ? new Date().toISOString() : null,
            mesPagamento: pagoImediatamente ? new Date().toISOString().substring(0, 7) : null
        };

        try {
            const novoEncaminhamento = await this.db.addEncaminhamento(encaminhamento);
            this.data.encaminhamentos.unshift(novoEncaminhamento);
            
            alert('Encaminhamento registrado com sucesso!');
            document.getElementById('cadastroForm').reset();
            
            // Atualizar dashboard
            await this.updateDashboard();
        } catch (error) {
            console.error('Erro ao salvar:', error);
            alert('Erro ao salvar encaminhamento!');
        }
    }

    // =====================================================
    // NÃO AGENDADOS
    // =====================================================

    async loadNaoAgendados() {
        // Recarregar dados do servidor
        await this.loadAllData();
        
        const tbody = document.querySelector('#tableNaoAgendados tbody');
        if (!tbody) return;

        let naoAgendados = this.data.encaminhamentos.filter(e => e.status === 'nao_agendada');

        // Filtro de mês (se aplicável)
        if (this.currentMonth !== undefined && this.currentMonth !== null) {
            naoAgendados = naoAgendados.filter(e => {
                const data = new Date(e.dataRegistro);
                return data.getMonth() === this.currentMonth && data.getFullYear() === this.currentYear;
            });
        }

        tbody.innerHTML = naoAgendados.map(e => {
            const dentista = this.data.dentistas.find(d => d.id === e.dentistaId);
            const dataRegistro = new Date(e.dataRegistro);
            const hoje = new Date();
            const diasPendente = Math.floor((hoje - dataRegistro) / (1000 * 60 * 60 * 24));

            return `
                <tr>
                    <td>${e.codigoPaciente}</td>
                    <td>${e.nomePaciente}</td>
                    <td>${dentista ? dentista.nome : '-'}</td>
                    <td>${dataRegistro.toLocaleDateString('pt-BR')}</td>
                    <td>${diasPendente} dias</td>
                    <td class="acoes">
                        <button class="btn btn-success btn-sm" onclick="app.marcarComoAgendado(${e.id})">
                            ✓ Agendar
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="app.excluirEncaminhamento(${e.id})">
                            🗑️ Excluir
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    async marcarComoAgendado(id) {
        try {
            const encaminhamento = this.data.encaminhamentos.find(e => e.id === id);
            if (!encaminhamento) {
                alert('Encaminhamento não encontrado!');
                return;
            }

            // Atualizar no Supabase
            await this.db.updateEncaminhamento(id, { status: 'agendada' });
            
            // Atualizar localmente
            encaminhamento.status = 'agendada';
            
            alert('✓ Paciente marcado como agendado!');
            
            // Recarregar listas
            await this.loadNaoAgendados();
            await this.loadAgendados();
            await this.updateDashboard();
        } catch (error) {
            console.error('Erro ao marcar como agendado:', error);
            alert('Erro ao atualizar status!');
        }
    }

    // =====================================================
    // AGENDADOS - ✅ CORREÇÃO COMPLETA
    // =====================================================

    async loadAgendados() {
        // ✅ Recarregar dados do servidor para garantir sincronia
        await this.loadAllData();
        
        const tbody = document.querySelector('#tableAgendados tbody');
        if (!tbody) return;

        // ✅ Filtrar agendados (status = 'agendada')
        let agendados = this.data.encaminhamentos.filter(e => this.isAgendada(e));

        // Filtro de mês/ano (se definidos)
        if (this.currentMonth !== undefined && this.currentMonth !== null) {
            agendados = agendados.filter(e => {
                const data = new Date(e.dataRegistro);
                return data.getMonth() === this.currentMonth && data.getFullYear() === this.currentYear;
            });
        }

        // Filtros adicionais da interface
        const search = document.getElementById('searchAgendados')?.value.toLowerCase() || '';
        const filterDentista = document.getElementById('filterDentistaAgendados')?.value || '';
        const filterStatus = document.getElementById('filterStatusAgendados')?.value || '';

        if (search) {
            agendados = agendados.filter(e => 
                e.nomePaciente.toLowerCase().includes(search) ||
                e.codigoPaciente.toLowerCase().includes(search)
            );
        }

        if (filterDentista) {
            agendados = agendados.filter(e => String(e.dentistaId) === filterDentista);
        }

        if (filterStatus) {
            if (filterStatus === 'nao_pago') {
                agendados = agendados.filter(e => !e.pago);
            } else if (filterStatus === 'pagou_na_hora') {
                agendados = agendados.filter(e => e.pagouNaHora);
            } else if (filterStatus === 'pago') {
                agendados = agendados.filter(e => e.pago);
            }
        }

        // ✅ Renderizar tabela
        tbody.innerHTML = agendados.map(e => {
            const dentista = this.data.dentistas.find(d => d.id === e.dentistaId);
            const dataRegistro = new Date(e.dataRegistro);
            const statusPagamento = e.pagouNaHora ? '💰 Pagou na Hora' : (e.pago ? '✓ Pago' : '⏳ Não Pago');

            return `
                <tr>
                    <td>${e.codigoPaciente}</td>
                    <td>${e.nomePaciente}</td>
                    <td>${dentista ? dentista.nome : '-'}</td>
                    <td>${dataRegistro.toLocaleDateString('pt-BR')}</td>
                    <td>${statusPagamento}</td>
                    <td class="acoes">
                        <button class="btn btn-danger btn-sm" onclick="app.excluirEncaminhamento(${e.id})">
                            🗑️ Excluir
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        console.log(`✅ ${agendados.length} agendados carregados`);
    }

    // Helper para verificar se é agendada
    isAgendada(e) {
        const status = String(e.status || '').toLowerCase();
        return status === 'agendada' || status === 'agendado';
    }

    // =====================================================
    // PAGAMENTOS
    // =====================================================

    async loadPagamentos() {
        await this.loadAllData();
        
        const tbody = document.querySelector('#tablePagamentos tbody');
        if (!tbody) return;

        let pagamentos = this.data.encaminhamentos.filter(e => e.status === 'agendada');

        tbody.innerHTML = pagamentos.map(e => {
            const dentista = this.data.dentistas.find(d => d.id === e.dentistaId);
            const data = new Date(e.dataRegistro);
            const statusPag = e.pago ? '✓ Pago' : '⏳ Aguardando';

            return `
                <tr>
                    <td>${e.codigoPaciente}</td>
                    <td>${e.nomePaciente}</td>
                    <td>${dentista ? dentista.nome : '-'}</td>
                    <td>${statusPag}</td>
                    <td>${data.toLocaleDateString('pt-BR')}</td>
                    <td class="acoes">
                        ${!e.pago ? `
                            <button class="btn btn-success btn-sm" onclick="app.registrarPagamento(${e.id})">
                                💰 Registrar Pagamento
                            </button>
                        ` : ''}
                    </td>
                </tr>
            `;
        }).join('');
    }

    async registrarPagamento(id) {
        const mes = prompt('Mês do pagamento (YYYY-MM):', new Date().toISOString().substring(0, 7));
        if (!mes) return;

        try {
            await this.db.updateEncaminhamento(id, {
                pago: true,
                dataPagamento: new Date().toISOString(),
                mesPagamento: mes
            });

            const enc = this.data.encaminhamentos.find(e => e.id === id);
            if (enc) {
                enc.pago = true;
                enc.dataPagamento = new Date().toISOString();
                enc.mesPagamento = mes;
            }

            alert('✓ Pagamento registrado!');
            await this.loadPagamentos();
            await this.updateDashboard();
        } catch (error) {
            console.error('Erro ao registrar pagamento:', error);
            alert('Erro ao registrar pagamento!');
        }
    }

    // =====================================================
    // EXCLUSÃO
    // =====================================================

    async excluirEncaminhamento(id) {
        if (!confirm('Deseja realmente excluir este registro?')) return;

        try {
            await this.db.deleteEncaminhamento(id);
            
            // Remover localmente
            const index = this.data.encaminhamentos.findIndex(e => e.id === id);
            if (index > -1) {
                this.data.encaminhamentos.splice(index, 1);
            }

            alert('✓ Registro excluído!');
            
            // Recarregar páginas
            await this.loadNaoAgendados();
            await this.loadAgendados();
            await this.updateDashboard();
        } catch (error) {
            console.error('Erro ao excluir:', error);
            alert('Erro ao excluir registro!');
        }
    }

    // =====================================================
    // DASHBOARD
    // =====================================================

    async updateDashboard() {
        await this.loadAllData();

        const encaminhamentos = this.data.encaminhamentos;
        
        // KPIs principais
        const totalAgendadas = encaminhamentos.filter(e => e.status === 'agendada').length;
        const totalNaoAgendadas = encaminhamentos.filter(e => e.status === 'nao_agendada').length;
        const totalPagas = encaminhamentos.filter(e => e.pago).length;
        const taxaConversao = totalAgendadas > 0 
            ? ((totalPagas / totalAgendadas) * 100).toFixed(1) 
            : 0;

        document.getElementById('totalAgendadas').textContent = totalAgendadas;
        document.getElementById('totalNaoAgendadas').textContent = totalNaoAgendadas;
        document.getElementById('totalPagas').textContent = totalPagas;
        document.getElementById('taxaConversao').textContent = taxaConversao + '%';

        // Placar semanal
        this.updatePlacarSemanal();
    }

    updatePlacarSemanal() {
        const hoje = new Date();
        const inicioSemana = new Date(hoje);
        inicioSemana.setDate(hoje.getDate() - hoje.getDay());
        inicioSemana.setHours(0, 0, 0, 0);

        const fimSemana = new Date(inicioSemana);
        fimSemana.setDate(inicioSemana.getDate() + 7);

        const pagosSemana = this.data.encaminhamentos.filter(e => {
            if (!e.pago || !e.dataPagamento) return false;
            const dataPag = new Date(e.dataPagamento);
            return dataPag >= inicioSemana && dataPag < fimSemana;
        }).length;

        document.getElementById('placarSemanal').textContent = pagosSemana;
        document.getElementById('placarComparacao').textContent = 
            pagosSemana >= 25 ? '🎉 Meta atingida!' : `Faltam ${25 - pagosSemana} para a meta`;
    }

    // =====================================================
    // GESTÃO (Dentistas e Funcionários)
    // =====================================================

    async loadGestao() {
        await this.loadDentistas();
        await this.loadFuncionarios();
    }

    async loadDentistas() {
        await this.loadAllData();
        
        const tbody = document.querySelector('#tableDentistas tbody');
        if (!tbody) return;

        tbody.innerHTML = this.data.dentistas.map(d => `
            <tr>
                <td>${d.id}</td>
                <td>${d.nome}</td>
                <td>${d.tipo}</td>
                <td class="acoes">
                    <button class="btn btn-danger btn-sm" onclick="app.removerDentista(${d.id})">
                        🗑️ Excluir
                    </button>
                </td>
            </tr>
        `).join('');
    }

    async loadFuncionarios() {
        await this.loadAllData();
        
        const tbody = document.querySelector('#tableFuncionarios tbody');
        if (!tbody) return;

        tbody.innerHTML = this.data.usuarios.map(u => `
            <tr>
                <td>${u.id}</td>
                <td>${u.nome}</td>
                <td>${u.username}</td>
                <td>${u.perfil}</td>
                <td class="acoes">
                    <button class="btn btn-danger btn-sm" onclick="app.removerFuncionario(${u.id})">
                        🗑️ Excluir
                    </button>
                </td>
            </tr>
        `).join('');
    }

    async removerDentista(id) {
        if (!confirm('Deseja excluir este dentista?')) return;

        try {
            await this.db.deleteDentista(id);
            await this.loadDentistas();
            alert('✓ Dentista removido!');
        } catch (error) {
            console.error('Erro ao remover dentista:', error);
            alert('Erro ao remover dentista!');
        }
    }

    async removerFuncionario(id) {
        if (!confirm('Deseja excluir este funcionário?')) return;

        try {
            await this.db.deleteUsuario(id);
            await this.loadFuncionarios();
            alert('✓ Funcionário removido!');
        } catch (error) {
            console.error('Erro ao remover funcionário:', error);
            alert('Erro ao remover funcionário!');
        }
    }

    // =====================================================
    // UTILITÁRIOS
    // =====================================================

    populateSelects() {
        // Dentistas no cadastro
        const selectDentista = document.getElementById('dentista');
        if (selectDentista) {
            selectDentista.innerHTML = '<option value="">Selecione...</option>' +
                this.data.dentistas.map(d => `<option value="${d.id}">${d.nome}</option>`).join('');
        }

        // Dentistas nos filtros
        const filterDentista = document.getElementById('filterDentistaAgendados');
        if (filterDentista) {
            filterDentista.innerHTML = '<option value="">Todos os dentistas</option>' +
                this.data.dentistas.map(d => `<option value="${d.id}">${d.nome}</option>`).join('');
        }

        // Mês dashboard
        const selectMes = document.getElementById('mesDashboard');
        if (selectMes) {
            const meses = [
                'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
            ];
            selectMes.innerHTML = '<option value="all">Todos os meses</option>' +
                meses.map((m, i) => `<option value="${i}">${m}</option>`).join('');
        }
    }
}

// =====================================================
// INICIALIZAÇÃO
// =====================================================

let app;

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Iniciando Sistema Profilaxia v4.0 com Supabase...');
    app = new ProfilaxiaApp();
});
