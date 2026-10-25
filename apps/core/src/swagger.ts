import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { CABECERA_USUARIO_DEV } from './identidad';

export const SWAGGER_PATH = 'docs';

const SEGURIDAD_USUARIO_DEV = 'usuario-dev';

export function setupSwagger(app: INestApplication): void {
  const options = new DocumentBuilder()
    .setTitle('Núcleo asistencial · Grupo 4')
    .setDescription(
      'API REST del monolito modular. Solo existe en desarrollo. ' +
        `Use Authorize para enviar la cabecera ${CABECERA_USUARIO_DEV} con el correo de un usuario semilla.`,
    )
    .setVersion('0.1.0')
    .addApiKey(
      {
        type: 'apiKey',
        name: CABECERA_USUARIO_DEV,
        in: 'header',
        description: 'Correo de un usuario semilla, por ejemplo ana.perez@ejemplo.test',
      },
      SEGURIDAD_USUARIO_DEV,
    )
    .addSecurityRequirements(SEGURIDAD_USUARIO_DEV)
    .build();

  SwaggerModule.setup(SWAGGER_PATH, app, SwaggerModule.createDocument(app, options), {
    swaggerOptions: { persistAuthorization: true },
  });
}
