# Sistema de Citas e Historia Clínica de la Red — Grupo 4

Arquitectura de Software · UFPS · 2026-II · Caso 4 — Citas médicas y telemedicina.

Integrantes: Wilhen Ferney Gutiérrez Pabón (líder) · Javier Sneider Rincón Moreno · Angel Leonardo Montañez Corredor ·
Nefer Sneyder Rojas Porras · Kevin David Zorro Hernández · Juan Camilo Uribe Mendoza

## Contenido

| Archivo | Qué es | Autor |
|---|---|---|
| `docs/vision.md` | Cuestionario 1, preguntas 0 a 7: supuestos (incluido A-02, cobro en línea del copago), actores, funciones, escenarios EC-01 y EC-02 | Angel Montañez |
| `docs/img/contexto-c4-nivel1.png` | Diagrama de contexto C4 nivel 1: 8 actores y 16 flechas, con la pasarela de pagos | Angel Montañez |
| `docs/adr/ADR-000-vision-y-atributos.md` | Atributos de calidad rectores y su orden; pregunta 8: decisiones derivadas (ADR-001 a ADR-006) | Juan Camilo Uribe |
| `docs/flujo-agendar-cita-virtual.md` | Flujo "agendar una cita virtual con cobro del copago": 6 pasos, decisión paso por paso (síncrono o evento, compensación, idempotencia) y por qué así | Wilhen Gutiérrez |
| `docs/diagramas/` | Diagramas de secuencia y de estados de la cita (Archify): imagen PNG, versión interactiva HTML y fuente JSON | Wilhen Gutiérrez |
| `docs/contenedores.dsl` · `docs/contenedores.png` | Vista de contenedores C4 en Structurizr DSL y su imagen exportada; cada flecha indica protocolo y si espera respuesta | Javier Rincón |
| `docs/adr/ADR-001-eventos-agendamiento.md` | ADR-001 (aceptado): el pago se confirma por webhook, y la sala y los avisos salen por evento | Nefer Rojas |
| `docs/adr/ADR-002-resumen-consulta.md` | ADR-002: el modelo de lenguaje redacta un borrador de la nota de atención y solo entra a la historia con la aprobación del médico; diagrama de la falla y alternativa «sin modelo» | Nefer Rojas |
| `docs/adr/ADR-003-autorizacion-por-vinculo.md` | ADR-003: autorización por vínculo asistencial (táctica de EC-01), con su costo medido | Kevin Zorro y Juan Camilo Uribe |
| `docs/plan-de-trabajo.md` · `docs/img/cronograma.png` | Plan de trabajo: RF y RNF detallados, tamaño y estimación, capacidad del equipo, cronograma del semestre y reparto por persona del avance del 30 de octubre | Kevin Zorro |
| `docs/reunion-de-arranque.md` | Lo que se aprueba en la reunión de arranque del sprint 1: decisiones técnicas, contratos y reparto | Kevin Zorro |
| `packages/eventos/README.md` | Uso del paquete de eventos: contratos, topología de colas, publicador y consumidor idempotente, con ejemplos para los adaptadores | Nefer Rojas |
| `apps/core/README.md` | Núcleo asistencial: cómo arrancarlo, usuarios semilla y cabecera de desarrollo, módulos y tablas, y reglas para agregar un módulo | Kevin Zorro |

## Decisiones clave

- Atributos rectores, en orden: confidencialidad y auditabilidad > disponibilidad selectiva > integrabilidad sin fuga.
- Monolito modular (agenda, historia clínica, autorización), con el registro de auditoría append-only y los adaptadores de terceros fuera del proceso principal.
- El paciente espera solo los pasos 1 a 3: verificar disponibilidad, reservar el cupo (bloqueo de 15 min) e iniciar el pago (timeout de 5 s). El resultado del pago llega por webhook.
- Con `CitaConfirmada`, la creación de la sala (sin token) y el aviso con enlace al portal ocurren en paralelo. El token de vigencia corta se emite cuando el paciente entra a la consulta.
- La auditoría es síncrona para el acceso a la historia clínica y por evento para el metadato del agendamiento.
- La pasarela de pagos recibe solo el monto y una referencia opaca. Si se cae, la cita virtual no se agenda (decisión registrada en el ADR-000).

## Segundo previo: escenario EC-01 (acceso sin vínculo asistencial)

