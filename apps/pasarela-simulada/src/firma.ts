import { createHmac } from 'node:crypto';

/**
 * Firma HMAC-SHA256 en hexadecimal minúscula, sin prefijo.
 *
 * Se firma siempre el cuerpo ya serializado, nunca un objeto: si se re-serializa
 * después, el orden de las claves o los espacios cambian y la firma no valida.
 */
export function firmar(cuerpo: string, secreto: string): string {
  return createHmac('sha256', secreto).update(cuerpo, 'utf8').digest('hex');
}
