/* ================================================================
   app.js — 应用入口（常量、状态、主题、音效、路由、初始化）
   ================================================================ */

// ---- Shortcuts ----
const $ = function(s, p) { return (p || document).querySelector(s); };
const $$ = function(s, p) { return [].slice.call((p || document).querySelectorAll(s)); };

// ---- Constants ----
const COLORS = ['#6366f1','#ec4899','#f59e0b','#22c55e','#06b6d4','#ef4444','#8b5cf6','#f97316'];
const MONTHS = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
const DAY_LABELS = ['日','一','二','三','四','五','六'];
const DEBOUNCE_MS = 300;

// ---- State ----
let tasks = [];
let history = {};
let currentView = 'viewCheckin';
let statsYear = new Date().getFullYear();
let editingTaskId = null;
let backfillTaskId = null;
let lastClickTime = {};
let confirmCallback = null;
let audioCtx = null;
let toastTimer = null;
let todoCategories = [];
let todoItems = [];
let todoFilterCategory = 'all';
let editingTodoId = null;
let editingCatId = null;
let postponeTodoId = null;

// ---- Helpers ----
function todayStr(d) {
  var t = d || new Date();
  return t.getFullYear() + '-' + String(t.getMonth()+1).padStart(2,'0') + '-' + String(t.getDate()).padStart(2,'0');
}
function fmtDate(str) {
  var parts = str.split('-');
  return parts[0] + '年' + parseInt(parts[1]) + '月' + parseInt(parts[2]) + '日';
}
function weekday(str) { return DAY_LABELS[new Date(str).getDay()]; }

// ---- Export / Import (v2: exports from local cache) ----
function exportData() {
  var data = { tasks: tasks, history: history, exportDate: todayStr() };
  // Also include todo data
  data.todoCategories = todoCategories;
  data.todoItems = todoItems;
  var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'checkin_backup_' + todayStr() + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('数据已导出为 JSON 文件');
}

// ---- Theme ----
function initTheme() {
  var saved = localStorage.getItem('checkin_theme');
  var theme;
  if (saved === 'dark' || saved === 'light') theme = saved;
  else theme = window.matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light';
  applyTheme(theme);
}

function applyTheme(theme) {
  document.body.dataset.theme = theme;
  var btn = $('#themeBtn');
  if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
  localStorage.setItem('checkin_theme', theme);
}

function toggleTheme() {
  var next = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  if (currentView === 'viewStats') renderStats();
}

// ---- Sound ----
function playDing() {
  try {
    var C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    if (!audioCtx) audioCtx = new C();
    var o = audioCtx.createOscillator();
    var g = audioCtx.createGain();
    o.connect(g); g.connect(audioCtx.destination);
    o.type = 'sine';
    o.frequency.setValueAtTime(1200, audioCtx.currentTime);
    o.frequency.exponentialRampToValueAtTime(600, audioCtx.currentTime + 0.08);
    g.gain.setValueAtTime(0.18, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
    o.start(audioCtx.currentTime);
    o.stop(audioCtx.currentTime + 0.25);
  } catch(e) {}
}

function playUndo() {
  try {
    var C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    if (!audioCtx) audioCtx = new C();
    var o = audioCtx.createOscillator();
    var g = audioCtx.createGain();
    o.connect(g); g.connect(audioCtx.destination);
    o.type = 'sine';
    o.frequency.setValueAtTime(500, audioCtx.currentTime);
    o.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.1);
    g.gain.setValueAtTime(0.12, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
    o.start(audioCtx.currentTime);
    o.stop(audioCtx.currentTime + 0.2);
  } catch(e) {}
}

// ---- Toast ----
function showToast(msg, duration) {
  duration = duration || 1800;
  var el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function() { el.classList.remove('show'); }, duration);
}

// ---- Checkmark Animation ----
function showCheckmark(card) {
  var rect = card.getBoundingClientRect();
  var cx = rect.left + rect.width / 2;
  var cy = rect.top + rect.height / 2;
  var div = document.createElement('div');
  div.className = 'checkmark-anim';
  div.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;z-index:50;pointer-events:none';
  var circle = document.createElement('div');
  circle.className = 'circle';
  circle.style.cssText = 'position:absolute;left:' + (cx - 30) + 'px;top:' + (cy - 30) + 'px';
  circle.innerHTML = '<span class="check">✓</span>';
  div.appendChild(circle);
  document.body.appendChild(div);
  setTimeout(function() { div.remove(); }, 600);
}

// ---- Navigation ----
function switchView(viewName) {
  currentView = viewName;
  $$('.view').forEach(function(v) { v.classList.remove('active'); });
  $('#' + viewName).classList.add('active');
  $$('.nav-item').forEach(function(n) { n.classList.toggle('active', n.dataset.view === viewName); });
  if (viewName === 'viewStats') renderStats();
  if (viewName === 'viewCheckin') renderTasks();
  if (viewName === 'viewTodo') renderTodoView();
}

