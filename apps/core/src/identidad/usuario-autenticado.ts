import type { Request } from 'express';
import type { Rol } from '../generated/prisma/enums';

/** Who is calling. Ids of other modules' entities are plain ids: ask their module for details. */
export interface UsuarioAutenticado {
  id: string;
  correo: string;
  nombre: string;
  rol: Rol;
  /** Set when the rol is PACIENTE. */
  pacienteId: string | null;
  /** Set when the rol is PROFESIONAL. */
  profesionalId: string | null;
}

export interface SolicitudAutenticada extends Request {
  usuario?: UsuarioAutenticado;
}
