import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import type { Env } from '../config/env';
import { AutenticacionDevGuard, CABECERA_USUARIO_DEV } from './autenticacion-dev.guard';
import type { IdentidadService } from './identidad.service';
import type { SolicitudAutenticada, UsuarioAutenticado } from './usuario-autenticado';

const ANA: UsuarioAutenticado = {
  id: '00000000-0000-4000-8005-000000000001',
  correo: 'ana.perez@ejemplo.test',
  nombre: 'Ana Lucía Pérez Gómez',
  rol: 'PACIENTE',
  pacienteId: '00000000-0000-4000-8004-000000000001',
  profesionalId: null,
};

interface Escenario {
  nodeEnv: Env['NODE_ENV'];
  esPublico?: boolean;
  cabecera?: string;
  usuario?: UsuarioAutenticado | null;
}

function escenario({ nodeEnv, esPublico = false, cabecera, usuario = null }: Escenario) {
  const request = {
    header: (name: string) => (name === CABECERA_USUARIO_DEV ? cabecera : undefined),
  } as SolicitudAutenticada;
  const context = {
    getHandler: () => escenario,
    getClass: () => AutenticacionDevGuard,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  const buscarActivoPorCorreo = vi.fn().mockResolvedValue(usuario);
  const guard = new AutenticacionDevGuard(
    { getAllAndOverride: () => esPublico } as unknown as Reflector,
    { get: () => nodeEnv } as unknown as ConfigService<Env, true>,
    { buscarActivoPorCorreo } as unknown as IdentidadService,
  );
  return { guard, context, request, buscarActivoPorCorreo };
}

describe('AutenticacionDevGuard', () => {
  it('lets a @Publico() route through without looking anyone up, in any environment', async () => {
    for (const nodeEnv of ['development', 'test', 'production'] as const) {
      const { guard, context, buscarActivoPorCorreo } = escenario({ nodeEnv, esPublico: true });

      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(buscarActivoPorCorreo).not.toHaveBeenCalled();
    }
  });

  describe.each(['development', 'test'] as const)('in %s', (nodeEnv) => {
    it('admits a known user and leaves it on the request', async () => {
      const { guard, context, request, buscarActivoPorCorreo } = escenario({
        nodeEnv,
        cabecera: ANA.correo,
        usuario: ANA,
      });

      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(buscarActivoPorCorreo).toHaveBeenCalledWith(ANA.correo);
      expect(request.usuario).toEqual(ANA);
    });

    it('asks for the header when it is missing', async () => {
      const { guard, context } = escenario({ nodeEnv });

      await expect(guard.canActivate(context)).rejects.toThrow(CABECERA_USUARIO_DEV);
    });

    it('rejects a user that does not exist or is inactive', async () => {
      const { guard, context } = escenario({ nodeEnv, cabecera: 'nadie@ejemplo.test' });

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('outside development and test', () => {
    it('denies a valid header: the shortcut does not work here', async () => {
      const { guard, context, request, buscarActivoPorCorreo } = escenario({
        nodeEnv: 'production',
        cabecera: ANA.correo,
        usuario: ANA,
      });

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      expect(buscarActivoPorCorreo).not.toHaveBeenCalled();
      expect(request.usuario).toBeUndefined();
    });

    it('does not even hint that the header exists', async () => {
      const { guard, context } = escenario({ nodeEnv: 'production' });

      const error = await guard.canActivate(context).catch((e: unknown) => e);

      expect((error as UnauthorizedException).message).toBe('No autenticado');
    });
  });
});
