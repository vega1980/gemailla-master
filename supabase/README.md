# Migración GEMAILLA a Supabase — fase 1

Base de origen revisada: `vega1980/gemailla-master`, commit
`d3241cf3f04340ab60746cfa288649faa8483914` (Master y Next en el mismo repositorio).

## Implementado

- Empresas con los campos que utiliza actualmente `CompaniesPage`.
- Membresías por empresa con los roles `owner`, `director`, `admin`, `editor`,
  `viewer` e `invitado`.
- Acceso de lectura condicionado a una membresía activa y una empresa activa.
  La revocación se consulta en la base; no depende de un rol guardado en el JWT.
- Creación conjunta de empresa y propietario mediante `create_company`.
  Repetir el mismo ID y los mismos datos devuelve la empresa existente.
  Un ID ajeno o un reintento con otros datos se rechaza.
- Escritura de membresías reservada al backend. No hay permisos de escritura
  directa para clientes, incluso propietarios o administradores.

La aplicación todavía usa Firebase. Esta fase no importa datos, no crea proyectos,
no publica la aplicación ni apaga servicios. La base se aplicó el 6 de octubre de 2026 al proyecto `Gemailla`
(`zdzsdzhmpzbfhozcpquq`, `us-west-2`).

## Verificación reproducible

Con Node 22, desde la raíz del repositorio:

```bash
npm ci --prefix supabase/verification --ignore-scripts
npm test --prefix supabase/verification
```

Resultado local: **11/11 pruebas aprobadas**, Node `22.23.3`, PGlite `0.5.8`.
Las pruebas ejecutan SQL y políticas en PostgreSQL compilado a WASM. Solo
simulan el contrato `auth.users` / `auth.uid()` para separar las sesiones.
Comprueban lecturas entre empresas, permisos, revocación, datos inválidos,
rollback e idempotencia secuencial. No comprueban autenticación real, PostgREST,
Storage ni múltiples conexiones concurrentes.

La comprobación adicional `verification/remote-company-foundation.sql` pasó en
el PostgreSQL real del proyecto. Usa roles SQL y claims simulados para verificar
creación, reintento, aislamiento, viewer, escrituras denegadas, revocación,
archivo, usuario anónimo y sesión sin UID. Toda la prueba se revierte: quedaron
0 empresas, 0 membresías y 0 usuarios. Tampoco sustituye la prueba de login
real ni de la API HTTP.

El asesor de seguridad devolvió 0 alertas. El asesor de rendimiento solo
reportó 5 índices aún sin uso en tablas recién creadas; se conservan porque
respaldan claves foráneas. Véase
[índices sin uso](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).

## Aplicación al destino

La migración está en `migrations/20261006120110_company_foundation.sql`.
Su versión coincide con el historial remoto: `20261006120110`, nombre
`company_foundation`. No volver a ejecutarla manualmente: las tablas ya existen.
Se aplicó mediante la herramienta de migraciones después de verificar que
el destino no contenía tablas de la aplicación.

Ambas tablas tienen RLS activo, permisos explícitos y claves foráneas indexadas.
La operación privilegiada está en `gemailla_private`; la función pública
`create_company` es SECURITY INVOKER. Se retiró el permiso de ejecución de
clientes sobre el trigger automático `public.rls_auto_enable()`, sin desactivar
el trigger de RLS.

Ejemplo de llamada con un cliente Supabase autenticado (SDK pendiente de
integración en la aplicación):

```javascript
const companyId = crypto.randomUUID(); // Conservar este ID durante los reintentos.
const { data, error } = await supabase.rpc('create_company', {
  p_company_id: companyId,
  p_company: { name: 'Mi empresa', fiscalRegime: '601' },
});
if (error) throw error;
```

## Trabajo pendiente para completar la migración

1. Verificar esta base con sesiones reales de Supabase Auth y llamadas a
   la API desde dos usuarios de empresas diferentes.
2. Integrar Supabase Auth y crear el mapa entre UIDs Firebase y UUIDs Supabase
   si se trasladan usuarios existentes. Los IDs de empresa permanecen como texto.
3. Implementar los adaptadores de empresas, perfiles, invitaciones y cambios de
   rol, incluyendo la jerarquía de asignación de roles que utiliza Firebase.
   Esta fase no incluye aún una función para editar, archivar o invitar.
4. Migrar documentos y su cuarentena, finanzas, CRM, RR. HH., proyectos, IA,
   métricas y auditoría; migrar también las funciones y la conexión regulatoria
   de Next. Cada módulo necesita sus propias políticas y pruebas.
5. Validar la aplicación completa antes de cambiar la producción y retirar
   las dependencias de Firebase/Google Cloud.

La clave `service_role` queda exclusivamente en el backend; omite las políticas
de acceso. Las operaciones del backend deben validar usuario, empresa y rol.
No se han incluido claves ni contraseñas en esta rama.

## Referencias oficiales

- [RLS: permisos y políticas](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Migración de Firebase Auth](https://supabase.com/docs/guides/platform/migrating-to-supabase/firebase-auth)
- [Migración de Firestore](https://supabase.com/docs/guides/platform/migrating-to-supabase/firestore-data)
