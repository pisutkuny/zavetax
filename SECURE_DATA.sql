-- 1. ล้างข้อมูลเก่าทิ้ง (จำเป็นต้องทำ เพราะข้อมูลเก่าไม่มีเจ้าของ)
truncate table transactions;

-- 2. เพิ่มช่องเก็บ User ID (ตอนนี้ทำได้แล้ว เพราะตารางว่าง)
alter table transactions 
add column if not exists user_id uuid references auth.users not null default auth.uid();

-- 3. ลบนโยบายเก่า
drop policy if exists "Allow generic access" on transactions;

-- 4. สร้างกฎใหม่
create policy "Users can view own transactions" on transactions
  for select using (auth.uid() = user_id);

create policy "Users can insert own transactions" on transactions
  for insert with check (auth.uid() = user_id);

create policy "Users can update own transactions" on transactions
  for update using (auth.uid() = user_id);

create policy "Users can delete own transactions" on transactions
  for delete using (auth.uid() = user_id);
