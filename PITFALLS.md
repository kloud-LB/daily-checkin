# 项目踩坑记录

---

## 1. Supabase 确认邮件链接指向 localhost 无法打开

### 现象

注册 Supabase 邮箱用户后，邮箱收到确认邮件，但点击链接后浏览器显示 **"localhost 拒绝连接"** 或 **"无法访问此网站"**，无法完成邮箱验证。

### 问题分析

Supabase Auth 在发送确认邮件时，邮件中的确认链接域名来自项目的 **Site URL** 配置。实际流程：

```
1. Supabase 默认 Site URL = http://localhost:3000
2. VS Code Live Server 默认端口 = 5500
3. 邮箱链接 → http://localhost:3000/auth/callback?token=...
4. Live Server 在 5500 端口监听，3000 端口无服务
5. 浏览器报告 "拒绝连接"
```

**根因**：端口不匹配。Supabase 生成 URL 用的是 `3000`，但本地开发服务器跑在 `5500`。两个端口之间没有自动发现机制，Supabase 无法感知开发者实际使用的端口。

### 处理方案

| 步骤 | 操作 |
|------|------|
| 1 | Supabase Dashboard → **Authentication** → **URL Configuration** |
| 2 | 将 **Site URL** 从 `http://localhost:3000` 改为 `http://localhost:5500` |
| 3 | 重新注册一次账号（或用之前的邮箱重新触发确认邮件） |

修改后，Supabase 发送的新确认邮件链接会自动指向 `http://localhost:5500/auth/callback?token=...`，Live Server 能正确接收。

> **端口取决于开发服务器**：VS Code Live Server 默认 5500；Vite 默认 5173；Create React App 默认 3000。根据自己使用的工具调整。

---

## 2. supabase-client.js URL 带 `/rest/v1/` 后缀导致 API 404

### 现象

Supabase JS SDK 初始化后，所有 API 请求返回 **404** 或 **请求超时**。前端功能全部不可用，但 Supabase 项目在线状态正常。

### 问题分析

Supabase JS SDK 的 `createClient(url, key)` 内部实现：

```javascript
// SDK 内部自动拼接 REST API 路径
this.restUrl = `${url}/rest/v1`;
```

如果传入的 `url` 已经包含 `/rest/v1/`：

```
传入: https://xxx.supabase.co/rest/v1/
SDK拼接: https://xxx.supabase.co/rest/v1//rest/v1/checkin_tasks
                                 ↑ 双重路径，永久 404
```

**根因**：`createClient` 的第一个参数应该是 Supabase 项目的**根域名**，而非 REST API 端点。这是 Supabase 文档和 Quickstart 示例中常见的误解——Dashboard API 页面展示的 `Project URL` 不带 `/rest/v1/`，但 `Config URL` 有时会带。

### 处理方案

```javascript
// ❌ 错误 —— 从 Supabase 面板 API 配置复制时多带了后缀
const SUPABASE_URL = 'https://xxx.supabase.co/rest/v1/';

// ✅ 正确 —— 只保留项目根域名
const SUPABASE_URL = 'https://xxx.supabase.co';
```

Supabase Dashboard → Settings → API → 复制 **Project URL** 字段（格式为 `https://<项目ID>.supabase.co`，不含路径后缀）。

---

## 3. RLS 策略未配置导致数据请求返回空

### 现象

用户已登录（右上角显示用户信息），但打卡任务列表始终为空，浏览器 Network 面板显示 API 返回 `200 OK []`，创建任务的请求也"成功"但实际上没有写入数据库。

### 问题分析

Supabase 的 Row Level Security 默认行为：

```
启用 RLS 的表：      无策略 → 拒绝所有访问（静默拒绝，不报错）
                    有 USING 策略 → 按策略过滤行
                    有 WITH CHECK 策略 → 按策略校验写入
```

```
用户发请求 → Supabase API 网关 → PostgreSQL
                                   │
                                   ├─ checkin_tasks 启用了 RLS
                                   │  但没有任何策略
                                   │  → SELECT: 返回 0 行（静默）
                                   │  → INSERT: 权限拒绝（静默，不报错）
                                   │
                                   └─ 前端看到: 空列表 / 空响应
```

**根因**：`ALTER TABLE ... ENABLE ROW LEVEL SECURITY` 启用了行级安全，但没有创建对应的 `CREATE POLICY` 策略。启用 RLS 后如果没有策略，PostgreSQL 的默认行为是"拒绝一切"，API 层为了安全也做了静默处理。

### 处理方案

