// Inti aplikasi: client Supabase, login, navigasi, utilitas
const sb = supabase.createClient(APP_CONFIG.SUPABASE_URL, APP_CONFIG.SUPABASE_ANON_KEY);
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

let toastTimer;
function toast(msg, isError = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = isError ? 'err' : '';
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.hidden = true, 3500);
}

// ---- Navigasi ----
const views = []; // {name, label, onShow}
function registerView(name, label, onShow) {
  views.push({ name, label, onShow });
}
function buildNav() {
  const nav = $('#nav');
  nav.innerHTML = '';
  views.forEach(v => {
    const b = document.createElement('button');
    b.textContent = v.label;
    b.dataset.view = v.name;
    b.onclick = () => showView(v.name);
    nav.appendChild(b);
  });
}
async function showView(name) {
  document.querySelectorAll('.view').forEach(el => el.hidden = el.id !== 'view-' + name);
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('active', b.dataset.view === name));
  const v = views.find(x => x.name === name);
  if (v && v.onShow) await v.onShow();
  if (name !== 'count' && window.stopScanner) window.stopScanner(); // dipakai di Tahap 7
}

// ---- Auth ----
async function isAllowed(user) {
  const { data } = await sb.from('allowed_users').select('user_id').eq('user_id', user.id).maybeSingle();
  return !!data;
}
async function enterApp(user) {
  if (!(await isAllowed(user))) {
    await sb.auth.signOut();
    showLogin('Akun ini tidak diizinkan mengakses aplikasi.');
    return;
  }
  $('#login-view').hidden = true;
  $('#app').hidden = false;
  $('#user-email').textContent = user.email;
  buildNav();
  if (views.length) await showView(views[0].name);
}
function showLogin(msg) {
  $('#app').hidden = true;
  $('#login-view').hidden = false;
  const e = $('#login-error');
  e.hidden = !msg;
  e.textContent = msg || '';
}
function initAuth() {
  $('#login-form').addEventListener('submit', async ev => {
    ev.preventDefault();
    const btn = ev.submitter; btn.disabled = true;
    const { data, error } = await sb.auth.signInWithPassword({
      email: $('#login-email').value.trim(),
      password: $('#login-password').value
    });
    btn.disabled = false;
    if (error) return showLogin('Email atau password salah.');
    await enterApp(data.user);
  });
  $('#logout-btn').onclick = async () => { await sb.auth.signOut(); showLogin(); };
}
