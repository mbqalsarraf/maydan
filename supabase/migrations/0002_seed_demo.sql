-- Idempotent demo seed. Everything here is FICTIONAL and flagged is_demo.
-- Run (or re-run any time to add fresh upcoming sessions):  select public.seed_demo();
create or replace function public.seed_demo() returns text language plpgsql set search_path = '' as $$
declare
  d date; today date := (now() at time zone 'Asia/Kuwait')::date;
  s record; h int;
begin
  insert into public.hosts (id, slug, kind, name_en, name_ar, about_en, about_ar, area, is_demo) values
    (md5('h-pottery')::uuid, 'dar-alteen', 'host', 'Dar Al-Teen Studio (demo)', 'استوديو دار الطين (تجريبي)', 'Fictional pottery studio for families.', 'استوديو فخار خيالي للعائلات.', 'Salmiya', true),
    (md5('h-bakery')::uuid, 'khubz-kitchen', 'host', 'Khubz & Co. Kitchen (demo)', 'مطبخ خبز وشركاه (تجريبي)', 'Fictional teaching kitchen.', 'مطبخ تعليمي خيالي.', 'Shuwaikh', true),
    (md5('h-sports')::uuid, 'mishref-youth', 'host', 'Mishref Youth Sports Club (demo)', 'نادي مشرف الرياضي للناشئين (تجريبي)', 'Fictional youth sports club.', 'نادٍ رياضي خيالي للناشئين.', 'Mishref', true),
    (md5('h-volunteers')::uuid, 'shatti-volunteers', 'host', 'Shatti Volunteers (demo)', 'متطوعو الشاطئ (تجريبي)', 'Fictional volunteer group.', 'فريق تطوعي خيالي.', 'Fahaheel', true),
    (md5('h-arts')::uuid, 'qalam-arts', 'host', 'Qalam Arts Centre (demo)', 'مركز قلم للفنون (تجريبي)', 'Fictional arts centre.', 'مركز فنون خيالي.', 'Kuwait City', true),
    (md5('h-online')::uuid, 'adasa-learning', 'host', 'Adasa Learning (demo)', 'عدسة للتعلّم (تجريبي)', 'Fictional online course maker.', 'منصة دورات إلكترونية خيالية.', 'Online', true),
    (md5('p-ac')::uuid, 'barid-ac', 'provider', 'Barid AC Care (demo)', 'بارد لخدمات التكييف (تجريبي)', 'Fictional AC service provider.', 'مزوّد خدمات تكييف خيالي.', 'Hawalli', true),
    (md5('p-plumb')::uuid, 'sanafer-plumbing', 'provider', 'Sanafer Plumbing (demo)', 'سنافر للسباكة (تجريبي)', 'Fictional plumbing provider.', 'مزوّد خدمات سباكة خيالي.', 'Salmiya', true),
    (md5('p-clean')::uuid, 'lamea-cleaning', 'provider', 'Lamea Home Cleaning (demo)', 'لامعة لتنظيف المنازل (تجريبي)', 'Fictional cleaning provider.', 'مزوّد خدمات تنظيف خيالي.', 'Jabriya', true)
  on conflict (id) do nothing;

  insert into public.service_definitions (id, slug, name_en, name_ar, scope_en, scope_ar, unit_en, unit_ar) values
    (md5('s-ac')::uuid, 'ac-cleaning', 'AC cleaning', 'تنظيف المكيف',
     'One standard split AC unit: indoor filter and coil wash, drain flush. No gas refill or repairs.',
     'وحدة سبليت قياسية واحدة: غسيل الفلتر والملف الداخلي وتسليك التصريف. لا يشمل تعبئة الغاز أو الإصلاح.', 'per unit', 'للوحدة'),
    (md5('s-tap')::uuid, 'tap-replacement', 'Basic tap replacement (labour)', 'تبديل حنفية عادية (أجرة اليد)',
     'Remove and fit one standard basin or sink tap. Labour only; the tap and parts are excluded.',
     'فك وتركيب حنفية مغسلة أو مطبخ عادية واحدة. أجرة اليد فقط؛ لا تشمل الحنفية أو القطع.', 'per tap', 'للحنفية'),
    (md5('s-clean')::uuid, 'home-cleaning', 'Home cleaning visit', 'زيارة تنظيف منزلي',
     'One cleaner for 4 hours, apartment up to 3 rooms. Cleaning supplies not included.',
     'عاملة واحدة لمدة 4 ساعات لشقة حتى 3 غرف. لا تشمل مواد التنظيف.', 'per visit', 'للزيارة')
  on conflict (id) do nothing;

  insert into public.listings (id, host_id, type, title_en, title_ar, description_en, description_ar, category, area,
      price_amount, min_age, max_age, level, is_flexible, duration_minutes, is_demo) values
    (md5('l-pottery')::uuid, md5('h-pottery')::uuid, 'workshop', 'Family Pottery Morning', 'صباح الفخار العائلي',
     'Shape and paint a small clay bowl together. All ages from 3; children take part with a parent or guardian. Aprons and clay provided.',
     'شكّلوا ولوّنوا وعاءً صغيراً من الطين معاً. لجميع الأعمار من 3 سنوات؛ يشارك الأطفال برفقة وليّ الأمر. المرايل والطين متوفرة.',
     'family', 'Salmiya', 6.000, 3, null, 'all', false, 90, true),
    (md5('l-bread')::uuid, md5('h-bakery')::uuid, 'workshop', 'Sourdough Baking Workshop (Adults)', 'ورشة خبز العجين المخمّر (للكبار)',
     'Hands-on evening workshop for adults (18+): starter care, shaping and baking. Take your loaf home.',
     'ورشة مسائية عملية للكبار (18+): العناية بالخميرة والتشكيل والخَبز. خذ رغيفك معك.',
     'food', 'Shuwaikh', 15.000, 18, null, 'beginner', false, 150, true),
    (md5('l-football')::uuid, md5('h-sports')::uuid, 'course', 'Kids'' Football Skills Clinic', 'عيادة مهارات كرة القدم للأطفال',
     'Dribbling, passing and small-sided games for ages 6 to 13. A parent or guardian books and stays reachable.',
     'مراوغة وتمرير ومباريات مصغّرة للأعمار من 6 إلى 13. يحجز وليّ الأمر ويبقى متاحاً للتواصل.',
     'sports', 'Mishref', 4.000, 6, 13, 'beginner', false, 90, true),
    (md5('l-beach')::uuid, md5('h-volunteers')::uuid, 'event', 'Sunset Beach Clean-up Walk', 'مشي وتنظيف الشاطئ عند الغروب',
     'A relaxed community walk collecting litter along the shore. Gloves and bags provided. Free.',
     'مشي مجتمعي هادئ لجمع المخلفات على الشاطئ. القفازات والأكياس متوفرة. مجاناً.',
     'outdoors', 'Fahaheel', 0.000, 3, null, 'all', false, 90, true),
    (md5('l-calligraphy')::uuid, md5('h-arts')::uuid, 'course', 'Arabic Calligraphy for Beginners', 'الخط العربي للمبتدئين',
     'Learn the basic strokes of Ruq''ah script with reed pen and ink. Ages 14 and up.',
     'تعلّم أساسيات خط الرقعة بالقلم والحبر. من عمر 14 فما فوق.',
     'arts', 'Kuwait City', 10.000, 14, null, 'beginner', false, 90, true),
    (md5('l-photo')::uuid, md5('h-online')::uuid, 'course', 'Phone Photography Basics (self-paced online)', 'أساسيات التصوير بالهاتف (دورة إلكترونية مرنة)',
     'Self-paced online lessons you can follow at any time during the access window. About 90 minutes in total.',
     'دروس إلكترونية مرنة تتابعها في أي وقت خلال فترة الإتاحة. حوالي 90 دقيقة إجمالاً.',
     'learning', 'Online', 5.000, 14, null, 'beginner', true, 90, true)
  on conflict (id) do nothing;

  insert into public.listings (id, host_id, type, title_en, title_ar, description_en, description_ar, category, area, price_amount,
      duration_minutes, service_def_id, inclusions_en, inclusions_ar, exclusions_en, exclusions_ar, includes_parts, includes_callout, min_age, is_demo) values
    (md5('sl-ac-barid')::uuid, md5('p-ac')::uuid, 'service', 'AC cleaning', 'تنظيف المكيف', '', '', 'home', 'Hawalli', 8.000, 60, md5('s-ac')::uuid,
     'Call-out included; filter and coil wash; drain flush', 'تشمل رسوم الزيارة؛ غسيل الفلتر والملف؛ تسليك التصريف', 'Gas refill; repairs; outdoor unit', 'تعبئة الغاز؛ الإصلاحات؛ الوحدة الخارجية', false, true, 18, true),
    (md5('sl-tap-barid')::uuid, md5('p-ac')::uuid, 'service', 'Basic tap replacement (labour)', 'تبديل حنفية عادية (أجرة اليد)', '', '', 'home', 'Hawalli', 6.000, 60, md5('s-tap')::uuid,
     'Labour for one tap', 'أجرة اليد لحنفية واحدة', 'Call-out fee; the tap and parts', 'رسوم الزيارة؛ الحنفية والقطع', false, false, 18, true),
    (md5('sl-tap-sanafer')::uuid, md5('p-plumb')::uuid, 'service', 'Basic tap replacement (labour)', 'تبديل حنفية عادية (أجرة اليد)', '', '', 'home', 'Salmiya', 5.000, 60, md5('s-tap')::uuid,
     'Call-out included; labour for one tap', 'تشمل رسوم الزيارة؛ أجرة اليد لحنفية واحدة', 'The tap and parts', 'الحنفية والقطع', false, true, 18, true),
    (md5('sl-clean-sanafer')::uuid, md5('p-plumb')::uuid, 'service', 'Home cleaning visit', 'زيارة تنظيف منزلي', '', '', 'home', 'Salmiya', 14.000, 60, md5('s-clean')::uuid,
     'Transport included; one cleaner, 4 hours', 'تشمل المواصلات؛ عاملة واحدة لمدة 4 ساعات', 'Cleaning supplies', 'مواد التنظيف', false, true, 18, true),
    (md5('sl-clean-lamea')::uuid, md5('p-clean')::uuid, 'service', 'Home cleaning visit', 'زيارة تنظيف منزلي', '', '', 'home', 'Jabriya', 12.000, 60, md5('s-clean')::uuid,
     'Transport included; one cleaner, 4 hours', 'تشمل المواصلات؛ عاملة واحدة لمدة 4 ساعات', 'Cleaning supplies', 'مواد التنظيف', false, true, 18, true),
    (md5('sl-ac-lamea')::uuid, md5('p-clean')::uuid, 'service', 'AC cleaning', 'تنظيف المكيف', '', '', 'home', 'Jabriya', 10.000, 60, md5('s-ac')::uuid,
     'Call-out included; filter and coil wash; drain flush', 'تشمل رسوم الزيارة؛ غسيل الفلتر والملف؛ تسليك التصريف', 'Gas refill; repairs', 'تعبئة الغاز؛ الإصلاحات', false, true, 18, true)
  on conflict (id) do nothing;

  -- Upcoming activity sessions for the next 3 weeks (dow: 0=Sun .. 4=Thu, 5=Fri, 6=Sat), Kuwait local times.
  for d in select generate_series(today + 1, today + 21, interval '1 day')::date loop
    for s in select * from (values
        ('l-pottery', 5, time '10:00', 90, 12), ('l-bread', 6, time '17:00', 150, 8),
        ('l-football', 6, time '09:00', 90, 16), ('l-beach', 5, time '16:00', 90, 40),
        ('l-calligraphy', 4, time '18:30', 90, 10), ('l-calligraphy', 6, time '11:00', 90, 10),
        ('l-pottery', 6, time '10:30', 90, 12), ('l-bread', 5, time '18:00', 150, 8)
      ) as t(k, dow, st, mins, cap) where t.dow = extract(dow from d)::int loop
      insert into public.occurrences (listing_id, starts_at, ends_at, capacity)
      values (md5(s.k)::uuid, (d + s.st) at time zone 'Asia/Kuwait', (d + s.st) at time zone 'Asia/Kuwait' + make_interval(mins => s.mins), s.cap)
      on conflict (listing_id, starts_at) do nothing;
    end loop;
    -- Provider appointment slots: Sun-Thu, 09:00-17:00, one hour each.
    if extract(dow from d)::int between 0 and 4 and d <= today + 14 then
      for h in 9..16 loop
        insert into public.occurrences (listing_id, starts_at, ends_at, capacity)
        select l.id, (d + make_time(h, 0, 0)) at time zone 'Asia/Kuwait', (d + make_time(h + 1, 0, 0)) at time zone 'Asia/Kuwait', 1
        from public.listings l where l.type = 'service' and l.is_demo
        on conflict (listing_id, starts_at) do nothing;
      end loop;
    end if;
  end loop;
  -- Flexible online course: one 30-day access window.
  insert into public.occurrences (listing_id, starts_at, ends_at, capacity)
  select md5('l-photo')::uuid, date_trunc('day', now()), date_trunc('day', now()) + interval '30 days', 200
  where not exists (select 1 from public.occurrences where listing_id = md5('l-photo')::uuid and ends_at > now() + interval '3 days');

  -- Sample price reports: SYNTHETIC demo data, never verified market rates.
  insert into public.price_reports (id, service_def_id, amount, currency, area, includes_parts, includes_callout, observed_on,
      source_type, verification, is_demo, reported_by)
  select md5('pr-' || t.svc || '-' || t.n)::uuid, md5(t.svc)::uuid, t.amount, 'KWD', t.area, false, t.callout,
         today - (t.n * 6), 'demo_sample', 'demo', true, null
  from (values
    ('s-ac', 1, 6.000, 'Hawalli', true), ('s-ac', 2, 7.000, 'Salmiya', true), ('s-ac', 3, 7.500, 'Jabriya', true),
    ('s-ac', 4, 8.000, 'Hawalli', true), ('s-ac', 5, 8.000, 'Kuwait City', true), ('s-ac', 6, 9.000, 'Mishref', true),
    ('s-ac', 7, 10.000, 'Salmiya', true), ('s-ac', 8, 10.000, 'Fahaheel', true), ('s-ac', 9, 12.000, 'Jabriya', true),
    ('s-ac', 10, 5.000, 'Hawalli', false), ('s-ac', 11, 6.000, 'Salmiya', false), ('s-ac', 12, 7.000, 'Mishref', false),
    ('s-tap', 1, 4.000, 'Salmiya', true), ('s-tap', 2, 5.000, 'Hawalli', true), ('s-tap', 3, 5.000, 'Jabriya', true),
    ('s-tap', 4, 6.000, 'Kuwait City', true), ('s-tap', 5, 6.000, 'Salmiya', true), ('s-tap', 6, 7.000, 'Mishref', true),
    ('s-tap', 7, 7.500, 'Fahaheel', true), ('s-tap', 8, 8.000, 'Hawalli', true), ('s-tap', 9, 10.000, 'Jabriya', true),
    ('s-tap', 10, 3.000, 'Salmiya', false), ('s-tap', 11, 4.000, 'Hawalli', false), ('s-tap', 12, 5.000, 'Fahaheel', false),
    ('s-clean', 1, 10.000, 'Jabriya', true), ('s-clean', 2, 11.000, 'Salmiya', true), ('s-clean', 3, 12.000, 'Hawalli', true),
    ('s-clean', 4, 12.000, 'Jabriya', true), ('s-clean', 5, 13.000, 'Kuwait City', true), ('s-clean', 6, 14.000, 'Salmiya', true),
    ('s-clean', 7, 15.000, 'Mishref', true), ('s-clean', 8, 16.000, 'Fahaheel', true), ('s-clean', 9, 18.000, 'Hawalli', true),
    ('s-clean', 10, 9.000, 'Jabriya', false), ('s-clean', 11, 10.000, 'Salmiya', false)
  ) as t(svc, n, amount, area, callout)
  on conflict (id) do nothing;

  -- Currency: illustrative demo rates only (units per 1 USD). Not live, not for transactions.
  insert into public.app_settings (key, value) values ('fx_mode', '"demo"'::jsonb), ('venue_buffer_minutes', '30'::jsonb)
  on conflict (key) do nothing;
  insert into public.fx_snapshots (id, mode, source, base, rates, effective_at, refresh_policy, note)
  values (md5('fx-demo')::uuid, 'demo', 'Maydan illustrative sample rates', 'USD',
    '{"USD":1,"KWD":0.307,"SAR":3.75,"AED":3.6725,"QAR":3.64,"BHD":0.376,"OMR":0.3845}'::jsonb,
    timestamptz '2026-11-01 00:00:00+00', 'static; never refreshed', 'Illustrative demo rates. Not live market data.')
  on conflict (id) do nothing;
  return 'seeded';
end $$;
revoke execute on function public.seed_demo() from public, anon, authenticated;
