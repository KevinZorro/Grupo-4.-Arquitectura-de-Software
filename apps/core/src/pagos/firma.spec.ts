import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { firmaValida } from './firma';

const SECRETO = 'secreto-de-prueba';
const CUERPO = JSON.stringify({
  idTransaccion: 'tx-1',
  referencia: 'cita-1',
  estado: 'APROBADO',
});

function firmar(cuerpo: string, secreto = SECRETO): string {
  return createHmac('sha256', secreto).update(cuerpo).digest('hex');
}

describe('firmaValida', () => {
  it('acepta la firma HMAC-SHA256 del cuerpo crudo', () => {
    expect(firmaValida(CUERPO, firmar(CUERPO), SECRETO)).toBe(true);
  });

  it('acepta la firma en mayúsculas, que es el mismo hexadecimal', () => {
    expect(firmaValida(CUERPO, firmar(CUERPO).toUpperCase(), SECRETO)).toBe(true);
  });

  it('rechaza el cuerpo alterado', () => {
    expect(firmaValida(`${CUERPO} `, firmar(CUERPO), SECRETO)).toBe(false);
    expect(firmaValida(CUERPO.replace('APROBADO', 'RECHAZADO'), firmar(CUERPO), SECRETO)).toBe(
      false,
    );
  });

  it('rechaza una firma hecha con otro secreto', () => {
    expect(firmaValida(CUERPO, firmar(CUERPO, 'otro-secreto'), SECRETO)).toBe(false);
  });

  it.each([
    ['sin cabecera', undefined],
    ['vacía', ''],
    ['con longitud distinta', 'f'.repeat(63)],
    ['con caracteres que no son hex', 'z'.repeat(64)],
  ])('rechaza una firma %s', (_caso, firma) => {
    expect(firmaValida(CUERPO, firma, SECRETO)).toBe(false);
  });

  it('rechaza todo si el secreto está vacío', () => {
    expect(firmaValida(CUERPO, firmar(CUERPO, ''), '')).toBe(false);
  });
});
