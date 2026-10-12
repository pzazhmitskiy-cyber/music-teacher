-- Схема базы. Выполнить один раз в Supabase → SQL Editor.

-- Ученики
create table students (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  kind text not null default 'private' check (kind in ('private', 'school')),
  parent_name text,
  contact text,
  price integer not null default 0,          -- цена урока, ₽
  duration_min integer not null default 45,  -- длительность по умолчанию
  notes text,                                -- личные заметки, родителям не видны
  year_plan text,                            -- годовой план, виден родителям
  share_token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

-- Постоянные уроки: «каждый вторник в 16:00»
create table recurring_slots (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  student_id uuid not null references students on delete cascade,
  weekday smallint not null check (weekday between 1 and 7), -- 1 = понедельник
  start_time time not null,
  duration_min integer not null default 45,
  starts_on date not null default current_date,
  ends_on date
);

-- Конкретные уроки. Постоянные создаются из recurring_slots при просмотре недели.
create table lessons (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  student_id uuid not null references students on delete cascade,
  slot_id uuid references recurring_slots on delete set null,
  slot_date date,               -- дата по расписанию; не меняется при переносе
  lesson_date date not null,
  start_time time not null,
  duration_min integer not null default 45,
  price integer not null default 0,
  status text not null default 'planned'
    check (status in ('planned', 'done', 'cancelled', 'missed')),
  homework text,                -- видно родителям
  note text,                    -- личная заметка
  created_at timestamptz not null default now(),
  unique (slot_id, slot_date)
);
create index lessons_date on lessons (owner_id, lesson_date);
create index lessons_student on lessons (student_id, lesson_date);

-- Оплаты
create table payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  student_id uuid not null references students on delete cascade,
  amount integer not null,
  paid_on date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);
create index payments_student on payments (student_id, paid_on);

-- Каждый видит только свои данные
alter table students enable row level security;
alter table recurring_slots enable row level security;
alter table lessons enable row level security;
alter table payments enable row level security;

create policy own on students for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy own on recurring_slots for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy own on lessons for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy own on payments for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Страница для родителей: по секретной ссылке отдаёт только то, что можно показать.
create or replace function parent_view(token text)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'name', s.name,
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
