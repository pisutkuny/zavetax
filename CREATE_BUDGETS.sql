-- Create Budgets Table
create table if not exists public.budgets (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    category text not null,
    amount numeric not null default 0,
    alert_threshold integer default 80,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(user_id, category)
);

-- RLS Policies
alter table public.budgets enable row level security;

create policy "Users can view their own budgets"
on public.budgets for select
using (auth.uid() = user_id);

create policy "Users can insert their own budgets"
on public.budgets for insert
with check (auth.uid() = user_id);

create policy "Users can update their own budgets"
on public.budgets for update
using (auth.uid() = user_id);

create policy "Users can delete their own budgets"
on public.budgets for delete
using (auth.uid() = user_id);
