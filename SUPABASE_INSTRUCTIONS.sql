-- Copy and paste this into Supabase SQL Editor

create table transactions (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  type text check (type in ('income', 'expense')),
  amount numeric not null,
  category text,
  note text,
  date date default current_date
  -- user_id uuid references auth.users -- Uncomment this if you implement Auth later
);

-- Turn on Row Level Security (Important for real apps)
alter table transactions enable row level security;

-- Policy to allow anonymous read/write (For development ONLY)
create policy "Allow generic access" on transactions
  for all using (true) with check (true);
