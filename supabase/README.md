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
no publica la aplicación ni apaga servicios. No se ha aplicado a Supabase remoto.

## Verificación reproducible

Con Node 22, desde la raíz del repositorio:

```bash
npm ci --prefix supabase/verification --ignore-scripts
npm test --prefix supabase/verification
```

Resultado local: **10/10 pruebas aprobadas**, Node `22.23.3`, PGlite `0.5.8`.
Las pruebas ejecutan SQL y políticas en PostgreSQL compilado a WASM. Solo
simulan el contrato `auth.users` / `auth.uid()` para separar las sesiones.
Comprueban lecturas entre empresas, permisos, revocación, datos inválidos,
rollback e idempotencia secuencial. No comprueban autenticación real, PostgREST,
Storage, múltiples conexiones concurrentes ni el proyecto remoto.

## Aplicación al destino

La migración está en `migrations/20261006092000_company_foundation.sql`.
Necesita un proyecto Supabase de desarrollo identificado y conectado, con su
esquema de Auth y sus roles estándar. Antes de aplicarla se deben revisar las
tablas existentes: la migración falla si `public.companies` o
`public.company_members` ya existen, para evitar reemplazarlas.

Después de aplicarla se debe comprobar el acceso mediante sesiones reales de
dos usuarios de empresas diferentes. El cambio de proveedor de la aplicación
requiere completar las siguientes fases.

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

1. Conectar e identificar el proyecto Supabase de destino y verificar esta base
   con su autenticación real.
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
