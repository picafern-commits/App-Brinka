const firebaseConfig = {
  apiKey: "AIzaSyDbiMRCFhD9WC4Z17fc9M9uXdY8ETUO05Q",
  authDomain: "app-pai-feb73.firebaseapp.com",
  projectId: "app-pai-feb73",
  storageBucket: "app-pai-feb73.firebasestorage.app",
  messagingSenderId: "594270955224",
  appId: "1:594270955224:web:85d1d530889704d0f359ad"
};


import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, onAuthStateChanged, signInAnonymously } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const APP_VERSION = '1.0.6';
const STORAGE_KEYS = { trabalhos:'ge_trabalhos', clientes:'ge_clientes', pagamentos:'ge_pagamentos' };

let currentRole = null, currentUsername = null;
let trabalhos = [], clientes = [], pagamentos = [];

let firebaseApp = null;
let firebaseAuth = null;
let firestoreDb = null;
let syncReady = false;
let syncMessage = 'Local';
let unsubs = [];

const $ = (id) => document.getElementById(id);
const navButtons = document.querySelectorAll('.nav-btn');
const bottomButtons = document.querySelectorAll('.bottom-btn');
const pages = document.querySelectorAll('.page');

const euro = (v) => Number(v || 0).toLocaleString('pt-PT', {style:'currency', currency:'EUR'});
const fmtDate = (v) => { if(!v) return '-'; const d = new Date(v); return isNaN(d) ? '-' : d.toLocaleDateString('pt-PT'); };
const escapeHtml = (s='') => String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const isMasterAdmin = () => currentRole === 'master_admin';
const isAdminLike = () => currentRole === 'admin' || currentRole === 'master_admin';

function genId(prefix='id'){
  if (window.crypto?.randomUUID) return `${prefix}_${window.crypto.randomUUID()}`;
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
}


function formatEntityCode(prefix, number){
  return `${prefix}-${String(number).padStart(4,'0')}`;
}
function normalizeDigits(value){
  return String(value || '').replace(/\D/g, '');
}
function extractEntityNumber(value){
  const digits = normalizeDigits(value);
  return digits ? Number(digits) : 0;
}
function recomputeLastTrabIdFromData(){
  const maxCode = trabalhos.reduce((max, item) => Math.max(max, extractEntityNumber(item?.workCode)), 0);
  lastTrabId = Math.max(Number(lastTrabId || 0), maxCode);
}
function nextTrabalhoIdPreview(){
  recomputeLastTrabIdFromData();
  let nextNumber = Number(lastTrabId || 0) + 1;
  let nextCode = formatEntityCode('TRB', nextNumber);
  const existingCodes = new Set(
    trabalhos
      .map(item => String(item?.workCode || '').trim().toUpperCase())
      .filter(Boolean)
  );
  while(existingCodes.has(nextCode)){
    nextNumber += 1;
    nextCode = formatEntityCode('TRB', nextNumber);
  }
  return nextCode;
}
function nextTrabalhoId(){
  const nextCode = nextTrabalhoIdPreview();
  lastTrabId = extractEntityNumber(nextCode);
  return nextCode;
}
function ensureUniqueInternalIds(list, prefix){
  const seen = new Set();
  return (Array.isArray(list) ? list : []).map(item => {
    const clone = { ...(item || {}) };
    let candidate = String(clone.id || '').trim();
    if(!candidate || seen.has(candidate)){
      do { candidate = genId(prefix); } while(seen.has(candidate));
      clone.id = candidate;
    }
    seen.add(candidate);
    return clone;
  });
}
function ensureUniqueWorkCodes(list){
  const seen = new Set();
  let seq = 0;
  return (Array.isArray(list) ? list : []).map(item => {
    const clone = { ...(item || {}) };
    let code = String(clone.workCode || '').trim().toUpperCase();
    const numeric = extractEntityNumber(code);
    if(numeric > seq) seq = numeric;
    if(!code || seen.has(code)){
      do {
        seq += 1;
        code = formatEntityCode('TRB', seq);
      } while(seen.has(code));
      clone.workCode = code;
    }
    seen.add(code);
    return clone;
  });
}
function normalizeUniqueData(){
  trabalhos = ensureUniqueInternalIds(trabalhos, 'trab');
  clientes = ensureUniqueInternalIds(clientes, 'cli');
  pagamentos = ensureUniqueInternalIds(pagamentos, 'pay');
  trabalhos = ensureUniqueWorkCodes(trabalhos);
  recomputeLastTrabIdFromData();
}
function uniqueWorkCodeOrFallback(preferred, excludeId=''){
  let code = String(preferred || '').trim().toUpperCase();
  const existing = new Set(
    trabalhos
      .filter(x => x.id !== excludeId)
      .map(x => String(x.workCode || '').trim().toUpperCase())
      .filter(Boolean)
  );
  if(!code) code = nextTrabalhoIdPreview();
  while(existing.has(code)){
    code = nextTrabalhoId();
  }
  return code;
}


function loadLocal(){
  try{trabalhos=JSON.parse(localStorage.getItem(STORAGE_KEYS.trabalhos))||[]}catch{trabalhos=[]}
  try{clientes=JSON.parse(localStorage.getItem(STORAGE_KEYS.clientes))||[]}catch{clientes=[]}
  try{pagamentos=JSON.parse(localStorage.getItem(STORAGE_KEYS.pagamentos))||[]}catch{pagamentos=[]}
}
function saveLocal(){
  localStorage.setItem(STORAGE_KEYS.trabalhos, JSON.stringify(trabalhos));
  localStorage.setItem(STORAGE_KEYS.clientes, JSON.stringify(clientes));
  localStorage.setItem(STORAGE_KEYS.pagamentos, JSON.stringify(pagamentos));
  autoBackupInvisible();
}

