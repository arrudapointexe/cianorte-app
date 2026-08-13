// DOM Elements
const setupPanel = document.getElementById('setup-panel');
const mainApp = document.getElementById('main-app');
const selectLojaGlobal = document.getElementById('select-loja-global');

// Configs e Estado
let supabaseClient = null;
let lojasDisponiveis = ['Cianorte Matriz', 'Cianorte Filial 1', 'Cianorte Filial 2'];
let tarefasChecklist = ['Limpeza da loja', 'Organização do estoque', 'Reposição de vitrine', 'Fechamento de caixa'];
let eventos = [];
let checklists = [];
let configs = [];

// Funções Utilitárias
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `${type === 'success' ? '✅' : '❌'} ${message}`;
  
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function formatarData(data) {
  const pad = n => n.toString().padStart(2, '0');
  const d = [data.getFullYear(), pad(data.getMonth() + 1), pad(data.getDate())].join('-');
  const h = [pad(data.getHours()), pad(data.getMinutes()), pad(data.getSeconds())].join(':');
  return `${d} ${h}`;
}

window.copiarLink = function(text, btn) {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(() => {
      showToast('Link copiado!');
      const originalText = btn.textContent;
      btn.textContent = 'Copiado!';
      setTimeout(() => btn.textContent = originalText, 2000);
    });
  } else {
    // Fallback for non-HTTPS (like local network IPs)
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      showToast('Link copiado!');
      const originalText = btn.textContent;
      btn.textContent = 'Copiado!';
      setTimeout(() => btn.textContent = originalText, 2000);
    } catch (err) {
      showToast('Erro ao copiar link', 'error');
    }
    document.body.removeChild(textArea);
  }
}

// Navegação de Abas
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    e.target.classList.add('active');
    document.getElementById(e.target.dataset.target).classList.add('active');
    
    // Atualizar dashboard e esconder seletor se a aba for admin
    if (e.target.dataset.target === 'aba-admin') {
      document.getElementById('loja-selector-container').classList.add('hidden');
      atualizarDashboardAdmin();
    } else {
      document.getElementById('loja-selector-container').classList.remove('hidden');
    }
  });
});

document.querySelectorAll('.tab-btn-sub').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.tab-btn-sub').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content-sub').forEach(c => c.classList.remove('active'));
    e.target.classList.add('active');
    document.getElementById(e.target.dataset.target).classList.add('active');
  });
});

// Checar URL Params para admin e loja fixa
const urlParams = new URLSearchParams(window.location.search);
const isAdmin = urlParams.get('admin') === 'true';
const lojaFixa = urlParams.get('loja_fixa');

if (isAdmin) {
  document.getElementById('btn-tab-admin').classList.remove('hidden');
}

// Inicialização e Configuração do Supabase
function initApp() {
  const urlSupaUrl = urlParams.get('supaUrl');
  const urlSupaKey = urlParams.get('supaKey');
  
  if (urlSupaUrl && urlSupaKey) {
    localStorage.setItem('supaUrl', urlSupaUrl);
    localStorage.setItem('supaKey', urlSupaKey);
    // Remove os parâmetros sensíveis da URL para não ficarem visíveis na barra de endereços
    let novaUrl = window.location.pathname;
    if (lojaFixa && lojaFixa !== 'null') {
      novaUrl += "?loja_fixa=" + encodeURIComponent(lojaFixa);
    }
    window.history.replaceState({}, document.title, novaUrl);
  }

  const supaUrl = localStorage.getItem('supaUrl');
  const supaKey = localStorage.getItem('supaKey');

  if (supaUrl && supaKey) {
    try {
      // Cria a instância do Supabase globalmente
      supabaseClient = window.supabase.createClient(supaUrl, supaKey);
      setupPanel.classList.add('hidden');
      mainApp.classList.remove('hidden');
      carregarDados();
    } catch (e) {
      console.error(e);
      setupPanel.classList.remove('hidden');
      mainApp.classList.add('hidden');
    }
  } else {
    setupPanel.classList.remove('hidden');
    mainApp.classList.add('hidden');
  }

  // Preencher campos do TG
  document.getElementById('tg-token').value = localStorage.getItem('tgToken') || '';
  document.getElementById('tg-chat').value = localStorage.getItem('tgChat') || '';
}

document.getElementById('btn-save-setup').addEventListener('click', () => {
  const url = document.getElementById('supa-url').value.trim();
  const key = document.getElementById('supa-key').value.trim();
  if (url && key) {
    localStorage.setItem('supaUrl', url);
    localStorage.setItem('supaKey', key);
    initApp();
  } else {
    showToast('Preencha os dois campos.', 'error');
  }
});

