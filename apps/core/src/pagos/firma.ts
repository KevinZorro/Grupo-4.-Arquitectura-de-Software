import { createHmac, timingSafeEqual } from 'node:crypto';

/** The gateway sends a hex HMAC-SHA256 of the raw body in X-Firma (PAG-1 contract). */
const FIRMA_HEX = /^[0-9a-f]{64}$/i;

/**
 * Verifies the gateway's signature. `cuerpo` must be the exact bytes received: re-serializing
 * the parsed JSON would change the signature. It returns false instead of throwing so the
 * webhook can answer 401 without leaking why.
 */
export function firmaValida(cuerpo: string, firma: string | undefined, secreto: string): boolean {
  if (secreto === '' || firma === undefined || !FIRMA_HEX.test(firma)) {
    return false;
  }

  const esperada = createHmac('sha256', secreto).update(cuerpo).digest();
  const recibida = Buffer.from(firma, 'hex');
  return recibida.length === esperada.length && timingSafeEqual(esperada, recibida);
}