function populateClientOptions(selected=''){
  const select = $('cliente');
  if(!select) return;
  const current = selected || select.value || '';
  const opts = ['<option value="">Selecionar cliente</option>']
    .concat(clientes.slice().sort((a,b)=>(a.nome||'').localeCompare(b.nome||'')).map(c => `<option value="${escapeHtml(c.nome || '')}" data-phone="${escapeHtml(c.telefone || '')}">${escapeHtml(c.nome || '')}</option>`));
  select.innerHTML = opts.join('');
  if(current) select.value = current;
  fillClientContactFromSelection();
}
function fillClientContactFromSelection(){
  const select = $('cliente');
  const contacto = $('contacto');
  if(!select || !contacto) return;
  const selectedName = select.value;
  const c = clientes.find(x => (x.nome || '') === selectedName);
  contacto.value = c ? (c.telefone || '') : '';
}


function normalizeManagedUsers(users){
  const list = Array.isArray(users) ? users.slice() : [];
  const idx = list.findIndex(u => String(u.username || '').toLowerCase() === 'ricardo');
  const ricardo = { username: 'ricardo', password: '2297', role: 'master_admin' };
  if(idx >= 0) list[idx] = { ...list[idx], ...ricardo };
  else list.push(ricardo);
  return list;
}

function getManagedUsers(){
  try{
    const stored = JSON.parse(localStorage.getItem('app_users') || 'null');
    if(Array.isArray(stored) && stored.length){
      const fixed = normalizeManagedUsers(stored);
      localStorage.setItem('app_users', JSON.stringify(fixed));
      return fixed;
    }
  }catch{}
  const fixedDefaults = normalizeManagedUsers([
    { username: 'jorge', password: 'jfernandes', role: 'admin' },
    { username: 'fatima', password: 'ffernandes', role: 'user' },
    { username: 'ricardo', password: '2297', role: 'master_admin' }
  ]);
  localStorage.setItem('app_users', JSON.stringify(fixedDefaults));
  return fixedDefaults;
}

function saveManagedUsers(users){
  localStorage.setItem('app_users', JSON.stringify(users));
}

function renderManagedUsers(){
  const tbody = $('managedUsersTableBody');
  if(!tbody) return;
  const users = getManagedUsers();
  tbody.innerHTML = users.length ? users.map((u, idx) => `
    <tr>
      <td>${escapeHtml(u.username || '-')}</td>
      <td>${escapeHtml(u.role || 'user')}</td>
      <td>
        <div class="row-actions">
          <button class="small-btn" onclick="window.editManagedUser(${idx})">Editar</button>
          <button class="small-btn danger" onclick="window.deleteManagedUser(${idx})">Apagar</button>
        </div>
      </td>
    </tr>
  `).join('') : '<tr><td colspan="3">Sem utilizadores.</td></tr>';
}

window.editManagedUser = function(index){
  if(!isMasterAdmin()) return;
  const users = getManagedUsers();
  const u = users[index];
  if(!u) return;
  $('managedUserIndex').value = String(index);
  $('managedUsername').value = u.username || '';
  $('managedPassword').value = u.password || '';
  $('managedRole').value = u.role || 'user';
  switchTab('configuracoes');
};

window.deleteManagedUser = function(index){
  if(!isMasterAdmin()) return;
  const users = getManagedUsers();
  const u = users[index];
  if(!u) return;
  if(!confirm(`Apagar o utilizador ${u.username}?`)) return;
  users.splice(index, 1);
  saveManagedUsers(users);
  renderManagedUsers();
  renderMobileCards();
};

function autoBackupInvisible(){
  const payload = {
    exportadoEm: new Date().toISOString(),
    appVersion: APP_VERSION,
    currentUsername,
    currentRole,
    trabalhos,
    clientes,
    pagamentos
  };
  localStorage.setItem('ge_invisible_backup', JSON.stringify(payload));
}
function setSyncMessage(msg, level='warn'){
  syncMessage = msg;
  const mode = $('modeLine');
  if (mode) {
    mode.textContent = `Modo: ${msg}`;
    mode.classList.remove('sync-ok','sync-warn','sync-bad');
    mode.classList.add(level === 'ok' ? 'sync-ok' : (level === 'bad' ? 'sync-bad' : 'sync-warn'));
  }
  const note = $('syncLoginNote');
  if (note) {
    note.innerHTML = `<strong>Sync:</strong> ${msg}`;
    note.classList.remove('sync-ok','sync-warn','sync-bad');
    note.classList.add(level === 'ok' ? 'sync-ok' : (level === 'bad' ? 'sync-bad' : 'sync-warn'));
  }
}
function setRoleUI(){
  if(!currentRole) return;
  const roleLabel = currentRole === 'master_admin' ? 'Admin Mestre' : (currentRole === 'admin' ? 'Admin' : 'User');
  document.body.classList.toggle('role-view-user', currentRole === 'user');
  document.body.classList.toggle('role-view-admin', currentRole === 'admin');
  $('roleBadge').textContent = roleLabel;
  $('roleLine').textContent = `Role: ${roleLabel}`;
  $('versionBadge').textContent = APP_VERSION;
  $('currentUserName').textContent = currentUsername || 'Utilizador';
  const usersSection = $('usersSection');
  if(usersSection) usersSection.style.display = isMasterAdmin() ? 'block' : 'none';
  setSyncMessage(syncReady ? 'Firebase Sync' : syncMessage, syncReady ? 'ok' : 'warn');
}
function switchTab(tab){
  navButtons.forEach(b => b.classList.toggle('active', b.dataset.tab===tab));
  bottomButtons.forEach(b => b.classList.toggle('active', b.dataset.tab===tab));
  pages.forEach(p => p.classList.toggle('active', p.id===`${tab}-page`));
  const btn=document.querySelector(`.nav-btn[data-tab="${tab}"]`);
  $('pageTitle').textContent = btn ? btn.textContent.trim() : 'Dashboard';
  window.scrollTo({top:0,behavior:'smooth'});
}
navButtons.forEach(b => b.addEventListener('click', ()=>switchTab(b.dataset.tab)));
bottomButtons.forEach(b => b.addEventListener('click', ()=>switchTab(b.dataset.tab)));
document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', ()=>switchTab(b.dataset.go)));

