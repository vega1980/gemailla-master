import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

// PostgreSQL real en WASM. auth.users y auth.uid son el único contrato simulado.
// No verifica GoTrue, JWT, PostgREST, Storage ni concurrencia entre conexiones.
const db = new PGlite();
const ownerA = '10000000-0000-4000-8000-000000000001';
const ownerB = '10000000-0000-4000-8000-000000000002';
const viewerA = '10000000-0000-4000-8000-000000000003';
const adminA = '10000000-0000-4000-8000-000000000004';

async function asUser(uid, action, role = 'authenticated') {
  await db.exec(`set role ${role}`);
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid || '']);
  try {
    return await action();
  } finally {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
  }
}

const createCompany = (id, fields = { name: 'Empresa A' }) =>
  db.query('select * from public.create_company($1, $2::jsonb)', [id, JSON.stringify(fields)]);

before(async () => {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    grant usage on schema public, auth to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
    -- Reproduce proyectos Supabase con permisos por defecto amplios.
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
    create function public.rls_auto_enable() returns event_trigger
      language plpgsql security definer set search_path = '' as $$ begin null; end $$;
  `);
  for (const uid of [ownerA, ownerB, viewerA, adminA]) {
    await db.query('insert into auth.users(id) values ($1)', [uid]);
  }
  const migration = await readFile(new URL('../migrations/20261006120110_company_foundation.sql', import.meta.url), 'utf8');
  await db.exec(migration);
  await asUser(ownerA, () => createCompany('company-A'));
  await asUser(ownerB, () => createCompany('company-B', { name: 'Empresa B' }));
  for (const [uid, role] of [[viewerA, 'viewer'], [adminA, 'admin']]) {
    await db.query(`insert into public.company_members
      (company_id, user_uid, role, created_by, updated_by) values ('company-A', $1, $2, $3, $3)`, [uid, role, ownerA]);
  }
});

after(async () => { await db.close(); });

test('API pública sin elevación de privilegios y trigger automático sin acceso de clientes', async () => {
  const definitions = await db.query(`select n.nspname, p.prosecdef
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where p.proname = 'create_company' order by n.nspname`);
  assert.deepEqual(definitions.rows, [
    { nspname: 'gemailla_private', prosecdef: true },
    { nspname: 'public', prosecdef: false },
  ]);
  for (const role of ['anon', 'authenticated']) {
    const privilege = await db.query("select has_function_privilege($1, 'public.rls_auto_enable()', 'execute') as allowed", [role]);
    assert.equal(privilege.rows[0].allowed, false);
  }
});

test('empresa y propietario se crean juntos; reintento conserva una sola membresía', async () => {
  await asUser(ownerA, async () => {
    const first = await createCompany('company-C', { name: 'Empresa C', fiscalRegime: '601' });
    const retry = await createCompany('company-C', { name: 'Empresa C', fiscalRegime: '601' });
    assert.deepEqual(first.rows, retry.rows);
    assert.equal(first.rows[0].owner_uid, ownerA);
    assert.equal(first.rows[0].created_by, ownerA);
    assert.equal(first.rows[0].fiscal_regime, '601');
    const members = await db.query("select * from public.company_members where company_id = 'company-C'");
    assert.equal(members.rows.length, 1);
    assert.equal(members.rows[0].role, 'owner');
    await assert.rejects(createCompany('company-C', { name: 'Otra empresa' }), { code: '22023' });
  });
});

test('la consulta sin filtro de empresa no expone otra empresa', async () => {
  await asUser(ownerB, async () => {
    const companies = await db.query('select id from public.companies');
    assert.deepEqual(companies.rows, [{ id: 'company-B' }]);
    const members = await db.query('select company_id from public.company_members');
    assert.deepEqual(members.rows, [{ company_id: 'company-B' }]);
  });
});

test('viewer ve su membresía; admin puede listar los miembros de su empresa', async () => {
  await asUser(viewerA, async () => {
    assert.deepEqual((await db.query('select id from public.companies')).rows, [{ id: 'company-A' }]);
    const members = await db.query('select user_uid from public.company_members');
    assert.deepEqual(members.rows, [{ user_uid: viewerA }]);
  });
  await asUser(adminA, async () => {
    const members = await db.query('select company_id from public.company_members');
    assert.equal(members.rows.length, 3);
    assert.ok(members.rows.every(member => member.company_id === 'company-A'));
  });
});

test('clientes no pueden asignar roles, modificar ni borrar empresas o miembros', async () => {
  for (const uid of [viewerA, adminA, ownerA]) {
    await asUser(uid, async () => {
      await assert.rejects(db.query("update public.company_members set role = 'owner'"), { code: '42501' });
      await assert.rejects(db.query("delete from public.company_members where company_id = 'company-A'"), { code: '42501' });
      await assert.rejects(db.query("update public.companies set owner_uid = $1 where id = 'company-A'", [viewerA]), { code: '42501' });
      await assert.rejects(db.query("delete from public.companies where id = 'company-A'"), { code: '42501' });
      await assert.rejects(db.query(`insert into public.company_members
        (company_id,user_uid,role,created_by,updated_by) values ('company-B',$1,'admin',$1,$1)`, [uid]), { code: '42501' });
      await assert.rejects(db.query(`insert into public.companies
        (id,owner_uid,name,created_by,updated_by) values ('direct',$1,'Directa',$1,$1)`, [uid]), { code: '42501' });
    });
  }
});

test('sin sesión no se permite leer ni crear; JWT sin UID tampoco crea', async () => {
  await asUser(null, async () => {
    await assert.rejects(db.query('select * from public.companies'), { code: '42501' });
    await assert.rejects(db.query('select * from public.company_members'), { code: '42501' });
    await assert.rejects(createCompany('anon'), { code: '42501' });
  }, 'anon');
  await asUser(null, async () => {
    assert.equal((await db.query('select * from public.companies')).rows.length, 0);
    await assert.rejects(createCompany('no-uid'), { code: '42501' });
  });
});

test('un usuario no puede apropiarse de un ID existente ni enviar propietario o roles', async () => {
  await asUser(ownerB, async () => {
    await assert.rejects(createCompany('company-A'), { code: '42501' });
    await assert.rejects(createCompany('injected-owner', { name: 'Inválida', ownerUid: ownerA }), { code: '22023' });
    await assert.rejects(createCompany('injected-role', { name: 'Inválida', role: 'owner' }), { code: '22023' });
  });
});

test('datos inválidos no dejan empresas ni membresías parciales', async () => {
  await asUser(ownerA, async () => {
    for (const fields of [{}, { name: '' }, { name: ' '.repeat(5) }, { name: 123 }, { name: 'X'.repeat(181) }, { name: 'Válida', phone: 'X'.repeat(41) }]) {
      await assert.rejects(createCompany('invalid-company', fields));
    }
    for (const id of ['', '../escape', 'X'.repeat(129), null]) await assert.rejects(createCompany(id));
    for (const fields of [null, [], 'string']) await assert.rejects(createCompany('invalid-company', fields));
  });
  assert.equal((await db.query("select * from public.companies where id = 'invalid-company'")).rows.length, 0);
  assert.equal((await db.query("select * from public.company_members where company_id = 'invalid-company'")).rows.length, 0);
  // Fuerza un fallo después del INSERT de empresa para verificar rollback de la RPC.
  await db.exec(`create function gemailla_private.fail_member_test() returns trigger language plpgsql as $$
    begin raise exception 'Fallo de prueba'; end $$;
    create trigger fail_member_test before insert on public.company_members
      for each row execute function gemailla_private.fail_member_test();`);
  try {
    await asUser(ownerA, () => assert.rejects(createCompany('rollback-company')));
    assert.equal((await db.query("select * from public.companies where id = 'rollback-company'")).rows.length, 0);
  } finally {
    await db.exec('drop trigger fail_member_test on public.company_members; drop function gemailla_private.fail_member_test();');
  }
});

test('revocar membresía corta el acceso con el mismo UID de sesión, incluso al propietario', async () => {
  for (const [uid, companyId] of [[viewerA, 'company-A'], [ownerB, 'company-B']]) {
    await db.query("update public.company_members set status = 'revoked' where company_id = $1 and user_uid = $2", [companyId, uid]);
    await asUser(uid, async () => {
      assert.equal((await db.query('select * from public.companies')).rows.length, 0);
      assert.equal((await db.query('select * from public.company_members')).rows.length, 0);
      if (uid === ownerB) {
        await assert.rejects(createCompany('company-B', { name: 'Empresa B' }), { code: '42501' });
      }
    });
  }
});

test('archivar una empresa corta el acceso a sus datos y membresías', async () => {
  await db.query("update public.companies set status = 'archived' where id = 'company-A'");
  await asUser(adminA, async () => {
    assert.equal((await db.query('select * from public.companies')).rows.length, 0);
    assert.equal((await db.query('select * from public.company_members')).rows.length, 0);
  });
});

test('backend tiene acceso explícito y restricciones siguen rechazando duplicados y roles inválidos', async () => {
  await asUser(null, async () => {
    assert.ok((await db.query('select * from public.companies')).rows.length >= 3);
    await assert.rejects(db.query("update public.company_members set role = 'superadmin'"), { code: '23514' });
    await assert.rejects(db.query(`insert into public.company_members
      (company_id,user_uid,role,created_by,updated_by) values ('company-C',$1,'owner',$1,$1)`, [ownerA]), { code: '23505' });
  }, 'service_role');
});
