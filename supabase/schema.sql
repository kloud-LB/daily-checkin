-- ================================================================
-- Daily Check-in v2.0.0 — Supabase Database Schema
-- Run this in Supabase SQL Editor: https://app.supabase.com
-- ================================================================

-- 1. Check-in Tasks
CREATE TABLE IF NOT EXISTS checkin_tasks (
  id            BIGINT PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  target_count  INT DEFAULT 1 CHECK (target_count >= 1 AND target_count <= 99),
  color         TEXT DEFAULT '#6366f1',
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_checkin_tasks_user ON checkin_tasks(user_id);

-- 2. Check-in History
CREATE TABLE IF NOT EXISTS checkin_history (
  id            BIGSERIAL PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id       BIGINT NOT NULL REFERENCES checkin_tasks(id) ON DELETE CASCADE,
  date          DATE NOT NULL,
  count         INT DEFAULT 1 CHECK (count >= 1),
  completed_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, task_id, date)
);
CREATE INDEX idx_checkin_history_user_date ON checkin_history(user_id, date);
CREATE INDEX idx_checkin_history_task ON checkin_history(task_id);

-- 3. Todo Categories
CREATE TABLE IF NOT EXISTS todo_categories (
  id            TEXT PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  color         TEXT DEFAULT '#6366f1',
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_todo_categories_user ON todo_categories(user_id);

-- 4. Todo Items
CREATE TABLE IF NOT EXISTS todo_items (
  id            BIGINT PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id   TEXT REFERENCES todo_categories(id) ON DELETE SET NULL,
  title         TEXT NOT NULL,
  description   TEXT DEFAULT '',
  deadline      TIMESTAMPTZ,
  priority      TEXT DEFAULT 'medium' CHECK (priority IN ('high','medium','low')),
  status        TEXT DEFAULT 'pending' CHECK (status IN ('pending','completed','postponed','cancelled')),
  created_at    TIMESTAMPTZ DEFAULT now(),
  completed_at  TIMESTAMPTZ
);
CREATE INDEX idx_todo_items_user ON todo_items(user_id);
CREATE INDEX idx_todo_items_category ON todo_items(category_id);
CREATE INDEX idx_todo_items_status ON todo_items(user_id, status);

-- 5. User Profiles
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname    TEXT NOT NULL,
  avatar      TEXT DEFAULT '👤',
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- 6. Bookkeeping Records
CREATE TABLE IF NOT EXISTS bookkeeping_records (
  id            BIGINT PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  amount        DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  category      TEXT NOT NULL,
  note          TEXT DEFAULT '',
  date          DATE NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_bk_records_user_date ON bookkeeping_records(user_id, date);
CREATE INDEX idx_bk_records_user_cat ON bookkeeping_records(user_id, category);

-- 7. Enable Row Level Security
ALTER TABLE checkin_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkin_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE todo_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE todo_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookkeeping_records ENABLE ROW LEVEL SECURITY;

-- 8. RLS Policies: each user can only access their own data
CREATE POLICY "user_own_tasks" ON checkin_tasks
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_own_history" ON checkin_history
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_own_todo_categories" ON todo_categories
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_own_todo_items" ON todo_items
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_own_profile" ON user_profiles
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_own_bk_records" ON bookkeeping_records
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
