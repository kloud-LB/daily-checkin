/* ================================================================
   auth.js — Supabase 用户认证 + 用户资料（昵称 + 头像）
   ================================================================ */

var authUser = null;
var userProfile = { nickname: '', avatar: '👤' };

const AVATAR_EMOJIS = [
  '👤', '😊', '😎', '🤓', '👨', '👩', '🧑', '👻',
  '🐱', '🐶', '🦊', '🐼', '🐨', '🦁', '🐯', '🐸',
  '🦄', '🐙', '🌈', '⭐', '🔥', '💎', '🎯', '🚀',
  '🎨', '🌸', '🍀', '💪', '🧠', '🎵', '🌙', '☀️'
];

// ---- User Profile Data Layer ----
async function loadUserProfile(uid) {
  // Try cache first
  var cached = dbCacheLoad(uid, 'checkin_cache_profile');
  if (cached) {
    userProfile = cached;
    updateAvatarBtn();
    return;
  }
  // Fetch from server
  if (isOnline) {
    try {
      var sb = getSupabase();
      var res = await sb.from('user_profiles').select('*').eq('user_id', uid).maybeSingle();
      if (!res.error && res.data) {
        userProfile = { nickname: res.data.nickname, avatar: res.data.avatar || '👤' };
        dbCacheSave(uid, 'checkin_cache_profile', userProfile);
        updateAvatarBtn();
      }
    } catch(e) { /* use defaults */ }
  }
}

async function saveUserProfile() {
  if (!authUser) return;
  var uid = authUser.id;
  dbCacheSave(uid, 'checkin_cache_profile', userProfile);
  if (isOnline) {
    try {
      await getSupabase().from('user_profiles').upsert({
        user_id: uid,
        nickname: userProfile.nickname,
        avatar: userProfile.avatar,
        updated_at: new Date().toISOString()
      });
    } catch(e) { /* offline queue */ }
  }
}

// ---- Avatar Button ----
function updateAvatarBtn() {
  var btn = document.getElementById('avatarBtn');
  if (!btn) return;
  if (authUser && userProfile.avatar) {
    btn.textContent = userProfile.avatar;
    btn.classList.remove('guest');
  } else {
    btn.textContent = '👤';
    btn.classList.add('guest');
  }
}

function toggleUserPanel() {
  if (!authUser) {
    // Not logged in — show auth UI
    showAuthUI();
    return;
  }
  var overlay = document.getElementById('userPanelOverlay');
  if (!overlay) return;
  if (overlay.classList.contains('show')) {
    closeUserPanel();
    return;
  }
  // Update panel content
  document.getElementById('userPanelAvatar').textContent = userProfile.avatar || '👤';
  document.getElementById('userPanelNickname').textContent = userProfile.nickname || '未设置昵称';
  document.getElementById('userPanelEmail').textContent = authUser ? authUser.email : '';
  overlay.classList.add('show');
}

function closeUserPanel() {
  var overlay = document.getElementById('userPanelOverlay');
  if (overlay) overlay.classList.remove('show');
}

// ---- Avatar Picker ----
function openAvatarPicker() {
  var grid = document.getElementById('emojiGrid');
  grid.innerHTML = AVATAR_EMOJIS.map(function(e) {
    var sel = e === userProfile.avatar ? ' selected' : '';
    return '<button class="emoji-option' + sel + '" data-emoji="' + e + '">' + e + '</button>';
  }).join('');
  document.getElementById('avatarPickerOverlay').classList.add('show');

  grid.onclick = function(e) {
    var btn = e.target.closest('.emoji-option');
    if (!btn) return;
    userProfile.avatar = btn.dataset.emoji;
    saveUserProfile();
    updateAvatarBtn();
    document.getElementById('userPanelAvatar').textContent = userProfile.avatar;
    closeAvatarPicker();
  };
}

function closeAvatarPicker() {
  document.getElementById('avatarPickerOverlay').classList.remove('show');
}

// ---- Nickname Edit ----
function openNicknameEdit() {
  document.getElementById('nicknameEditInput').value = userProfile.nickname || '';
  document.getElementById('nicknameEditOverlay').classList.add('show');
  setTimeout(function() { document.getElementById('nicknameEditInput').focus(); }, 350);
}

function saveNicknameEdit() {
  var name = document.getElementById('nicknameEditInput').value.trim();
  if (!name) { showToast('昵称不能为空'); return; }
  userProfile.nickname = name;
  saveUserProfile();
  updateAvatarBtn();
  document.getElementById('userPanelNickname').textContent = name;
  document.getElementById('nicknameEditOverlay').classList.remove('show');
  showToast('昵称已更新');
}

function closeNicknameEdit() {
  document.getElementById('nicknameEditOverlay').classList.remove('show');
}

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
      document.body.classList.remove('is-guest');
      document.body.classList.add('is-authed');
      hideAuthUI();
      onUserReady();
    } else {
      document.body.classList.add('is-guest');
      document.body.classList.remove('is-authed');
      userProfile = { nickname: '', avatar: '👤' };
      updateAvatarBtn();
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
        '<label class="form-label">昵称</label>' +
        '<input class="form-input" id="authNickname" type="text" placeholder="给自己起个名字" maxlength="20">' +
      '</div>' +
      '<div class="form-group">' +
        '<label class="form-label">头像</label>' +
        '<div class="auth-avatar-pick" id="authAvatarPick"></div>' +
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
      '<p style="text-align:center;font-size:0.65rem;color:var(--text-tertiary);margin-top:12px">' +
        '你的数据仅属于你，通过 Row Level Security 隔离' +
      '</p>' +
    '</div>' +
  '</div>';
}

