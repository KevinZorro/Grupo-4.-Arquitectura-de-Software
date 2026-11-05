import { z } from 'zod';
import type { Prisma } from '../generated/prisma/client';
import { Modalidad } from '../generated/prisma/enums';

/** What the API shows of a franja, both when searching and inside a patient's citas. */
export const vistaFranjaSchema = z.object({
  id: z.uuid(),
  modalidad: z.enum(Modalidad),
  iniciaEn: z.iso.datetime(),
  terminaEn: z.iso.datetime(),
  sede: z.object({ id: z.uuid(), nombre: z.string(), ciudad: z.string() }),
  profesional: z.object({ id: z.uuid(), nombre: z.string() }),
  especialidad: z.object({ id: z.uuid(), nombre: z.string() }),
});

export type VistaFranja = z.infer<typeof vistaFranjaSchema>;

export const SELECCION_FRANJA = {
  id: true,
  modalidad: true,
  iniciaEn: true,
  terminaEn: true,
  sede: { select: { id: true, nombre: true, ciudad: true } },
  profesional: {
    select: {
      id: true,
      nombres: true,
      apellidos: true,
      especialidad: { select: { id: true, nombre: true } },
    },
  },
} satisfies Prisma.FranjaSelect;

type FranjaSeleccionada = Prisma.FranjaGetPayload<{ select: typeof SELECCION_FRANJA }>;

export function aVistaFranja({ profesional, ...franja }: FranjaSeleccionada): VistaFranja {
  return {
    id: franja.id,
    modalidad: franja.modalidad,
    iniciaEn: franja.iniciaEn.toISOString(),
    terminaEn: franja.terminaEn.toISOString(),
    sede: franja.sede,
    profesional: { id: profesional.id, nombre: `${profesional.nombres} ${profesional.apellidos}` },
    especialidad: profesional.especialidad,
  };
}