// Carregar Dados do Banco
async function carregarDados() {
  try {
    const [resConfigs, resEventos, resChecklists] = await Promise.all([
      supabaseClient.from('configs').select('*').order('id', { ascending: true }),
      supabaseClient.from('eventos').select('*').order('id', { ascending: true }),
      supabaseClient.from('checklists').select('*').order('id', { ascending: true })
    ]);

    if (resConfigs.data) configs = resConfigs.data;
    if (resEventos.data) eventos = resEventos.data;
    if (resChecklists.data) checklists = resChecklists.data;

    processarConfigs();
    renderizarChecklist();
  } catch (error) {
    console.error("Erro ao carregar dados", error);
    showToast("Erro ao conectar no banco de dados.", "error");
  }
}

function processarConfigs() {
  // Lojas
  const lojasSet = new Set(configs.map(c => c.Loja).filter(l => l));
  if (lojasSet.size > 0) {
    lojasDisponiveis = Array.from(lojasSet);
  }

  selectLojaGlobal.innerHTML = '';
  lojasDisponiveis.forEach(loja => {
    const opt = document.createElement('option');
    opt.value = loja;
    opt.textContent = loja;
    selectLojaGlobal.appendChild(opt);
  });

  if (lojaFixa && lojasDisponiveis.includes(lojaFixa)) {
    selectLojaGlobal.value = lojaFixa;
    selectLojaGlobal.disabled = true;
  }

  // Tarefas
  const tarefasSet = new Set(configs.map(c => c.Tarefa_Checklist).filter(t => t));
  if (tarefasSet.size > 0) {
    tarefasChecklist = Array.from(tarefasSet);
  }
  
  // Admin Lojas dropdown
  const adminLojaSelect = document.getElementById('admin-loja');
  adminLojaSelect.innerHTML = '<option value="Todas as Lojas">Todas as Lojas</option>';
  lojasDisponiveis.forEach(loja => {
    const opt = document.createElement('option');
    opt.value = loja;
    opt.textContent = loja;
    adminLojaSelect.appendChild(opt);
  });

  // Gerar Links de Acesso
  const linksContainer = document.getElementById('links-container');
  if (linksContainer) {
    linksContainer.innerHTML = '';
    const baseUrl = window.location.origin + window.location.pathname;
    const sUrl = localStorage.getItem('supaUrl') || '';
    const sKey = localStorage.getItem('supaKey') || '';
    lojasDisponiveis.forEach(loja => {
      const link = `${baseUrl}?loja_fixa=${encodeURIComponent(loja)}&supaUrl=${encodeURIComponent(sUrl)}&supaKey=${encodeURIComponent(sKey)}`;
      linksContainer.innerHTML += `
        <div style="background: #f8f9fa; padding: 10px 15px; border-radius: 8px; margin-bottom: 10px; display: flex; flex-wrap: wrap; gap: 10px; justify-content: space-between; align-items: center; border: 1px solid #eee;">
          <span style="font-weight: 700; color: var(--primary-color);">${loja}</span>
          <div style="display:flex; gap:10px; flex-grow: 1; max-width: 400px;">
            <input type="text" value="${link}" readonly style="flex-grow: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 0.85rem; background: #fff;" onclick="this.select()">
            <button class="btn btn-success" style="padding: 8px 15px; font-size: 0.85rem; width: auto;" onclick="window.copiarLink('${link}', this)">Copiar</button>
          </div>
        </div>
      `;
    });
  }

  renderizarChecklist();
  atualizarEstadoSaida();
}

selectLojaGlobal.addEventListener('change', () => {
  renderizarChecklist();
  atualizarEstadoSaida();
});

function atualizarEstadoSaida() {
  if (!selectLojaGlobal.value) return;
  const lojaAtual = selectLojaGlobal.value;
  const hoje = formatarData(new Date()).split(' ')[0];
  
  const eventosHojeLoja = eventos.filter(e => {
    let d = e.Data_Hora.split(/[T ]/)[0];
    if (d.includes('/')) d = d.split('/').reverse().join('-');
    return e.Loja === lojaAtual && d === hoje;
  });
  const entradas = eventosHojeLoja.filter(e => e.Tipo_Evento === 'Entrada').length;
  const saidas = eventosHojeLoja.filter(e => e.Tipo_Evento === 'Saida').length;
  const clientes = Math.max(0, entradas - saidas);

  const form = document.getElementById('saida-form');
  const warning = document.getElementById('saida-warning');
  const badge = document.getElementById('badge-clientes');

  if (clientes <= 0) {
    form.classList.add('hidden');
    warning.classList.remove('hidden');
    badge.style.display = 'none';
  } else {
    form.classList.remove('hidden');
    warning.classList.add('hidden');
    badge.style.display = 'inline-block';
    badge.textContent = `${clientes} na loja`;
  }
}

