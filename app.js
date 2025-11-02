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

        // ===== Config das faixas de comissão (mensal) =====
        this.COMISSAO_FAIXAS = [
            { id:'f0', label:'Faixa 1-99 (Sem comissão)',    min:1,   max:99,  valor:null,  color:'#e57373', alert:true },
            { id:'f1', label:'Meta 100-149 (R$1,00/limpeza)',min:100, max:149, valor:1.00, color:'#90a4ae' },
            { id:'f2', label:'Meta 150-170 (R$1,30/limpeza)',min:150, max:170, valor:1.30, color:'#26a69a' },
            { id:'f3', label:'Meta 171-200 (R$1,50/limpeza)',min:171, max:200, valor:1.50, color:'#00897b' },
        ];

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
    // NAVEGAÇÃO ENTRE PÁGINAS
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

            // Carregar dados ao alternar páginas
            switch(page) {
                case 'dashboard':
                    await this.updateDashboard();
                    break;
                case 'naoAgendados':
                    await this.loadNaoAgendados();
                    break;
                case 'agendados':
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
    // AGENDADOS
    // =====================================================

    async loadAgendados() {
        await this.loadAllData();
        
        const tbody = document.querySelector('#tableAgendados tbody');
        if (!tbody) return;

        // Filtrar agendados (status = 'agendada')
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

        // Renderizar tabela
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

        // Placar semanal (meta = 50)
        this.updatePlacarSemanal();

        // ===== NOVOS BLOCOS =====
        // Placar de Comissão (mensal)
        const contPlacar = document.getElementById('placar-comissao-container');
        const totalMes = await this.fetchLimpezasPagasMes();
        const model = this.calcularPlacarComissao(totalMes);
        this.renderPlacarComissao(contPlacar, model);

        // Ranking 3 colunas (por período selecionável)
        const contRanking = document.getElementById('ranking-dentistas-3col-container');
        await this.renderRankingDentistas3ColUI(contRanking);
    }

    updatePlacarSemanal() {
        const WEEKLY_GOAL = 50; // ✅ meta única da semana

        // Semana inicia na segunda-feira (BR)
        const hoje = new Date();
        const inicioSemana = new Date(hoje);
        const dow = hoje.getDay();               // 0=dom,1=seg..6=sáb
        const diff = (dow === 0 ? 6 : dow - 1);  // volta até segunda
        inicioSemana.setDate(hoje.getDate() - diff);
        inicioSemana.setHours(0, 0, 0, 0);

        const fimSemana = new Date(inicioSemana);
        fimSemana.setDate(inicioSemana.getDate() + 7);

        const pagosSemana = this.data.encaminhamentos.filter(e => {
            if (!e.pago || !e.dataPagamento) return false;
            const dataPag = new Date(e.dataPagamento);
            return dataPag >= inicioSemana && dataPag < fimSemana;
        }).length;

        document.getElementById('placarSemanal').textContent = pagosSemana;

        const faltam = Math.max(WEEKLY_GOAL - pagosSemana, 0);
        document.getElementById('placarComparacao').textContent = 
            pagosSemana >= WEEKLY_GOAL ? '🎉 Meta atingida!' : `Faltam ${faltam} para a meta`;
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
    // UTILITÁRIOS + NOVOS BLOCOS (placar/ ranking)
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

    // ===== Helpers de período =====
    startOfMonth(d=new Date()){ return new Date(d.getFullYear(), d.getMonth(), 1, 0,0,0,0); }
    toISO(x){ const p=n=>String(n).padStart(2,'0'); return `${x.getFullYear()}-${p(x.getMonth()+1)}-${p(x.getDate())}T${p(x.getHours())}:${p(x.getMinutes())}:${p(x.getSeconds())}`; }
    startOfWeekBR(now=new Date()){ const d=new Date(now); const day=d.getDay(); const diff=(day===0?6:day-1); d.setDate(d.getDate()-diff); d.setHours(0,0,0,0); return d; }
    rangeByPeriod(periodo){ const now=new Date(); if(periodo==='semana'){const from=this.startOfWeekBR(now); return {from:this.toISO(from), to:this.toISO(now)};} if(periodo==='mes'){const from=this.startOfMonth(now); return {from:this.toISO(from), to:this.toISO(now)};} return {from:null,to:null}; }

    // ===== Placar de Comissão (mensal) =====
    async fetchLimpezasPagasMes(){
        const from = this.startOfMonth();
        const now = new Date();
        const rows = this.data?.encaminhamentos || [];
        const total = rows.filter(e=>{
            const d = new Date(e.dataPagamento || e.dataRegistro || e.created_at || now);
            const pago = (e.pago===true) || String(e.status).toLowerCase()==='pago' || String(e.status_pagamento).toLowerCase()==='pago';
            return d >= from && d <= now && pago;
        }).length;
        return total;
    }

    calcularPlacarComissao(totalMes){
        let ativa = this.COMISSAO_FAIXAS[0];
        for (const f of this.COMISSAO_FAIXAS){
            if (totalMes >= f.min && totalMes <= f.max){ ativa = f; break; }
            if (totalMes > this.COMISSAO_FAIXAS[this.COMISSAO_FAIXAS.length-1].max){
                ativa = this.COMISSAO_FAIXAS[this.COMISSAO_FAIXAS.length-1];
            }
        }
        const linhas = this.COMISSAO_FAIXAS.map(f=>{
            const Y = f.id==='f0' ? 100 : f.max;
            const progress = Math.min(totalMes / Y, 1);
            const valueText = `${Math.min(totalMes, Y)}/${Y}`;
            return { ...f, Y, progress, valueText, isAtiva:(f.id===ativa.id) };
        });
        return { totalMes, ativa, linhas };
    }

    renderPlacarComissao(container, model){
        if (!container) return;
        const { linhas } = model;
        container.innerHTML = `
            <section class="card">
                <h3>🎯 Metas Coletivas (ASB + Recepcionistas)</h3>
                ${linhas.map(f=>`
                    <div class="faixa ${f.alert && f.isAtiva ? 'faixa-alerta':''}">
                        <div class="faixa-header">
                            <span>${f.label}</span>
                            <span class="faixa-valor">${f.valueText}</span>
                        </div>
                        <div class="faixa-bar">
                            <div class="faixa-fill" style="width:${Math.round(f.progress*100)}%; background:${f.color};"></div>
                        </div>
                        ${f.alert && f.isAtiva ? `<p class="faixa-note">💪 Engajamento é fundamental para atingir a primeira faixa!</p>`:''}
                    </div>
                `).join('')}
            </section>
        `;
    }

    // ===== Ranking de Dentistas (3 colunas) =====
    isPago(r){ return (r.pago===true) || String(r.status).toLowerCase()==='pago' || String(r.status_pagamento).toLowerCase()==='pago'; }
    isAgendado(r){
        if (typeof r.agendado==='boolean') return r.agendado;
        const s = String(r.status_agendamento||r.status||'').toLowerCase();
        return ['agendado','agendada','marcado','confirmado'].includes(s);
    }

    async fetchRankingDentistas3Col(periodo='semana'){
        const { from, to } = this.rangeByPeriod(periodo);
        const rows = (this.data?.encaminhamentos || []).filter(r=>{
            const d = new Date(r.dataRegistro || r.created_at || Date.now());
            if (from && to) return d >= new Date(from) && d <= new Date(to);
            return true;
        }).map(r=>{
            const dent = (this.data?.dentistas || []).find(d=>d.id===r.dentistaId);
            return { ...r, dentista_nome: dent ? dent.nome : '—' };
        });

        const map = new Map();
        for (const r of rows){
            const key = r.dentistaId || 'sem_id';
            const nome = r.dentista_nome || '—';
            const cur = map.get(key) || { dentista_id:key, nome, agendados:0, naoAgendados:0, pagos:0 };
            if (this.isPago(r)) cur.pagos += 1;
            if (this.isAgendado(r)) cur.agendados += 1; else cur.naoAgendados += 1;
            map.set(key, cur);
        }
        const arr = [...map.values()];
        arr.sort((a,b)=> (b.pagos - a.pagos) || (b.agendados - a.agendados) || a.nome.localeCompare(b.nome));
        return arr.map((x,i)=>({ pos:i+1, ...x }));
    }

    async renderRankingDentistas3ColUI(container){
        if (!container) return;

        container.innerHTML = `
            <div class="rk-card card">
                <div class="rk-head">
                    <h3>🏆 Ranking Dentistas (Agendado / Não Agendado / Pago)</h3>
                    <select id="rk3-period" class="input">
                        <option value="semana">Semana</option>
                        <option value="mes">Mês</option>
                        <option value="total">Total</option>
                    </select>
                </div>
                <table class="rk-table">
                    <thead>
                        <tr>
                            <th class="rk-pos">Pos.</th>
                            <th>Dentista</th>
                            <th class="rk-val">Agendado</th>
                            <th class="rk-val">Não Agendado</th>
                            <th class="rk-val">Pago</th>
                        </tr>
                    </thead>
                    <tbody id="rk3-body"><tr><td colspan="5" class="rk-muted">Carregando…</td></tr></tbody>
                </table>
            </div>
        `;

        const select = container.querySelector('#rk3-period');
        const tbody  = container.querySelector('#rk3-body');

        const load = async (periodo)=>{
            tbody.innerHTML = `<tr><td colspan="5" class="rk-muted">Carregando…</td></tr>`;
            let data;
            if (periodo === 'total') {
                data = await this.fetchRankingDentistas3Col(null); // sem filtro
            } else {
                data = await this.fetchRankingDentistas3Col(periodo);
            }
            if (!data.length){
                tbody.innerHTML = `<tr><td colspan="5" class="rk-muted">Sem dados no período.</td></tr>`;
                return;
            }
            tbody.innerHTML = data.slice(0,10).map(row=>{
                const medal = row.pos===1?'🥇':row.pos===2?'🥈':row.pos===3?'🥉':`${row.pos}º`;
                return `
                    <tr>
                        <td class="rk-pos"><span class="rk-medal">${medal}</span></td>
                        <td>${row.nome}</td>
                        <td class="rk-val">${row.agendados}</td>
                        <td class="rk-val">${row.naoAgendados}</td>
                        <td class="rk-val">${row.pagos}</td>
                    </tr>
                `;
            }).join('');
        };

        select.addEventListener('change', ()=> load(select.value));
        load(select.value);
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
