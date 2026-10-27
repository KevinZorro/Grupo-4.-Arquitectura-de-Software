# Núcleo asistencial (`apps/core`)

Monolito modular NestJS con los módulos agenda, pagos, historia, autorización e identidad, sobre PostgreSQL con
Prisma. El paquete es `@citas/core`. El plan (§7.5) lo llama `apps/nucleo`; el directorio real es `apps/core`.

## Arrancar

Requisitos: Node 22.12 o superior y Docker (solo para PostgreSQL).

```bash
npm install                          # en la raíz; el postinstall genera el cliente de Prisma
cp .env.example .env                 # ya trae NODE_ENV=development y la URL de la base
docker compose up -d postgres-core
npm run db:deploy -w @citas/core     # aplica las migraciones
npm run db:seed -w @citas/core       # 12 sedes y datos ficticios; se puede repetir sin duplicar
npm run start:dev -w @citas/core     # http://localhost:3000
```

- `GET /health` responde `{ "estado": "ok", "base": "ok" }`. Si la base no contesta en 2 s responde 503 con
  `{ "estado": "degradado", "base": "caida" }`; el proceso sigue vivo.
- Swagger en <http://localhost:3000/docs>, solo con `NODE_ENV=development`.
- La API vive bajo `/api/v1`. Quedan fuera del prefijo `/health` y todo `/internal/*` (contrato de los adaptadores).

## Variables de entorno

Se validan con zod al arrancar. Si falta una o no es válida, el proceso imprime cuáles y termina con código 1. Los
mensajes no repiten los valores recibidos, porque la URL de la base lleva una contraseña.

| Variable            | Obligatoria | Qué es                                                           |
| ------------------- | ----------- | ---------------------------------------------------------------- |
| `NODE_ENV`          | sí          | `development`, `test` o `production`. No tiene valor por defecto |
| `CORE_DATABASE_URL` | sí          | URL `postgresql://` de la base del núcleo                        |
| `PORT`              | no          | Puerto HTTP. Por defecto 3000                                    |
| `CORS_ORIGINS`      | no          | Orígenes del navegador separados por comas. Vacío desactiva CORS |
| `RABBITMQ_URL`      | sí          | URL `amqp://` del broker al que sale la bandeja de salida        |

Sin RabbitMQ el núcleo arranca igual: los eventos quedan pendientes en `evento_saliente` y salen, en orden, cuando el
broker vuelve. Los módulos los guardan con `BandejaSalidaService.encolar(tx, { clave, datos })` dentro de la misma
transacción que cambia el estado de la cita (EVT-3).

## Identificarse en desarrollo

Todas las rutas niegan por defecto (401) salvo las marcadas `@Publico()`. Mientras llega el login (IDN-1, sprint 2),
se envía la cabecera `X-Usuario-Dev` con el correo de un usuario semilla:

```bash
curl -H 'X-Usuario-Dev: ana.perez@ejemplo.test' http://localhost:3000/api/v1/<ruta>
```

La cabecera solo funciona con `NODE_ENV=development` o `test`. En cualquier otro entorno el núcleo responde un 401 que
ni la menciona. En Swagger, el botón Authorize la envía por usted. El selector de usuario del frontend (FUN-4) debe
enviarla con uno de estos correos:

| Correo                            | Nombre                                  | Rol                            |
| --------------------------------- | --------------------------------------- | ------------------------------ |
| `ana.perez@ejemplo.test`          | Ana Lucía Pérez Gómez                   | PACIENTE                       |
| `luis.moreno@ejemplo.test`        | Luis Alberto Moreno Díaz                | PACIENTE                       |
| `sara.rincon@ejemplo.test`        | Sara Valentina Rincón Ortiz (menor, TI) | PACIENTE                       |
| `pedro.castellanos@ejemplo.test`  | Pedro Antonio Castellanos Vera          | PACIENTE                       |
| `maria.quintana@ejemplo.test`     | María José Quintana Ruiz (CE)           | PACIENTE                       |
| `jorge.salcedo@ejemplo.test`      | Jorge Iván Salcedo Peña                 | PACIENTE                       |
| `laura.contreras@ejemplo.test`    | Laura Marcela Contreras Peña            | PROFESIONAL (Medicina general) |
| `camila.villamizar@ejemplo.test`  | Camila Andrea Villamizar Rojas          | PROFESIONAL (Pediatría)        |
| `ricardo.penaranda@ejemplo.test`  | Ricardo Alonso Peñaranda Gómez          | PROFESIONAL (Cardiología)      |
| `gabriela.sepulveda@ejemplo.test` | Gabriela Lucía Sepúlveda Ríos           | PROFESIONAL (Psiquiatría)      |
| `admin.cucuta@ejemplo.test`       | Marta Cecilia Ruiz Peña                 | ADMINISTRATIVO                 |
| `admin.tibu@ejemplo.test`         | Edgar Fabián Oliveros Solano            | ADMINISTRATIVO                 |
| `auditor@ejemplo.test`            | Hernán Darío Cáceres Soto               | AUDITOR                        |

Todo es ficticio: los correos están en el dominio reservado `.test` y los documentos empiezan por 9. Los ids son fijos y
legibles, `00000000-0000-4000-80KK-NNNNNNNNNNNN`, donde `KK` es el tipo (01 sede, 02 especialidad, 03 profesional,
04 paciente, 05 usuario) y `NN…` el número. Por ejemplo, Ana Lucía es el usuario `…-8005-000000000001`.

En un controlador, `@UsuarioActual()` entrega a quien llama (`id`, `correo`, `nombre`, `rol`, `pacienteId`,
`profesionalId`). Cuando llegue el JWT cambia la guarda y estos dos decoradores siguen igual.