// ==========================================
// VENDEDORAS LOGIC
// ==========================================
const selectComprou = document.getElementById('select-comprou');
const containerMotivo = document.getElementById('container-motivo');
const labelObs = document.getElementById('label-obs');

selectComprou.addEventListener('change', (e) => {
  if (e.target.value === 'Não') {
    containerMotivo.classList.remove('hidden');
    labelObs.textContent = 'Motivo da perda detalhado (Obrigatório)';
  } else {
    containerMotivo.classList.add('hidden');
    labelObs.textContent = 'Observações (opcional)';
  }
});

// Registrar Entrada
document.getElementById('btn-entrada').addEventListener('click', async () => {
  const lojaAtual = selectLojaGlobal.value;
  const dataHora = formatarData(new Date());

  const novoEvento = {
    Data_Hora: dataHora,
    Loja: lojaAtual,
    Tipo_Evento: 'Entrada',
    Comprou: '-',
    Motivo_Nao_Compra: '-',
    Observacoes: '-',
    Funcionaria: '-'
  };

  try {
    const { error } = await supabaseClient.from('eventos').insert([novoEvento]);
    if (error) throw error;
    
    eventos.push(novoEvento); // Update local cache
    showToast(`Entrada registrada em ${lojaAtual}`);
    atualizarEstadoSaida();
    
    // Animação no botão
    const btn = document.getElementById('btn-entrada');
    btn.style.transform = 'scale(0.95)';
    setTimeout(() => btn.style.transform = 'scale(1)', 150);
  } catch (e) {
    showToast('Erro ao salvar entrada.', 'error');
    console.error(e);
  }
});

// Registrar Saída
document.getElementById('btn-saida').addEventListener('click', async () => {
  const lojaAtual = selectLojaGlobal.value;
  const func = document.getElementById('input-funcionaria').value.trim().toUpperCase();
  const comprou = selectComprou.value;
  const motivo = document.getElementById('select-motivo').value;
  const obs = document.getElementById('input-obs').value.trim();
  const dataHora = formatarData(new Date());

  if (!func) {
    showToast('Informe o nome da funcionária.', 'error');
    return;
  }

  if (comprou === 'Não' && (!motivo || !obs)) {
    showToast('Informe o motivo da perda e os detalhes.', 'error');
    return;
  }

  // Check se há entradas sem saída hoje na loja
  const hoje = dataHora.split(/[T ]/)[0];
  const eventosHojeLoja = eventos.filter(e => e.Loja === lojaAtual && e.Data_Hora.split(/[T ]/)[0] === hoje);
  const entradas = eventosHojeLoja.filter(e => e.Tipo_Evento === 'Entrada').length;
  const saidas = eventosHojeLoja.filter(e => e.Tipo_Evento === 'Saida').length;

  if (entradas <= saidas) {
    showToast('Não há clientes pendentes na loja. Registre uma entrada primeiro.', 'error');
    return;
  }

  const novoEvento = {
    Data_Hora: dataHora,
    Loja: lojaAtual,
    Tipo_Evento: 'Saida',
    Comprou: comprou,
    Motivo_Nao_Compra: comprou === 'Não' ? motivo : '-',
    Observacoes: obs || '-',
    Funcionaria: func
  };

  try {
    const { error } = await supabaseClient.from('eventos').insert([novoEvento]);
    if (error) throw error;
    
    eventos.push(novoEvento);
    showToast(`Saída registrada em ${lojaAtual}`);
    atualizarEstadoSaida();
    
    // Reset forms
    document.getElementById('input-funcionaria').value = '';
    document.getElementById('select-motivo').value = '';
    document.getElementById('input-obs').value = '';
    selectComprou.value = 'Sim';
    containerMotivo.classList.add('hidden');
    labelObs.textContent = 'Observações (opcional)';
    
  } catch (e) {
    showToast('Erro ao salvar saída.', 'error');
    console.error(e);
  }
});

// ==========================================
// CHECKLIST LOGIC
// ==========================================
function getLogicalDate() {
  const now = new Date();
  now.setHours(now.getHours() - 8);
  return now.toISOString().split('T')[0];
}

