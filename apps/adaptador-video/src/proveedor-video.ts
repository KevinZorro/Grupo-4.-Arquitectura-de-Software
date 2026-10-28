import { randomUUID } from 'node:crypto';

export interface ProveedorVideo {
  crearSala(idCita: string): Promise<{ idSala: string }>;
}

export class ProveedorVideoSimulado implements ProveedorVideo {
  async crearSala(idCita: string): Promise<{ idSala: string }> {
    if (!idCita) {
      throw new Error('idCita es obligatorio para crear una sala');
    }

    return { idSala: randomUUID() };
  }
}
