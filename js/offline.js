/* ================================================================
   offline.js — 离线缓存层
   - 网络可用时: 写 Supabase + 更新本地缓存
   - 网络不可用时: 写离线队列 + 更新本地缓存
   - 网络恢复时: 回放离线队列 + 刷新本地缓存
   ================================================================ */

const OFFLINE_QUEUE_KEY = 'checkin_offline_queue';

// 本地缓存 key（镜像 Supabase 数据结构）
const CACHE_KEYS = {
  tasks: 'checkin_cache_tasks',
  history: 'checkin_cache_history',
  todoCategories: 'checkin_cache_todo_categories',
  todoItems: 'checkin_cache_todo_items'
};

let isOnline = navigator.onLine;
let syncInProgress = false;

// ---- Network Detection ----
function initOffline() {
  var badge = document.getElementById('offlineBadge');
  window.addEventListener('online', function() {
    isOnline = true;
    document.body.classList.remove('is-offline');
    if (badge) badge.style.display = 'none';
    syncOfflineQueue();
  });
  window.addEventListener('offline', function() {
    isOnline = false;
    document.body.classList.add('is-offline');
    if (badge) badge.style.display = '';
  });
  if (!isOnline) {
    document.body.classList.add('is-offline');
    if (badge) badge.style.display = '';
  }
}

// ---- Local Cache Helpers ----
function cacheGet(key) {
  try { return JSON.parse(localStorage.getItem(key)); }
  catch(e) { return null; }
}

function cacheSet(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)); }
  catch(e) { /* quota exceeded, ignore */ }
}

function cacheGetTasks(uid) {
  var cached = cacheGet(CACHE_KEYS.tasks);
  return (cached && cached._uid === uid) ? cached.data : null;
}

function cacheSetTasks(uid, data) {
  cacheSet(CACHE_KEYS.tasks, { _uid: uid, data: data, _ts: Date.now() });
}

function cacheGetHistory(uid) {
  var cached = cacheGet(CACHE_KEYS.history);
  return (cached && cached._uid === uid) ? cached.data : {};
}

function cacheSetHistory(uid, data) {
  cacheSet(CACHE_KEYS.history, { _uid: uid, data: data, _ts: Date.now() });
}

function cacheGetTodoCategories(uid) {
  var cached = cacheGet(CACHE_KEYS.todoCategories);
  return (cached && cached._uid === uid) ? cached.data : null;
}

function cacheSetTodoCategories(uid, data) {
  cacheSet(CACHE_KEYS.todoCategories, { _uid: uid, data: data, _ts: Date.now() });
}

function cacheGetTodoItems(uid) {
  var cached = cacheGet(CACHE_KEYS.todoItems);
  return (cached && cached._uid === uid) ? cached.data : null;
}

function cacheSetTodoItems(uid, data) {
  cacheSet(CACHE_KEYS.todoItems, { _uid: uid, data: data, _ts: Date.now() });
}

// ---- Offline Queue ----
function queueGet() {
  try { return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY)) || []; }
  catch(e) { return []; }
}

function queueSet(items) {
  try { localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(items)); }
  catch(e) { /* quota exceeded */ }
}

function queuePush(action) {
  var q = queueGet();
  q.push(action);
  queueSet(q);
}

// ---- Sync ----
async function syncOfflineQueue() {
  if (!isOnline || syncInProgress) return;
  syncInProgress = true;
  try {
    var q = queueGet();
    if (q.length === 0) return;
    var sb = getSupabase();
    var uid = (await sb.auth.getUser()).data.user?.id;
    if (!uid) { syncInProgress = false; return; }

    // Filter out actions that may cause conflicts
    var remaining = [];
    for (var i = 0; i < q.length; i++) {
      var action = q[i];
      try {
        await replayAction(sb, uid, action);
      } catch(e) {
        remaining.push(action);
      }
    }
    queueSet(remaining);

    // Refresh all caches from Supabase
    await refreshAllCaches(sb, uid);

  } catch(e) {
    /* re-sync later */
  }
  syncInProgress = false;
}

async function replayAction(sb, uid, action) {
  switch (action.type) {
    case 'checkin':
      await sb.from('checkin_history').upsert({
        user_id: uid,
        task_id: action.taskId,
        date: action.date,
        count: action.count,
        completed_at: action.timestamp ? new Date(action.timestamp).toISOString() : new Date().toISOString()
      }, { onConflict: 'user_id,task_id,date' });
      break;

    case 'createTask':
      await sb.from('checkin_tasks').upsert({
        id: action.id, user_id: uid, name: action.name,
        target_count: action.targetCount, color: action.color,
        created_at: new Date(action.createdAt).toISOString()
      });
      break;

    case 'deleteTask':
      await sb.from('checkin_tasks').delete().eq('id', action.id).eq('user_id', uid);
      break;

    case 'updateTask':
      await sb.from('checkin_tasks').update({
        name: action.name, target_count: action.targetCount,
        color: action.color
      }).eq('id', action.id).eq('user_id', uid);
      break;

    case 'createTodo':
      await sb.from('todo_items').upsert({
        id: action.id, user_id: uid, category_id: action.categoryId,
        title: action.title, description: action.description || '',
        deadline: action.deadline, priority: action.priority,
        status: action.status, created_at: new Date(action.createdAt).toISOString()
      });
      break;

    case 'updateTodo':
      await sb.from('todo_items').update({
        title: action.title, description: action.description,
        deadline: action.deadline, priority: action.priority,
        category_id: action.categoryId, status: action.status, completed_at: action.completedAt ? new Date(action.completedAt).toISOString() : null
      }).eq('id', action.id).eq('user_id', uid);
      break;

    case 'deleteTodo':
      await sb.from('todo_items').delete().eq('id', action.id).eq('user_id', uid);
      break;

    case 'createCategory':
      await sb.from('todo_categories').upsert({
        id: action.id, user_id: uid, name: action.name,
        color: action.color, created_at: new Date(action.createdAt).toISOString()
      });
      break;

    case 'updateCategory':
      await sb.from('todo_categories').update({
        name: action.name, color: action.color
      }).eq('id', action.id).eq('user_id', uid);
      break;

    case 'deleteCategory':
      await sb.from('todo_categories').delete().eq('id', action.id).eq('user_id', uid);
      break;

    case 'undoCheckin':
      await sb.from('checkin_history').delete()
        .eq('user_id', uid).eq('task_id', action.taskId).eq('date', action.date);
      break;

    default:
      break;
  }
}

async function refreshAllCaches(sb, uid) {
  try {
    var tRes = await sb.from('checkin_tasks').select('*').eq('user_id', uid).order('created_at');
    if (!tRes.error) cacheSetTasks(uid, tRes.data);

    var hRes = await sb.from('checkin_history').select('*').eq('user_id', uid);
    if (!hRes.error) {
      // Convert array to {date: {taskId: {count, completedAt}}}
      var hData = {};
      hRes.data.forEach(function(r) {
        if (!hData[r.date]) hData[r.date] = {};
        hData[r.date][r.task_id] = { count: r.count, completedAt: new Date(r.completed_at).getTime() };
      });
      cacheSetHistory(uid, hData);
    }

    var cRes = await sb.from('todo_categories').select('*').eq('user_id', uid);
    if (!cRes.error) cacheSetTodoCategories(uid, cRes.data);

    var iRes = await sb.from('todo_items').select('*').eq('user_id', uid).order('created_at');
    if (!iRes.error) cacheSetTodoItems(uid, iRes.data);
  } catch(e) { /* offline, ignore */ }
}