function renderizarChecklist() {
  const lojaAtual = selectLojaGlobal.value;
  document.getElementById('checklist-title').textContent = `✅ Checklist Diário - ${lojaAtual}`;
  
  const logicalDate = getLogicalDate();
  const checklistsHoje = checklists.filter(c => {
    // converter Data_Hora para logicalDate
    const d = new Date(c.Data_Hora.replace(' ', 'T'));
    d.setHours(d.getHours() - 8);
    const ld = d.toISOString().split('T')[0];
    return ld === logicalDate && c.Loja === lojaAtual;
  });

  const container = document.getElementById('checklist-container');
  container.innerHTML = '';

  tarefasChecklist.forEach(tarefa => {
    const concluidoPor = checklistsHoje.filter(c => c.Tarefa === tarefa && c.Status === 'Concluído').map(c => c.Funcionaria.toUpperCase());
    const isConcluida = concluidoPor.length > 0;

    const div = document.createElement('div');
    div.className = `checklist-item ${isConcluida ? 'done' : ''}`;
    
    let html = `<input type="checkbox" id="chk-${tarefa}" value="${tarefa}">`;
    html += `<label for="chk-${tarefa}">${tarefa}</label>`;
    
    if (isConcluida) {
      html += `<span class="badge">Feito por: ${concluidoPor.join(', ')}</span>`;
    }
    
    div.innerHTML = html;
    container.appendChild(div);
  });
}

document.getElementById('btn-salvar-check').addEventListener('click', async () => {
  const func = document.getElementById('check-funcionaria').value.trim().toUpperCase();
  const checkboxes = document.querySelectorAll('#checklist-container input[type="checkbox"]:checked');
  const lojaAtual = selectLojaGlobal.value;
  const dataHora = formatarData(new Date());

  if (checkboxes.length === 0) {
    showToast('Nenhuma tarefa marcada.', 'error');
    return;
  }

  if (!func) {
    showToast('Informe o nome da funcionária.', 'error');
    return;
  }

  const novasTarefas = [];
  checkboxes.forEach(chk => {
    novasTarefas.push({
      Data_Hora: dataHora,
      Loja: lojaAtual,
      Funcionaria: func,
      Tarefa: chk.value,
      Status: 'Concluído'
    });
  });

  try {
    const { error } = await supabaseClient.from('checklists').insert(novasTarefas);
    if (error) throw error;
    
    checklists.push(...novasTarefas);
    showToast(`${novasTarefas.length} tarefa(s) salva(s)!`);
    document.getElementById('check-funcionaria').value = '';
    renderizarChecklist();
  } catch (e) {
    showToast('Erro ao salvar checklist.', 'error');
    console.error(e);
  }
});

// ==========================================
// ADMIN DASHBOARD
// ==========================================
document.querySelectorAll('.tab-btn-sub').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.tab-btn-sub').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    // Lógica adicional de troca de aba aqui, se necessário
  });
});

let myChart = null;

document.getElementById('admin-periodo').addEventListener('change', (e) => {
  const container = document.getElementById('custom-date-container');
  if (e.target.value === 'Personalizado') {
    container.classList.remove('hidden');
  } else {
    container.classList.add('hidden');
    atualizarDashboardAdmin();
  }
});
document.getElementById('admin-date-start').addEventListener('change', atualizarDashboardAdmin);
document.getElementById('admin-date-end').addEventListener('change', atualizarDashboardAdmin);
document.getElementById('admin-loja').addEventListener('change', atualizarDashboardAdmin);

