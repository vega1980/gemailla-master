import test from 'node:test';
import assert from 'node:assert/strict';
import { DOMAIN_FORM_OPTIONS } from '../../src/shared/constants/domainEnums.js';
import { validateDomainWrite } from '../../src/shared/validation/domainSchemas.js';

const cases = [
  ['crmClientStatus','crmClients','status',{companyId:'test',name:'Cliente',status:'activo'}],
  ['interactionType','crmInteractions','type',{companyId:'test',clientId:'client',type:'llamada',date:'2026-11-14',subject:'Seguimiento'}],
  ['employmentType','employees','employmentType',{companyId:'test',fullName:'Empleado',employmentType:'tiempo_completo',status:'activo'}],
  ['payrollStatus','payroll','status',{companyId:'test',employeeId:'employee',period:'2026-11',period_type:'mensual',baseSalary:1000,bonuses:0,overtime:0,deductions_imss:0,deductions_isr:0,other_deductions:0,netPay:1000,status:'pendiente'}],
  ['kpiFrequency','kpis','frequency',{companyId:'test',name:'KPI',target:10,current:2,frequency:'mensual',status:'en_curso'}],
];
for (const [catalog, collection, field, fixture] of cases) {
  test(`${collection}: every offered value can be persisted after domain validation`,()=>{
    assert.ok(DOMAIN_FORM_OPTIONS[catalog].length);
    assert.equal(DOMAIN_FORM_OPTIONS[catalog].includes('archived'),false);
    for(const value of DOMAIN_FORM_OPTIONS[catalog]) {
      const payload=validateDomainWrite(collection,{...fixture,[field]:value});
      assert.equal(payload[field],value);
      assert.equal(payload.companyId,'test');
    }
    assert.throws(()=>validateDomainWrite(collection,{...fixture,[field]:'arbitrary-value'}));
  });
}
