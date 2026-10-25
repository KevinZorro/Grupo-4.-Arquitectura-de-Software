import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service';
import { IdentidadService } from './identidad.service';

function serviceWith(findUnique: ReturnType<typeof vi.fn>): IdentidadService {
  return new IdentidadService({ usuario: { findUnique } } as unknown as PrismaService);
}

describe('IdentidadService.buscarActivoPorCorreo', () => {
  it('looks up only active users, by the correo in lowercase and trimmed', async () => {
    const findUnique = vi.fn().mockResolvedValue(null);

    await serviceWith(findUnique).buscarActivoPorCorreo('  ANA.Perez@Ejemplo.TEST ');

    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { correo: 'ana.perez@ejemplo.test', activo: true } }),
    );
  });

  it('asks only for the fields the rest of the core may see', async () => {
    const findUnique = vi.fn().mockResolvedValue(null);

    await serviceWith(findUnique).buscarActivoPorCorreo('ana.perez@ejemplo.test');

    expect(findUnique.mock.calls[0][0].select).toEqual({
      id: true,
      correo: true,
      nombre: true,
      rol: true,
      pacienteId: true,
      profesionalId: true,
    });
  });

  it('answers null when there is no such user', async () => {
    const findUnique = vi.fn().mockResolvedValue(null);

    await expect(
      serviceWith(findUnique).buscarActivoPorCorreo('x@ejemplo.test'),
    ).resolves.toBeNull();
  });
});
