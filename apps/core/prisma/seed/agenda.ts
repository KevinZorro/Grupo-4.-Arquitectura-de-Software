import type { Prisma, PrismaClient } from '../../src/generated/prisma/client';
import { forUpdate, seedId, type WithId } from './ids';

// Everything here is made up: the sedes are not real IPS and nobody on this list exists.

export const SEDES = [
  {
    id: seedId('sede', 1),
    nombre: 'IPS Cúcuta Centro',
    ciudad: 'Cúcuta',
    direccion: 'Calle 10 # 4-20',
  },
  {
    id: seedId('sede', 2),
    nombre: 'IPS Cúcuta Atalaya',
    ciudad: 'Cúcuta',
    direccion: 'Avenida 5 # 12-30',
  },
  {
    id: seedId('sede', 3),
    nombre: 'IPS Los Patios',
    ciudad: 'Los Patios',
    direccion: 'Carrera 8 # 15-12',
  },
  {
    id: seedId('sede', 4),
    nombre: 'IPS Villa del Rosario',
    ciudad: 'Villa del Rosario',
    direccion: 'Calle 7 # 9-41',
  },
  {
    id: seedId('sede', 5),
    nombre: 'IPS El Zulia',
    ciudad: 'El Zulia',
    direccion: 'Carrera 4 # 6-18',
  },
  {
    id: seedId('sede', 6),
    nombre: 'IPS Pamplona',
    ciudad: 'Pamplona',
    direccion: 'Calle 5 # 8-25',
  },
  { id: seedId('sede', 7), nombre: 'IPS Ocaña', ciudad: 'Ocaña', direccion: 'Carrera 12 # 10-33' },
  { id: seedId('sede', 8), nombre: 'IPS Ábrego', ciudad: 'Ábrego', direccion: 'Calle 3 # 5-10' },
  { id: seedId('sede', 9), nombre: 'IPS Tibú', ciudad: 'Tibú', direccion: 'Carrera 6 # 7-22' },
  {
    id: seedId('sede', 10),
    nombre: 'IPS Sardinata',
    ciudad: 'Sardinata',
    direccion: 'Calle 9 # 4-15',
  },
  {
    id: seedId('sede', 11),
    nombre: 'IPS Convención',
    ciudad: 'Convención',
    direccion: 'Carrera 2 # 3-9',
  },
  {
    id: seedId('sede', 12),
    nombre: 'IPS Chinácota',
    ciudad: 'Chinácota',
    direccion: 'Calle 6 # 2-28',
  },
] satisfies Prisma.SedeCreateInput[];

export const ESPECIALIDADES = [
  { id: seedId('especialidad', 1), nombre: 'Medicina general' },
  { id: seedId('especialidad', 2), nombre: 'Pediatría' },
  { id: seedId('especialidad', 3), nombre: 'Ginecología y obstetricia' },
  { id: seedId('especialidad', 4), nombre: 'Medicina interna' },
  { id: seedId('especialidad', 5), nombre: 'Cardiología' },
  { id: seedId('especialidad', 6), nombre: 'Dermatología' },
  { id: seedId('especialidad', 7), nombre: 'Psiquiatría' },
  { id: seedId('especialidad', 8), nombre: 'Ortopedia y traumatología' },
] satisfies Prisma.EspecialidadCreateInput[];

const [
  MEDICINA_GENERAL,
  PEDIATRIA,
  GINECOLOGIA,
  MEDICINA_INTERNA,
  CARDIOLOGIA,
  DERMATOLOGIA,
  PSIQUIATRIA,
  ORTOPEDIA,
] = ESPECIALIDADES;

function profesional(
  n: number,
  especialidad: { id: string },
  nombres: string,
  apellidos: string,
): WithId<Prisma.ProfesionalUncheckedCreateInput> {
  return {
    id: seedId('profesional', n),
    nombres,
    apellidos,
    // Made-up registry number: the RM prefix and four digits mean nothing outside this seed.
    registroProfesional: `RM-${String(n).padStart(4, '0')}`,
    especialidadId: especialidad.id,
  };
}

export const PROFESIONALES = [
  profesional(1, MEDICINA_GENERAL, 'Laura Marcela', 'Contreras Peña'),
  profesional(2, MEDICINA_GENERAL, 'Andrés Felipe', 'Ortega Suárez'),
  profesional(3, PEDIATRIA, 'Camila Andrea', 'Villamizar Rojas'),
  profesional(4, PEDIATRIA, 'Juan Sebastián', 'Cárdenas León'),
  profesional(5, GINECOLOGIA, 'María Fernanda', 'Quintero Díaz'),
  profesional(6, GINECOLOGIA, 'Natalia Patricia', 'Ramírez Barrera'),
  profesional(7, MEDICINA_INTERNA, 'Carlos Eduardo', 'Mendoza Pabón'),
  profesional(8, MEDICINA_INTERNA, 'Diana Carolina', 'Escalante Vargas'),
  profesional(9, CARDIOLOGIA, 'Ricardo Alonso', 'Peñaranda Gómez'),
  profesional(10, CARDIOLOGIA, 'Sofía Alejandra', 'Maldonado Cely'),
  profesional(11, DERMATOLOGIA, 'Valentina Isabel', 'Parada Niño'),
  profesional(12, DERMATOLOGIA, 'Esteban David', 'Lizcano Mora'),
  profesional(13, PSIQUIATRIA, 'Gabriela Lucía', 'Sepúlveda Ríos'),
  profesional(14, PSIQUIATRIA, 'Mauricio José', 'Duarte Colmenares'),
  profesional(15, ORTOPEDIA, 'Óscar Iván', 'Rangel Prada'),
  profesional(16, ORTOPEDIA, 'Paola Andrea', 'Bautista Sanabria'),
] satisfies Prisma.ProfesionalUncheckedCreateInput[];

/** Upserts by id, so running it again restores the catalog to these values and adds nothing. */
export async function sembrarAgenda(prisma: PrismaClient): Promise<void> {
  // One transaction, in this order, because profesional points at especialidad.
  await prisma.$transaction([
    ...SEDES.map((sede) =>
      prisma.sede.upsert({ where: { id: sede.id }, update: forUpdate(sede), create: sede }),
    ),
    ...ESPECIALIDADES.map((especialidad) =>
      prisma.especialidad.upsert({
        where: { id: especialidad.id },
        update: forUpdate(especialidad),
        create: especialidad,
      }),
    ),
    ...PROFESIONALES.map((profesional) =>
      prisma.profesional.upsert({
        where: { id: profesional.id },
        update: forUpdate(profesional),
        create: profesional,
      }),
    ),
  ]);
}
