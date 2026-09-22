alter table srchub.booking_lines
  add column if not exists pricing_mode text not null default 'per_day';

alter table srchub.booking_lines
  drop constraint if exists booking_lines_pricing_mode_check;

alter table srchub.booking_lines
  add constraint booking_lines_pricing_mode_check
  check (pricing_mode in ('per_day', 'flat'));

create or replace view srchub.v_booking_line_charges as
select
  bl.id,
  bl.booking_id,
  bl.unit_id,
  bl.kind,
  bl.daily_rate_inr,
  bl.quantity,
  bl.item_start_at,
  bl.item_end_at,
  bl.returned_at,
  bl.checkout_hours,
  bl.return_hours,
  bl.condition_out,
  bl.condition_in,
  bl.added_mid_booking,
  bl.created_at,
  coalesce(bl.item_start_at, b.start_at) as eff_start,
  coalesce(bl.returned_at, bl.item_end_at, b.end_at) as eff_end,
  greatest(1, coalesce(bl.returned_at, bl.item_end_at, b.end_at) - coalesce(bl.item_start_at, b.start_at)) as days,
  case
    when bl.pricing_mode = 'flat' then bl.daily_rate_inr * bl.quantity
    else bl.daily_rate_inr
      * greatest(1, coalesce(bl.returned_at, bl.item_end_at, b.end_at) - coalesce(bl.item_start_at, b.start_at))
      * bl.quantity
  end as line_total_inr
from srchub.booking_lines bl
join srchub.bookings b on b.id = bl.booking_id;
