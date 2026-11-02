// Forma de lo que devuelve el núcleo (apps/core/src/agenda: vista-franja.ts y citas.service.ts).
export type Modalidad = 'VIRTUAL' | 'PRESENCIAL';
export type EstadoCita = 'PENDIENTE_PAGO' | 'CONFIRMADA' | 'CANCELADA';

export interface Franja {
  id: string;
  modalidad: Modalidad;
  iniciaEn: string;
  terminaEn: string;
  sede: { id: string; nombre: string; ciudad: string };
  profesional: { id: string; nombre: string };
  especialidad: { id: string; nombre: string };
}

export interface Cita {
  id: string;
  estado: EstadoCita;
  bloqueoVenceEn: string | null;
  franja: Franja;
}

export interface Reserva {
  id: string;
  estado: EstadoCita;
  bloqueoVenceEn?: string;
  urlPago?: string;
}