function atualizarDashboardAdmin() {
  if (!isAdmin) return;

  const periodo = document.getElementById('admin-periodo').value;
  const filtroLoja = document.getElementById('admin-loja').value;
  
  const hoje = new Date().toISOString().split('T')[0];
  const ontemDate = new Date();
  ontemDate.setDate(ontemDate.getDate() - 1);
  const ontem = ontemDate.toISOString().split('T')[0];
  const seteDiasDate = new Date();
  seteDiasDate.setDate(seteDiasDate.getDate() - 7);
  const seteDias = seteDiasDate.toISOString().split('T')[0];
  
  const dateStart = document.getElementById('admin-date-start').value;
  const dateEnd = document.getElementById('admin-date-end').value;
  const mesAtualStr = hoje.substring(0, 7);

  let dfFiltrado = eventos.filter(e => {
    let d = e.Data_Hora.split(/[T ]/)[0];
    if (d.includes('/')) d = d.split('/').reverse().join('-');
    
    if (periodo === 'Hoje' && d !== hoje) return false;
    if (periodo === 'Ontem' && d !== ontem) return false;
    if (periodo === 'Últimos 7 dias' && d < seteDias) return false;
    if (periodo === 'Mês Atual' && !d.startsWith(mesAtualStr)) return false;
    if (periodo === 'Personalizado') {
      if (dateStart && d < dateStart) return false;
      if (dateEnd && d > dateEnd) return false;
    }
    
    if (filtroLoja !== 'Todas as Lojas' && e.Loja !== filtroLoja) return false;
    
    return true;
  });

  // Métricas Globais
  const tEntradas = dfFiltrado.filter(e => e.Tipo_Evento === 'Entrada').length;
  const tSaidas = dfFiltrado.filter(e => e.Tipo_Evento === 'Saida').length;
  const tVendas = dfFiltrado.filter(e => e.Tipo_Evento === 'Saida' && e.Comprou === 'Sim').length;
  const conversao = tSaidas > 0 ? ((tVendas / tSaidas) * 100).toFixed(1) : 0;

  // 4. Horários de Pico
  const horariosCount = {};
  dfFiltrado.forEach(e => {
    if (e.Tipo_Evento === 'Entrada') {
      const timePart = e.Data_Hora.split(/[T ]/)[1];
      const hora = timePart ? timePart.substring(0, 2) : '00';
      horariosCount[hora] = (horariosCount[hora] || 0) + 1;
    }
  });
  let horarioPico = '-';
  let picoCount = 0;
  for (const h in horariosCount) {
    if (horariosCount[h] > picoCount) {
      picoCount = horariosCount[h];
      horarioPico = h + 'h';
    }
  }

  const metricsContainer = document.getElementById('admin-metrics');
  metricsContainer.innerHTML = `
    <div class="metric-card">
      <h3>Entradas</h3>
      <div class="value">${tEntradas}</div>
    </div>
    <div class="metric-card" style="border-bottom-color: var(--success-color);">
      <h3>Vendas</h3>
      <div class="value">${tVendas}</div>
    </div>
    <div class="metric-card" style="border-bottom-color: #9b59b6;">
      <h3>Conversão Geral</h3>
      <div class="value">${conversao}%</div>
    </div>
    <div class="metric-card" style="border-bottom-color: #f39c12;">
      <h3>Horário de Pico</h3>
      <div class="value">${horarioPico}</div>
    </div>
  `;

  // Gráfico de Fluxo
  renderizarGrafico(dfFiltrado);

  // 1. Ofensores
  const dfPerdas = dfFiltrado.filter(e => e.Tipo_Evento === 'Saida' && e.Comprou === 'Não' && e.Motivo_Nao_Compra && e.Motivo_Nao_Compra !== '-');
  const motivosCount = {};
  dfPerdas.forEach(e => { motivosCount[e.Motivo_Nao_Compra] = (motivosCount[e.Motivo_Nao_Compra] || 0) + 1; });
  const sortedMotivos = Object.keys(motivosCount).sort((a,b) => motivosCount[b] - motivosCount[a]);
  const tbodyOfensores = document.querySelector('#table-ofensores tbody');
  tbodyOfensores.innerHTML = sortedMotivos.length === 0 ? '<tr><td colspan="2" style="text-align:center;">Nenhuma perda no período</td></tr>' : '';
  sortedMotivos.forEach(m => {
    tbodyOfensores.innerHTML += `<tr><td>${m}</td><td>${motivosCount[m]}</td></tr>`;
  });

  // 2. Equipe
  const dfSaidas = dfFiltrado.filter(e => e.Tipo_Evento === 'Saida' && e.Funcionaria && e.Funcionaria !== '-');
  const funcStats = {};
  dfSaidas.forEach(e => {
    const funcNome = e.Funcionaria.toUpperCase();
    const key = funcNome + '|' + e.Loja;
    if (!funcStats[key]) funcStats[key] = { func: funcNome, loja: e.Loja, atend: 0, vendas: 0 };
    funcStats[key].atend++;
    if (e.Comprou === 'Sim') funcStats[key].vendas++;
  });
  const sortedEquipe = Object.values(funcStats).sort((a,b) => b.vendas - a.vendas || (b.vendas/b.atend) - (a.vendas/a.atend));
  const tbodyEquipe = document.querySelector('#table-equipe tbody');
  tbodyEquipe.innerHTML = sortedEquipe.length === 0 ? '<tr><td colspan="5" style="text-align:center;">Sem atendimentos no período</td></tr>' : '';
  sortedEquipe.forEach(f => {
    const conv = ((f.vendas / f.atend) * 100).toFixed(1);
    tbodyEquipe.innerHTML += `<tr><td>${f.func}</td><td>${f.loja}</td><td>${f.atend}</td><td>${f.vendas}</td><td>${conv}%</td></tr>`;
  });

  // 3. Lojas (Ranking)
  const lojasStats = {};
  dfFiltrado.forEach(e => {
    if (!lojasStats[e.Loja]) lojasStats[e.Loja] = { entradas: 0, saidas: 0, vendas: 0 };
    if (e.Tipo_Evento === 'Entrada') lojasStats[e.Loja].entradas++;
    if (e.Tipo_Evento === 'Saida') {
      lojasStats[e.Loja].saidas++;
      if (e.Comprou === 'Sim') lojasStats[e.Loja].vendas++;
    }
  });
  const sortedLojas = Object.keys(lojasStats).map(l => ({ loja: l, ...lojasStats[l] })).sort((a,b) => (b.vendas/b.saidas || 0) - (a.vendas/a.saidas || 0));
  const tbodyLojas = document.querySelector('#table-lojas tbody');
  tbodyLojas.innerHTML = sortedLojas.length === 0 ? '<tr><td colspan="5" style="text-align:center;">Sem dados no período</td></tr>' : '';
  sortedLojas.forEach((l, idx) => {
    const perdas = l.saidas - l.vendas;
    const conv = l.saidas > 0 ? ((l.vendas / l.saidas) * 100).toFixed(1) : 0;
    const medal = idx === 0 && conv > 0 ? '🥇 ' : (idx === 1 && conv > 0 ? '🥈 ' : '');
    tbodyLojas.innerHTML += `<tr><td>${medal}${l.loja}</td><td>${l.entradas}</td><td>${l.vendas}</td><td>${perdas}</td><td><strong>${conv}%</strong></td></tr>`;
  });
}

