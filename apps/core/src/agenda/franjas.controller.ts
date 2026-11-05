import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { Modalidad } from '../generated/prisma/enums';
import { FranjasService, MAXIMO_FRANJAS } from './franjas.service';
import { vistaFranjaSchema, type VistaFranja } from './vista-franja';

const buscarFranjasSchema = z.strictObject({
  especialidadId: z.uuid().optional(),
  sedeId: z.uuid().optional(),
  profesionalId: z.uuid().optional(),
  modalidad: z.enum(Modalidad).optional(),
  fecha: z.iso.date({ error: 'debe tener el formato AAAA-MM-DD' }).optional(),
});

@ApiTags('agenda')
@Controller('franjas')
export class FranjasController {
  constructor(private readonly franjas: FranjasService) {}

  @Get()
  @ApiOperation({
    summary: 'Franjas libres que aún no han empezado',
    description:
      `Ordenadas de la más próxima a la más lejana, hasta ${MAXIMO_FRANJAS}. ` +
      'La fecha es un día del calendario de Colombia.',
  })
  @ApiOkResponse({ standardSchema: z.array(vistaFranjaSchema) })
  buscar(
    @Query({ schema: buscarFranjasSchema }) filtros: z.infer<typeof buscarFranjasSchema>,
  ): Promise<VistaFranja[]> {
    return this.franjas.buscarLibres(filtros);
  }
}
