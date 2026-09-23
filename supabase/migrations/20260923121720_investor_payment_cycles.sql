-- Investor revenue follows receipts, grouped into 15th-to-14th cycles.
-- A settled cycle is an immutable snapshot: later receipts belong to a later cycle.

create or replace function srchub.get_investor_portal_data()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
with me as (
  select p.investor_id
  from srchub.profiles p
  where p.id = (select auth.uid())
    and p.is_active
    and p.role = 'investor'
    and p.investor_id is not null
),
owned as (
  select distinct ai.unit_id
  from srchub.asset_investments ai
  join me on me.investor_id = ai.investor_id
),
camera_rows as (
  select jsonb_build_object(
    'code', u.code,
    'name', u.name,
    'manufacturer', u.manufacturer,
    'model', u.model,
    'dailyRate', coalesce(u.default_daily_rate, 0),
    'cost', coalesce((select sum(e.amount_inr) from srchub.asset_expenses e where e.unit_id = u.id), u.purchase_cost, 0),
    'investors', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', i.name,
        'loc', coalesce(i.location, ''),
        'invested', ai.invested_amount_inr
      ) order by i.name)
      from srchub.asset_investments ai
      join srchub.investors i on i.id = ai.investor_id
      where ai.unit_id = u.id
    ), '[]'::jsonb),
    'expenses', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'id', e.id,
        'n', e.description,
        'usd', e.amount_usd,
        'inr', e.amount_inr
      )) order by e.sort, e.created_at)
      from srchub.asset_expenses e
      where e.unit_id = u.id
    ), '[]'::jsonb)
  ) as item
  from srchub.equipment_units u
  join owned o on o.unit_id = u.id
),
relevant_bookings as (
  select distinct b.*
  from srchub.bookings b
  join srchub.booking_lines linked_line on linked_line.booking_id = b.id
  join owned o on o.unit_id = linked_line.unit_id
  where b.deleted_at is null
),
booking_rows as (
  select jsonb_strip_nulls(jsonb_build_object(
    'code', b.code,
    'production', b.production_name,
    'project', b.project_name,
    'contact', b.contact_name,
    'status', b.status,
    'start', b.start_at,
    'end', b.end_at,
    'otherCharges', coalesce(b.other_charges_inr, 0),
    'discount', coalesce(b.discount_inr, 0),
    'deposit', coalesce(b.deposit_inr, 0),
    '_charges', coalesce((select t.charges_inr from srchub.v_booking_totals t where t.booking_id = b.id), 0),
    '_paid', coalesce((
      select sum(case when p.transaction_type::text = 'refund' then -p.amount_inr else p.amount_inr end)
      from srchub.payments p
      where p.booking_id = b.id
    ), 0),
    'cameras', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'code', u.code,
        'name', u.name,
        'rate', coalesce(bl.daily_rate_inr, 0),
        'qty', coalesce(bl.quantity, 1),
        'pricingMode', coalesce(bl.pricing_mode, 'per_day'),
        'start', bl.item_start_at,
        'end', bl.item_end_at,
        'returnedAt', bl.returned_at
      )) order by u.code)
      from srchub.booking_lines bl
      join srchub.equipment_units u on u.id = bl.unit_id
      join owned o on o.unit_id = u.id
      where bl.booking_id = b.id
    ), '[]'::jsonb),
    'accessories', '[]'::jsonb,
    'payments', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        '_id', p.id,
        'amount', p.amount_inr,
        'type', p.transaction_type,
        'method', p.method,
        'date', p.received_at,
        'ref', p.reference
      )) order by p.received_at, p.created_at)
      from srchub.payments p
      where p.booking_id = b.id
    ), '[]'::jsonb)
  )) as item
  from relevant_bookings b
),
settlement_rows as (
  select jsonb_build_object(
    'cam', u.code,
    'month', to_char(s.period_month, 'YYYY-MM-DD'),
    'date', coalesce(s.settled_at::date, s.period_month),
    'gross', coalesce(s.gross_received_inr, 0),
    'pool', coalesce(s.pool_inr, 0)
  ) as item
  from srchub.settlements s
  join srchub.equipment_units u on u.id = s.unit_id
  join owned o on o.unit_id = s.unit_id
),
payout_rows as (
  select jsonb_build_object(
    'cam', u.code,
    'investor', i.name,
    'amount', coalesce(sh.amount_inr, 0),
    'date', coalesce(sh.paid_at, s.settled_at::date),
    'mode', 'Monthly settlement',
    'month', to_char(s.period_month, 'YYYY-MM-DD')
  ) as item
  from srchub.settlement_shares sh
  join srchub.settlements s on s.id = sh.settlement_id
  join srchub.equipment_units u on u.id = s.unit_id
  join srchub.investors i on i.id = sh.investor_id
  join owned o on o.unit_id = s.unit_id
),
cfg as (
  select jsonb_build_object(
    'maintenancePct', coalesce(r.maintenance_pct, 0.10),
    'managerPct', coalesce(r.manager_pct, 0.10)
  ) as item
  from srchub.revenue_config r
  order by (r.unit_id is null) desc
  limit 1
)
select jsonb_build_object(
  'cameras', coalesce((select jsonb_agg(item) from camera_rows), '[]'::jsonb),
  'bookings', coalesce((select jsonb_agg(item) from booking_rows), '[]'::jsonb),
  'settlements', coalesce((select jsonb_agg(item) from settlement_rows), '[]'::jsonb),
  'payouts', coalesce((select jsonb_agg(item) from payout_rows), '[]'::jsonb),
  'config', coalesce((select item from cfg), jsonb_build_object('maintenancePct', 0.10, 'managerPct', 0.10))
);
$function$;

