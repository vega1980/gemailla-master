import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { clearFirebaseEmulators, getE2EProjectId } from './support/emulatorCleanup.js';
import { createAndLoginUser, createCompany, setActiveCompanyClaims, uniqueId } from './support/firebaseHarness.js';
const require = createRequire(new URL('../../functions/package.json', import.meta.url));
const { getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
function database() { return getFirestore(getApps()[0] || initializeApp({projectId:getE2EProjectId()})); }
async function setup(page) {
  await clearFirebaseEmulators(); await page.goto('/');
  const id=uniqueId('module'),email=`${id}@gemailla-e2e.test`;
  const user=await createAndLoginUser(page,{email});
  await createCompany(page,{companyId:id,ownerUid:user.uid,ownerEmail:email,name:'Empresa funcional'});
  await setActiveCompanyClaims(page,{userUid:user.uid,companyId:id,role:'owner'});
  return {companyId:id,uid:user.uid};
}
async function transactions(companyId, expense=250) {
 const date=new Date().toISOString().slice(0,10);
 const ownerUid=(await database().collection('companies').doc(companyId).get()).data().ownerUid;
 for(const [id,type,amount,category] of [['income','ingreso',1000,'ventas'],['expense','gasto',expense,'renta']])
  await database().collection('transactions').doc(`${companyId}-${id}`).set({companyId,ownerUid,type,amount,category,date,description:`Fixture ${id}`,status:'confirmed',paymentMethod:'transferencia',createdAt:new Date()});
}

test('Empresas: create using the real UI with optional fields empty, then reload',async({page})=>{
 await setup(page); await page.goto('/companies');
 await page.getByRole('button',{name:'Nueva Empresa',exact:true}).click();
 const dialog=page.getByRole('dialog'); await dialog.getByPlaceholder('Nombre de la empresa').fill('Empresa creada desde formulario');
 await dialog.getByRole('button',{name:'Crear',exact:true}).click();
 await expect(dialog).not.toBeVisible(); await page.reload();
 await expect(page.getByText('Empresa creada desde formulario',{exact:true}).first()).toBeVisible();
});

test('ERP: register income through the real form and verify storage and reload',async({page})=>{
 const {companyId}=await setup(page);await page.goto('/erp');
 await page.getByRole('button',{name:'Nueva Transacción',exact:true}).click();
 const dialog=page.getByRole('dialog');await dialog.getByPlaceholder('0.00').fill('123.45');
 await dialog.getByPlaceholder('Descripción...').fill('Ingreso persistente de prueba');
 await dialog.getByRole('button',{name:'Registrar',exact:true}).click();
 await expect(dialog).not.toBeVisible(); await page.reload();
 await expect(page.getByText('Ingreso persistente de prueba',{exact:true})).toBeVisible();
 const rows=await database().collection('transactions').where('companyId','==',companyId).get();
 expect(rows.docs.some(d=>d.data().amount===123.45)).toBe(true);
});

test('Finanzas: known totals and actual PDF contents agree with fixtures',async({page},testInfo)=>{
 const {companyId}=await setup(page);await transactions(companyId);await page.goto('/finance');
 const panel=page.getByRole('tabpanel');await expect(panel.getByText('$1,000.00',{exact:true}).first()).toBeVisible();
 await expect(panel.getByText('$250.00',{exact:true}).first()).toBeVisible();
 await expect(panel.getByText('$750.00',{exact:true}).first()).toBeVisible();
 const waiting=page.waitForEvent('download');await panel.getByRole('button',{name:'Exportar PDF',exact:true}).click();
 const download=await waiting;const file=testInfo.outputPath('financial-statement.pdf');await download.saveAs(file);
 const bytes=await readFile(file);expect(bytes.subarray(0,5).toString()).toBe('%PDF-');
 // jsPDF emits uncompressed text streams in this export. Verify the actual
 // downloaded bytes, without depending on a separate PDF worker runtime.
 const contents=bytes.toString('latin1');
 expect(contents).toContain('1,000.00');expect(contents).toContain('250.00');expect(contents).toContain('750.00');
});

test('Dashboard: reflects known tenant income, expenses and balance',async({page},testInfo)=>{
 const {companyId}=await setup(page);await transactions(companyId);
 await expect.poll(async()=>(await database().collection('companyMetrics').doc(companyId).get()).data()?.transactionCount,{timeout:20000}).toBe(2);
 const metrics=(await database().collection('companyMetrics').doc(companyId).get()).data();
 await testInfo.attach('actual-company-metrics',{body:JSON.stringify({expected:{totalIncome:1000,totalExpenses:250,netCashFlow:750},actual:metrics}),contentType:'application/json'});
 await page.goto('/dashboard');
 await expect(page.locator('main')).toContainText('1,000');await expect(page.locator('main')).toContainText('250');await expect(page.locator('main')).toContainText('750');
});

test('Panel cliente: deterministic negative balance alert uses real tenant data',async({page})=>{
 const {companyId}=await setup(page);await transactions(companyId,1500);await page.goto('/client');
 await page.getByRole('tab',{name:'Alertas',exact:true}).click();
 await expect(page.getByText('Balance negativo este mes: $-500. Los gastos superan los ingresos.',{exact:true})).toBeVisible();
});

test('Actividad: server-generated transaction audit events are visible and filterable',async({page})=>{
 const {companyId}=await setup(page);await transactions(companyId);await page.goto('/activity');
 await expect(page.getByText('Transacción creada',{exact:true}).first()).toBeVisible({timeout:20000});
 await page.getByPlaceholder('Buscar por usuario, detalle...').fill('NoExisteUnRegistroConEsteTexto');
 await expect(page.getByText('Transacción creada',{exact:true})).toHaveCount(0);
});

test('Operaciones: supported KPI frequencies only and weekly persistence',async({page})=>{
 await setup(page);await page.goto('/operations');await page.getByRole('button',{name:'Nuevo KPI',exact:true}).click();
 const dialog=page.getByRole('dialog');await dialog.getByPlaceholder('Ej. Tasa de conversión').fill('KPI semanal de prueba');
 await dialog.getByPlaceholder('100',{exact:true}).fill('10');await dialog.getByPlaceholder('0',{exact:true}).fill('2');
 await dialog.locator('button[role=combobox]').nth(2).click();await expect(page.getByRole('option',{name:'diario',exact:true})).toHaveCount(0);await page.getByRole('option',{name:'semanal',exact:true}).click();
 await dialog.getByRole('button',{name:'Crear KPI',exact:true}).click();await expect(dialog).not.toBeVisible();
 await page.reload();await expect(page.getByText('KPI semanal de prueba',{exact:true})).toBeVisible();
});

test('Auditoria: empty books cannot launch a financial AI audit',async({page})=>{
 await setup(page);await page.goto('/audit');
 await expect(page.getByRole('button',{name:/Ejecutar.*Auditoría/i})).toBeDisabled();
});

test('IA: basic plan cannot submit a paid AI query',async({page})=>{
 await setup(page);await page.goto('/ai');
 await expect(page.getByPlaceholder('Escribe tu consulta...')).toHaveCount(0);
 await expect(page.getByRole('link',{name:/planes|actualizar|mejorar/i}).first()).toBeVisible();
});

test('Predicciones: basic plan is gated before any forecast runs',async({page})=>{
 await setup(page);await page.goto('/predictive');
 await expect(page.getByRole('link',{name:'Ver planes y precios'})).toBeVisible();
 await expect(page.getByRole('tab')).toHaveCount(0);
});

test('Suscripciones: current basic plan is displayed without self-service entitlement writes',async({page})=>{
 const {companyId}=await setup(page);await page.goto('/subscriptions');
 await expect(page.getByRole('button',{name:'Plan actual',exact:true})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Seleccionar Pro',exact:true})).toBeVisible();
 expect((await database().collection('companyEntitlements').doc(companyId).get()).exists).toBe(false);
});

test('RRHH: automatic payroll persists its computed net amount for the fixture employee',async({page})=>{
 const {companyId}=await setup(page);
 await database().collection('employees').doc(`${companyId}-employee`).set({companyId,fullName:'Empleado de nómina',baseSalary:1000,status:'activo',employmentType:'tiempo_completo',createdAt:new Date()});
 await page.goto('/hr');await page.getByRole('tab',{name:'Nóminas',exact:true}).click();
 await page.getByRole('button',{name:'Nueva',exact:true}).click();
 const dialog=page.getByRole('dialog');await dialog.getByRole('combobox').first().click();
 await page.getByRole('option',{name:/Empleado de nómina/}).click();
 await expect(dialog.getByText('$868',{exact:true})).toBeVisible();
 await dialog.getByRole('button',{name:'Crear Nómina',exact:true}).click();await expect(dialog).not.toBeVisible();
 await page.reload();await page.getByRole('tab',{name:'Nóminas',exact:true}).click();
 await expect(page.getByText('$868',{exact:true}).first()).toBeVisible();
 const payroll=await database().collection('payroll').where('companyId','==',companyId).get();
 expect(payroll.docs.some(d=>d.data().netPay===868)).toBe(true);
});

for(const route of ['/dashboard','/companies','/documents','/regulatory','/erp','/audit','/ai','/activity','/subscriptions','/predictive','/finance','/client','/operations','/crm','/hr']) {
 test(`Module route and available tabs: ${route}`,async({page},testInfo)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await setup(page);await page.goto(route);
  await expect(page.getByRole('button',{name:/Empresa activa: Empresa funcional/})).toBeVisible();
  await expect(page.locator('main')).toBeVisible();
  const tabs=await page.getByRole('tab').allTextContents();
  for(const title of tabs){
   await page.getByRole('tab',{name:title.trim(),exact:true}).click();
   await expect(page.getByRole('tabpanel')).toBeVisible();
  }
  expect(errors).toEqual([]);
  await testInfo.attach('module-result',{body:JSON.stringify({route,tabs,headings:await page.locator('main h1,main h2,main h3').allTextContents()}),contentType:'application/json'});
 });
}
