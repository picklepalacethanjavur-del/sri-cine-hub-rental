-- Flexible Technicians and Crew Members directories for the srchub schema.
-- This script is idempotent and mirrors the staff-only access model used by
-- Customers and Suppliers. Investors cannot access these directory tables.

create table if not exists srchub.technician_expertise_areas (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists technician_expertise_areas_name_uidx
  on srchub.technician_expertise_areas (lower(btrim(name)));
create index if not exists technician_expertise_areas_active_sort_idx
  on srchub.technician_expertise_areas (sort_order, name)
  where is_active;

create table if not exists srchub.technician_subcategories (
  id uuid primary key default gen_random_uuid(),
  expertise_area_id uuid not null references srchub.technician_expertise_areas(id) on delete restrict,
  name text not null check (btrim(name) <> ''),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists technician_subcategories_area_name_uidx
  on srchub.technician_subcategories (expertise_area_id, lower(btrim(name)));
create index if not exists technician_subcategories_area_active_idx
  on srchub.technician_subcategories (expertise_area_id, sort_order, name)
  where is_active;

create table if not exists srchub.technicians (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (btrim(full_name) <> ''),
  phone_number text not null check (btrim(phone_number) <> ''),
  expertise_area_ids uuid[] not null default '{}',
  subcategory_ids uuid[] not null default '{}',
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists technicians_active_name_idx
  on srchub.technicians (lower(full_name))
  where is_active;
create index if not exists technicians_expertise_area_ids_idx
  on srchub.technicians using gin (expertise_area_ids);
create index if not exists technicians_subcategory_ids_idx
  on srchub.technicians using gin (subcategory_ids);

create table if not exists srchub.crew_roles (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists crew_roles_name_uidx
  on srchub.crew_roles (lower(btrim(name)));
create index if not exists crew_roles_active_sort_idx
  on srchub.crew_roles (sort_order, name)
  where is_active;

create table if not exists srchub.crew_members (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (btrim(full_name) <> ''),
  phone_number text not null check (btrim(phone_number) <> ''),
  role_ids uuid[] not null default '{}',
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crew_members_active_name_idx
  on srchub.crew_members (lower(full_name))
  where is_active;
create index if not exists crew_members_role_ids_idx
  on srchub.crew_members using gin (role_ids);

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'technician_expertise_areas', 'technician_subcategories', 'technicians',
    'crew_roles', 'crew_members'
  ] loop
    execute format('alter table srchub.%I enable row level security', table_name);
    execute format('drop policy if exists p_staff_all on srchub.%I', table_name);
    execute format(
      'create policy p_staff_all on srchub.%I for all to authenticated using (srchub.is_staff()) with check (srchub.is_staff())',
      table_name
    );
    execute format('revoke all on table srchub.%I from anon', table_name);
    execute format('grant select, insert, update, delete on table srchub.%I to authenticated, service_role', table_name);
    execute format('drop trigger if exists set_updated_at on srchub.%I', table_name);
    execute format(
      'create trigger set_updated_at before update on srchub.%I for each row execute function srchub.set_updated_at()',
      table_name
    );
  end loop;
end $$;

insert into srchub.technician_expertise_areas (name, sort_order)
values
  ('Camera Service', 10),
  ('Lens Service', 20),
  ('Lighting Service', 30),
  ('Sound Equipment', 40),
  ('Grip Equipment', 50),
  ('Battery / Power', 60),
  ('Electronics', 70),
  ('Other', 999)
on conflict do nothing;

insert into srchub.crew_roles (name, sort_order)
values
  ('Cinematographer / DOP', 10),
  ('Camera Operator', 20),
  ('Focus Puller', 30),
  ('1st Camera Assistant', 40),
  ('2nd Camera Assistant', 50),
  ('3rd Camera Assistant', 60),
  ('DIT', 70),
  ('Other', 999)
on conflict do nothing;