create or replace function srchub.settle_month(p_unit uuid, p_month date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_cycle_start date := case
    when extract(day from p_month) >= 15 then date_trunc('month', p_month)::date + 14
    else (date_trunc('month', p_month) - interval '1 month')::date + 14
  end;
  v_cycle_end date;
  v_gross numeric := 0;
  v_pool numeric := 0;
  v_mnt numeric;
  v_mgr numeric;
  v_total_invested numeric;
  v_settlement uuid;
  r record;
begin
  if not exists (
    select 1 from srchub.profiles p
    where p.id = (select auth.uid()) and p.is_active and p.role = 'admin'
  ) then
    raise exception 'Only an active admin can settle investor payouts' using errcode = '42501';
  end if;

  v_cycle_end := (v_cycle_start + interval '1 month' - interval '1 day')::date;
  if current_date <= v_cycle_end then
    raise exception 'This payment cycle is still open through %', v_cycle_end;
  end if;

  select s.id into v_settlement
  from srchub.settlements s
  where s.unit_id = p_unit and s.period_month = v_cycle_start;
  if v_settlement is not null then
    return v_settlement;
  end if;

  select maintenance_pct, manager_pct into v_mnt, v_mgr
  from srchub.revenue_config
  where unit_id = p_unit or unit_id is null
  order by unit_id nulls last
  limit 1;

  select coalesce(sum(
    (case when p.transaction_type::text = 'refund' then -p.amount_inr else p.amount_inr end)
    * camera_lines.camera_total_inr / nullif(t.charges_inr, 0)
  ), 0)
  into v_gross
  from srchub.payments p
  join srchub.v_booking_totals t on t.booking_id = p.booking_id
  join lateral (
    select sum(lc.line_total_inr) as camera_total_inr
    from srchub.booking_lines bl
    join srchub.v_booking_line_charges lc on lc.id = bl.id
    where bl.booking_id = p.booking_id and bl.unit_id = p_unit
  ) camera_lines on camera_lines.camera_total_inr is not null
  where p.received_at >= v_cycle_start
    and p.received_at < v_cycle_start + interval '1 month';

  v_gross := round(v_gross);
  v_pool := round(v_gross * (1 - coalesce(v_mnt, 0.10) - coalesce(v_mgr, 0.10)));

  insert into srchub.settlements(unit_id, period_month, gross_received_inr, pool_inr, status, settled_at)
  values (p_unit, v_cycle_start, v_gross, v_pool, 'settled', now())
  on conflict (unit_id, period_month) do nothing
  returning id into v_settlement;

  if v_settlement is null then
    select s.id into v_settlement
    from srchub.settlements s
    where s.unit_id = p_unit and s.period_month = v_cycle_start;
    return v_settlement;
  end if;

  select sum(invested_amount_inr) into v_total_invested
  from srchub.asset_investments
  where unit_id = p_unit;

  for r in
    select investor_id, invested_amount_inr
    from srchub.asset_investments
    where unit_id = p_unit
  loop
    insert into srchub.settlement_shares(settlement_id, investor_id, amount_inr)
    values (
      v_settlement,
      r.investor_id,
      round(v_pool * r.invested_amount_inr / nullif(v_total_invested, 0))
    );
  end loop;

  return v_settlement;
end;
$function$;

revoke execute on function srchub.settle_month(uuid, date) from public;
grant execute on function srchub.settle_month(uuid, date) to authenticated;