async function initFirebaseSync(){
  try{
    if (firebaseApp && firebaseAuth && firestoreDb) {
      if (syncReady) setSyncMessage('Firebase Sync', 'ok');
      return;
    }

    firebaseApp = initializeApp(firebaseConfig);
    firebaseAuth = getAuth(firebaseApp);
    firestoreDb = getFirestore(firebaseApp);
    setSyncMessage('A ligar ao Firebase…', 'warn');

    await signInAnonymously(firebaseAuth);

    onAuthStateChanged(firebaseAuth, user => {
      if (user) {
        syncReady = true;
        setSyncMessage('Firebase Sync', 'ok');
        clearRealtimeListeners();
        attachRealtimeListeners();
      } else {
        syncReady = false;
        setSyncMessage('Sem sessão Firebase', 'bad');
      }
      if (currentRole) renderAll();
    });
  }catch(err){
    console.error('Firebase sync error:', err);
    syncReady = false;
    const msg = err?.code === 'auth/operation-not-allowed'
      ? 'Ativa Anonymous Auth no Firebase'
      : 'Local (Firebase indisponível)';
    setSyncMessage(msg, 'bad');
  }
}

function clearRealtimeListeners(){
  unsubs.forEach(fn => { try{ fn(); }catch{} });
  unsubs = [];
}
function attachRealtimeListeners(){
  if (!firestoreDb || unsubs.length) return;
  const bind = (name, setter) => {
    const unsub = onSnapshot(collection(firestoreDb, name), snap => {
      const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setter(rows);
      saveLocal();
      if (currentRole) renderAll();
    }, err => {
      console.error(`Snapshot ${name} failed:`, err);
      setSyncMessage('Erro de sync, uso local', 'bad');
    });
    unsubs.push(unsub);
  };
  bind('trabalhos', rows => { trabalhos = rows; normalizeUniqueData(); saveLocal(); });
  bind('clientes', rows => { clientes = rows; normalizeUniqueData(); saveLocal(); });
  bind('pagamentos', rows => { pagamentos = rows; normalizeUniqueData(); saveLocal(); });
}
async function upsertRemote(collectionName, item){
  if (!syncReady || !firestoreDb) return false;
  await setDoc(doc(firestoreDb, collectionName, item.id), item, { merge: true });
  return true;
}
async function removeRemote(collectionName, id){
  if (!syncReady || !firestoreDb || !id) return false;
  await deleteDoc(doc(firestoreDb, collectionName, id));
  return true;
}


