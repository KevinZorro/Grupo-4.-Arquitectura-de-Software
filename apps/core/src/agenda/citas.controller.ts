import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { z } from 'zod';
import { Modalidad } from '../generated/prisma/enums';
import { UsuarioActual, type UsuarioAutenticado } from '../identidad';
import {
  CitasService,
  reservaSchema,
  vistaCitaSchema,
  type Reserva,
  type VistaCita,
} from './citas.service';

export const CABECERA_IDEMPOTENCIA = 'Idempotency-Key';

const claveIdempotenciaSchema = z.uuid();

const reservarSchema = z.strictObject({
  franjaId: z.uuid(),
  modalidad: z.enum(Modalidad),
});

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

  @Post()
  @ApiOperation({
    summary: 'Reserva una franja para el paciente que llama',
    description:
      'La virtual queda PENDIENTE_PAGO con la franja bloqueada 15 min y devuelve el enlace de ' +
      'pago; la presencial queda CONFIRMADA. Repetir la solicitud con la misma ' +
      `${CABECERA_IDEMPOTENCIA} devuelve la misma cita.`,
  })
  @ApiHeader({
    name: CABECERA_IDEMPOTENCIA,
    required: true,
    description: 'UUID que el cliente genera una vez por intento de reserva',
  })
  @ApiCreatedResponse({ standardSchema: reservaSchema })
  @ApiBadRequestResponse({ description: 'Falta la cabecera o el cuerpo no es válido' })
  @ApiForbiddenResponse({ description: 'Quien llama no es un paciente' })
  @ApiNotFoundResponse({ description: 'La franja no existe' })
  @ApiConflictResponse({ description: 'La franja ya está tomada' })
  @ApiUnprocessableEntityResponse({
    description: 'La franja ya empezó, es de otra modalidad o la clave se usó para otra solicitud',
  })
  @ApiServiceUnavailableResponse({
    description: 'La pasarela no respondió: la cita quedó CANCELADA y la franja libre',
  })
  reservar(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Headers(CABECERA_IDEMPOTENCIA) clave: string | undefined,
    @Body({ schema: reservarSchema }) cuerpo: z.infer<typeof reservarSchema>,
  ): Promise<Reserva> {
    const pacienteId = pacienteDe(usuario);
    const claveIdempotencia = claveIdempotenciaSchema.safeParse(clave);
    if (!claveIdempotencia.success) {
      throw new BadRequestException(`La cabecera ${CABECERA_IDEMPOTENCIA} debe ser un UUID`);
    }
    return this.citas.reservar(pacienteId, claveIdempotencia.data, cuerpo);
  }
}
