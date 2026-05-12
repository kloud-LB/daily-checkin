/* ================================================================
   migrate.js — v1.x localStorage 数据迁移到 Supabase
   ================================================================ */

async function migrateFromJSON(file) {
  var reader = new FileReader();
  reader.onload = async function(e) {
    try {
      var data = JSON.parse(e.target.result);
      if (!data.tasks || !data.history) throw new Error('格式无效（缺少 tasks 或 history）');

      var sb = getSupabase();
      var uid = authUser.id;
      if (!uid) { showToast('请先登录'); return; }

      var taskCount = data.tasks.length;
      var historyDays = Object.keys(data.history).length;
      var msg = '即将迁移 ' + taskCount + ' 个打卡任务、' + historyDays + ' 天记录到云端。' +
                (data.todoCategories ? '包含待办数据。' : '') +
                '\n当前云端数据不会被覆盖，确定继续？';

      if (!confirm(msg)) return;
      showToast('正在迁移中...', 3000);

      // Migrate tasks
      var taskErrors = 0;
      for (var i = 0; i < data.tasks.length; i++) {
        var t = data.tasks[i];
        var res = await sb.from('checkin_tasks').upsert({
          id: parseInt(t.id) || (Date.now() + i),
          user_id: uid,
          name: t.name,
          target_count: t.targetCount || 1,
          color: t.color || '#6366f1',
          created_at: new Date(t.createdAt || Date.now()).toISOString()
        });
        if (res.error) taskErrors++;
      }

      // Migrate history
      var historyInserted = 0;
      var historyErrors = 0;
      var dates = Object.keys(data.history);
      for (var d = 0; d < dates.length; d++) {
        var dateStr = dates[d];
        var dayData = data.history[dateStr];
        var taskIds = Object.keys(dayData);
        for (var j = 0; j < taskIds.length; j++) {
          var tid = parseInt(taskIds[j]);
          var h = dayData[taskIds[j]];
          var res = await sb.from('checkin_history').upsert({
            user_id: uid,
            task_id: tid,
            date: dateStr,
            count: h.count || 1,
            completed_at: new Date(h.completedAt || Date.now()).toISOString()
          }, { onConflict: 'user_id,task_id,date' });
          if (res.error) historyErrors++;
          else historyInserted++;
        }
      }

      // Migrate todo categories if present
      var catInserted = 0;
      if (data.todoCategories && Array.isArray(data.todoCategories)) {
        for (var c = 0; c < data.todoCategories.length; c++) {
          var cat = data.todoCategories[c];
          var catId = cat.id || ('cat_' + Date.now() + '_' + c);
          var catRes = await sb.from('todo_categories').upsert({
            id: catId, user_id: uid, name: cat.name,
            color: cat.color || '#6366f1',
            created_at: new Date(cat.createdAt || Date.now()).toISOString()
          });
          if (!catRes.error) catInserted++;
        }
      }

      // Migrate todo items if present
      var todoInserted = 0;
      if (data.todoItems && Array.isArray(data.todoItems)) {
        for (var ti = 0; ti < data.todoItems.length; ti++) {
          var item = data.todoItems[ti];
          var itemId = parseInt(item.id) || (Date.now() + ti);
          var itemRes = await sb.from('todo_items').upsert({
            id: itemId, user_id: uid, category_id: item.categoryId || null,
            title: item.title, description: item.description || '',
            deadline: item.deadline ? new Date(item.deadline).toISOString() : null,
            priority: item.priority || 'medium',
            status: item.status || 'pending',
            created_at: new Date(item.createdAt || Date.now()).toISOString(),
            completed_at: item.completedAt ? new Date(item.completedAt).toISOString() : null
          });
          if (!itemRes.error) todoInserted++;
        }
      }

      // Refresh caches and UI
      await refreshAllCaches(sb, uid);
      loadAllDataFromCache();
      renderAll();

      var resultMsg = '迁移完成！任务 ' + (data.tasks.length - taskErrors) + '/' + data.tasks.length +
        '，打卡记录 ' + historyInserted + ' 条';
      if (catInserted > 0) resultMsg += '，分类 ' + catInserted;
      if (todoInserted > 0) resultMsg += '，待办 ' + todoInserted;
      showToast(resultMsg, 3000);

    } catch(err) {
      showToast('迁移失败：' + (err.message || '文件格式不正确'));
    }
  };
  reader.readAsText(file);
}

// Override import handler to use migration
function bindMigrateImport() {
  var input = document.getElementById('importFileInput');
  if (!input) return;
  input.onchange = function() {
    if (this.files && this.files[0]) {
      migrateFromJSON(this.files[0]);
      this.value = '';
    }
  };
}
