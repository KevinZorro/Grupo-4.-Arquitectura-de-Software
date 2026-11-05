import { EstadoCita } from '../generated/prisma/enums';

/**
 * The cita's life cycle (docs/diagramas/estados-cita.png). A table instead of a class per state:
 * the states carry no behaviour of their own, only which state may follow.
 */
const TRANSICIONES: Readonly<Record<EstadoCita, readonly EstadoCita[]>> = {
  // Paid, rejected, timed out, or the payment could not even start.
  [EstadoCita.PENDIENTE_PAGO]: [EstadoCita.CONFIRMADA, EstadoCita.CANCELADA],
  // Cancelled by the patient or by the sede.
  [EstadoCita.CONFIRMADA]: [EstadoCita.CANCELADA],
  // A late payment arrives while the franja is still free, so the cita is given back.
  [EstadoCita.CANCELADA]: [EstadoCita.CONFIRMADA],
};

export class TransicionDeCitaInvalidaError extends Error {
  constructor(
    readonly desde: EstadoCita,
    readonly hacia: EstadoCita,
  ) {
    super(`Una cita en ${desde} no puede pasar a ${hacia}`);
    this.name = 'TransicionDeCitaInvalidaError';
  }
}

export function puedeTransicionar(desde: EstadoCita, hacia: EstadoCita): boolean {
  return TRANSICIONES[desde].includes(hacia);
}

/** Returns the new state, or throws when the life cycle does not allow the move. */
export function transicionar(desde: EstadoCita, hacia: EstadoCita): EstadoCita {
  if (!puedeTransicionar(desde, hacia)) {
    throw new TransicionDeCitaInvalidaError(desde, hacia);
  }
  return hacia;
}
