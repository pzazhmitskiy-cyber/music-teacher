-- Администраторы видят и меняют данные всех пользователей.
-- Выполнить один раз в Supabase → SQL Editor.

create table app_admins (
  user_id uuid primary key references auth.users on delete cascade
);
alter table app_admins enable row level security;
-- Через сайт список админов только читается; добавлять и убирать — в SQL Editor
create policy read_self on app_admins for select using (user_id = auth.uid());

create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from app_admins where user_id = auth.uid());
$$;
grant execute on function is_admin() to authenticated;

drop policy own on students;
drop policy own on parents;
drop policy own on recurring_slots;
drop policy own on lessons;
drop policy own on payments;

create policy own on students for all
  using (owner_id = auth.uid() or is_admin()) with check (owner_id = auth.uid() or is_admin());
create policy own on parents for all
  using (owner_id = auth.uid() or is_admin()) with check (owner_id = auth.uid() or is_admin());
create policy own on recurring_slots for all
  using (owner_id = auth.uid() or is_admin()) with check (owner_id = auth.uid() or is_admin());
create policy own on lessons for all
  using (owner_id = auth.uid() or is_admin()) with check (owner_id = auth.uid() or is_admin());
create policy own on payments for all
  using (owner_id = auth.uid() or is_admin()) with check (owner_id = auth.uid() or is_admin());

-- Назначить администратора (подставьте почту):
--   insert into app_admins (user_id) select id from auth.users where email = 'почта@example.com';
-- Убрать:
--   delete from app_admins where user_id = (select id from auth.users where email = 'почта@example.com');
