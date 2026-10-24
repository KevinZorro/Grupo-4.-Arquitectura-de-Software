# Reunión de arranque — sprint 1

Grupo 4 · Caso 4 · sábado 24 de octubre de 2026 · 1 hora

Este documento reúne lo que hay que aprobar hoy. Todo sale de `docs/plan-de-trabajo.md`, que es la fuente de verdad; si algo
cambia en la reunión, se corrige allá.

## Agenda

1. Retraso y alcance (10 min): `docs/plan-de-trabajo.md`, secciones 4 y 5. Capacidad neta de 210 h frente a 238 h del alcance completo; por eso hay un MVP de 163 h.
2. Decisiones técnicas (15 min): sección 1 de este documento.
3. Contratos para trabajar en paralelo (15 min): sección 2.
4. Reparto y fechas del sprint 1 (15 min): sección 3 y los issues con la etiqueta `sprint-1`.
5. Forma de trabajo (5 min): sección 4.

## 1. Decisiones técnicas

Marca cada una como aprobada o cámbiala aquí mismo.

| Decisión | Propuesta | Por qué | Alternativa |
|---|---|---|---|
| Frontend | React con Vite y TypeScript, más una biblioteca de componentes como MUI o Mantine | La aplicación vive detrás de un login, así que una SPA basta, y la biblioteca evita diseñar componentes en un sistema en el que la riqueza de interfaz no manda | Next.js, que solo se justificaría si hiciera falta renderizar en servidor |
| Acceso a datos | Prisma con migraciones versionadas, más SQL propio para la restricción única de la franja y los triggers de la auditoría | Da cliente tipado y migraciones simples a un equipo que empieza | TypeORM, si el equipo ya lo domina |
| Monorepo | npm workspaces | No agrega herramientas y alcanza para siete aplicaciones y un paquete | pnpm con Turborepo |
| Cliente de RabbitMQ | amqplib envuelto en `packages/eventos` | Da control directo sobre acuses, reintentos y colas de mensajes muertos, que son el centro del ADR-001 | @golevelup/nestjs-rabbitmq |
| Autenticación | JWT propio con roles | Basta para cuatro roles y no suma otro servidor que operar | Keycloak, que pesa demasiado para cinco semanas |
| Terceros | Simuladores propios de pasarela, video y laboratorio, y correo a Mailpit | Permiten provocar fallas en la demo sin depender de cuentas externas | Sandbox de una pasarela real, como ítem Podría |
| Idempotencia de los adaptadores | Tabla de mensajes procesados en un esquema propio de cada adaptador dentro del PostgreSQL del núcleo | Cumple el ADR-001 sin otra base que operar y sin que un módulo lea las tablas de otro | Una base por adaptador |

- [ ] Frontend
- [ ] Acceso a datos
- [ ] Monorepo
- [ ] Cliente de RabbitMQ
- [ ] Autenticación
- [ ] Terceros simulados
- [ ] Idempotencia de los adaptadores

Pendiente de decidir: la biblioteca de componentes (MUI o Mantine).

## 2. Contratos

Con estos nombres y formas trabaja cada persona desde hoy, sin esperar a las demás. Si alguien necesita un cambio, lo avisa al grupo
antes de implementarlo.

