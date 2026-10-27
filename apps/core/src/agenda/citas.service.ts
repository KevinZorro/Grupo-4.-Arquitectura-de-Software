import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { EstadoCita } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { aVistaFranja, SELECCION_FRANJA, vistaFranjaSchema } from './vista-franja';

export const vistaCitaSchema = z.object({
  id: z.uuid(),
  estado: z.enum(EstadoCita),
  /** Until when the franja is held for the payment; null once the cita leaves PENDIENTE_PAGO. */
  bloqueoVenceEn: z.iso.datetime().nullable(),
  franja: vistaFranjaSchema,
});

export type VistaCita = z.infer<typeof vistaCitaSchema>;

@Injectable()
export class CitasService {
  constructor(private readonly prisma: PrismaService) {}

  /** Every cita of the patient, cancelled ones included, the latest franja first. */
  async listarDelPaciente(pacienteId: string): Promise<VistaCita[]> {
    const citas = await this.prisma.cita.findMany({
      where: { pacienteId },
      select: {
        id: true,
        estado: true,
        bloqueoVenceEn: true,
        franja: { select: SELECCION_FRANJA },
      },
      orderBy: [{ franja: { iniciaEn: 'desc' } }, { creadoEn: 'desc' }],
    });
    return citas.map(({ franja, bloqueoVenceEn, ...cita }) => ({
      ...cita,
      bloqueoVenceEn: bloqueoVenceEn?.toISOString() ?? null,
      franja: aVistaFranja(franja),
    }));
  }
}
