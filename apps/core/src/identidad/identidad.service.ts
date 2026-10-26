import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { UsuarioAutenticado } from './usuario-autenticado';

/** What the rest of the core may ask the identity module. */
@Injectable()
export class IdentidadService {
  constructor(private readonly prisma: PrismaService) {}

  /** Correos are stored in lowercase, so the lookup lowercases whatever it receives. */
  buscarActivoPorCorreo(correo: string): Promise<UsuarioAutenticado | null> {
    return this.prisma.usuario.findUnique({
      where: { correo: correo.trim().toLowerCase(), activo: true },
      select: {
        id: true,
        correo: true,
        nombre: true,
        rol: true,
        pacienteId: true,
        profesionalId: true,
      },
    });
  }
}
