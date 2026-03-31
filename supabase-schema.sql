-- 領収書テーブル
create table if not exists receipts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null,
  amount integer not null, -- 円単位
  store_name text not null,
  item_name text,
  purpose text,
  payment_method text not null check (payment_method in ('cash', 'card')),
  card_info text, -- e.g. "JCB 1139"
  image_url text not null,
  is_flagged boolean not null default false,
  month text not null, -- YYYY-MM
  created_at timestamptz default now() not null
);

-- 店名マスタ
create table if not exists store_names (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  created_at timestamptz default now() not null,
  unique (user_id, name)
);

-- 用途マスタ
create table if not exists purposes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz default now() not null,
  unique (user_id, name)
);

-- RLS 有効化
alter table receipts enable row level security;
alter table store_names enable row level security;
alter table purposes enable row level security;

-- receipts ポリシー
create policy "receipts: own data only"
  on receipts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- store_names ポリシー
create policy "store_names: own data only"
  on store_names for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- purposes ポリシー
create policy "purposes: own data only"
  on purposes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Storage バケット（Supabase ダッシュボードか管理APIで作成）
-- bucket: receipt-images (public: false)
