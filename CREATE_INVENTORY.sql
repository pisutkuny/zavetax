
-- Create Inventory Items Table
create table inventory_items (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  name text not null,
  quantity numeric default 0,
  unit text not null, -- e.g. kg, pack, pcs
  cost_per_unit numeric default 0,
  low_stock_threshold numeric default 5,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, name)
);

-- RLS for Items
alter table inventory_items enable row level security;

create policy "Users can view their own inventory items"
  on inventory_items for select
  using (auth.uid() = user_id);

create policy "Users can insert their own inventory items"
  on inventory_items for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own inventory items"
  on inventory_items for update
  using (auth.uid() = user_id);

create policy "Users can delete their own inventory items"
  on inventory_items for delete
  using (auth.uid() = user_id);


-- Create Inventory Logs Table (History)
create table inventory_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  item_id uuid references inventory_items(id) on delete cascade not null,
  change_amount numeric not null, -- + for Add, - for Use
  reason text, -- e.g. Purchase, Daily Use, Spoilage
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS for Logs
alter table inventory_logs enable row level security;

create policy "Users can view their own inventory logs"
  on inventory_logs for select
  using (auth.uid() = user_id);

create policy "Users can insert their own inventory logs"
  on inventory_logs for insert
  with check (auth.uid() = user_id);
