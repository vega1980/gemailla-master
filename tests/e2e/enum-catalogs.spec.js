import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import { clearFirebaseEmulators,getE2EProjectId } from './support/emulatorCleanup.js';
import { createAndLoginUser,createCompany,setActiveCompanyClaims,uniqueId } from './support/firebaseHarness.js';
import { DOMAIN_FORM_OPTIONS } from '../../src/shared/constants/domainEnums.js';
const require=createRequire(new URL('../../functions/package.json',import.meta.url));
const { getApps,initializeApp }=require('firebase-admin/app');
const { getFirestore }=require('firebase-admin/firestore');
const db=()=>getFirestore(getApps()[0]||initializeApp({projectId:getE2EProjectId()}));
async function setup(page) {
 await clearFirebaseEmulators();await page.goto('/');
 const companyId=uniqueId('catalog'),email=`${companyId}@gemailla-e2e.test`;
 const user=await createAndLoginUser(page,{email});
 await createCompany(page,{companyId,ownerUid:user.uid,ownerEmail:email,name:'Empresa catálogos'});
 await setActiveCompanyClaims(page,{userUid:user.uid,companyId,role:'owner'});
 return companyId;
}

test('CRM: canonical client statuses and all interaction types save and persist',async({page})=>{
 test.setTimeout(120000);const companyId=await setup(page);await page.goto('/crm');
 for(const status of DOMAIN_FORM_OPTIONS.crmClientStatus) {
  await page.getByRole('button',{name:'Nuevo Cliente',exact:true}).click();
  const dialog=page.getByRole('dialog');await dialog.getByPlaceholder('Ej. Empresa ABC').fill(`Cliente ${status}`);
  await dialog.locator('button[role=combobox]').nth(1).click();
  await expect(page.getByRole('option',{name:'Perdido',exact:true})).toHaveCount(0);
  await page.getByRole('option',{name:new RegExp(`^${status}$`,'i')}).click();
  await dialog.getByRole('button',{name:'Crear Cliente',exact:true}).click();await expect(dialog).not.toBeVisible();
 }
 for(const type of DOMAIN_FORM_OPTIONS.interactionType) {
  await page.getByTitle('Registrar interacción',{exact:true}).first().click();
  const dialog=page.getByRole('dialog');await dialog.locator('button[role=combobox]').first().click();
  for(const removed of ['cotizacion','pedido','soporte','otro']) await expect(page.getByRole('option',{name:new RegExp(removed)})).toHaveCount(0);
  await page.getByRole('option',{name:new RegExp(type)}).click();
  await dialog.getByPlaceholder('Ej. Llamada de seguimiento').fill(`Seguimiento ${type}`);
  await dialog.getByRole('button',{name:'Guardar',exact:true}).click();await expect(dialog).not.toBeVisible();
 }
 await page.reload();
 for(const status of DOMAIN_FORM_OPTIONS.crmClientStatus) await expect(page.getByText(`Cliente ${status}`,{exact:true})).toBeVisible();
 const clients=await db().collection('crmClients').where('companyId','==',companyId).get();
 expect(clients.docs.map(d=>d.data().status).sort()).toEqual([...DOMAIN_FORM_OPTIONS.crmClientStatus].sort());
 const interactions=await db().collection('crmInteractions').where('companyId','==',companyId).get();
 expect(interactions.docs.map(d=>d.data().type).sort()).toEqual([...DOMAIN_FORM_OPTIONS.interactionType].sort());
});

test('HR: all supported employment types save without obsolete options or implicit mapping',async({page})=>{
 test.setTimeout(120000);const companyId=await setup(page);await page.goto('/hr');
 const labels={tiempo_completo:'Tiempo completo',medio_tiempo:'Medio tiempo',contrato:'Contrato',practicante:'Practicante'};
 for(const type of DOMAIN_FORM_OPTIONS.employmentType) {
  await page.getByRole('button',{name:'Nuevo Empleado',exact:true}).click();
  const dialog=page.getByRole('dialog');await dialog.getByPlaceholder('Nombre completo',{exact:true}).fill(`Empleado ${type}`);
  await dialog.locator('button[role=combobox]').first().click();
  for(const value of ['Freelance','Temporal']) await expect(page.getByRole('option',{name:value,exact:true})).toHaveCount(0);
  await page.getByRole('option',{name:labels[type],exact:true}).click();
  await dialog.getByRole('button',{name:'Crear Empleado',exact:true}).click();await expect(dialog).not.toBeVisible();
 }
 await page.reload();
 for(const type of DOMAIN_FORM_OPTIONS.employmentType)await expect(page.getByText(`Empleado ${type}`,{exact:true})).toBeVisible();
 const employees=await db().collection('employees').where('companyId','==',companyId).get();
 expect(employees.docs.map(d=>d.data().employmentType).sort()).toEqual([...DOMAIN_FORM_OPTIONS.employmentType].sort());
});

test('Payroll: pending to processing to paid persists through the real UI',async({page})=>{
 const companyId=await setup(page);
 await db().collection('employees').doc(`${companyId}-employee`).set({companyId,fullName:'Empleado nómina',baseSalary:1000,status:'activo',employmentType:'contrato',createdAt:new Date()});
 await page.goto('/hr');await page.getByRole('tab',{name:'Nóminas',exact:true}).click();
 await page.getByRole('button',{name:'Nueva',exact:true}).click();
 const dialog=page.getByRole('dialog');await dialog.locator('button[role=combobox]').first().click();await page.getByRole('option',{name:/Empleado nómina/}).click();
 await dialog.locator('button[role=combobox]').last().click();
 await expect(page.getByRole('option',{name:'Aprobado',exact:true})).toHaveCount(0);
 await expect(page.getByRole('option',{name:'En proceso',exact:true})).toBeVisible();
 await expect(page.getByRole('option',{name:'Cancelado',exact:true})).toBeVisible();
 await page.getByRole('option',{name:'Pendiente',exact:true}).click();
 await dialog.getByRole('button',{name:'Crear Nómina',exact:true}).click();await expect(dialog).not.toBeVisible();
 await page.getByRole('button',{name:'Procesar',exact:true}).click();
 await expect(page.getByText('En proceso',{exact:true}).first()).toBeVisible();
 await page.getByRole('button',{name:'Pagar',exact:true}).click();
 await expect(page.getByText('Pagado',{exact:true}).first()).toBeVisible();
 await page.reload();await page.getByRole('tab',{name:'Nóminas',exact:true}).click();
 await expect(page.getByText('Pagado',{exact:true}).first()).toBeVisible();
 const records=await db().collection('payroll').where('companyId','==',companyId).get();
 expect(records.docs.map(d=>d.data().status)).toEqual(['pagado']);
});
