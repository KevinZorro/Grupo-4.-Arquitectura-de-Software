import { ApiProperty } from '@nestjs/swagger';

export class EstadoNucleoDto {
  @ApiProperty({ enum: ['ok', 'degradado'] })
  estado!: 'ok' | 'degradado';

  @ApiProperty({
    enum: ['ok', 'caida'],
    description: 'Resultado de un SELECT 1 contra el PostgreSQL del núcleo',
  })
  base!: 'ok' | 'caida';
}
