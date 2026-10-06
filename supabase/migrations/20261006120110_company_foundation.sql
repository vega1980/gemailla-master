-- Primera fase: empresas y membresías. No cambia el proveedor de la aplicación.
-- Ejecutar en un proyecto Supabase de desarrollo mediante el historial de migraciones.
begin;

create schema if not exists gemailla_private;
revoke all on schema gemailla_private from public, anon, authenticated;
grant usage on schema gemailla_private to authenticated;

-- Los IDs de empresa son texto para conservar los IDs existentes de Firestore.
-- Los usuarios usan los UUID de Supabase Auth; su importación requiere un mapa de UIDs.
create table public.companies (
  id text primary key check (id ~ '^[A-Za-z0-9_-]{1,128}$'),
  owner_uid uuid not null references auth.users(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 180),
  rfc text not null default '' check (char_length(rfc) <= 20),
  industry text not null default '' check (char_length(industry) <= 100),
  address text not null default '' check (char_length(address) <= 500),
  phone text not null default '' check (char_length(phone) <= 40),
  email text not null default '' check (char_length(email) <= 254),
  fiscal_regime text not null default '' check (char_length(fiscal_regime) <= 100),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict
);

create table public.company_members (
  company_id text not null references public.companies(id) on delete restrict,
  user_uid uuid not null references auth.users(id) on delete restrict,
  role text not null check (role in ('owner', 'director', 'admin', 'editor', 'viewer', 'invitado')),
  status text not null default 'active' check (status in ('active', 'revoked', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  primary key (company_id, user_uid)
);

create index company_members_active_user_idx
  on public.company_members (user_uid, company_id) where status = 'active';
create unique index company_members_one_active_owner_idx
  on public.company_members (company_id) where role = 'owner' and status = 'active';

-- Índices completos para las referencias a usuarios, incluidas membresías revocadas.
create index companies_owner_uid_idx on public.companies (owner_uid);
create index companies_created_by_idx on public.companies (created_by);
create index companies_updated_by_idx on public.companies (updated_by);
create index company_members_user_uid_idx on public.company_members (user_uid);
create index company_members_created_by_idx on public.company_members (created_by);
create index company_members_updated_by_idx on public.company_members (updated_by);

alter table public.companies enable row level security;
alter table public.company_members enable row level security;

-- Supabase puede otorgar permisos por defecto. Se restringen explícitamente.
revoke all on public.companies, public.company_members from public, anon, authenticated;
grant select on public.companies, public.company_members to authenticated;
grant select, insert, update, delete on public.companies, public.company_members to service_role;

-- SECURITY DEFINER evita la recursión al consultar membresías desde sus políticas.
-- La función usa siempre auth.uid(), nunca un UID enviado por el cliente.
create function gemailla_private.has_company_role(p_company_id text, p_roles text[])
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.company_members m
    join public.companies c on c.id = m.company_id
    where m.company_id = p_company_id
      and m.user_uid = (select auth.uid())
      and m.status = 'active'
      and c.status = 'active'
      and m.role = any(p_roles)
  );
$$;
revoke all on function gemailla_private.has_company_role(text, text[]) from public, anon;
grant execute on function gemailla_private.has_company_role(text, text[]) to authenticated;

create policy companies_member_read on public.companies
for select to authenticated using (
  gemailla_private.has_company_role(id, array['owner','director','admin','editor','viewer','invitado'])
);

create policy company_members_authorized_read on public.company_members
for select to authenticated using (
  (user_uid = (select auth.uid()) and status = 'active'
    and gemailla_private.has_company_role(company_id, array['owner','director','admin','editor','viewer','invitado']))
  or gemailla_private.has_company_role(company_id, array['owner','director','admin'])
);

-- Creación transaccional e idempotente: el cliente conserva p_company_id al reintentar.
-- No se permite crear roles ajenos ni cambiar la propiedad mediante datos del cliente.
create function gemailla_private.create_company(p_company_id text, p_company jsonb)
returns public.companies
language plpgsql security definer set search_path = ''
as $$
declare
  current_uid uuid := auth.uid();
  company_row public.companies;
  inserted_rows integer;
begin
  if current_uid is null then
    raise exception 'Debes iniciar sesión.' using errcode = '42501';
  end if;
  if p_company_id is null or p_company_id !~ '^[A-Za-z0-9_-]{1,128}$' then
    raise exception 'ID de empresa inválido.' using errcode = '22023';
  end if;
  if p_company is null or jsonb_typeof(p_company) <> 'object' then
    raise exception 'Datos de empresa inválidos.' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_each(p_company) as field(key, value)
    where key not in ('name','rfc','industry','address','phone','email','fiscalRegime')
      or jsonb_typeof(value) <> 'string'
  ) or not (p_company ? 'name') then
    raise exception 'Campos de empresa inválidos.' using errcode = '22023';
  end if;

  insert into public.companies (
    id, owner_uid, name, rfc, industry, address, phone, email, fiscal_regime,
    created_by, updated_by
  ) values (
    p_company_id, current_uid, btrim(p_company->>'name'),
    coalesce(p_company->>'rfc', ''), coalesce(p_company->>'industry', ''),
    coalesce(p_company->>'address', ''), coalesce(p_company->>'phone', ''),
    coalesce(p_company->>'email', ''), coalesce(p_company->>'fiscalRegime', ''),
    current_uid, current_uid
  ) on conflict (id) do nothing;
  get diagnostics inserted_rows = row_count;

  select * into company_row from public.companies where id = p_company_id;
  if company_row.owner_uid <> current_uid or company_row.status <> 'active' then
    raise exception 'No se puede crear esta empresa.' using errcode = '42501';
  end if;

  if inserted_rows = 0 then
    if not gemailla_private.has_company_role(p_company_id, array['owner']) then
      raise exception 'No se puede crear esta empresa.' using errcode = '42501';
    end if;
    if company_row.name <> btrim(p_company->>'name')
      or company_row.rfc <> coalesce(p_company->>'rfc', '')
      or company_row.industry <> coalesce(p_company->>'industry', '')
      or company_row.address <> coalesce(p_company->>'address', '')
      or company_row.phone <> coalesce(p_company->>'phone', '')
      or company_row.email <> coalesce(p_company->>'email', '')
      or company_row.fiscal_regime <> coalesce(p_company->>'fiscalRegime', '') then
      raise exception 'El ID ya tiene otros datos de empresa.' using errcode = '22023';
    end if;
    return company_row;
  end if;

  insert into public.company_members (company_id, user_uid, role, created_by, updated_by)
  values (p_company_id, current_uid, 'owner', current_uid, current_uid);
  return company_row;
end;
$$;
revoke all on function gemailla_private.create_company(text, jsonb) from public, anon;
grant execute on function gemailla_private.create_company(text, jsonb) to authenticated;

-- La API pública no eleva privilegios; delega en la operación privada validada.
create function public.create_company(p_company_id text, p_company jsonb)
returns public.companies
language sql security invoker set search_path = ''
as $$
  select * from gemailla_private.create_company(p_company_id, p_company);
$$;
revoke all on function public.create_company(text, jsonb) from public, anon, authenticated;
grant execute on function public.create_company(text, jsonb) to authenticated;

-- El trigger automático creado por Studio no debe ser un endpoint de la API.
-- Esto no desactiva el trigger ni cambia su definición.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;

commit;
