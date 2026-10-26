import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { isDevHeaderEnabled, type Env } from '../config/env';
import { IdentidadService } from './identidad.service';
import { ES_PUBLICO } from './publico.decorator';
import type { SolicitudAutenticada } from './usuario-autenticado';

export const CABECERA_USUARIO_DEV = 'X-Usuario-Dev';

/**
 * Stand-in for the real login (IDN-1, sprint 2): while developing, the caller names a seeded
 * user's correo in the X-Usuario-Dev header. When the JWT guard arrives it replaces this class
 * and nothing else changes: @Publico() and @UsuarioActual() keep their meaning.
 *
 * It is registered globally and denies by default. Outside development and test it denies every
 * route that is not @Publico(), even when the header is present.
 */
@Injectable()
export class AutenticacionDevGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService<Env, true>,
    private readonly identidad: IdentidadService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const esPublico = this.reflector.getAllAndOverride<boolean | undefined>(ES_PUBLICO, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (esPublico) {
      return true;
    }

    // Says nothing about the header: outside development it must not even be advertised.
    if (!isDevHeaderEnabled(this.config.get('NODE_ENV', { infer: true }))) {
      throw new UnauthorizedException('No autenticado');
    }

    const request = context.switchToHttp().getRequest<SolicitudAutenticada>();
    const correo = request.header(CABECERA_USUARIO_DEV);
    if (!correo) {
      throw new UnauthorizedException(`Falta la cabecera ${CABECERA_USUARIO_DEV}`);
    }

    const usuario = await this.identidad.buscarActivoPorCorreo(correo);
    if (!usuario) {
      throw new UnauthorizedException('Usuario de desarrollo desconocido o inactivo');
    }

    request.usuario = usuario;
    return true;
  }
}
