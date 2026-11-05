import { Injectable } from '@nestjs/common';
import type { Modalidad } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { aVistaFranja, SELECCION_FRANJA, type VistaFranja } from './vista-franja';
import { diaSiguiente, inicioDelDiaEnColombia } from './zona-horaria';

// ponytail: a cap instead of pagination; the seed offers ~640 franjas, add a cursor if that grows.
export const MAXIMO_FRANJAS = 200;

export interface FiltrosFranja {
  especialidadId?: string;
  sedeId?: string;
  profesionalId?: string;
  modalidad?: Modalidad;
  /** Colombian calendar day, AAAA-MM-DD. */
  fecha?: string;
}

@Injectable()
export class FranjasService {
  constructor(private readonly prisma: PrismaService) {}

  /** Franjas still to come that no live cita holds, soonest first. */
  async buscarLibres(filtros: FiltrosFranja, ahora = new Date()): Promise<VistaFranja[]> {
    const { especialidadId, sedeId, profesionalId, modalidad, fecha } = filtros;
    const franjas = await this.prisma.franja.findMany({
      where: {
        sedeId,
        profesionalId,
        modalidad,
        iniciaEn: {
          gt: ahora,
          ...(fecha && {
            gte: inicioDelDiaEnColombia(fecha),
            lt: inicioDelDiaEnColombia(diaSiguiente(fecha)),
          }),
        },
        sede: { activa: true },
        profesional: { activo: true, especialidadId },
        citas: { none: { estado: { not: 'CANCELADA' } } },
      },
      select: SELECCION_FRANJA,
      orderBy: [{ iniciaEn: 'asc' }, { id: 'asc' }],
      take: MAXIMO_FRANJAS,
    });
    return franjas.map(aVistaFranja);
  }
}
