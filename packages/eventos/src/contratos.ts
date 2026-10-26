import { randomUUID } from 'node:crypto';
import { z } from 'zod';

// Los eventos llevan solo identificadores (ADR-001): los objetos son estrictos para que ningún
// dato clínico o personal viaje hacia pasarela, mensajería o video por descuido.
const cabecera = {
  idEvento: z.uuid(),
  ocurridoEn: z.iso.datetime(),
};

const citaConfirmada = z.strictObject({
  ...cabecera,
  idCita: z.uuid(),
  idPaciente: z.uuid(),
  modalidad: z.enum(['VIRTUAL', 'PRESENCIAL']),
});

const citaCancelada = z.strictObject({
  ...cabecera,
  idCita: z.uuid(),
  idPaciente: z.uuid(),
  motivo: z.enum([
    'FALLA_INICIO_PAGO',
    'PAGO_RECHAZADO',
    'BLOQUEO_VENCIDO',
    'CANCELADA_POR_PACIENTE',
    'CANCELADA_POR_SEDE',
  ]),
});

const salaCreada = z.strictObject({
  ...cabecera,
  idCita: z.uuid(),
  idSala: z.uuid(),
});

// La clave de enrutamiento identifica el tipo de evento dentro del exchange "citas".
export const esquemas = {
  'cita.confirmada': citaConfirmada,
  'cita.cancelada': citaCancelada,
  'sala.creada': salaCreada,
};

export type ClaveEnrutamiento = keyof typeof esquemas;
export type Evento<C extends ClaveEnrutamiento> = z.infer<(typeof esquemas)[C]>;
export type DatosEvento<C extends ClaveEnrutamiento> = Omit<Evento<C>, 'idEvento' | 'ocurridoEn'>;

export type CitaConfirmada = Evento<'cita.confirmada'>;
export type CitaCancelada = Evento<'cita.cancelada'>;
export type SalaCreada = Evento<'sala.creada'>;

// The idEvento must be fixed when the event is stored in the outbox, so retries keep the same id.
export function crearEvento<C extends ClaveEnrutamiento>(
  clave: C,
  datos: DatosEvento<C>,
): Evento<C> {
  const evento = { ...datos, idEvento: randomUUID(), ocurridoEn: new Date().toISOString() };
  return esquemas[clave].parse(evento) as Evento<C>;
}
