/* ================================================================
   auth.js — Supabase 用户认证（邮箱登录/注册）
   ================================================================ */

let authUser = null;

// ---- Session Management ----
async function initAuth() {
  try {
    var sb = getSupabase();
    var resp = await sb.auth.getUser();
    authUser = resp.data.user || null;
  } catch(e) {
    authUser = null;
  }
  // Listen for auth state changes
  getSupabase().auth.onAuthStateChange(function(event, session) {
    authUser = session ? session.user : null;
    if (authUser) {
      // Signed in or token refreshed
      document.body.classList.remove('is-guest');
      document.body.classList.add('is-authed');
      hideAuthUI();
      onUserReady();
    } else {
      // Signed out
      document.body.classList.add('is-guest');
      document.body.classList.remove('is-authed');
      showAuthUI();
    }
  });
  // Restore session
  if (authUser) {
    document.body.classList.remove('is-guest');
    document.body.classList.add('is-authed');
    hideAuthUI();
    return true;
  } else {
    document.body.classList.add('is-guest');
    showAuthUI();
    return false;
  }
}

// ---- Auth UI ----
function getAuthHTML() {
  return '<div class="auth-container" id="authContainer">' +
    '<div class="auth-card">' +
      '<div class="auth-header">' +
        '<div style="font-size:2rem">📋</div>' +
        '<h2 style="margin:8px 0 4px;font-size:1.2rem">每日打卡</h2>' +
        '<p style="font-size:0.8rem;color:var(--text-secondary)">登录以同步数据到云端</p>' +
      '</div>' +
      '<div class="form-group">' +
        '<label class="form-label">邮箱</label>' +
        '<input class="form-input" id="authEmail" type="email" placeholder="your@email.com">' +
      '</div>' +
      '<div class="form-group">' +
        '<label class="form-label">密码</label>' +
        '<input class="form-input" id="authPassword" type="password" placeholder="至少6位">' +
      '</div>' +
      '<div id="authError" style="color:#c97a3c;font-size:0.78rem;margin-bottom:8px;display:none"></div>' +
      '<button class="form-submit" id="authSignInBtn" style="margin-bottom:8px">登录</button>' +
      '<button class="form-submit" id="authSignUpBtn" style="background:var(--input-bg);color:var(--text)">注册新账号</button>' +
      '<div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--divider);text-align:center">' +
        '<p style="font-size:0.72rem;color:var(--text-tertiary);margin-bottom:8px">已有 v1.x 数据？</p>' +
        '<button class="form-submit" id="authMigrateBtn" style="font-size:0.82rem;padding:10px">📤 从旧版迁移数据</button>' +
      '</div>' +
      '<p style="text-align:center;font-size:0.65rem;color:var(--text-tertiary);margin-top:12px">' +
        '你的数据仅属于你，通过 Row Level Security 隔离' +
      '</p>' +
    '</div>' +
  '</div>';
}

function showAuthUI() {
  var existing = document.getElementById('authContainer');
  if (existing) existing.style.display = '';
  else {
    var div = document.createElement('div');
    div.innerHTML = getAuthHTML();
    document.body.appendChild(div.firstElementChild);
    bindAuthEvents();
  }
  document.getElementById('app').style.display = 'none';
  document.getElementById('fabBtn').style.display = 'none';
  document.querySelector('.bottom-nav').style.display = 'none';
}

function hideAuthUI() {
  var el = document.getElementById('authContainer');
  if (el) el.style.display = 'none';
  document.getElementById('app').style.display = '';
  document.getElementById('fabBtn').style.display = '';
  document.querySelector('.bottom-nav').style.display = '';
}

function bindAuthEvents() {
  var emailEl = document.getElementById('authEmail');
  var passEl = document.getElementById('authPassword');
  var errEl = document.getElementById('authError');

  function showErr(msg) { errEl.textContent = msg; errEl.style.display = ''; }
  function hideErr() { errEl.style.display = 'none'; }

  document.getElementById('authSignInBtn').onclick = async function() {
    hideErr();
    var email = emailEl.value.trim();
    var pass = passEl.value;
    if (!email || !pass) { showErr('请填写邮箱和密码'); return; }
    if (pass.length < 6) { showErr('密码至少6位'); return; }
    try {
      var resp = await getSupabase().auth.signInWithPassword({ email: email, password: pass });
      if (resp.error) showErr(resp.error.message);
      // onAuthStateChange will handle UI transition
    } catch(e) { showErr('登录失败，请检查网络'); }
  };

  document.getElementById('authSignUpBtn').onclick = async function() {
    hideErr();
    var email = emailEl.value.trim();
    var pass = passEl.value;
    if (!email || !pass) { showErr('请填写邮箱和密码'); return; }
    if (pass.length < 6) { showErr('密码至少6位'); return; }
    try {
      var resp = await getSupabase().auth.signUp({ email: email, password: pass });
      if (resp.error) showErr(resp.error.message);
      else showErr('注册成功！请登录（若开启了邮箱确认，请查看收件箱）');
    } catch(e) { showErr('注册失败，请检查网络'); }
  };

  document.getElementById('authMigrateBtn').onclick = function() {
    document.getElementById('importFileInput').click();
  };
}

async function signOutUser() {
  try {
    await getSupabase().auth.signOut();
    authUser = null;
  } catch(e) { /* ignore */ }
}

// Stub: called when user is authenticated and ready
function onUserReady() {
  // If app.init has already run, reload data; otherwise app.init will handle it
  if (typeof renderTasks === 'function' && typeof refreshAllCaches === 'function') {
    refreshAllCaches(getSupabase(), authUser.id).then(function() {
      loadAllDataFromCache();
      renderAll();
    });
  }
}

function loadAllDataFromCache() {
  // Called after cache is populated to restore state from local cache
  if (authUser && typeof cacheGetTasks === 'function') {
    var t = cacheGetTasks(authUser.id);
    if (t) tasks = t;
    var h = cacheGetHistory(authUser.id);
    if (h) history = h;
    var c = cacheGetTodoCategories(authUser.id);
    if (c) todoCategories = c;
    var i = cacheGetTodoItems(authUser.id);
    if (i) todoItems = i;
  }
}

function renderAll() {
  if (typeof renderTasks === 'function') renderTasks();
  if (typeof renderTodoView === 'function') renderTodoView();
  if (currentView === 'viewStats' && typeof renderStats === 'function') renderStats();
}
