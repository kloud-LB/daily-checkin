# 每日打卡 (Daily Check-in)

零依赖、纯前端生活管理应用，支持 Supabase 云端同步。

## 功能模块

| 模块 | 说明 |
|------|------|
| 打卡 | 每日任务管理 + GitHub 风格热力图统计 |
| 待办 | 三级优先级 + 截止时间 + 分类管理 |
| 记账 | 收支记录 + 计算器 + 分类统计 + SVG 趋势图 |
| 体重管理 | 即将上线 |

## 版本

| 分支 | 版本 | 说明 |
|------|------|------|
| `main` | v1.x | 单 HTML 文件，localStorage 存储，下载即用 |
| `v2` | v2.1.1 | 模块化架构 + 通用数据引擎 + Remix Icons，Supabase 后端 |

## v2.x 快速开始

### 1. 创建 Supabase 项目

1. 注册 [supabase.com](https://supabase.com) 账号
2. 创建项目，选择 **Singapore** 区域
3. 等待数据库就绪（约2分钟）

### 2. 配置凭证

- 进入 Supabase 项目 → Settings → API
- 复制 **Project URL** 和 **anon public key**
- 编辑 `js/supabase-client.js`，替换 `SUPABASE_URL` 和 `SUPABASE_ANON_KEY`

### 3. 初始化数据库

- Supabase → SQL Editor
- 粘贴运行 `supabase/schema.sql` 全部内容（含 6 张表 + RLS 策略）

### 4. 开启认证

- Authentication → Providers → Email
- 启用 Email provider（开发阶段建议关闭 Confirm email）

### 5. 部署

将项目文件上传到静态托管服务：

- **GitHub Pages**：push 到仓库，Settings → Pages 启用
- **Vercel**：`vercel deploy` 一键部署
- **本地**：用 VS Code Live Server 打开 `index.html`

## v1.x 用户迁移

1. 先用 v1.x 版本导出 JSON 备份文件
2. 注册/登录 v2.x
3. 点击右上角头像 → 用户面板 →「导入」

## 技术栈

- **前端**：HTML5 / CSS3 / Vanilla JS（零框架）
- **图标**：[Remix Icon](https://remixicon.com) v4（CDN）
- **后端**：Supabase（PostgreSQL + Auth + RLS）
- **SDK**：@supabase/supabase-js v2（CDN）
- **主题色**：`#6b7db3`（低饱和度钢蓝）

## 路线图

| 版本 | 状态 | 内容 |
|------|------|------|
| v2.1.1 | ✅ 已发布 | Remix Icons + 低饱和度蓝 + 用户面板重构 |
| v2.2.0 | 📋 规划中 | PWA（全屏安装、离线缓存、桌面图标） |
| v2.3.0 | 💡 构思中 | 截图 OCR 自动记账 |

## 许可证

MIT