## Módulos y tablas

| Módulo       | Carpeta            | Esquema                               | Tablas                                | Tareas                     |
| ------------ | ------------------ | ------------------------------------- | ------------------------------------- | -------------------------- |
| agenda       | `src/agenda`       | `agenda.prisma`                       | `sede`, `especialidad`, `profesional` | AGE-1 agrega franja y cita |
| identidad    | `src/identidad`    | `identidad.prisma`                    | `usuario`, `paciente`                 | IDN-*                      |
| pagos        | `src/pagos`        | `pagos.prisma` (aún no existe)        | —                                     | PAG-*                      |
| historia     | `src/historia`     | `historia.prisma` (aún no existe)     | —                                     | HCL-*                      |
| autorizacion | `src/autorizacion` | `autorizacion.prisma` (aún no existe) | —                                     | AUT-*                      |

`src/config`, `src/prisma`, `src/health` y `src/generated` no son módulos de dominio: sirven a todos.

## Reglas de los módulos

Implementan lo que dice la visión (§6) y el RNF-12: ningún módulo consulta las tablas de otro. La prueba
`test/arquitectura` las hace fallar en CI y dice qué archivo las rompe.

1. Cada módulo declara sus modelos en `prisma/schema/<módulo>.prisma`, con el mismo nombre que su carpeta.
2. Un modelo no tiene relación con un modelo de otro módulo. Se guarda el id suelto, sin clave foránea, como hace
   `usuario.profesional_id`. Que el id exista lo comprueba el módulo dueño.
3. El código de `src/<módulo>` solo usa los delegados de Prisma y el SQL de sus propias tablas.
4. Se entra a un módulo solo por su `index.ts`. Para dar datos a otro módulo, exporte un servicio ahí. Ejemplo:
   `IdentidadService` en `src/identidad/index.ts`.

## Recetas

**Un modelo o una columna nueva.** Edite el `.prisma` de su módulo y corra:

```bash
npm run db:migrate -w @citas/core -- --name agenda_franja   # crea y aplica la migración
npm run db:generate -w @citas/core                          # Prisma 7 no regenera el cliente al migrar
```

Para SQL propio (un índice parcial, un trigger) use `-- --create-only`, edite el `migration.sql` y vuelva a correr
`db:migrate`. Prisma no genera migraciones inversas: en desarrollo `npm run db:reset -w @citas/core` borra los datos
de la base y reaplica las migraciones, y después se vuelve a sembrar con `db:seed`; en producción se restaura una copia.
Dos personas pueden crear migraciones a la vez: tras fusionar `main`, corra `db:migrate` y confirme que no pide otra.

**Datos de semilla.** Cree `prisma/seed/<módulo>.ts` con sus datos y una función `sembrar<Módulo>`, y agréguela en
`prisma/seed/index.ts` después de los módulos a los que apunta. Use ids de `seedId(...)` y `upsert`, para que repetir la
semilla no duplique. La semilla se niega a correr con `NODE_ENV=production`.

**Una ruta pública.** Marque la ruta o el controlador con `@Publico()`: el health, un webhook que verifica su propia
firma, los endpoints `/internal/v1`. Todo lo demás exige usuario.

**Validar la entrada.** Con zod, directamente en el decorador. Use `z.strictObject` para rechazar campos desconocidos:

```ts
const crearCitaSchema = z.strictObject({ franjaId: z.uuid(), modalidad: z.enum(['VIRTUAL', 'PRESENCIAL']) });

@Post()
crear(@Body({ schema: crearCitaSchema }) cuerpo: z.infer<typeof crearCitaSchema>) { /* ... */ }
```

Swagger toma el esquema del cuerpo de ahí mismo. Un dato inválido responde 400 con el detalle de cada campo.

## Pruebas

```bash
npm test                           # raíz: unitarias y prueba de arquitectura; no necesitan base
npm run test:e2e -w @citas/core    # contra PostgreSQL real; aplica las migraciones pendientes antes de empezar
```

Las e2e levantan la app como corre en desarrollo, en pruebas y en producción, comprueban la cabecera en cada uno y
arrancan el proceso compilado para ver que falla con código 1 si falta una variable. Si no hay base, dicen cómo
levantarla.

## Decisiones y trampas

- NestJS 12 publica sus paquetes como ES modules, pero la aplicación sigue en CommonJS: los imports relativos no
  llevan extensión. Por eso se exige Node 22.12 o superior, que puede hacer `require()` de ES modules.
- Prisma está fijo en 7.10.1. `npm install prisma` sin versión instala la 8.0, que hoy es una versión candidata, porque
  la etiqueta `latest` apunta a ella. Los tres paquetes de Prisma deben tener la misma versión.
- TypeScript está fijo en `~6.0.3`. TypeScript 7 no expone la API que usa `nest build`, y typescript-eslint llega
  hasta 6.0.
- `prisma.config.ts` lee `process.env` en vez de `env()` a propósito: `prisma generate` corre en cada `npm install`
  y no debe fallar en un clon sin `.env`.
- Con `emitDecoratorMetadata`, el constructor debe tipar `ConfigService<Env, true>`; un alias de tipo hace que Nest no
  encuentre qué inyectar.

## Fuera de FUN-3

- Dockerfile y servicio `core` en `docker-compose.yml`: hoy el compose solo levanta las bases, RabbitMQ y Mailpit, y el
  núcleo corre con `npm run start:dev`. Encaja en INT-1.
- Franjas y citas con su semilla (AGE-1), bandeja de salida (EVT-3), login con JWT (IDN-1) y autorización por vínculo
  (AUT-*).
