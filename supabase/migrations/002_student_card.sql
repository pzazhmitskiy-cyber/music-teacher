-- Расширенная карточка ученика и список родителей.
-- Выполнить один раз в Supabase → SQL Editor (для баз, созданных до этого изменения).

alter table students
  add column last_name text,
  add column birth_date date,
  add column documents text,     -- паспорт, свидетельство и т.п.
  add column citizenship text,
  add column address text,
  add column instrument text,
  add column about text;         -- общая информация

create table parents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  student_id uuid not null references students on delete cascade,
  name text not null,
  phone text,
  email text,
  created_at timestamptz not null default now()
);
create index parents_student on parents (student_id);
alter table parents enable row level security;
create policy own on parents for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Переносим старые поля «Родитель» и «Телефон / Telegram»
insert into parents (owner_id, student_id, name, phone)
select owner_id, id, coalesce(parent_name, 'Родитель'), contact
from students
where parent_name is not null or contact is not null;

alter table students drop column parent_name, drop column contact;

-- Полное имя на странице для родителей
create or replace function parent_view(token text)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'name', trim(s.name || ' ' || coalesce(s.last_name, '')),
    'year_plan', s.year_plan,
    'slots', coalesce((
      select json_agg(json_build_object('weekday', r.weekday, 'time', to_char(r.start_time, 'HH24:MI'))
                      order by r.weekday, r.start_time)
      from recurring_slots r
      where r.student_id = s.id
        and r.starts_on <= current_date
        and (r.ends_on is null or r.ends_on >= current_date)
    ), '[]'::json),
    'upcoming', coalesce((
      select json_agg(json_build_object('date', l.lesson_date, 'time', to_char(l.start_time, 'HH24:MI'))
                      order by l.lesson_date, l.start_time)
      from (
        select lesson_date, start_time from lessons
        where student_id = s.id and status = 'planned' and slot_id is null
          and lesson_date >= current_date
        order by lesson_date, start_time limit 10
      ) l
    ), '[]'::json),
    'homework', coalesce((
      select json_agg(json_build_object('date', l.lesson_date, 'text', l.homework)
                      order by l.lesson_date desc)
      from (
        select lesson_date, homework from lessons
        where student_id = s.id and coalesce(homework, '') <> ''
        order by lesson_date desc limit 10
      ) l
    ), '[]'::json)
  )
  from students s
  where s.share_token = token and not s.archived;
$$;

revoke all on function parent_view(text) from public;
grant execute on function parent_view(text) to anon, authenticated;
