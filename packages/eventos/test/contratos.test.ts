import { describe, expect, it } from 'vitest';
import { crearEvento, esquemas } from '../src/contratos';

// Datos ficticios.
const idCita = '6f1c2a4e-8b3d-4c5e-9f7a-1b2c3d4e5f60';
const idPaciente = '0a9b8c7d-6e5f-4a3b-8c1d-2e3f4a5b6c7d';

describe('contratos', () => {
  it('crearEvento agrega idEvento y ocurridoEn en UTC', () => {
    const evento = crearEvento('cita.confirmada', { idCita, idPaciente, modalidad: 'VIRTUAL' });

    expect(evento.idEvento).toMatch(/^[0-9a-f-]{36}$/);
    expect(evento.ocurridoEn.endsWith('Z')).toBe(true);
  });

  it('rechaza un idEvento que no es UUID', () => {
    const evento = crearEvento('sala.creada', { idCita, idSala: idPaciente });

    expect(esquemas['sala.creada'].safeParse({ ...evento, idEvento: 'abc' }).success).toBe(false);
  });

  it('rechaza una fecha que no está en UTC', () => {
    const evento = crearEvento('cita.cancelada', { idCita, idPaciente, motivo: 'PAGO_RECHAZADO' });
    const conZonaHoraria = { ...evento, ocurridoEn: '2026-10-27T09:00:00-05:00' };

    expect(esquemas['cita.cancelada'].safeParse(conZonaHoraria).success).toBe(false);
  });

  it('rechaza campos que no son identificadores, como la especialidad', () => {
    const evento = crearEvento('cita.confirmada', { idCita, idPaciente, modalidad: 'PRESENCIAL' });
    const conFuga = { ...evento, especialidad: 'Cardiología' };

    expect(esquemas['cita.confirmada'].safeParse(conFuga).success).toBe(false);
  });
});
