# 每日打卡 (Daily Check-in)

零依赖、纯前端打卡 + 待办应用，支持 Supabase 云端同步。

## 版本

| 分支 | 版本 | 说明 |
|------|------|------|
| `main` | v1.x | 单 HTML 文件，localStorage 存储，下载即用 |
| `v2` | v2.0.0 | 模块化架构，Supabase 后端，多端同步 |

## v2.0.0 快速开始

### 1. 创建 Supabase 项目

1. 注册 [supabase.com](https://supabase.com) 账号
2. 创建项目，选择 **Singapore** 区域
3. 等待数据库就绪（约2分钟）

### 2. 配置凭证

- 进入 Supabase 项目 → Settings → API
- 复制 **Project URL** 和 **anon public key**
- 编辑 `js/supabase-client.js`，替换 `__SUPABASE_URL__` 和 `__SUPABASE_ANON_KEY__`

### 3. 初始化数据库

- Supabase → SQL Editor
- 粘贴运行 `supabase/schema.sql` 全部内容

### 4. 开启认证

- Authentication → Providers → Email
- 启用 Email provider（开发阶段建议关闭 Confirm email）

### 5. 部署

将项目文件上传到静态托管服务：

- **GitHub Pages**：push 到仓库，Settings → Pages 启用
- **Vercel**：`vercel deploy` 一键部署
- **本地**：用 VS Code Live Server 打开 `index.html`

## v1.x 用户迁移

v1.x 用户可导出数据（统计页 → 📤 导出）后，在 v2.0.0 登录页点击"从旧版迁移数据"，选择备份文件即可将所有任务和历史记录迁移到云端。

## 技术栈

- **前端**：HTML5 / CSS3 / Vanilla JS（零框架）
- **后端**：Supabase（PostgreSQL + Auth + RLS）
- **SDK**：@supabase/supabase-js v2（CDN）

## 许可证

MIT
