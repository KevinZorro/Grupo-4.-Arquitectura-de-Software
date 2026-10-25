import type { Prisma, PrismaClient } from '../../src/generated/prisma/client';
import { PROFESIONALES } from './agenda';
import { forUpdate, seedId, type WithId } from './ids';

// Everything here is made up. Mail goes to the reserved .test domain, so it can never reach a real
// inbox, and the document numbers all start with 9 so they are recognisable as fake at a glance.

export const DOMINIO_FICTICIO = 'ejemplo.test';

function paciente(
  n: number,
  tipoDocumento: Prisma.PacienteCreateInput['tipoDocumento'],
  nombres: string,
  apellidos: string,
  fechaNacimiento: string,
): WithId<Prisma.PacienteCreateInput> {
  return {
    id: seedId('paciente', n),
    tipoDocumento,
    numeroDocumento: `9${String(n).padStart(9, '0')}`,
    nombres,
    apellidos,
    fechaNacimiento: new Date(`${fechaNacimiento}T00:00:00.000Z`),
  };
}

export const PACIENTES = [
  paciente(1, 'CC', 'Ana Lucía', 'Pérez Gómez', '1988-03-14'),
  paciente(2, 'CC', 'Luis Alberto', 'Moreno Díaz', '1975-11-02'),
  paciente(3, 'TI', 'Sara Valentina', 'Rincón Ortiz', '2012-06-21'),
  paciente(4, 'CC', 'Pedro Antonio', 'Castellanos Vera', '1962-09-30'),
  paciente(5, 'CE', 'María José', 'Quintana Ruiz', '1994-01-17'),
  paciente(6, 'CC', 'Jorge Iván', 'Salcedo Peña', '1981-07-08'),
] satisfies Prisma.PacienteCreateInput[];

type Persona = { id: string; nombres: string; apellidos: string };

function usuarioDe(
  n: number,
  local: string,
  persona: Persona,
  rol: 'PACIENTE' | 'PROFESIONAL',
): WithId<Prisma.UsuarioUncheckedCreateInput> {
  return {
    id: seedId('usuario', n),
    correo: `${local}@${DOMINIO_FICTICIO}`,
    nombre: `${persona.nombres} ${persona.apellidos}`,
    rol,
    pacienteId: rol === 'PACIENTE' ? persona.id : null,
    profesionalId: rol === 'PROFESIONAL' ? persona.id : null,
  };
}

function usuarioDeLaRed(
  n: number,
  local: string,
  nombre: string,
  rol: 'ADMINISTRATIVO' | 'AUDITOR',
): WithId<Prisma.UsuarioUncheckedCreateInput> {
  return { id: seedId('usuario', n), correo: `${local}@${DOMINIO_FICTICIO}`, nombre, rol };
}

// The dev header X-Usuario-Dev takes one of these correos. The frontend's picker lists them.
export const USUARIOS = [
  usuarioDe(1, 'ana.perez', PACIENTES[0], 'PACIENTE'),
  usuarioDe(2, 'luis.moreno', PACIENTES[1], 'PACIENTE'),
  usuarioDe(3, 'sara.rincon', PACIENTES[2], 'PACIENTE'),
  usuarioDe(4, 'pedro.castellanos', PACIENTES[3], 'PACIENTE'),
  usuarioDe(5, 'maria.quintana', PACIENTES[4], 'PACIENTE'),
  usuarioDe(6, 'jorge.salcedo', PACIENTES[5], 'PACIENTE'),
  usuarioDe(7, 'laura.contreras', PROFESIONALES[0], 'PROFESIONAL'),
  usuarioDe(8, 'camila.villamizar', PROFESIONALES[2], 'PROFESIONAL'),
  usuarioDe(9, 'ricardo.penaranda', PROFESIONALES[8], 'PROFESIONAL'),
  usuarioDe(10, 'gabriela.sepulveda', PROFESIONALES[12], 'PROFESIONAL'),
  usuarioDeLaRed(11, 'admin.cucuta', 'Marta Cecilia Ruiz Peña', 'ADMINISTRATIVO'),
  usuarioDeLaRed(12, 'admin.tibu', 'Edgar Fabián Oliveros Solano', 'ADMINISTRATIVO'),
  usuarioDeLaRed(13, 'auditor', 'Hernán Darío Cáceres Soto', 'AUDITOR'),
] satisfies Prisma.UsuarioUncheckedCreateInput[];

/** Upserts by id, so running it again restores these rows and adds nothing. */
export async function sembrarIdentidad(prisma: PrismaClient): Promise<void> {
  // One transaction, in this order, because usuario points at paciente.
  await prisma.$transaction([
    ...PACIENTES.map((paciente) =>
      prisma.paciente.upsert({
        where: { id: paciente.id },
        update: forUpdate(paciente),
        create: paciente,
      }),
    ),
    ...USUARIOS.map((usuario) =>
      prisma.usuario.upsert({
        where: { id: usuario.id },
        update: forUpdate(usuario),
        create: usuario,
      }),
    ),
  ]);
}
