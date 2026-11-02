import type { EstadoCita, Modalidad } from '../api/tipos';

const ZONA = 'America/Bogota';

export const formatoFecha = (iso: string) =>
  new Date(iso).toLocaleString('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: ZONA,
  });

export const formatoHora = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-CO', { timeStyle: 'short', timeZone: ZONA });

export const ETIQUETA_MODALIDAD: Record<Modalidad, string> = {
  VIRTUAL: 'Virtual',
  PRESENCIAL: 'Presencial',
};

export const ETIQUETA_ESTADO: Record<EstadoCita, string> = {
  PENDIENTE_PAGO: 'Pendiente de pago',
  CONFIRMADA: 'Confirmada',
  CANCELADA: 'Cancelada',
};

export const COLOR_ESTADO: Record<EstadoCita, 'warning' | 'success' | 'default'> = {
  PENDIENTE_PAGO: 'warning',
  CONFIRMADA: 'success',
  CANCELADA: 'default',
};
