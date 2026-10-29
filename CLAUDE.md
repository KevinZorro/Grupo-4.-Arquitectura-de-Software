# Sistema de citas e historia clínica — Grupo 4

Proyecto del curso Arquitectura de Software (UFPS, 2026-II), caso 4: agendamiento de citas presenciales y virtuales,
videoconsulta e historia clínica bajo reserva legal para una red de 12 IPS. Seis integrantes (ver `README.md`).

## Estado
- Diseño cerrado: visión, ADR-000, ADR-001, flujo de agendamiento y vista de contenedores.
- El código empieza en el sprint 1 (24 al 30 de octubre de 2026). Plan, reparto y contratos en `docs/plan-de-trabajo.md`.
- Ya hay monorepo (FUN-1), Docker de las bases (FUN-2) y el núcleo `apps/core` (FUN-3); el resto de tareas cuelga de ellos.

## Stack (fijado en `docs/contenedores.dsl`)
- Núcleo asistencial (`apps/core`): NestJS 12 en CommonJS, monolito modular, PostgreSQL con Prisma 7, Vitest y TypeScript 6.
- Servicio de auditoría: Node.js con base y credenciales propias, solo de anexado.
- Broker RabbitMQ; adaptadores de video y mensajería y worker de laboratorio en Node.js.
- Frontend, ORM y monorepo: propuestas en `docs/plan-de-trabajo.md` §11 (React + Vite, Prisma, npm workspaces).

## Comandos
- Raíz: `npm install` (el postinstall genera el cliente de Prisma), `npm run build` (tsc), `npm run lint`, `npm test`.
- Núcleo, con `cp .env.example .env` y `docker compose up -d postgres-core`: `npm run db:deploy -w @citas/core`,
  `npm run db:seed -w @citas/core`, `npm run start:dev -w @citas/core`, `npm run test:e2e -w @citas/core`.
- `docker compose up` solo levanta bases, RabbitMQ y Mailpit; el núcleo aún no tiene Dockerfile (INT-1).
- `npm run build -w @citas/eventos` compila el paquete a `dist/` (las apps lo cargan desde ahí); `npm test -w
  @citas/eventos` corre sus pruebas, y la de mensaje repetido necesita `docker compose up`.
- `npm run dev -w @citas/web` levanta el frontend en `http://localhost:5173` (copiar antes `apps/web/.env.example` a `.env`).

## Estructura
- `docs/vision.md`: supuestos A-01 y A-02, actores, funciones, EC-01 y EC-02, monolito vs. distribuido.
- `docs/adr/`: ADR-000 (atributos rectores) y ADR-001 (eventos del agendamiento). ADR-002 a ADR-005 pendientes.
- `docs/flujo-agendar-cita-virtual.md` y `docs/diagramas/`: flujo de 6 pasos, secuencia y estados de la cita.
- `docs/contenedores.dsl` y `docs/contenedores.png`: vista C4 de contenedores (Structurizr DSL).
- `docs/plan-de-trabajo.md`: RF, RNF, estimación, cronograma, reparto por persona y contratos del sprint 1.
- Código propuesto: `apps/<aplicación>` y `packages/eventos` (plan §7.5).
- `apps/core/`: núcleo NestJS (el plan lo llama `apps/nucleo`). Un módulo por dominio en `src/<módulo>/` y sus modelos en
  `prisma/schema/<módulo>.prisma`. Guía, usuarios semilla y recetas en `apps/core/README.md`.

## Arquitectura
Monolito modular (agenda, pagos, historia, autorización, identidad) en el que ningún módulo consulta las tablas de
otro; auditoría fuera del proceso; terceros detrás de adaptadores conectados por RabbitMQ con bandeja de salida y
consumidores idempotentes. Atributos en orden: confidencialidad y auditabilidad > disponibilidad selectiva >
integrabilidad sin fuga (`docs/adr/ADR-000-vision-y-atributos.md`).

## Convenciones y gotchas
- Documentos en español. El lenguaje del dominio sigue los ADR en español (`CitaConfirmada`, `idCita`, `PENDIENTE_PAGO`).
- Los eventos llevan solo identificadores; ningún dato clínico cruza hacia pasarela, mensajería o video (ADR-001).
- Datos de semillas y pruebas siempre ficticios.
- Núcleo: ningún módulo toca tablas ajenas ni entra a otro sin su `index.ts` (lo exige `apps/core/test/arquitectura`).
  Toda ruta niega por defecto salvo `@Publico()`; en desarrollo se entra con `X-Usuario-Dev: <correo semilla>`.
- Versiones fijas: `npm i prisma` sin versión instala la 8.0 RC (etiqueta `latest`), TypeScript 7 rompe `nest build` y
  hace falta Node 22.12 o más. Prisma 7 no regenera el cliente al migrar (`npm run db:generate -w @citas/core`) y
  bloquea `migrate reset` si lo lanza un agente: pedir permiso al usuario, no forzarlo.
- Tareas con ID del plan (`AGE-3`, `PAG-2`...); ramas `feat/<id>-<tema>`; el PR lleva `Closes #<issue>`.
- Fechas límite en `docs/seguimiento/fechas-limite.json`; `.github/workflows/seguimiento-fechas.yml` publica la matriz en la rama `seguimiento`. Al agregar tareas de otro sprint, agregarlas a ese JSON.
- `README.md` lleva la tabla de documentos con su autor: agregar la fila al crear un documento nuevo.

## Reglas de trabajo
- Autoría: cada commit a nombre de la persona que trabaja, sin `Co-Authored-By`, `Claude-Session` ni menciones a IA.
  En sesiones de Claude, `.git/git-guard.sh` (no versionado) fija la identidad; en la nube se recrea en cada sesión.
- Conventional Commits; PR pequeños con la plantilla, revisados por la pareja del módulo y fusionados con squash; nada
  de push directo a `main` ni force-push sin confirmación.
- Plan corto antes de cambios medianos; ADR para decisiones de arquitectura, escrito por quien la implementa.
- Pruebas después de cada cambio; nunca declarar terminado con pruebas fallando.
- Leer este archivo antes de explorar y actualizarlo en 1-2 líneas cuando cambie la estructura o aparezca un gotcha.