**Qué se prueba.** Un funcionario autenticado, sin cita, episodio ni interconsulta con el paciente, intenta abrir su
historia. El sistema debe negar sin revelar si el paciente existe y dejar el intento registrado. La prueba usa 200
casos (120 con vínculo y 80 sin él, de cuatro tipos: funcionario sin vínculo, vínculo vencido, otra sede y paciente inexistente; el reparto 120/80 es un supuesto nuestro) y exige: 0 falsos
permisos, 0 falsos rechazos (los 120 con vínculo abren; negar todo también daría cero falsos permisos), decisión de
autorización en p95 ≤ 300 ms (medido con 30 rondas de 200 casos a la vez; las 350 sesiones concurrentes son el techo del entorno de EC-01 en `docs/vision.md` §4, no la carga que se mide) y el 100 % de los accesos registrados en ≤ 2 s. Las medidas, su origen y su ventana (6:00 a 20:00) están en `docs/vision.md` §4 y en RNF-02 del plan.

**Por qué este y no otro.** ADR-000 pone la confidencialidad y la auditabilidad primero, y el caso dice que el riesgo es
el acceso indebido interno. La guía advierte que casi siempre se elige un escenario de disponibilidad o rendimiento,
porque su falla se provoca a voluntad. En este también: un escenario de seguridad tiene falla reproducible si el
intento indebido se vuelve un caso de prueba. La batería trae los 80 casos sin vínculo, 20 de cada tipo, y sin la
táctica la historia se entrega; no depende de un ataque real ni del azar. Los descartados:

- **EC-02 (un tercero no responde):** va segundo en ADR-000 y sus tácticas (timeout y circuit breaker, RES-1 y RES-2)
  están planeadas para el sprint 4. Queda como pendiente.
- **Confirmación repetida:** `packages/eventos` ya trae el consumidor idempotente con su prueba; repetirlo en
  JavaScript no demostraría nada nuevo.

**Alcance.** `escenario/` es un prototipo en JavaScript con adaptadores en memoria: modela la regla de autorización, no el
núcleo en NestJS. Las demoras de los vínculos (20 ms) y de la auditoría (30 ms) son simuladas, así que el costo medido
es una estimación declarada. Usa `node:test` y tipos con `// @ts-check` y JSDoc. Pide Node 22.12 o superior y no
necesita Docker. Queda fuera de los workspaces, por eso el
`npm test` de la raíz no lo corre.

**Cómo correrlo.**

    cd escenario
    npm run escenario                  # los 200 casos (120 con vínculo, 80 sin él): en main pasa
    npm run escenario:sin-falla        # solo los casos con vínculo
    npm run escenario:auditoria-caida  # auditoría caída: nadie abre una historia (falla cerrada)
    npm run medir                      # p50 y p95 de 30 rondas de 200 casos a la vez

Para ver la prueba en rojo, antes de la táctica: `git checkout 942e435` y `npm run escenario` desde `escenario/`;
después, `git checkout main`. El PR del escenario se fusionó con merge commit, no con squash, para que ese commit siga
en el historial.

**Video** (máximo 10 minutos, YouTube oculto): <enlace pendiente, se agrega en PRV-13>

**Quién hizo qué.**

| Persona | Hizo |
|---|---|
| Angel Montañez | Camino de abrir historia sin táctica y prueba de los 200 casos en rojo |
| Kevin Zorro | Autorización por vínculo con el usuario de la sesión, ADR-003, renumeración de los ADR y fusión del PR |
| Juan Camilo Uribe | Script de medición, registro síncrono en auditoría con falla cerrada y sección de costo del ADR-003 |
| Nefer Rojas | ADR-002 con el diagrama de la falla y ADR-001 en versión final |
| Javier Rincón | Vista de contenedores con el adaptador del modelo y el camino de EC-01 |
| Wilhen Gutiérrez | README del escenario, revisión cruzada y edición del video |

## Cómo ver la vista de contenedores

Abrir <https://structurizr.com/dsl>, pegar el contenido de `docs/contenedores.dsl` y presionar **Render**.
La imagen exportada está en `docs/contenedores.png`.

## Cómo arrancar el frontend

Requiere Node 20.19 o superior.

    npm install
    cp apps/web/.env.example apps/web/.env
    npm run dev -w @citas/web

Abre <http://localhost:5173>. El selector de usuario semilla de la barra superior solo aparece en desarrollo; el login real llega con IDN-2. La URL del núcleo sale de `VITE_API_URL`.
