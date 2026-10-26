import { createParamDecorator, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { SolicitudAutenticada, UsuarioAutenticado } from './usuario-autenticado';

/**
 * The authenticated caller of the request. It is only filled on routes that are not @Publico();
 * asking for it on a public route answers 401 instead of handing back nothing.
 */
export const UsuarioActual = createParamDecorator(
  (_data: unknown, context: ExecutionContext): UsuarioAutenticado => {
    const { usuario } = context.switchToHttp().getRequest<SolicitudAutenticada>();
    if (!usuario) {
      throw new UnauthorizedException('No autenticado');
    }
    return usuario;
  },
);
