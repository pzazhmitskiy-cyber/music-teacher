-- 10 тестовых учеников с разными настройками.
-- 1) Впишите свою почту в строке ниже (с ней вы входите на сайт).
-- 2) Выполните в Supabase → SQL Editor.
-- Все тестовые ученики помечены «[тест]» в заметках. Удалить их: supabase/cleanup_test.sql

do $$
declare
  me uuid := (select id from auth.users where email = 'ВАША_ПОЧТА@example.com');
  s uuid;
begin
  if me is null then
    raise exception 'Пользователь с такой почтой не найден: проверьте адрес в первой строке';
  end if;

  -- 1. Частная, два урока в неделю, полная карточка, мама
  insert into students (owner_id, name, last_name, instrument, kind, price, duration_min, birth_date, citizenship, address, documents, about, year_plan, notes)
  values (me, 'Маша', 'Тестова', 'фортепиано', 'private', 1500, 45, '2015-03-08', 'Россия, Кипр', 'Лимассол, ул. Примерная 1',
          'Свидетельство о рождении II-АБ 123456', 'Любит Шопена, стесняется выступать',
          E'Сентябрь — гаммы и этюды\nДекабрь — зимний концерт\nМай — экзамен', '[тест] Мама просит сообщать о переносах заранее')
  returning id into s;
  insert into parents (owner_id, student_id, name, phone, email) values (me, s, 'Мама: Ирина', '+357 99 000001', 'irina@example.com');
  insert into recurring_slots (owner_id, student_id, weekday, start_time, duration_min) values (me, s, 2, '16:00', 45), (me, s, 4, '17:30', 45);
  insert into payments (owner_id, student_id, amount, note) values (me, s, 6000, 'за 4 урока');

  -- 2. Школа, 30 минут, утро понедельника
  insert into students (owner_id, name, last_name, instrument, kind, price, duration_min, notes)
  values (me, 'Петя', 'Тестов', 'скрипка', 'school', 800, 30, '[тест]') returning id into s;
  insert into recurring_slots (owner_id, student_id, weekday, start_time, duration_min) values (me, s, 1, '09:00', 30);

  -- 3. Без фамилии, только разовые уроки
  insert into students (owner_id, name, instrument, price, duration_min, notes)
  values (me, 'Аня', 'вокал', 2000, 60, '[тест] только разовые') returning id into s;
  insert into lessons (owner_id, student_id, lesson_date, start_time, duration_min, price)
  values (me, s, current_date + 2, '12:00', 60, 2000), (me, s, current_date + 9, '12:00', 60, 2000);

  -- 4. Воскресенье вечером
  insert into students (owner_id, name, last_name, instrument, price, notes)
  values (me, 'Борис', 'Тестов', 'гитара', 1200, '[тест]') returning id into s;
  insert into recurring_slots (owner_id, student_id, weekday, start_time) values (me, s, 7, '20:30');

  -- 5. Начинает со следующей недели
  insert into students (owner_id, name, last_name, price, notes)
  values (me, 'Оля', 'Тестова', 1500, '[тест] начинает через неделю') returning id into s;
  insert into recurring_slots (owner_id, student_id, weekday, start_time, starts_on) values (me, s, 3, '15:00', current_date + 7);

  -- 6. В архиве
  insert into students (owner_id, name, last_name, price, archived, notes)
  values (me, 'Дима', 'Тестов', 1000, true, '[тест] в архиве') returning id into s;

  -- 7. Два родителя
  insert into students (owner_id, name, last_name, instrument, price, notes)
  values (me, 'Ева', 'Тестова', 'виолончель', 1800, '[тест]') returning id into s;
  insert into parents (owner_id, student_id, name, phone, email) values
    (me, s, 'Мама: Ольга', '+357 99 000002', 'olga@example.com'),
    (me, s, 'Папа: Андрей', '+7 900 000-00-03', null);
  insert into recurring_slots (owner_id, student_id, weekday, start_time) values (me, s, 5, '18:00');

  -- 8. Длинное имя со спецсимволами
  insert into students (owner_id, name, last_name, price, notes)
  values (me, 'Лев', 'О''Брайен-Тестовский-Длиннофамильный', 1300, '[тест]') returning id into s;
  insert into recurring_slots (owner_id, student_id, weekday, start_time) values (me, s, 3, '19:00');

  -- 9. Поздно и долго: 22:30, 90 минут
  insert into students (owner_id, name, last_name, price, duration_min, notes)
  values (me, 'Соня', 'Тестова', 2500, 90, '[тест]') returning id into s;
  insert into recurring_slots (owner_id, student_id, weekday, start_time, duration_min) values (me, s, 1, '22:30', 90);

  -- 10. Бесплатный, суббота
  insert into students (owner_id, name, last_name, instrument, price, notes)
  values (me, 'Ника', 'Тестова', 'флейта', 0, '[тест] бесплатно') returning id into s;
  insert into recurring_slots (owner_id, student_id, weekday, start_time) values (me, s, 6, '11:00');
end $$;
