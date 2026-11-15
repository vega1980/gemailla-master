import {test,expect} from '@playwright/test';
import {clearFirebaseEmulators} from './support/emulatorCleanup.js';
import {createAndLoginUser,createCompany,setActiveCompanyClaims,uniqueId} from './support/firebaseHarness.js';
async function setup(page){
 await clearFirebaseEmulators();await page.goto('/');
 const id=uniqueId('persistence'),email=`${id}@gemailla-e2e.test`;
 const user=await createAndLoginUser(page,{email});
 await createCompany(page,{companyId:id,ownerUid:user.uid,ownerEmail:email,name:'Empresa de persistencia'});
 await setActiveCompanyClaims(page,{userUid:user.uid,companyId:id,role:'owner'});
 return id;
}
for(const flow of [
 {name:'CRM client',route:'/crm',open:'Nuevo Cliente',placeholder:'Ej. Empresa ABC',save:'Crear Cliente',value:'Cliente de prueba persistente'},
 {name:'HR employee',route:'/hr',open:'Nuevo Empleado',placeholder:'Nombre completo',save:'Crear Empleado',value:'Persona de prueba persistente'},
 {name:'Operations project',route:'/operations',tab:'Gestión de Proyectos',open:'Nuevo Proyecto',placeholder:'Ej. Expansión a CDMX',save:'Crear Proyecto',value:'Proyecto de prueba persistente'}
])test(`${flow.name}: UI creation persists after reload`,async({page})=>{
 await setup(page);await page.goto(flow.route);
 if(flow.tab)await page.getByRole('button',{name:flow.tab}).click();
 await page.getByRole('button',{name:flow.open,exact:true}).click();
 const dialog=page.getByRole('dialog');await dialog.getByPlaceholder(flow.placeholder,{exact:true}).fill(flow.value);
 await dialog.getByRole('button',{name:flow.save,exact:true}).click();
 await expect(dialog).not.toBeVisible();
 await expect(page.getByText(flow.value,{exact:true})).toBeVisible();
 await page.reload();
 if(flow.tab)await page.getByRole('button',{name:flow.tab}).click();
 await expect(page.getByText(flow.value,{exact:true})).toBeVisible();
});
