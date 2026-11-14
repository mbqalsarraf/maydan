-- Removes the automated-test fixtures and the throwaway test accounts.
delete from public.reservations where occurrence_id in (select id from public.occurrences where listing_id = md5('t-l1')::uuid)
   or user_id in (select id from auth.users where email like 'maydan-test-%@example.com');
update public.occurrences o set booked_count = (select count(*) from public.reservations r where r.occurrence_id = o.id and r.status = 'confirmed');
delete from public.hosts where id = md5('t-host')::uuid;
delete from auth.users where email like 'maydan-test-%@example.com';
