const DEFAULT_USERS = [
  { username: 'jorge', password: 'jfernandes', role: 'admin' },
  { username: 'fatima', password: 'ffernandes', role: 'user' },
  { username: 'ricardo', password: '2297', role: 'master_admin' }
];

function normalizeUsers(users){
  const list = Array.isArray(users) ? users.slice() : [];
  const idx = list.findIndex(u => String(u.username || '').toLowerCase() === 'ricardo');
  const ricardo = { username: 'ricardo', password: '2297', role: 'master_admin' };
  if(idx >= 0) list[idx] = { ...list[idx], ...ricardo };
  else list.push(ricardo);
  return list;
}

function getUsers(){
  try{
    const stored = JSON.parse(localStorage.getItem('app_users') || 'null');
    if(Array.isArray(stored) && stored.length){
      const fixed = normalizeUsers(stored);
      localStorage.setItem('app_users', JSON.stringify(fixed));
      return fixed;
    }
  }catch{}
  const fixedDefaults = normalizeUsers(DEFAULT_USERS);
  localStorage.setItem('app_users', JSON.stringify(fixedDefaults));
  return fixedDefaults;
}

const loginForm = document.getElementById('loginForm');

function ensureDefaultUsers(){
  try{
    const fixedDefaults = normalizeUsers(DEFAULT_USERS);
    const stored = JSON.parse(localStorage.getItem('app_users') || 'null');
    if(!Array.isArray(stored) || !stored.length){
      localStorage.setItem('app_users', JSON.stringify(fixedDefaults));
      return fixedDefaults;
    }
    const fixed = normalizeUsers(stored);
    localStorage.setItem('app_users', JSON.stringify(fixed));
    return fixed;
  }catch{
    const fixedDefaults = normalizeUsers(DEFAULT_USERS);
    localStorage.setItem('app_users', JSON.stringify(fixedDefaults));
    return fixedDefaults;
  }
}

function saveSession(role, username){
  localStorage.setItem('app_session', JSON.stringify({ role, username }));
}

function readSession(){
  try{ return JSON.parse(localStorage.getItem('app_session') || 'null'); }catch(e){ return null; }
}

function clearSession(){
  localStorage.removeItem('app_session');
  localStorage.removeItem('app_session_tablet_teste');
}

function showApp(){
  document.getElementById('loginScreen')?.classList.add('hidden');
  document.getElementById('appRoot')?.classList.remove('hidden');
}

function showLogin(){
  document.getElementById('loginScreen')?.classList.remove('hidden');
  document.getElementById('appRoot')?.classList.add('hidden');
}

function safeStartApp(role, username){
  if(typeof window.startApp === 'function'){
    window.startApp(role, username);
    return true;
  }
  console.warn('startApp ainda não está disponível.');
  return false;
}

function bootFromSession(){
  const session = readSession();
  if(!session) return false;
  showApp();
  safeStartApp(session.role, session.username);
  return true;
}

loginForm?.addEventListener('submit', (e) => {
  e.preventDefault();

  const username = document.getElementById('loginUsername')?.value.trim().toLowerCase();
  const password = document.getElementById('loginPassword')?.value || '';
  const users = ensureDefaultUsers();

  const found = users.find(
    u => String(u.username || '').toLowerCase() === username && String(u.password || '') === password
  ) || (username === 'ricardo' && password === '2297' ? { username:'ricardo', role:'master_admin' } : null);

  if (!found) {
    document.getElementById('loginError').textContent = 'Credenciais inválidas.';
    return;
  }

  saveSession(found.role, found.username);
  document.getElementById('loginError').textContent = '';
  showApp();
  safeStartApp(found.role, found.username);
});

document.getElementById('logoutBtn')?.addEventListener('click', (e) => {
  e.preventDefault();
  clearSession();
  showLogin();
  loginForm?.reset();
});

document.addEventListener('DOMContentLoaded', () => {
  ensureDefaultUsers();
  if(!bootFromSession()){
    showLogin();
  }
});




window.forceGoTabletFinal = function(){
  try{ localStorage.removeItem('app_session'); }catch(e){}
  window.location.href = './';
}
window.forceGoTabletTest = function(){
  try{ localStorage.removeItem('app_session'); }catch(e){}
  try{ localStorage.removeItem('app_session_tablet_teste'); }catch(e){}
  window.location.href = '/App-Pai/Gestao-Tablet-PC-Teste/';
}
