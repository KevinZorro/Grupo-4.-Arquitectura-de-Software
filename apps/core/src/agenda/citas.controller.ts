import { Controller, ForbiddenException, Get } from '@nestjs/common';
import { ApiForbiddenResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { UsuarioActual, type UsuarioAutenticado } from '../identidad';
import { CitasService, vistaCitaSchema, type VistaCita } from './citas.service';

/** Only a patient books and owns citas; the other roles reach them through their own routes. */
function pacienteDe(usuario: UsuarioAutenticado): string {
  if (!usuario.pacienteId) {
    throw new ForbiddenException('Solo un paciente tiene citas propias');
  }
  return usuario.pacienteId;
}

@ApiTags('agenda')
@Controller('citas')
export class CitasController {
  constructor(private readonly citas: CitasService) {}

  @Get('mias')
  @ApiOperation({ summary: 'Citas del paciente que consulta, con su estado' })
  @ApiOkResponse({ standardSchema: z.array(vistaCitaSchema) })
  @ApiForbiddenResponse({ description: 'Quien consulta no es un paciente' })
  mias(@UsuarioActual() usuario: UsuarioAutenticado): Promise<VistaCita[]> {
    return this.citas.listarDelPaciente(pacienteDe(usuario));
  }
}