function renderizarGrafico(df) {
  const ctx = document.getElementById('fluxoChart').getContext('2d');
  
  if (myChart) myChart.destroy();

  const dfEntradas = df.filter(e => e.Tipo_Evento === 'Entrada');
  
  // Agrupar por hora
  const labels = Array.from({length: 15}, (_, i) => `${i+8}:00`); // 8h as 22h
  const dataMap = {};
  lojasDisponiveis.forEach(l => dataMap[l] = Array(15).fill(0));

  dfEntradas.forEach(e => {
    const timePart = e.Data_Hora.split(/[T ]/)[1];
    const hora = parseInt(timePart ? timePart.split(':')[0] : '8');
    const idx = hora - 8;
    if (idx >= 0 && idx < 15 && dataMap[e.Loja]) {
      dataMap[e.Loja][idx]++;
    }
  });

  const datasets = Object.keys(dataMap).map((loja, i) => {
    const colors = ['#ff6b6b', '#1dd1a1', '#54a0ff', '#feca57', '#9b59b6'];
    return {
      label: loja,
      data: dataMap[loja],
      borderColor: colors[i % colors.length],
      tension: 0.4,
      fill: false
    };
  });

  myChart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'top' } }
    }
  });
}

// ==========================================
// TELEGRAM INTEGRATION
// ==========================================
document.getElementById('btn-save-tg').addEventListener('click', () => {
  const token = document.getElementById('tg-token').value.trim().replace(/[\s'"]/g, '');
  const chat = document.getElementById('tg-chat').value.trim().replace(/[\s'"]/g, '');
  if (token && chat) {
    localStorage.setItem('tgToken', token);
    localStorage.setItem('tgChat', chat);
    showToast('Chaves do Telegram salvas com sucesso.');
  }
});

document.getElementById('btn-send-telegram').addEventListener('click', async () => {
  const token = localStorage.getItem('tgToken');
  const chat = localStorage.getItem('tgChat');
  
  if (!token || !chat) {
    showToast('Configure as chaves do Telegram primeiro!', 'error');
    return;
  }

  const cleanToken = token.trim().replace(/[\s'"]/g, '');
  const cleanChat = chat.trim().replace(/[\s'"]/g, '');
  const url = `https://api.telegram.org/bot${cleanToken}/sendMessage`;
  const periodo = document.getElementById('admin-periodo').value;
  
  // Sincronizar com o período selecionado
  const filtroLoja = document.getElementById('admin-loja').value;
  const hojeDateStr = new Date().toISOString().split('T')[0];
  const ontemDate = new Date();
  ontemDate.setDate(ontemDate.getDate() - 1);
  const ontem = ontemDate.toISOString().split('T')[0];
  const seteDiasDate = new Date();
  seteDiasDate.setDate(seteDiasDate.getDate() - 7);
  const seteDias = seteDiasDate.toISOString().split('T')[0];
  
  const dateStart = document.getElementById('admin-date-start').value;
  const dateEnd = document.getElementById('admin-date-end').value;
  const mesAtualStr = hojeDateStr.substring(0, 7);

  let dfFiltrado = eventos.filter(e => {
    let d = e.Data_Hora.split(/[T ]/)[0];
    if (d.includes('/')) d = d.split('/').reverse().join('-');
    
    if (periodo === 'Hoje' && d !== hojeDateStr) return false;
    if (periodo === 'Ontem' && d !== ontem) return false;
    if (periodo === 'Últimos 7 dias' && d < seteDias) return false;
    if (periodo === 'Mês Atual' && !d.startsWith(mesAtualStr)) return false;
    if (periodo === 'Personalizado') {
      if (dateStart && d < dateStart) return false;
      if (dateEnd && d > dateEnd) return false;
    }
    if (filtroLoja !== 'Todas as Lojas' && e.Loja !== filtroLoja) return false;
    return true;
  });

  const btn = document.getElementById('btn-send-telegram');
  btn.textContent = 'Gerando Imagem...';
  btn.disabled = true;

  try {
    // Calcular Métricas
    const tEntradas = dfFiltrado.filter(e => e.Tipo_Evento === 'Entrada').length;
    const tSaidas = dfFiltrado.filter(e => e.Tipo_Evento === 'Saida').length;
    const tVendas = dfFiltrado.filter(e => e.Tipo_Evento === 'Saida' && e.Comprou === 'Sim').length;
    const tPerdas = tSaidas - tVendas;
    const conversao = tSaidas > 0 ? ((tVendas / tSaidas) * 100).toFixed(1) : 0;

    // Preencher Template
    document.getElementById('tg-report-subtitle').innerHTML = `Período: <strong>${periodo}</strong> | Loja: <strong>${filtroLoja}</strong>`;
    
    document.getElementById('tg-report-metrics').innerHTML = `
      <div style="flex:1; text-align:center; padding:15px; border-top: 4px solid #3498db; background:#f8f9fa; border-radius:4px;">
        <div style="font-size:12px; color:#7f8c8d; font-weight:bold; letter-spacing:1px; margin-bottom:5px;">ENTRADAS</div>
        <div style="font-size:24px; font-weight:bold;">${tEntradas}</div>
      </div>
      <div style="flex:1; text-align:center; padding:15px; border-top: 4px solid #2ecc71; background:#f8f9fa; border-radius:4px;">
        <div style="font-size:12px; color:#7f8c8d; font-weight:bold; letter-spacing:1px; margin-bottom:5px;">VENDAS</div>
        <div style="font-size:24px; font-weight:bold;">${tVendas}</div>
      </div>
      <div style="flex:1; text-align:center; padding:15px; border-top: 4px solid #e74c3c; background:#f8f9fa; border-radius:4px;">
        <div style="font-size:12px; color:#7f8c8d; font-weight:bold; letter-spacing:1px; margin-bottom:5px;">PERDAS</div>
        <div style="font-size:24px; font-weight:bold;">${tPerdas}</div>
      </div>
      <div style="flex:1; text-align:center; padding:15px; border-top: 4px solid #9b59b6; background:#f8f9fa; border-radius:4px;">
        <div style="font-size:12px; color:#7f8c8d; font-weight:bold; letter-spacing:1px; margin-bottom:5px;">CONVERSÃO</div>
        <div style="font-size:24px; font-weight:bold;">${conversao}%</div>
      </div>
    `;

    // Lojas
    const lojasStats = {};
    dfFiltrado.forEach(e => {
      if (!lojasStats[e.Loja]) lojasStats[e.Loja] = { entradas: 0, saidas: 0, vendas: 0 };
      if (e.Tipo_Evento === 'Entrada') lojasStats[e.Loja].entradas++;
      if (e.Tipo_Evento === 'Saida') {
        lojasStats[e.Loja].saidas++;
        if (e.Comprou === 'Sim') lojasStats[e.Loja].vendas++;
      }
    });
    const sortedLojas = Object.keys(lojasStats).map(l => ({ loja: l, ...lojasStats[l] })).sort((a,b) => (b.vendas/b.saidas || 0) - (a.vendas/a.saidas || 0));
    let tLojas = '<thead><tr style="background:#2c3e50; color:white; text-align:left;"><th style="padding:10px;">Loja</th><th style="padding:10px;">Entradas</th><th style="padding:10px;">Vendas</th><th style="padding:10px;">Perdas</th><th style="padding:10px;">Conversão</th></tr></thead><tbody>';
    sortedLojas.forEach((l, idx) => {
      const perdas = l.saidas - l.vendas;
      const conv = l.saidas > 0 ? ((l.vendas / l.saidas) * 100).toFixed(1) : 0;
      tLojas += `<tr style="border-bottom: 1px solid #eee;"><td style="padding:10px;">${l.loja}</td><td style="padding:10px;">${l.entradas}</td><td style="padding:10px;">${l.vendas}</td><td style="padding:10px;">${perdas}</td><td style="padding:10px;"><strong>${conv}%</strong></td></tr>`;
    });
    document.getElementById('tg-report-lojas').innerHTML = tLojas + '</tbody>';

    // Equipe
    const dfSaidas = dfFiltrado.filter(e => e.Tipo_Evento === 'Saida' && e.Funcionaria && e.Funcionaria !== '-');
    const funcStats = {};
    dfSaidas.forEach(e => {
      const funcNome = e.Funcionaria.toUpperCase();
      const key = funcNome + '|' + e.Loja;
      if (!funcStats[key]) funcStats[key] = { func: funcNome, loja: e.Loja, atend: 0, vendas: 0 };
      funcStats[key].atend++;
      if (e.Comprou === 'Sim') funcStats[key].vendas++;
    });
    const sortedEquipe = Object.values(funcStats).sort((a,b) => b.vendas - a.vendas || (b.vendas/b.atend) - (a.vendas/a.atend));
    let tEq = '<thead><tr style="background:#2c3e50; color:white; text-align:left;"><th style="padding:10px;">Vendedora</th><th style="padding:10px;">Loja</th><th style="padding:10px;">Vendas</th><th style="padding:10px;">Perdas</th><th style="padding:10px;">Conversão</th></tr></thead><tbody>';
    sortedEquipe.forEach(f => {
      const perdas = f.atend - f.vendas;
      const conv = ((f.vendas / f.atend) * 100).toFixed(1);
      tEq += `<tr style="border-bottom: 1px solid #eee;"><td style="padding:10px;">${f.func}</td><td style="padding:10px;">${f.loja}</td><td style="padding:10px;">${f.vendas}</td><td style="padding:10px;">${perdas}</td><td style="padding:10px;">${conv}%</td></tr>`;
    });
    document.getElementById('tg-report-vendedoras').innerHTML = tEq + '</tbody>';

    // Ofensores e Obs
    const dfPerdasGlobais = dfFiltrado.filter(e => e.Tipo_Evento === 'Saida' && e.Comprou === 'Não' && e.Motivo_Nao_Compra && e.Motivo_Nao_Compra !== '-');
    const motivosCount = {};
    dfPerdasGlobais.forEach(e => { motivosCount[e.Motivo_Nao_Compra] = (motivosCount[e.Motivo_Nao_Compra] || 0) + 1; });
    
    // Limite aos 5 principais
    const top5Motivos = Object.keys(motivosCount).sort((a,b) => motivosCount[b] - motivosCount[a]).slice(0, 5);
    const motivosStr = top5Motivos.map(m => `${m} (${motivosCount[m]})`).join(', ');
    document.getElementById('tg-report-motivos-resumo').textContent = `Motivos mais registrados (Top 5): ${motivosStr || 'Nenhum'}`;

    // Limite de observações para a imagem não ficar gigante
    const dfObs = dfPerdasGlobais.filter(e => e.Observacoes && e.Observacoes !== '-').slice(-8);
    let obsHtml = '';
    dfObs.forEach(o => {
      obsHtml += `<div style="margin-bottom: 8px; border-bottom: 1px dashed #eccc68; padding-bottom: 8px;">
        <strong style="color: #d35400;">[${o.Loja}] ${o.Funcionaria.toUpperCase()}</strong> indicou '${o.Motivo_Nao_Compra}':<br>
        ${o.Observacoes}
      </div>`;
    });
    document.getElementById('tg-report-obs').innerHTML = obsHtml || 'Nenhuma observação relevante.';

    // Gerar a imagem com HTML2Canvas
    const reportTemplate = document.getElementById('telegram-report-template');
    
    btn.textContent = 'Renderizando...';
    
    const canvas = await html2canvas(reportTemplate, { 
      scale: 2, 
      useCORS: true, 
      backgroundColor: '#ffffff'
    });
    
    btn.textContent = 'Enviando...';
    
    canvas.toBlob(async (blob) => {
      const formData = new FormData();
      formData.append('chat_id', cleanChat);
      formData.append('photo', blob, 'relatorio_cianorte.png');
      
      const tgUrl = `https://api.telegram.org/bot${cleanToken}/sendPhoto`;
      const res = await fetch(tgUrl, {
        method: 'POST',
        body: formData
      });
      
      if (!res.ok) throw new Error('Erro na API do Telegram');
      showToast('Relatório visual enviado com sucesso!');
      
      btn.textContent = 'Gerar Relatório e Enviar';
      btn.disabled = false;
    }, 'image/png');

  } catch (e) {
    showToast('Erro ao gerar/enviar o relatório.', 'error');
    console.error(e);
    btn.textContent = 'Gerar Relatório e Enviar';
    btn.disabled = false;
  }
});

// Inicialização
initApp();
