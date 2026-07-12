// @ts-check

import { z } from 'zod';
import { COMPANY_ROLES, INVITABLE_COMPANY_ROLES } from '../constants/roles.js';
import { optionalTrimmedString, requiredTrimmedString } from './commonSchemas.js';

export const memberInviteSchema = z.object({
  userEmail: z.string().trim().email('Correo inválido.'),
  userName: optionalTrimmedString,
  role: z.enum(INVITABLE_COMPANY_ROLES).default('invitado'),
}).strict();

export const memberRecordSchema = z.object({
  companyId: requiredTrimmedString('La empresa es obligatoria.'),
  userUid: requiredTrimmedString('El usuario es obligatorio.'),
  userEmail: z.string().trim().email('Correo inválido.'),
  userName: optionalTrimmedString,
  role: z.enum(COMPANY_ROLES).default('invitado'),
}).strict();

/** @typedef {z.infer<typeof memberInviteSchema>} MemberInviteInput */
/** @typedef {z.infer<typeof memberRecordSchema>} MemberRecordInput */
