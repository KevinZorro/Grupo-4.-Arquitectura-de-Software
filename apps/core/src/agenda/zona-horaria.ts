// The network's 12 IPS are all in Norte de Santander. Colombia keeps UTC-5 all year (no daylight
// saving), so a fixed offset is exact. Dates are stored in UTC; this only maps the calendar day.
// ponytail: fixed offset, use Intl time zones if a sede ever opens outside Colombia.
const DESFASE_BOGOTA_MS = -5 * 60 * 60 * 1000;

const UN_DIA_MS = 24 * 60 * 60 * 1000;

/** The UTC instant at which a Colombian calendar day (AAAA-MM-DD) starts. */
export function inicioDelDiaEnColombia(fecha: string): Date {
  return new Date(Date.parse(`${fecha}T00:00:00.000Z`) - DESFASE_BOGOTA_MS);
}

/** The Colombian calendar day (AAAA-MM-DD) that contains the given instant. */
export function fechaEnColombia(instante: Date): string {
  return new Date(instante.getTime() + DESFASE_BOGOTA_MS).toISOString().slice(0, 10);
}

/** The day after the given one, both as AAAA-MM-DD. */
export function diaSiguiente(fecha: string): string {
  return new Date(Date.parse(`${fecha}T00:00:00.000Z`) + UN_DIA_MS).toISOString().slice(0, 10);
}