var _authAvatarSelected = '👤';

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
}

function hideAuthUI() {
  var el = document.getElementById('authContainer');
  if (el) el.style.display = 'none';
  document.getElementById('app').style.display = '';
  document.getElementById('fabBtn').style.display = '';
}

function renderAuthAvatarPicker() {
  var container = document.getElementById('authAvatarPick');
  if (!container) return;
  // Show first 16 emoji as quick picks
  var picks = AVATAR_EMOJIS.slice(0, 16);
  container.innerHTML = picks.map(function(e) {
    return '<button class="auth-avatar-opt' + (e === _authAvatarSelected ? ' selected' : '') +
      '" data-emoji="' + e + '">' + e + '</button>';
  }).join('');

  container.onclick = function(e) {
    var btn = e.target.closest('.auth-avatar-opt');
    if (!btn) return;
    _authAvatarSelected = btn.dataset.emoji;
    renderAuthAvatarPicker();
  };
}

function bindAuthEvents() {
  var emailEl = document.getElementById('authEmail');
  var passEl = document.getElementById('authPassword');
  var nickEl = document.getElementById('authNickname');
  var errEl = document.getElementById('authError');

  renderAuthAvatarPicker();

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
    } catch(e) { showErr('登录失败，请检查网络'); }
  };

  document.getElementById('authSignUpBtn').onclick = async function() {
    hideErr();
    var nickname = nickEl.value.trim();
    var email = emailEl.value.trim();
    var pass = passEl.value;
    if (!nickname) { showErr('请填写昵称'); return; }
    if (!email || !pass) { showErr('请填写邮箱和密码'); return; }
    if (pass.length < 6) { showErr('密码至少6位'); return; }
    try {
      var resp = await getSupabase().auth.signUp({ email: email, password: pass });
      if (resp.error) { showErr(resp.error.message); return; }
      // Create user profile
      var uid = resp.data.user ? resp.data.user.id : null;
      if (uid) {
        userProfile = { nickname: nickname, avatar: _authAvatarSelected };
        try {
          await getSupabase().from('user_profiles').upsert({
            user_id: uid,
            nickname: nickname,
            avatar: _authAvatarSelected,
            updated_at: new Date().toISOString()
          });
          dbCacheSave(uid, 'checkin_cache_profile', userProfile);
        } catch(e) { /* profile write failed */ }
        updateAvatarBtn();
        showErr('注册成功！请登录（若开启了邮箱确认，请查看收件箱）');
      } else {
        showErr('注册成功！请登录');
      }
    } catch(e) { showErr('注册失败，请检查网络'); }
  };

}

// ---- User Panel Events ----
function bindUserPanelEvents() {
  var overlay = document.getElementById('userPanelOverlay');
  if (!overlay) return;

  document.getElementById('avatarBtn').onclick = toggleUserPanel;

  overlay.onclick = function(e) {
    if (e.target === overlay) closeUserPanel();
  };

  document.getElementById('userPanelAvatarBtn').onclick = function() {
    openAvatarPicker();
  };

  document.getElementById('userPanelEditAvatar').onclick = function() {
    openAvatarPicker();
  };

  document.getElementById('userPanelEditName').onclick = function() {
    closeUserPanel();
    setTimeout(function() { openNicknameEdit(); }, 300);
  };

  document.getElementById('userPanelLogout').onclick = async function() {
    closeUserPanel();
    try {
      await getSupabase().auth.signOut();
      authUser = null;
      userProfile = { nickname: '', avatar: '👤' };
      updateAvatarBtn();
      // Clear all caches for this user
      showToast('已退出登录');
    } catch(e) { /* ignore */ }
  };

  document.getElementById('userPanelExport').onclick = function() {
    closeUserPanel();
    exportData();
  };

  document.getElementById('userPanelImport').onclick = function() {
    closeUserPanel();
    document.getElementById('importFileInput').click();
  };

  // Avatar picker modal
  document.getElementById('avatarPickerOverlay').onclick = function(e) {
    if (e.target === document.getElementById('avatarPickerOverlay')) closeAvatarPicker();
  };

  // Nickname edit modal
  document.getElementById('nicknameEditOverlay').onclick = function(e) {
    if (e.target === document.getElementById('nicknameEditOverlay')) closeNicknameEdit();
  };
  document.getElementById('nicknameEditSubmit').onclick = saveNicknameEdit;
}

async function signOutUser() {
  try {
    await getSupabase().auth.signOut();
    authUser = null;
  } catch(e) { /* ignore */ }
}

// Stub: called when user is authenticated and ready
function onUserReady() {
  if (authUser) {
    loadUserProfile(authUser.id).then(function() {
      updateAvatarBtn();
    });
    if (typeof dbLoadAll === 'function') {
      dbLoadAll(authUser.id);
    }
    if (typeof syncOfflineQueue === 'function') syncOfflineQueue();
  }
}
