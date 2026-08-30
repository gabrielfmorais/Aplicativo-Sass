-- SPEC-010 AC1–AC12 — subscriptions & entitlements under a hostile client: no direct writes, the
-- single service-role write path, idempotent redelivery, out-of-order rejection, unmapped events,
-- the status→capability truth table (parity with the core catalogue), fail-closed free, isolation.
begin;
create extension if not exists pgtap with schema extensions;
select plan(40);

insert into auth.users (id, instance_id, aud, role, email)
values ('00000000-0000-4000-8000-0000000000a6', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a6@example.test'),
       ('00000000-0000-4000-8000-0000000000b6', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b6@example.test');

-- ------------------------------------------------------------------------- foundation guardrails
select is((select count(*)::int from tests.tables_without_rls()), 0, 'subscriptions/billing_events have RLS enabled and forced');
select is((select count(*)::int from tests.unapproved_grants()), 0, 'grants are allow-listed (SPEC-010)');
select is((select count(*)::int from tests.unapproved_security_definer_functions()), 0, 'apply_billing_event is allow-listed');
select is((select count(*)::int from tests.unpinned_security_definer_functions()), 0, 'apply_billing_event has a pinned search_path');

-- --------------------------------------------------------------- no direct writes ever (AC3)
select tests.as_user('00000000-0000-4000-8000-0000000000a6');
select throws_ok(
  $$ insert into public.subscriptions (user_id, status, product_code, provider)
     values ('00000000-0000-4000-8000-0000000000a6', 'active', 'p', 'manual') $$,
  '42501', null, 'authenticated cannot INSERT a subscription');
select throws_ok(
  $$ update public.subscriptions set status = 'active' $$,
  '42501', null, 'authenticated cannot UPDATE a subscription (no forged premium — T04)');
select throws_ok(
  $$ delete from public.subscriptions $$,
  '42501', null, 'authenticated cannot DELETE a subscription');
select throws_ok(
  $$ select * from public.billing_events $$,
  '42501', null, 'authenticated cannot read the webhook audit table');
select tests.as_anon();
select throws_ok(
  $$ select * from public.subscriptions $$,
  '42501', null, 'anon cannot read subscriptions');

-- ------------------------------------------------------------------------- a valid event (AC1)
select tests.as_anon();
reset role;
set local role service_role;
select is(
  public.apply_billing_event('evt-a-1', '00000000-0000-4000-8000-0000000000a6', 'purchase',
    now(), 'revenuecat', 'active', 'prod_monthly', now() + interval '30 days', 'h1'),
  true, 'a valid purchase event is applied');
reset role;
select is((select status from public.subscriptions where user_id = '00000000-0000-4000-8000-0000000000a6'),
          'active', 'the subscription reflects the event (AC1)');

select tests.as_user('00000000-0000-4000-8000-0000000000a6');
select ok(public.has_entitlement('plan_customization'), 'an active subscriber has the capability server-side (AC1)');
select is((select count(*)::int from public.get_my_entitlements()), 3, 'she is granted the whole catalogue (one plan, NG2)');
select ok(not public.has_entitlement('not_a_real_code'), 'a code outside the catalogue is never granted');

-- ------------------------------------------------------------------- idempotent redelivery (AC2)
select tests.as_anon();
reset role;
set local role service_role;
select is(
  public.apply_billing_event('evt-a-1', '00000000-0000-4000-8000-0000000000a6', 'purchase',
    now(), 'revenuecat', 'active', 'prod_monthly', now() + interval '30 days', 'h1'),
  false, 'the same event_id redelivered is a no-op (AC2/FR8)');
reset role;
select is((select count(*)::int from public.billing_events where user_id = '00000000-0000-4000-8000-0000000000a6'),
          1, 'the redelivery created no second audit row');

-- --------------------------------------------------------------------- out of order (EC3/AC10)
set local role service_role;
select is(
  public.apply_billing_event('evt-a-0', '00000000-0000-4000-8000-0000000000a6', 'expire',
    now() - interval '1 day', 'revenuecat', 'expired', 'prod_monthly', now() - interval '1 day', 'h0'),
  true, 'an older event is recorded');
reset role;
select is((select status from public.subscriptions where user_id = '00000000-0000-4000-8000-0000000000a6'),
          'active', 'a stale (older) event does not regress the state (AC10)');
select is((select count(*)::int from public.billing_events where event_id = 'evt-a-0'), 1,
          'the stale event is still recorded for audit (AC10)');
set local role service_role;
select is(
  public.apply_billing_event('evt-a-2', '00000000-0000-4000-8000-0000000000a6', 'cancel',
    now() + interval '1 hour', 'revenuecat', 'cancelled', 'prod_monthly', now() + interval '1 hour', 'h2'),
  true, 'a newer event is applied');
reset role;
select is((select status from public.subscriptions where user_id = '00000000-0000-4000-8000-0000000000a6'),
          'cancelled', 'the newer event advances the state');
select tests.as_user('00000000-0000-4000-8000-0000000000a6');
select ok(not public.has_entitlement('plan_customization'), 'a cancelled subscription denies the capability (EC8)');

-- ----------------------------------------------------------------- event without a user (EC4/AC12)
select tests.as_anon();
reset role;
set local role service_role;
select is(
  public.apply_billing_event('evt-orphan', null, 'purchase',
    now(), 'revenuecat', 'active', 'prod_monthly', now() + interval '30 days', 'h-orphan'),
  true, 'an unmapped event is recorded for audit');
reset role;
select is((select count(*)::int from public.billing_events where user_id is null and event_id = 'evt-orphan'),
          1, 'the unmapped event is kept with user_id null (AC12)');
select is((select count(*)::int from public.subscriptions), 1, 'no subscription is created for an unmapped event (AC12)');

-- A well-formed uuid that is not a current user (never existed / deleted account) is treated the same
-- as unmapped: audited with a null user_id, no subscription, and — critically — no FK abort that would
-- lose the audit row and 5xx-loop the provider (improve IMPORTANT finding, PR-C).
set local role service_role;
select is(
  public.apply_billing_event('evt-ghost', '00000000-0000-4000-8000-0000000000ff', 'purchase',
    now(), 'revenuecat', 'active', 'prod_monthly', now() + interval '30 days', 'h-ghost'),
  true, 'an event for a non-existent user is recorded, not aborted');
reset role;
select is((select count(*)::int from public.billing_events where event_id = 'evt-ghost' and user_id is null),
          1, 'the event for a non-existent user is audited with null (EC4/AC12)');
select is((select count(*)::int from public.subscriptions where user_id = '00000000-0000-4000-8000-0000000000ff'),
          0, 'no subscription is created for a non-existent user');

-- ------------------------------------ malformed but mapped event: audited, not applied (defence in depth)
-- The newest event for A (so it clears the ordering guard) but with an invalid status: the upsert
-- fails the CHECK, yet the transaction must not abort — otherwise the audit row is lost and the
-- provider redelivers forever. Exercises the subtransaction added for the improve IMPORTANT finding.
set local role service_role;
select is(
  public.apply_billing_event('evt-a-bad', '00000000-0000-4000-8000-0000000000a6', 'weird',
    now() + interval '2 hours', 'revenuecat', 'not_a_status', 'prod_monthly', now() + interval '30 days', 'h-bad'),
  true, 'a malformed (invalid status) event for a mapped user is recorded, not raised (no infinite retry)');
reset role;
select is((select count(*)::int from public.billing_events where event_id = 'evt-a-bad'), 1,
          'the malformed event is audited — the failed upsert did not roll back the audit row');
select is((select status from public.subscriptions where user_id = '00000000-0000-4000-8000-0000000000a6'),
          'cancelled', 'the malformed event left the state untouched');

-- ------------------------------------------------------------- free by default + isolation (BR1/FR7)
select tests.as_user('00000000-0000-4000-8000-0000000000b6');
select ok(not public.has_entitlement('premium_content'), 'a user with no subscription is free (fail closed, §16)');
select is((select count(*)::int from public.get_my_entitlements()), 0, 'free means no granted codes');
select is((select count(*)::int from public.subscriptions), 0, 'B sees none of A''s subscription (RLS isolation)');

-- ------------------------------------------------- status→capability truth table (AC6 parity, SQL side)
-- Each granting status grants; each denying status does not. Mirrors GRANTING_SUBSCRIPTION_STATUSES.
reset role;
insert into public.subscriptions (user_id, status, product_code, provider)
values ('00000000-0000-4000-8000-0000000000b6', 'trial', 'p', 'manual');
select tests.as_user('00000000-0000-4000-8000-0000000000b6');
select ok(public.has_entitlement('advanced_insights'), 'trial grants');

reset role;
update public.subscriptions set status = 'active' where user_id = '00000000-0000-4000-8000-0000000000b6';
select tests.as_user('00000000-0000-4000-8000-0000000000b6');
select ok(public.has_entitlement('advanced_insights'), 'active grants');

reset role;
update public.subscriptions set status = 'grace' where user_id = '00000000-0000-4000-8000-0000000000b6';
select tests.as_user('00000000-0000-4000-8000-0000000000b6');
select ok(public.has_entitlement('advanced_insights'), 'grace grants (payment retry, BR3)');

reset role;
update public.subscriptions set status = 'expired' where user_id = '00000000-0000-4000-8000-0000000000b6';
select tests.as_user('00000000-0000-4000-8000-0000000000b6');
select ok(not public.has_entitlement('advanced_insights'), 'expired denies');

reset role;
update public.subscriptions set status = 'cancelled' where user_id = '00000000-0000-4000-8000-0000000000b6';
select tests.as_user('00000000-0000-4000-8000-0000000000b6');
select ok(not public.has_entitlement('advanced_insights'), 'cancelled denies');

reset role;
update public.subscriptions set status = 'refunded' where user_id = '00000000-0000-4000-8000-0000000000b6';
select tests.as_user('00000000-0000-4000-8000-0000000000b6');
select ok(not public.has_entitlement('advanced_insights'), 'refunded denies');

select * from finish();
rollback;