// ---- Event Bindings ----
function bindEvents() {
  $('#themeBtn').onclick = toggleTheme;

  $('#fabBtn').onclick = function(e) {
    var ripple = document.createElement('div');
    ripple.className = 'ripple';
    e.currentTarget.appendChild(ripple);
    setTimeout(function() { ripple.remove(); }, 600);
    if (currentView === 'viewCheckin') openAddModal();
    else if (currentView === 'viewTodo') openTodoForm();
    else switchView('viewCheckin');
  };

  $$('.nav-item').forEach(function(n) { n.onclick = function() { switchView(n.dataset.view); }; });

  // Check-in modal
  $('#taskModalOverlay').onclick = function(e) { if (e.target === $('#taskModalOverlay')) closeTaskModal(); };
  $('#taskFormSubmit').onclick = saveTask;
  $('#taskColorInput').oninput = function() { updateColorSelection($('#taskColorInput').value); };

  // Todo modal
  $('#todoModalOverlay').onclick = function(e) { if (e.target === $('#todoModalOverlay')) closeTodoForm(); };
  $('#todoFormSubmit').onclick = saveTodoItemForm;
  $$('#priorityToggle .priority-opt').forEach(function(b) {
    b.onclick = function() {
      $$('#priorityToggle .priority-opt').forEach(function(x) { x.classList.remove('selected'); });
      b.classList.add('selected');
    };
  });

  // Category modals
  $('#catModalOverlay').onclick = function(e) { if (e.target === $('#catModalOverlay')) closeCatManager(); };
  $('#catAddBtn').onclick = function() { openCatEdit(); };
  $('#catEditOverlay').onclick = function(e) { if (e.target === $('#catEditOverlay')) closeCatEdit(); };
  $('#catEditSubmit').onclick = saveCatEdit;
  $('#catColorInput').oninput = function() { updateCatColorSelection($('#catColorInput').value); };

  // Postpone
  $('#postponeOverlay').onclick = function(e) { if (e.target === $('#postponeOverlay')) closePostpone(); };
  $('#postponeSubmit').onclick = function() { applyPostpone(false); };
  $('#postponeClear').onclick = function() { applyPostpone(true); };

  // Confirm dialog
  $('#confirmCancel').onclick = function() { $('#confirmDialog').classList.remove('show'); confirmCallback = null; };
  $('#confirmOk').onclick = function() { if (confirmCallback) confirmCallback(); };
  $('#confirmDialog').onclick = function(e) {
    if (e.target === $('#confirmDialog')) { $('#confirmDialog').classList.remove('show'); confirmCallback = null; }
  };

  // Backfill
  $('#backfillOverlay').onclick = function(e) { if (e.target === $('#backfillOverlay')) closeBackfill(); };

  // Stats year switcher
  $('#yearPrev').onclick = function() { statsYear--; renderStats(); };
  $('#yearNext').onclick = function() { statsYear++; renderStats(); };

  // Export / Import
  $('#exportBtn').onclick = function() { exportData(); };
  $('#importBtn').onclick = function() { $('#importFileInput').click(); };

  // Keyboard
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      if ($('#confirmDialog').classList.contains('show')) { $('#confirmDialog').classList.remove('show'); confirmCallback = null; }
      else if ($('#backfillOverlay').classList.contains('show')) closeBackfill();
      else if ($('#taskModalOverlay').classList.contains('show')) closeTaskModal();
      else if ($('#todoModalOverlay').classList.contains('show')) closeTodoForm();
      else if ($('#catModalOverlay').classList.contains('show')) closeCatManager();
      else if ($('#catEditOverlay').classList.contains('show')) closeCatEdit();
      else if ($('#postponeOverlay').classList.contains('show')) closePostpone();
    }
  });

  // System theme change
  window.matchMedia('(prefers-color-scheme:dark)').addEventListener('change', function(e) {
    var saved = localStorage.getItem('checkin_theme');
    if (!saved || saved === 'auto') {
      applyTheme(e.matches ? 'dark' : 'light');
      if (currentView === 'viewStats') renderStats();
    }
  });
}

// ---- Init ----
async function init() {
  initTheme();
  initOffline();

  // Format header date
  var now = new Date();
  var hd = $('#headerDate');
  if (hd) hd.textContent = now.getFullYear() + '年' + (now.getMonth()+1) + '月' + now.getDate() + '日 周' + DAY_LABELS[now.getDay()];

  bindEvents();

  // Check auth state
  var loggedIn = await initAuth();
  if (!loggedIn) return; // Auth UI shown, wait for login

  // Load data from Supabase (online) or cache (offline)
  await loadTasksOnline();
  await loadHistoryOnline();
  await loadTodoCategoriesOnline();
  await loadTodoItemsOnline();

  // Initial render
  renderTasks();
  // Pre-render todo pills for nav visibility
  renderTodoPills();

  // If network is available, ensure caches are fresh
  if (isOnline && authUser) {
    syncOfflineQueue();
  }

  // Bind migration import
  bindMigrateImport();
}

document.addEventListener('DOMContentLoaded', init);
