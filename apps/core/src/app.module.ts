import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AgendaModule } from './agenda';
import { AutorizacionModule } from './autorizacion';
import { BandejaSalidaModule } from './bandeja-salida';
import { parseEnv } from './config/env';
import { HealthModule } from './health/health.module';
import { HistoriaModule } from './historia';
import { IdentidadModule } from './identidad';
import { PagosModule } from './pagos';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    // Looks for .env next to the app and in the repository root; real environment variables win.
    ConfigModule.forRoot({
      isGlobal: true,
      validate: parseEnv,
      envFilePath: ['.env', '../../.env'],
    }),
    PrismaModule,
    BandejaSalidaModule,
    HealthModule,
    AgendaModule,
    PagosModule,
    HistoriaModule,
    AutorizacionModule,
    IdentidadModule,
  ],
})
export class AppModule {}
