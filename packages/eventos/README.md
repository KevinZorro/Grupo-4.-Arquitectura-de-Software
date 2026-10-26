# @citas/eventos

Contratos de los eventos del agendamiento, publicador con confirmación del broker y consumidor idempotente. Lo usan el
núcleo y todos los adaptadores (ADR-001 y plan de trabajo §7.5).

## Qué trae

| Pieza                     | Qué hace                                                                                                                                                                                                                                             |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `esquemas`, `crearEvento` | Contratos zod de `cita.confirmada`, `cita.cancelada` y `sala.creada`. Todos llevan `idEvento` (UUID) y `ocurridoEn` (ISO 8601 en UTC), y rechazan cualquier campo de más: solo viajan identificadores.                                               |
| `declararTopologia`       | Exchange `citas` de tipo topic y una cola por consumidor, cada una con su `<cola>.dlq` a través del exchange `citas.muertos`. Llamarla al arrancar, tanto quien publica como quien consume.                                                          |
| `publicar`                | Valida el evento y lo publica persistente; la promesa se resuelve solo cuando RabbitMQ lo confirma. La bandeja de salida del núcleo (EVT-3) marca el evento como enviado después de eso.                                                             |
| `consumir`                | Registra `(id_mensaje, consumidor, fecha)` en `<esquema>.mensajes_procesados` dentro del PostgreSQL del núcleo, en la misma transacción que el procesamiento, y descarta los repetidos. El esquema es el prefijo de la cola (`mensajeria`, `video`). |

Si `procesar` lanza un error, la transacción se deshace y el mensaje va a su cola de mensajes muertos. Los reintentos
con espera creciente llegan con EVT-2.

## Ejemplo para un adaptador

```ts
import { connect } from 'amqplib';
import { Pool } from 'pg';
import { consumir, declararTopologia } from '@citas/eventos';

const conexion = await connect(process.env.RABBITMQ_URL!);
const canal = await conexion.createChannel();
const pool = new Pool({ connectionString: process.env.CORE_DATABASE_URL });

await declararTopologia(canal);
await consumir({
  canal,
  pool,
  cola: 'mensajeria.cita-confirmada',
  // Clave del ADR-001 para mensajería: un aviso por cita y tipo de mensaje.
  claveIdempotencia: (evento) => `${evento.idCita}:CONFIRMACION`,
  procesar: async (evento) => {
    // evento: { idEvento, ocurridoEn, idCita, idPaciente, modalidad }
  },
});
```

Sin `claveIdempotencia`, la clave es `idEvento`.

## Ejemplo para publicar

```ts
import { connect } from 'amqplib';
import { crearEvento, declararTopologia, publicar } from '@citas/eventos';

const conexion = await connect(process.env.RABBITMQ_URL!);
const canal = await conexion.createConfirmChannel();
await declararTopologia(canal);

// En el núcleo, crearEvento se llama al guardar en la bandeja de salida, para que un reintento
// conserve el mismo idEvento.
const evento = crearEvento('sala.creada', { idCita, idSala });
await publicar(canal, 'sala.creada', evento);
```

Para agregar una cola nueva (por ejemplo `auditoria.citas` en S2), se añade en `colas` dentro de `src/topologia.ts`.

## Comandos

- `npm run build -w @citas/eventos`: compila a `dist/`.
- `npm test -w @citas/eventos`: pruebas de contratos y la de mensaje repetido. Esta última necesita `docker compose up`
  (RabbitMQ y el PostgreSQL del núcleo).