在 Supabase SQL Editor 中运行完整的 `supabase/schema.sql`，确保每张表都包含 **USING + WITH CHECK 策略**：

```sql
-- 启用 RLS（只做一次）
ALTER TABLE checkin_tasks ENABLE ROW LEVEL SECURITY;

-- 创建策略（必须紧随其后）
CREATE POLICY "user_own_tasks" ON checkin_tasks
  FOR ALL                                -- 所有操作(SELECT/INSERT/UPDATE/DELETE)
  USING (auth.uid() = user_id)           -- 读取限制：只能读自己的行
  WITH CHECK (auth.uid() = user_id);     -- 写入限制：只能写 user_id=自己的行
```

**验证方法**：

| 状态 | 判断标准 |
|------|----------|
| 表不存在 | API 返回 `{code:"PGRST205", message:"Could not find the table..."}` |
| RLS 无策略 | 200 OK，body 始终为 `[]` |
| 正常 | 200 OK，返回实际数据 |

---

## 4. 路径体系混用（Windows + Git Bash）

### 现象

在 VS Code Terminal（Git Bash）中执行路径命令时：

```bash
# Git Bash Unix 风格路径
ls /c/Users/z10915/daily-checkin/    # ✅ 正常
ls C:\Users\z10915\daily-checkin\    # ❌ No such file or directory

# Windows 命令提示符风格路径
cd "D:\VIBECODING\daily-checkin"     # ✅ 正常
cd "/d/VIBECODING/daily-checkin"     # ❌ No such file or directory
```

### 问题分析

| 终端 | 路径风格 | C 盘 | D 盘 |
|------|----------|------|------|
| Git Bash | Unix (`/c/`, `/d/`) | `/c/Users/...` | `/d/VIBECODING/...` |
| Cmd / PowerShell | Windows (`C:\`, `D:\`) | `C:\Users\...` | `D:\VIBECODING\...` |
| WSL | Linux (`/mnt/c/`) | `/mnt/c/Users/...` | `/mnt/d/VIBECODING/...` |

**根因**：项目实际存储在 Windows 文件系统（`D:\VIBECODING`），但 Claude Code 的 Bash 工具运行在 Git Bash 环境（Unix 路径），路径风格不匹配时脚本执行失败。

### 处理方案

在 Git Bash 中统一使用 Unix 路径风格：

```bash
# C 盘 ⇒ /c/
ls /c/Users/z10915/daily-checkin/

# D 盘 ⇒ /d/
cd "/d/VIBECODING/daily-checkin"
```

---

## 5. localStorage 新旧 Key 并存导致混淆

### 现象

v1.x → v2.0 迁移后，localStorage 中同时存在两套 key：

```
checkin_tasks        ← v1.x 数据
checkin_history      ← v1.x 数据
checkin_cache_tasks  ← v2.0 离线缓存
checkin_cache_history← v2.0 离线缓存
```

浏览器 DevTools Application 面板显得混乱，不确定哪些 key 正在生效。

### 问题分析

| Key | 版本 | 用途 | 是否当前使用 |
|-----|------|------|------------|
| `checkin_tasks` | v1.x | 旧版任务存储 | ❌ v2.0 不读 |
| `checkin_history` | v1.x | 旧版打卡记录 | ❌ v2.0 不读 |
| `checkin_cache_tasks` | v2.0 | 离线任务缓存 | ✅ 当前使用 |
| `checkin_cache_history` | v2.0 | 离线记录缓存 | ✅ 当前使用 |
| `checkin_theme` | v1/2 | 主题偏好 | ✅ 当前使用 |
| `checkin_offline_queue` | v2.0 | 离线操作队列 | ✅ 当前使用 |

v2.0 不再读写旧 key，但旧 key 不会自动删除。

**根因**：v2.0 离线缓存层使用了新的 key 命名空间（`checkin_cache_*`），目的有二：
1. 不与 v1.x 数据冲突（保证回退到 `main` 分支时旧数据还在）
2. 缓存数据附加了 `_uid` 字段区分用户，与 v1.x 纯数据结构不兼容

### 处理方案

迁移完成并确认数据正常后，手动清理旧 key：

1. 浏览器 DevTools → Application → Local Storage → `http://localhost:5500`
2. 删除旧 key（仅删旧 key，保留 `checkin_cache_*` 和 `checkin_theme`）：

```
🗑 checkin_tasks
🗑 checkin_history
🗑 todo_categories
🗑 todo_items
```

> 保留 `checkin_theme`、`checkin_cache_*`、`checkin_offline_queue`，删除其余。
