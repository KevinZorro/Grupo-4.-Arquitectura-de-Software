import { randomUUID } from 'node:crypto';
import { PROFESIONALES, SEDES } from '../../prisma/seed/agenda';
import type { Prisma, PrismaClient } from '../../src/generated/prisma/client';

/**
 * Franjas made by a test, on a day of their own far in the future, so they never meet the seeded
 * ones or another file's. `limpiarAgenda` removes them and their citas afterwards.
 */
export class FranjasDePrueba {
  private readonly ids: string[] = [];
  /** A Colombian calendar day only this instance uses, between 2 and 30 years ahead. */
  readonly fecha: string;
  private siguienteMinuto = 0;

  constructor(private readonly prisma: PrismaClient) {
    const dias = 730 + Math.floor(Math.random() * 10_000);
    this.fecha = new Date(Date.now() + dias * 86_400_000).toISOString().slice(0, 10);
  }

  async crear(datos: Partial<Prisma.FranjaUncheckedCreateInput> = {}): Promise<string> {
    // 13:00 UTC is 8:00 in Colombia; each franja starts 30 minutes after the previous one.
    const iniciaEn = new Date(`${this.fecha}T13:00:00.000Z`);
    iniciaEn.setUTCMinutes(this.siguienteMinuto);
    this.siguienteMinuto += 30;
    const { id } = await this.prisma.franja.create({
      data: {
        profesionalId: PROFESIONALES[0].id,
        sedeId: SEDES[0].id,
        modalidad: 'VIRTUAL',
        iniciaEn,
        terminaEn: new Date(iniciaEn.getTime() + 30 * 60_000),
        ...datos,
      },
    });
    this.ids.push(id);
    return id;
  }

  citar(
    franjaId: string,
    pacienteId: string,
    estado: 'PENDIENTE_PAGO' | 'CONFIRMADA' | 'CANCELADA',
  ) {
    return this.prisma.cita.create({
      data: { franjaId, pacienteId, estado, claveIdempotencia: randomUUID() },
    });
  }

  async limpiar(): Promise<void> {
    await this.prisma.cita.deleteMany({ where: { franjaId: { in: this.ids } } });
    await this.prisma.franja.deleteMany({ where: { id: { in: this.ids } } });
  }
}