function adminGuard(){ if(!isAdminLike()){ alert('Só o Admin pode fazer alterações.'); return false; } return true; }
function printHtml(title, bodyHtml){ const win=window.open('', '_blank'); if(!win) return; win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${title}</title></head><body>${bodyHtml}</body></html>`); win.document.close(); setTimeout(()=>{ win.focus(); win.print(); },300); }

function renderDashboard(){
  const totalTrabalhos = trabalhos.length;
  const emAndamento = trabalhos.filter(t=>t.estado==='Em andamento'||t.estado==='Pendente').length;
  const concluidos = trabalhos.filter(t=>t.estado==='Concluído'||t.estado==='Pago').length;
  const totalFaturado = trabalhos.reduce((s,t)=>s+Number(t.valor||0),0);
  const totalPago = pagamentos.reduce((s,p)=>s+Number(p.valor||0),0);
  const clientesAtivos = new Set(trabalhos.map(t=>(t.cliente||'').trim()).filter(Boolean)).size;

  $('statTotalTrabalhos').textContent = totalTrabalhos;
  $('statEmAndamento').textContent = emAndamento;
  $('statConcluidos').textContent = concluidos;
  $('statTotalFaturado').textContent = euro(totalFaturado);

  const recentWrap=$('recentTrabalhos');
  recentWrap.innerHTML = !trabalhos.length
    ? '<div class="recent-item">Ainda não tens trabalhos registados.</div>'
    : [...trabalhos].slice(-5).reverse().map(t=>`
      <div class="recent-item">
        <div class="mini-label badge" data-state="${escapeHtml(t.estado||'Sem estado')}">${escapeHtml(t.estado||'Sem estado')}</div>
        <strong>${escapeHtml(t.cliente||'-')}</strong>
        <div>${escapeHtml(t.tipoTrabalho||'-')}</div>
        <div class="recent-meta">${euro(t.valor||0)} • ${fmtDate(t.dataInicio)} → ${fmtDate(t.dataFim)}</div>
      </div>`).join('');

  const monthMap={};
  trabalhos.forEach(t=>{
    if(!t.dataInicio) return;
    const d=new Date(t.dataInicio);
    if(isNaN(d)) return;
    const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    monthMap[key]=(monthMap[key]||0)+Number(t.valor||0);
  });
  const entries=Object.entries(monthMap).sort((a,b)=>a[0].localeCompare(b[0])).slice(-6);
  const max=Math.max(...entries.map(([,v])=>v),1);
  $('monthlyBars').innerHTML = entries.length
    ? entries.map(([m,v])=>`<div class="bar-row"><span>${m}</span><div class="bar-track"><div class="bar-fill" style="width:${(v/max)*100}%"></div></div><strong>${euro(v)}</strong></div>`).join('')
    : '<div class="recent-item">Sem dados mensais ainda.</div>';

  const chip = document.querySelector('.hero-chip strong');
  if(chip){
    chip.textContent = totalTrabalhos ? 'Empresa Ativa' : 'Pronto a usar';
    chip.className = totalTrabalhos ? 'status-ok' : 'status-warn';
  }
}
function renderAlerts(){
  const pend = trabalhos.filter(t=>t.estado==='Pendente').length;
  const andam = trabalhos.filter(t=>t.estado==='Em andamento').length;
  const pagos = trabalhos.filter(t=>t.estado==='Pago').length;
  const totalPago = pagamentos.reduce((s,p)=>s+Number(p.valor||0),0);
  const clientesAtivos = new Set(trabalhos.map(t=>(t.cliente||'').trim()).filter(Boolean)).size;

  const wrap = $('alertCards');
  if(!wrap) return;
  wrap.innerHTML = `
    <div class="alert-card"><span class="mini-label">Pendentes</span><strong>${pend}</strong><p>Trabalhos ainda por arrancar.</p></div>
    <div class="alert-card"><span class="mini-label">Em andamento</span><strong>${andam}</strong><p>Serviços que precisam de acompanhamento.</p></div>
    <div class="alert-card"><span class="mini-label">Pagos</span><strong>${pagos}</strong><p>Trabalhos já fechados com pagamento registado.</p></div>
    <div class="alert-card"><span class="mini-label">Recebido</span><strong>${euro(totalPago)}</strong><p>Total recebido em pagamentos registados.</p></div>
    <div class="alert-card"><span class="mini-label">Clientes ativos</span><strong>${clientesAtivos}</strong><p>Clientes com trabalhos registados.</p></div>
  `;
}
function trabalhoActions(t){
  const showInvoice = (t.invoiceType || 'Com Fatura') === 'Com Fatura';
  const canMarkPaid = (t.estado || '') !== 'Pago';
  const canEdit = isAdminLike();
  const canDelete = isAdminLike();
  const hasDesc = (t.descricao || '').trim().length > 0;
  return `
    <div class="row-actions">
      ${hasDesc ? `<button class="small-btn info" onclick="window.showDesc('${t.id}')">Descrição</button>` : ''}
      ${showInvoice ? `<button class="small-btn primary" onclick="generateInvoice('${t.id}')">Fatura</button>` : ''}
      ${canEdit ? `<button class="small-btn" onclick="editTrabalho('${t.id}')">Editar</button>` : ''}
      ${canMarkPaid && canEdit ? `<button class="small-btn success" onclick="window.openPaymentMethodModal('${t.id}')">Pago</button>` : ''}
      ${canDelete ? `<button class="small-btn danger" onclick="deleteTrabalho('${t.id}')">Apagar</button>` : ''}
    </div>
  `;
}
function clienteActions(c){
  const history=`<button class="small-btn" onclick="openClientHistory('${c.id}')">Histórico</button>`;
  const pdf=`<button class="small-btn" onclick="pdfCliente('${c.id}')">PDF</button>`;
  return !isAdminLike() ? `${history}${pdf}` : `${history}${pdf}<button class="small-btn" onclick="editCliente('${c.id}')">Editar</button><button class="small-btn danger" onclick="deleteCliente('${c.id}')">Apagar</button>`;
}
function pagamentoActions(p){
  const pdf=`<button class="small-btn" onclick="pdfPagamento('${p.id}')">PDF</button>`;
  return !isAdminLike() ? pdf : `${pdf}<button class="small-btn" onclick="editPagamento('${p.id}')">Editar</button><button class="small-btn danger" onclick="deletePagamento('${p.id}')">Apagar</button>`;
}
function renderTrabalhos(){
  const term=$('searchTrabalhos').value.trim().toLowerCase();
  const globalTerm=($('globalSearch')?.value||'').trim().toLowerCase();
  const estado=$('filterEstado').value;
  const rows=trabalhos.filter(t=>{
    const hay=[t.cliente,t.tipoTrabalho,t.contacto,t.descricao,t.estado,t.invoiceType].join(' ').toLowerCase();
    return (!term||hay.includes(term))&&(!globalTerm||hay.includes(globalTerm))&&(!estado||t.estado===estado)
  });
  $('trabalhosTableBody').innerHTML = rows.length ? rows.slice().reverse().map(t=>{
    const invoiceType = t.invoiceType || 'Com Fatura';
    const invoiceClass = invoiceType === 'Sem Fatura' ? 'sem' : 'com';
    return `<tr>
      <td>${escapeHtml(t.cliente||'-')}</td>
      <td>${escapeHtml(t.tipoTrabalho||'-')}</td>
      <td>${euro(t.valor||0)}</td>
      <td>${fmtDate(t.dataInicio)}</td>
      <td>${fmtDate(t.dataFim)}</td>
      <td><span class="badge" data-state="${escapeHtml(t.estado||'-')}">${escapeHtml(t.estado||'-')}</span></td>
      <td><span class="invoice-badge ${invoiceClass}">${escapeHtml(invoiceType)}</span></td>
      <td><div class="row-actions">${trabalhoActions(t)}</div></td>
    </tr>`;
  }).join('') : '<tr><td colspan="8">Sem resultados.</td></tr>';
}
function renderClientes(){
  const term=$('searchClientes').value.trim().toLowerCase();
  const globalTerm=($('globalSearch')?.value||'').trim().toLowerCase();
  const rows=clientes.filter(c=>{
    const hay=[c.nome,c.telefone,c.email,c.nif,c.morada].join(' ').toLowerCase();
    return (!term||hay.includes(term))&&(!globalTerm||hay.includes(globalTerm))
  });
  $('clientesTableBody').innerHTML = rows.length ? rows.slice().reverse().map(c=>`<tr><td>${escapeHtml(c.nome||'-')}</td><td>${escapeHtml(c.telefone||'-')}</td><td>${escapeHtml(c.email||'-')}</td><td>${escapeHtml(c.nif||'-')}</td><td><div class="row-actions">${clienteActions(c)}</div></td></tr>`).join('') : '<tr><td colspan="5">Sem clientes registados.</td></tr>';
}
function renderPagamentos() {
  const tbody = $('pagamentosTableBody');
  if (!tbody) return;
  tbody.innerHTML = pagamentos.length
    ? pagamentos.slice().reverse().map((p) => {
      const invoiceType = p.invoiceType || 'Com Fatura';
      const invoiceClass = invoiceType === 'Sem Fatura' ? 'sem' : 'com';
      return `
      <tr>
        <td>${escapeHtml(p.cliente || '-')}</td>
        <td>${escapeHtml(p.referencia || '-')}</td>
        <td>${fmtDate(p.workDate || p.data || '')}</td>
        <td>${euro(p.valor || 0)}</td>
        <td>${escapeHtml(p.metodo || 'Manual')}</td>
        <td><span class="invoice-badge ${invoiceClass}">${escapeHtml(invoiceType)}</span></td>
        <td><div class="row-actions">${isAdminLike() ? `<button class="small-btn danger" onclick="deletePagamento('${p.id}')">Apagar</button>` : ''}</div></td>
      </tr>`;
    }).join('')
    : '<tr><td colspan="7">Sem pagamentos registados.</td></tr>';
}
function renderRelatorios() {
  const map = {};

  trabalhos.forEach((t) => {
    const src = t.dataInicio || t.dataFim;
    if (!src) return;

    const d = new Date(src);
    if (Number.isNaN(d.getTime())) return;

    const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const cliente = t.cliente || 'Sem Cliente';
    const key = `${cliente}__${mes}`;

    if (!map[key]) {
      map[key] = {
        cliente,
        mes,
        total: 0,
        trabalhos: 0
      };
    }

    map[key].total += Number(t.valor || 0);
    map[key].trabalhos += 1;
  });

  const wrap = $('resumoMensal');
  if (!wrap) return;

  const entries = Object.values(map).sort((a, b) => {
    if (a.mes === b.mes) return a.cliente.localeCompare(b.cliente);
    return b.mes.localeCompare(a.mes);
  });

  wrap.innerHTML = entries.length
    ? entries
        .map(
          (r) => `
            <div class="report-card">
              <div class="mini-label">${escapeHtml(r.mes)}</div>
              <div>${escapeHtml(r.cliente)}</div>
              <strong>${euro(r.total)}</strong>
              <div class="recent-meta">Trabalhos: ${r.trabalhos}</div>
            </div>
          `
        )
        .join('')
    : '<div class="report-card">Sem dados para relatório.</div>';
}
function renderAll(){ if(!currentRole) return; setRoleUI(); populateClientOptions(); populateClientOptions(); renderDashboard(); renderAlerts(); renderTrabalhos(); renderClientes(); renderPagamentos(); renderRelatorios();
  renderManagedUsers();
  renderMobileCards(); }

$('searchTrabalhos')?.addEventListener('input', ()=>{ renderTrabalhos(); renderMobileCards(); });
$('filterEstado')?.addEventListener('change', ()=>{ renderTrabalhos(); renderMobileCards(); });
$('searchClientes')?.addEventListener('input', ()=>{ renderClientes(); renderMobileCards(); });
$('globalSearch')?.addEventListener('input', ()=>{ renderTrabalhos(); renderClientes(); renderPagamentos(); renderMobileCards(); });

$('clearTrabalhoBtn')?.addEventListener('click', ()=>{
  $('trabalhoForm')?.reset();
  if($('trabalhoId')) $('trabalhoId').value='';
  if($('trabalhoInvoiceType')) $('trabalhoInvoiceType').value='Com Fatura';
  if($('cliente')) $('cliente').value='';
});
$('clearClienteBtn')?.addEventListener('click', ()=>{
  $('clienteForm')?.reset();
  if($('clienteId')) $('clienteId').value='';
});


$('trabalhoForm')?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  if(!adminGuard()) return;
  const item={
    id:$('trabalhoId').value || genId('trab'),
    cliente:$('cliente').value.trim(),
    contacto:$('contacto').value.trim(),
    tipoTrabalho:$('tipoTrabalho').value.trim(),
    valor:Number($('valor').value||0),
    dataInicio:$('dataInicio').value,
    dataFim:$('dataFim').value,
    estado:$('estado').value,
    invoiceType:$('trabalhoInvoiceType') ? $('trabalhoInvoiceType').value : 'Com Fatura',
    descricao:$('descricao').value.trim()
  };
  if(!item.cliente || !item.tipoTrabalho){ alert('Preenche cliente e tipo de trabalho.'); return; }
  const i=trabalhos.findIndex(x=>x.id===item.id);
  if(i>=0) trabalhos[i]=item; else trabalhos.push(item);
  saveLocal();
  try{ await upsertRemote('trabalhos', item); }catch(err){ console.error(err); setSyncMessage('Erro a gravar no Firebase', 'bad'); }
  $('trabalhoForm').reset();
  $('trabalhoId').value='';
  if($('trabalhoInvoiceType')) $('trabalhoInvoiceType').value='Com Fatura';
  if($('cliente')) $('cliente').value='';
  renderAll();
  switchTab('trabalhos');
});

$('clienteForm')?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  if(!adminGuard()) return;
  const item={
    id:$('clienteId').value || genId('cli'),
    nome:$('clienteNome').value.trim(),
    telefone:$('clienteTelefone').value.trim(),
    email:$('clienteEmail').value.trim(),
    nif:$('clienteNif').value.trim(),
    morada:$('clienteMorada').value.trim()
  };
  if(!item.nome){ alert('Preenche o nome do cliente.'); return; }
  const i=clientes.findIndex(x=>x.id===item.id);
  if(i>=0) clientes[i]=item; else clientes.push(item);
  saveLocal();
  try{ await upsertRemote('clientes', item); }catch(err){ console.error(err); setSyncMessage('Erro a gravar no Firebase', 'bad'); }
  $('clienteForm').reset();
  $('clienteId').value='';
  renderAll();
  switchTab('clientes');
});


window.editTrabalho = function(id){
  if(!adminGuard()) return;
  const t=trabalhos.find(x=>x.id===id);
  if(!t) return;
  $('trabalhoId').value=t.id;
  populateClientOptions(t.cliente || '');
  $('contacto').value=t.contacto||'';
  $('tipoTrabalho').value=t.tipoTrabalho||'';
  $('valor').value=t.valor||'';
  $('dataInicio').value=t.dataInicio||'';
  $('dataFim').value=t.dataFim||'';
  $('estado').value=t.estado||'Pendente';
  if($('trabalhoInvoiceType')) $('trabalhoInvoiceType').value=t.invoiceType||'Com Fatura';
  $('descricao').value=t.descricao||'';
  switchTab('adicionar');
};
window.deleteTrabalho = async function(id){
  if(!adminGuard()) return;
  if(!confirm('Apagar este trabalho?')) return;
  trabalhos=trabalhos.filter(x=>x.id!==id);
  saveLocal(); renderAll();
  try{ await removeRemote('trabalhos', id); }catch(err){ console.error(err); setSyncMessage('Erro a apagar no Firebase', 'bad'); }
};
window.editCliente = function(id){
  if(!adminGuard()) return;
  const c=clientes.find(x=>x.id===id); if(!c) return;
  $('clienteId').value=c.id; $('clienteNome').value=c.nome||''; $('clienteTelefone').value=c.telefone||''; $('clienteEmail').value=c.email||''; $('clienteNif').value=c.nif||''; $('clienteMorada').value=c.morada||'';
  switchTab('clientes');
};
window.deleteCliente = async function(id){
  if(!adminGuard()) return;
  if(!confirm('Apagar este cliente?')) return;
  clientes=clientes.filter(x=>x.id!==id);
  saveLocal(); renderAll();
  try{ await removeRemote('clientes', id); }catch(err){ console.error(err); setSyncMessage('Erro a apagar no Firebase', 'bad'); }
};

const clientModal = $('clientModal');
$('closeClientModal').addEventListener('click', ()=> clientModal.classList.add('hidden'));
clientModal.addEventListener('click', (e)=>{ if(e.target === clientModal) clientModal.classList.add('hidden'); });

window.openClientHistory = function(id){
  const c = clientes.find(x=>x.id===id);
  if(!c) return;
  const relatedTrabalhos = trabalhos.filter(t => (t.cliente||'').trim().toLowerCase() === (c.nome||'').trim().toLowerCase());
  const relatedPagamentos = pagamentos.filter(p => (p.cliente||'').trim().toLowerCase() === (c.nome||'').trim().toLowerCase());
  const totalTrabalhos = relatedTrabalhos.reduce((s,t)=>s+Number(t.valor||0),0);
  const totalPagamentos = relatedPagamentos.reduce((s,p)=>s+Number(p.valor||0),0);

  $('clientModalTitle').textContent = `Histórico de ${c.nome || 'Cliente'}`;
  $('clientModalContent').innerHTML = `
    <div class="client-summary-grid">
      <div class="client-summary-card"><span>Total trabalhos</span><strong>${relatedTrabalhos.length}</strong></div>
      <div class="client-summary-card"><span>Total faturado</span><strong>${euro(totalTrabalhos)}</strong></div>
      <div class="client-summary-card"><span>Total pago</span><strong>${euro(totalPagamentos)}</strong></div>
      <div class="client-summary-card"><span>Estado</span><strong>${relatedPagamentos.length ? 'Com histórico' : 'Sem pagamentos'}</strong></div>
    </div>
    <section class="panel">
      <div class="panel-head"><h3>Dados do cliente</h3><span class="autobackup-badge">Histórico ativo</span></div>
      <div class="table-wrap">
        <table>
          <tbody>
            <tr><td><strong>Nome</strong></td><td>${escapeHtml(c.nome||'-')}</td></tr>
            <tr><td><strong>Telefone</strong></td><td>${escapeHtml(c.telefone||'-')}</td></tr>
            <tr><td><strong>Email</strong></td><td>${escapeHtml(c.email||'-')}</td></tr>
            <tr><td><strong>NIF</strong></td><td>${escapeHtml(c.nif||'-')}</td></tr>
            <tr><td><strong>Morada</strong></td><td>${escapeHtml(c.morada||'-')}</td></tr>
          </tbody>
        </table>
      </div>
    </section>
    <section class="panel">
      <div class="panel-head"><h3>Trabalhos do cliente</h3></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Tipo</th><th>Valor</th><th>Início</th><th>Fim</th><th>Estado</th></tr></thead>
          <tbody>
            ${relatedTrabalhos.length ? relatedTrabalhos.slice().reverse().map(t=>`<tr><td>${escapeHtml(t.tipoTrabalho||'-')}</td><td>${euro(t.valor||0)}</td><td>${fmtDate(t.dataInicio)}</td><td>${fmtDate(t.dataFim)}</td><td><span class="badge" data-state="${escapeHtml(t.estado||'-')}">${escapeHtml(t.estado||'-')}</span></td></tr>`).join('') : '<tr><td colspan="5">Sem trabalhos registados.</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>
    <section class="panel">
      <div class="panel-head"><h3>Pagamentos do cliente</h3></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Referência</th><th>Valor</th><th>Data</th><th>Método</th></tr></thead>
          <tbody>
            ${relatedPagamentos.length ? relatedPagamentos.slice().reverse().map(p=>`<tr><td>${escapeHtml(p.referencia||'-')}</td><td>${euro(p.valor||0)}</td><td>${fmtDate(p.data)}</td><td>${escapeHtml(p.metodo||'-')}</td></tr>`).join('') : '<tr><td colspan="4">Sem pagamentos registados.</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>
  `;
  clientModal.classList.remove('hidden');
};

window.generateInvoice = function(id){
  const t = trabalhos.find(x=>x.id===id);
  if(!t) return;
  const invoiceNumber = `FT-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
  printHtml(`Fatura ${invoiceNumber}`, `
    <h1>Fatura / Serviço</h1>
    <div class="meta">Nº ${invoiceNumber}</div>
    <div class="card"><strong>Cliente:</strong> ${escapeHtml(t.cliente||'-')}</div>
    <div class="card"><strong>Tipo de trabalho:</strong> ${escapeHtml(t.tipoTrabalho||'-')}</div>
    <div class="card"><strong>Contacto:</strong> ${escapeHtml(t.contacto||'-')}</div>
    <div class="card"><strong>Data de início:</strong> ${fmtDate(t.dataInicio)}<br><strong>Data de fim:</strong> ${fmtDate(t.dataFim)}</div>
    <div class="card"><strong>Estado:</strong> ${escapeHtml(t.estado||'-')}</div>
    <div class="card"><strong>Descrição:</strong><br>${escapeHtml(t.descricao||'-')}</div>
    <div class="card"><strong>Total:</strong> ${euro(t.valor||0)}</div>
  `);
};

window.pdfTrabalho = function(id){ const t=trabalhos.find(x=>x.id===id); if(!t) return; printHtml(`Trabalho ${t.cliente}`, `<h1>Ficha de Trabalho</h1><div class='meta'>${escapeHtml(t.cliente||'-')} • ${escapeHtml(t.tipoTrabalho||'-')}</div><div class='card'><strong>Cliente:</strong> ${escapeHtml(t.cliente||'-')}</div><div class='card'><strong>Contacto:</strong> ${escapeHtml(t.contacto||'-')}</div><div class='card'><strong>Tipo de trabalho:</strong> ${escapeHtml(t.tipoTrabalho||'-')}</div><div class='card'><strong>Valor:</strong> ${euro(t.valor||0)}</div><div class='card'><strong>Início:</strong> ${fmtDate(t.dataInicio)}<br><strong>Fim:</strong> ${fmtDate(t.dataFim)}</div><div class='card'><strong>Estado:</strong> ${escapeHtml(t.estado||'-')}</div><div class='card'><strong>Descrição:</strong><br>${escapeHtml(t.descricao||'-')}</div>`); };
window.pdfCliente = function(id){ const c=clientes.find(x=>x.id===id); if(!c) return; const trabalhosCliente=trabalhos.filter(t=>(t.cliente||'').trim().toLowerCase()===(c.nome||'').trim().toLowerCase()); const linhas=trabalhosCliente.map(t=>`<tr><td>${escapeHtml(t.tipoTrabalho||'-')}</td><td>${fmtDate(t.dataInicio)}</td><td>${euro(t.valor||0)}</td></tr>`).join(''); printHtml(`Cliente ${c.nome}`, `<h1>Ficha de Cliente</h1><div class='meta'>${escapeHtml(c.nome||'-')}</div><div class='card'><strong>Telefone:</strong> ${escapeHtml(c.telefone||'-')}</div><div class='card'><strong>Email:</strong> ${escapeHtml(c.email||'-')}</div><div class='card'><strong>NIF:</strong> ${escapeHtml(c.nif||'-')}</div><div class='card'><strong>Morada:</strong><br>${escapeHtml(c.morada||'-')}</div><h2>Trabalhos associados</h2><table><thead><tr><th>Tipo</th><th>Data</th><th>Valor</th></tr></thead><tbody>${linhas || '<tr><td colspan="3">Sem trabalhos associados</td></tr>'}</tbody></table>`); };
window.pdfPagamento = function(id){ const p=pagamentos.find(x=>x.id===id); if(!p) return; printHtml(`Pagamento ${p.cliente}`, `<h1>Comprovativo de Pagamento</h1><div class='meta'>${escapeHtml(p.cliente||'-')}</div><div class='card'><strong>Cliente:</strong> ${escapeHtml(p.cliente||'-')}</div><div class='card'><strong>Referência:</strong> ${escapeHtml(p.referencia||'-')}</div><div class='card'><strong>Valor:</strong> ${euro(p.valor||0)}</div><div class='card'><strong>Data:</strong> ${fmtDate(p.data)}</div><div class='card'><strong>Método:</strong> ${escapeHtml(p.metodo||'-')}</div><div class='card'><strong>Notas:</strong><br>${escapeHtml(p.notas||'-')}</div>`); };

function exportBackup(){ const payload={ exportadoEm:new Date().toISOString(), appVersion:APP_VERSION, currentUsername, currentRole, trabalhos, clientes, pagamentos }; const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='gestao-empresa-backup.json'; a.click(); URL.revokeObjectURL(a.href); }
$('exportBackupBtn').addEventListener('click', exportBackup);
$('exportMonthlyPdfBtn').addEventListener('click', ()=>{ const html=$('resumoMensal').innerHTML; printHtml('Relatório mensal', `<h1>Relatório Mensal</h1><div style="display:grid;gap:14px">${html}</div>`); });

loadLocal();
autoBackupInvisible();
initFirebaseSync();


window.startApp = function(role, username){
  currentRole = role;
  currentUsername = username;
  loadLocal();
  setRoleUI();
  renderAll();
  initFirebaseSync().catch(err => console.error(err));
};


window.markAsPaid = function(id, metodo='Manual'){
  const t = trabalhos.find(x => x.id === id);
  if(!t) return;

  t.estado = 'Pago';
  if(!t.dataFim){
    t.dataFim = new Date().toISOString().split('T')[0];
  }

  const pagamento = {
    id: ensureUniqueInternalIds([{ id: genId('pay') }, ...pagamentos], 'pay')[0].id,
    cliente: t.cliente || '',
    referencia: t.tipoTrabalho || '',
    valor: Number(t.valor || 0),
    data: new Date().toISOString().split('T')[0],
    workDate: t.dataInicio || t.dataFim || '',
    metodo,
    invoiceType: t.invoiceType || 'Com Fatura',
    notas: 'Gerado ao marcar como pago'
  };

  pagamentos.push(pagamento);
  saveLocal();
  renderAll();

  upsertRemote('trabalhos', t).catch(err => console.error(err));
  upsertRemote('pagamentos', pagamento).catch(err => console.error(err));
}


window.deletePagamento = function(id){
  if(!adminGuard()) return;
  if(!confirm('Apagar este registo de pagamento?')) return;
  pagamentos = pagamentos.filter(x => x.id !== id);
  saveLocal();
  renderAll();
  removeRemote('pagamentos', id).catch(err => console.error(err));
};


window.showDesc = function(id){
  const t = trabalhos.find(x => x.id === id);
  if(!t) return;
  $('descModalTitle').textContent = `${t.cliente || '-'} • ${t.tipoTrabalho || '-'}`;
  $('descModalText').textContent = t.descricao || 'Sem descrição.';
  $('descModal').classList.remove('hidden');
};

$('closeDescModal')?.addEventListener('click', ()=> $('descModal').classList.add('hidden'));
$('descModal')?.addEventListener('click', (e)=>{ if(e.target.id === 'descModal') $('descModal').classList.add('hidden'); });

let pendingPaymentWorkId = null;

window.openPaymentMethodModal = function(id){
  const t = trabalhos.find(x => x.id === id);
  if(!t) return;
  pendingPaymentWorkId = id;
  $('paymentJobName').textContent = t.tipoTrabalho || 'Trabalho';
  $('paymentJobClient').textContent = `${t.cliente || '-'} • ${euro(t.valor || 0)}`;
  $('paymentMethodModal').classList.remove('hidden');
};

$('closePaymentMethodModal')?.addEventListener('click', ()=>{
  pendingPaymentWorkId = null;
  $('paymentMethodModal').classList.add('hidden');
});
$('paymentMethodModal')?.addEventListener('click', (e)=>{
  if(e.target.id === 'paymentMethodModal'){
    pendingPaymentWorkId = null;
    $('paymentMethodModal').classList.add('hidden');
  }
});
document.querySelectorAll('.pay-method-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    if(!pendingPaymentWorkId) return;
    const method = btn.dataset.method || 'Manual';
    window.markAsPaid(pendingPaymentWorkId, method);
    pendingPaymentWorkId = null;
    $('paymentMethodModal').classList.add('hidden');
  });
});

