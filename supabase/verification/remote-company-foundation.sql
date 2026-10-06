-- Comprobación en Supabase: todos los usuarios y datos de prueba se revierten.
-- Ejecutar como postgres. Simula claims y roles SQL; no prueba login ni PostgREST.
begin;
do $$
declare
  owner_a uuid := gen_random_uuid();
  owner_b uuid := gen_random_uuid();
  viewer_a uuid := gen_random_uuid();
  company_a text := 'verify_' || replace(gen_random_uuid()::text, '-', '');
  company_b text := 'verify_' || replace(gen_random_uuid()::text, '-', '');
  invalid_company text := 'verify_' || replace(gen_random_uuid()::text, '-', '');
  result_row public.companies;
begin
  insert into auth.users(id) values (owner_a), (owner_b), (viewer_a);

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', owner_a::text, true);
  select * into result_row from public.create_company(company_a, '{"name":"Prueba A"}');
  if result_row.owner_uid <> owner_a then raise exception 'Propietario incorrecto'; end if;
  perform public.create_company(company_a, '{"name":"Prueba A"}');
  if (select count(*) from public.company_members where company_id = company_a) <> 1 then
    raise exception 'Reintento duplicó membresías';
  end if;
  begin
    perform public.create_company(invalid_company, '{"name":"Prueba","role":"owner"}');
    raise exception 'Se aceptó inyección de rol';
  exception when invalid_parameter_value then null;
  end;

  perform set_config('request.jwt.claim.sub', owner_b::text, true);
  perform public.create_company(company_b, '{"name":"Prueba B"}');
  if (select count(*) from public.companies) <> 1
    or exists(select 1 from public.companies where id = company_a) then
    raise exception 'Lectura cruzada entre empresas';
  end if;
  begin
    perform public.create_company(company_a, '{"name":"Prueba A"}');
    raise exception 'Se aceptó apropiación de otra empresa';
  exception when insufficient_privilege then null;
  end;

  execute 'reset role';
  insert into public.company_members(company_id,user_uid,role,created_by,updated_by)
  values (company_a, viewer_a, 'viewer', owner_a, owner_a);
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', viewer_a::text, true);
  if (select count(*) from public.companies) <> 1
    or (select count(*) from public.company_members) <> 1
    or not exists(select 1 from public.company_members where user_uid = viewer_a) then
    raise exception 'Viewer tiene lecturas incorrectas';
  end if;
  begin
    update public.company_members set role = 'owner' where user_uid = viewer_a;
    raise exception 'Se aceptó escalada de privilegios';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.companies where id = company_a;
    raise exception 'Se permitió borrar empresa desde cliente';
  exception when insufficient_privilege then null;
  end;

  execute 'reset role';
  update public.company_members set status = 'revoked' where user_uid = viewer_a;
  execute 'set local role authenticated';
  if exists(select 1 from public.companies) or exists(select 1 from public.company_members) then
    raise exception 'Revocación no cortó acceso';
  end if;

  execute 'reset role';
  update public.company_members set status = 'revoked' where user_uid = owner_a;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', owner_a::text, true);
  begin
    perform public.create_company(company_a, '{"name":"Prueba A"}');
    raise exception 'Propietario revocado pudo reintentar';
  exception when insufficient_privilege then null;
  end;

  execute 'reset role';
  update public.companies set status = 'archived' where id = company_b;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', owner_b::text, true);
  if exists(select 1 from public.companies) or exists(select 1 from public.company_members) then
    raise exception 'Archivo no cortó acceso';
  end if;

  execute 'reset role';
  execute 'set local role anon';
  begin
    perform count(*) from public.companies;
    raise exception 'Anon pudo leer';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.create_company(invalid_company, '{"name":"Prueba"}');
    raise exception 'Anon pudo crear';
  exception when insufficient_privilege then null;
  end;

  execute 'reset role';
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '{}', true);
  begin
    perform public.create_company(invalid_company, '{"name":"Prueba"}');
    raise exception 'Sesión sin UID pudo crear';
  exception when insufficient_privilege then null;
  end;

  execute 'reset role';
  execute 'set local role service_role';
  if not exists(select 1 from public.companies where id = company_a)
    or not exists(select 1 from public.companies where id = company_b) then
    raise exception 'Backend no tiene acceso';
  end if;
  execute 'reset role';
  if exists(select 1 from public.companies where id = invalid_company) then
    raise exception 'Entrada inválida dejó datos';
  end if;
  if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname in ('companies','company_members')
      and not c.relrowsecurity) then
    raise exception 'RLS desactivado';
  end if;
  if has_function_privilege('anon','public.rls_auto_enable()','EXECUTE')
    or has_function_privilege('authenticated','public.rls_auto_enable()','EXECUTE') then
    raise exception 'Trigger automático expuesto';
  end if;
end;
$$;
rollback;
select 'passed' as result,
  'RLS, roles, aislamiento, creación, reintento, revocación, archivo y rollback' as verified;
