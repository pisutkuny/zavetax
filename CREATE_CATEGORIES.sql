-- Create categories table
create table categories (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  name text not null,
  type text not null check (type in ('income', 'expense')),
  is_default boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table categories enable row level security;

-- Policies
create policy "Users can view their own categories"
on categories for select
using (auth.uid() = user_id);

create policy "Users can insert their own categories"
on categories for insert
with check (auth.uid() = user_id);

create policy "Users can update their own categories"
on categories for update
using (auth.uid() = user_id);

create policy "Users can delete their own categories"
on categories for delete
using (auth.uid() = user_id);

-- Create index
create index categories_user_id_type_idx on categories (user_id, type);