```text
Estructura del repositorio
  apps/nucleo                  NestJS: agenda, pagos, historia, autorizacion, identidad
  apps/auditoria               servicio de auditoría con su propia base (S2)
  apps/adaptador-video         worker
  apps/adaptador-mensajeria    worker
  apps/worker-laboratorio      worker (S4)
  apps/pasarela-simulada       solo desarrollo y demo
  apps/web                     React + Vite
  packages/eventos             contratos, publicador y consumidor idempotente
  docker-compose.yml

Núcleo, REST bajo /api/v1
  GET  /franjas?especialidadId&sedeId&profesionalId&modalidad=VIRTUAL|PRESENCIAL&fecha=AAAA-MM-DD
  POST /citas            cabecera Idempotency-Key; cuerpo { franjaId, modalidad }
       201 virtual       { id, estado: "PENDIENTE_PAGO", bloqueoVenceEn, urlPago }
       201 presencial    { id, estado: "CONFIRMADA" }
       409 la franja ya está tomada · 503 la pasarela no respondió y la cita queda CANCELADA
  GET  /citas/mias
  POST /pagos/webhook    cabecera X-Firma (HMAC-SHA256 del cuerpo)
                         cuerpo { idTransaccion, referencia, estado: "APROBADO" | "RECHAZADO" }

Núcleo, uso interno de los adaptadores
  GET  /internal/v1/citas/{idCita}/aviso  ->  { nombre, correo, fecha, hora, sede, enlacePortal }

Pasarela simulada
  POST /transacciones                  { referencia, monto } -> { idTransaccion, urlPago }
  GET  /pagar/{idTransaccion}          página con Aprobar y Rechazar
  GET  /transacciones/{idTransaccion}  -> { estado }   consulta de respaldo (S2)

Eventos, exchange "citas" de tipo topic; todos llevan idEvento (UUID) y ocurridoEn (ISO 8601, UTC)
  cita.confirmada   CitaConfirmada { idCita, idPaciente, modalidad }
  cita.cancelada    CitaCancelada  { idCita, idPaciente, motivo }
                    motivo: FALLA_INICIO_PAGO | PAGO_RECHAZADO | BLOQUEO_VENCIDO | CANCELADA_POR_PACIENTE | CANCELADA_POR_SEDE
  sala.creada       SalaCreada     { idCita, idSala }

Colas, una por consumidor y cada una con su cola de mensajes muertos
  video.cita-confirmada · mensajeria.cita-confirmada · mensajeria.cita-cancelada (S2)
  auditoria.citas (S2) · nucleo.sala-creada (S3)
```

- [ ] Estructura del repositorio
- [ ] Contrato REST del núcleo
- [ ] Pasarela simulada
- [ ] Eventos y colas

## 3. Reparto del semestre

| Persona | Responsable de | Pareja de revisión | Horas del plan base | Holgura |
|---|---|---|---|---|
| Wilhen Gutiérrez (líder) | Agenda y estados de la cita, coordinación y presentación final | Angel | 32 | 3 |
| Angel Montañez | Pasarela simulada, pago del copago, login, portal del paciente y pruebas E2E | Wilhen | 28 | 7 |
| Nefer Rojas | Paquete de eventos, mensajería, recordatorios y nota de atención firmada; ADR-002 | Javier | 30 | 5 |
| Javier Rincón | Infraestructura, CI, adaptador de video, pantalla de consulta y resiliencia (EC-02); ADR-003 | Nefer | 30 | 5 |
| Kevin Zorro | Núcleo, integración, identidad y autorización por vínculo (EC-01); ADR-004 | Juan Camilo | 29 | 6 |
| Juan Camilo Uribe | Frontend base, servicio de auditoría y laboratorio; ADR-005 | Kevin | 32 | 3 |

Tareas del sprint 1: 17 issues con la etiqueta `sprint-1`, 7 h por persona, con la fecha límite de cada PR en el issue.

- [ ] Cada persona confirma que sus 7 h del sprint 1 son realistas

## 4. Forma de trabajo

- Una rama por tarea: `feat/<id>-<tema>`, por ejemplo `feat/age-3-reserva`.
- PR pequeños con la plantilla, revisados por la pareja del módulo y fusionados con squash. `main` exige una aprobación.
- Reunión semanal de 1 h para cerrar el sprint y planear el siguiente; a mitad de semana, un reporte escrito de cada persona.
- Quien vaya a incumplir una fecha lo avisa el mismo día.
- Todo el código debe quedar fusionado antes del jueves 29 a las 12:00; ese día hay integración y ensayo.

## Acuerdos de la reunión

- 
