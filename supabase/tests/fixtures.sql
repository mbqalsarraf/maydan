-- Fixtures for scripts/test-backend.mjs (run as an administrator in the SQL editor). Remove with cleanup.sql.
insert into public.hosts (id, slug, kind, name_en, name_ar, area, is_demo) values (md5('t-host')::uuid, 'zz-test-host', 'host', 'ZZ Automated Test Host', 'اختبار آلي', 'Salmiya', true) on conflict do nothing;
insert into public.listings (id, host_id, type, title_en, title_ar, category, area, price_amount, min_age, duration_minutes, is_demo) values (md5('t-l1')::uuid, md5('t-host')::uuid, 'event', 'ZZ Automated Test Listing', 'اختبار آلي', 'family', 'Salmiya', 1, 3, 60, true) on conflict do nothing;
insert into public.occurrences (id, listing_id, starts_at, ends_at, capacity) values
 (md5('t-o1')::uuid, md5('t-l1')::uuid, now() + interval '2 days', now() + interval '2 days 1 hour', 1),
 (md5('t-o2')::uuid, md5('t-l1')::uuid, now() + interval '3 days', now() + interval '3 days 1 hour', 5),
 (md5('t-o3')::uuid, md5('t-l1')::uuid, now() + interval '3 days 30 minutes', now() + interval '3 days 90 minutes', 5),
 (md5('t-o4')::uuid, md5('t-l1')::uuid, now() - interval '1 day', now() - interval '23 hours', 5) on conflict do nothing;
