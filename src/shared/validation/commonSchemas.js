// @ts-check

import { z } from 'zod';

/**
 * Normaliza strings opcionales enviados desde formularios: trim + undefined cuando
 * el usuario deja el campo vacío. Evita persistir cadenas vacías como valores de
 * negocio válidos.
 */
export const optionalTrimmedString = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().trim().optional(),
);

/**
 * Variante para emails opcionales con la misma semántica que optionalTrimmedString.
 */
export const optionalEmail = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().trim().email('Correo inválido.').optional(),
);

/**
 * Campo requerido de texto con trim para evitar ids/nombres compuestos solo por espacios.
 * @param {string} message
 */
export function requiredTrimmedString(message) {
  return z.string().trim().min(1, message);
}
