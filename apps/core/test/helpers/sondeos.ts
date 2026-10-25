import { Controller, Get } from '@nestjs/common';
import { Publico, UsuarioActual, type UsuarioAutenticado } from '../../src/identidad';

// Stand-ins for the routes later tasks will add, so the tests can show how the core treats them.

@Publico()
@Controller('sondeo')
export class SondeoPublicoController {
  @Get()
  ping(): { ok: boolean } {
    return { ok: true };
  }
}

@Publico()
@Controller('internal/v1/sondeo')
export class SondeoInternoController {
  @Get()
  ping(): { ok: boolean } {
    return { ok: true };
  }
}

/** Not @Publico(), so it is denied unless a user is identified. */
@Controller('protegido')
export class SondeoProtegidoController {
  @Get()
  quien(@UsuarioActual() usuario: UsuarioAutenticado): UsuarioAutenticado {
    return usuario;
  }
}

/** A mistake the core must catch: asking for the user on a route that does not authenticate. */
@Publico()
@Controller('mal-uso')
export class SondeoMalUsoController {
  @Get()
  quien(@UsuarioActual() usuario: UsuarioAutenticado): UsuarioAutenticado {
    return usuario;
  }
}