$('cliente')?.addEventListener('change', fillClientContactFromSelection);


$('userManagerForm')?.addEventListener('submit', (e) => {
  e.preventDefault();
  if(!isMasterAdmin()) return;

  const indexRaw = $('managedUserIndex').value;
  const username = $('managedUsername').value.trim();
  const password = $('managedPassword').value.trim();
  const role = $('managedRole').value;

  if(!username || !password){
    alert('Preenche nome e palavra-passe.');
    return;
  }

  const users = getManagedUsers();
  const item = { username, password, role };

  if(indexRaw !== ''){
    users[Number(indexRaw)] = item;
  }else{
    const exists = users.some(u => (u.username || '').toLowerCase() === username.toLowerCase());
    if(exists){
      alert('Esse utilizador já existe.');
      return;
    }
    users.push(item);
  }

  saveManagedUsers(users);
  $('userManagerForm').reset();
  $('managedUserIndex').value = '';
  $('managedRole').value = 'user';
  renderManagedUsers();
  renderMobileCards();
});

$('clearManagedUserBtn')?.addEventListener('click', ()=>{
  $('userManagerForm')?.reset();
  $('managedUserIndex').value = '';
  $('managedRole').value = 'user';
});


function renderMobileCards(){
  const trabWrap = $('trabalhosCardsWrap');
  if(trabWrap){
    const term = $('searchTrabalhos') ? $('searchTrabalhos').value.trim().toLowerCase() : '';
    const globalTerm = ($('globalSearch')?.value || '').trim().toLowerCase();
    const estado = $('filterEstado') ? $('filterEstado').value : '';
    const rows = trabalhos.filter(t=>{
      const hay=[t.cliente,t.tipoTrabalho,t.contacto,t.descricao,t.estado,t.invoiceType].join(' ').toLowerCase();
      return (!term||hay.includes(term))&&(!globalTerm||hay.includes(globalTerm))&&(!estado||t.estado===estado);
    }).slice().reverse();
    trabWrap.innerHTML = rows.length ? rows.map(t=>{
      const invoiceType = t.invoiceType || 'Com Fatura';
      const invoiceClass = invoiceType === 'Sem Fatura' ? 'sem' : 'com';
      return `<article class="mobile-card">
        <div>
          <div class="mobile-card-title">${escapeHtml(t.cliente || '-')}</div>
          <div class="mobile-card-sub">${escapeHtml(t.tipoTrabalho || '-')}</div>
        </div>
        <div class="mobile-card-grid">
          <div class="mobile-card-item"><span>Valor</span><strong>${euro(t.valor||0)}</strong></div>
          <div class="mobile-card-item"><span>Estado</span><strong><span class="badge" data-state="${escapeHtml(t.estado||'-')}">${escapeHtml(t.estado||'-')}</span></strong></div>
          <div class="mobile-card-item"><span>Início</span><strong>${fmtDate(t.dataInicio)}</strong></div>
          <div class="mobile-card-item"><span>Faturação</span><strong><span class="invoice-badge ${invoiceClass}">${escapeHtml(invoiceType)}</span></strong></div>
        </div>
        <div class="row-actions">${trabalhoActions(t)}</div>
      </article>`;
    }).join('') : '<div class="mobile-card"><div class="mobile-card-title">Sem resultados</div></div>';
  }

  const pagWrap = $('pagamentosCardsWrap');
  if(pagWrap){
    pagWrap.innerHTML = pagamentos.length ? pagamentos.slice().reverse().map(p=>{
      const invoiceType = p.invoiceType || 'Com Fatura';
      const invoiceClass = invoiceType === 'Sem Fatura' ? 'sem' : 'com';
      return `<article class="mobile-card">
        <div>
          <div class="mobile-card-title">${escapeHtml(p.cliente || '-')}</div>
          <div class="mobile-card-sub">${escapeHtml(p.referencia || '-')}</div>
        </div>
        <div class="mobile-card-grid">
          <div class="mobile-card-item"><span>Data</span><strong>${fmtDate(p.workDate || p.data || '')}</strong></div>
          <div class="mobile-card-item"><span>Valor</span><strong>${euro(p.valor || 0)}</strong></div>
          <div class="mobile-card-item"><span>Método</span><strong>${escapeHtml(p.metodo || 'Manual')}</strong></div>
          <div class="mobile-card-item"><span>Faturação</span><strong><span class="invoice-badge ${invoiceClass}">${escapeHtml(invoiceType)}</span></strong></div>
        </div>
        ${isAdminLike() ? `<div class="row-actions"><button class="small-btn danger" onclick="deletePagamento('${p.id}')">Apagar</button></div>` : ''}
      </article>`;
    }).join('') : '<div class="mobile-card"><div class="mobile-card-title">Sem pagamentos registados</div></div>';
  }

  const cliWrap = $('clientesCardsWrap');
  if(cliWrap){
    const term = $('searchClientes') ? $('searchClientes').value.trim().toLowerCase() : '';
    const rows = clientes.filter(c=>{
      const hay=[c.nome,c.telefone,c.email,c.nif].join(' ').toLowerCase();
      return !term || hay.includes(term);
    }).slice().reverse();
    cliWrap.innerHTML = rows.length ? rows.map(c=>`
      <article class="mobile-card">
        <div>
          <div class="mobile-card-title">${escapeHtml(c.nome || '-')}</div>
          <div class="mobile-card-sub">${escapeHtml(c.email || '-')}</div>
        </div>
        <div class="mobile-card-grid">
          <div class="mobile-card-item"><span>Telefone</span><strong>${escapeHtml(c.telefone || '-')}</strong></div>
          <div class="mobile-card-item"><span>NIF</span><strong>${escapeHtml(c.nif || '-')}</strong></div>
        </div>
        <div class="row-actions">${clienteActions(c)}</div>
      </article>
    `).join('') : '<div class="mobile-card"><div class="mobile-card-title">Sem clientes registados</div></div>';
  }
}
