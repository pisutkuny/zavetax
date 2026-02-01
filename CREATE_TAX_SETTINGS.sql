-- Create tax_settings table to store annual tax deduction configurations
create table tax_settings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  year integer not null,
  filing_status text check (filing_status in ('single', 'married_joint', 'married_separate')) default 'single',
  deductions jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  -- Ensure one setting per year per user
  unique(user_id, year)
);

-- Enable RLS
alter table tax_settings enable row level security;

-- Policies
create policy "Users can view own tax settings" on tax_settings
  for select using (auth.uid() = user_id);

create policy "Users can insert own tax settings" on tax_settings
  for insert with check (auth.uid() = user_id);

create policy "Users can update own tax settings" on tax_settings
  for update using (auth.uid() = user_id);
