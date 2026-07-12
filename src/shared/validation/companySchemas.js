// @ts-check

import { z } from 'zod';
import { optionalEmail, optionalTrimmedString, requiredTrimmedString } from './commonSchemas.js';

export const companySchema = z.object({
  name: requiredTrimmedString('El nombre de la empresa es obligatorio.'),
  rfc: optionalTrimmedString,
  industry: optionalTrimmedString,
  address: optionalTrimmedString,
  phone: optionalTrimmedString,
  email: optionalEmail,
  fiscalRegime: optionalTrimmedString,
}).strict();

/** @typedef {z.infer<typeof companySchema>} CompanyInput */
