import { describe, expect, it } from 'vitest';
import { EstadoCita } from '../generated/prisma/enums';
import { puedeTransicionar, transicionar, TransicionDeCitaInvalidaError } from './estado-cita';

const { PENDIENTE_PAGO, CONFIRMADA, CANCELADA } = EstadoCita;

describe('ciclo de vida de la cita', () => {
  it.each([
    [PENDIENTE_PAGO, CONFIRMADA],
    [PENDIENTE_PAGO, CANCELADA],
    [CONFIRMADA, CANCELADA],
    [CANCELADA, CONFIRMADA],
  ])('allows %s -> %s', (desde, hacia) => {
    expect(puedeTransicionar(desde, hacia)).toBe(true);
    expect(transicionar(desde, hacia)).toBe(hacia);
  });

  it.each([
    [CONFIRMADA, PENDIENTE_PAGO],
    [CANCELADA, PENDIENTE_PAGO],
    [PENDIENTE_PAGO, PENDIENTE_PAGO],
    [CONFIRMADA, CONFIRMADA],
    [CANCELADA, CANCELADA],
  ])('rejects %s -> %s with a named error', (desde, hacia) => {
    expect(puedeTransicionar(desde, hacia)).toBe(false);

    const error = (() => {
      try {
        transicionar(desde, hacia);
      } catch (e) {
        return e;
      }
    })();

    expect(error).toBeInstanceOf(TransicionDeCitaInvalidaError);
    expect(error).toMatchObject({ name: 'TransicionDeCitaInvalidaError', desde, hacia });
  });
});
