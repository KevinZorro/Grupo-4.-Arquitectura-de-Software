import { Controller, Get, Logger, ServiceUnavailableException } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { EstadoNucleoDto } from './estado-nucleo.dto';

/** Health must answer fast even when the database hangs, so the ping gets its own deadline. */
const DATABASE_PING_TIMEOUT_MS = 2_000;

@ApiTags('infraestructura')
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Estado del núcleo y de su base de datos' })
  @ApiOkResponse({ type: EstadoNucleoDto })
  @ApiServiceUnavailableResponse({ type: EstadoNucleoDto, description: 'La base no responde' })
  async estado(): Promise<EstadoNucleoDto> {
    if (await this.isDatabaseUp()) {
      return { estado: 'ok', base: 'ok' };
    }
    throw new ServiceUnavailableException({ estado: 'degradado', base: 'caida' });
  }

  private async isDatabaseUp(): Promise<boolean> {
    let timer: NodeJS.Timeout | undefined;
    const deadline = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(
        () => reject(new Error(`sin respuesta en ${DATABASE_PING_TIMEOUT_MS} ms`)),
        DATABASE_PING_TIMEOUT_MS,
      );
    });
    try {
      await Promise.race([this.prisma.$queryRaw`SELECT 1`, deadline]);
      return true;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(`La base de datos no respondió: ${reason}`);
      return false;
    } finally {
      clearTimeout(timer);
    }
  }
}
