# Sistema de Citas e Historia Clínica de la Red — Grupo 4

Arquitectura de Software · UFPS · 2026-II · Caso 4 — Citas médicas y telemedicina.

Integrantes: Wilhen Ferney Gutiérrez Pabón (líder) · Javier Sneider Rincón Moreno · Angel Leonardo Montañez Corredor ·
Nefer Sneyder Rojas Porras · Kevin David Zorro Hernández · Juan Camilo Uribe Mendoza

## Contenido

| Archivo | Qué es | Autor |
|---|---|---|
| `docs/vision.md` | Cuestionario 1, preguntas 0 a 7: supuestos (incluido A-02, cobro en línea del copago), actores, funciones, escenarios EC-01 y EC-02 | Angel Montañez |
| `docs/img/contexto-c4-nivel1.png` | Diagrama de contexto C4 nivel 1: 8 actores y 16 flechas, con la pasarela de pagos | Angel Montañez |
| `docs/adr/ADR-000-vision-y-atributos.md` | Atributos de calidad rectores y su orden; pregunta 8: decisiones derivadas (ADR-001 a ADR-005) | Juan Camilo Uribe |
| `docs/flujo-agendar-cita-virtual.md` | Flujo "agendar una cita virtual con cobro del copago": 6 pasos, decisión paso por paso (síncrono o evento, compensación, idempotencia) y por qué así | Wilhen Gutiérrez |
| `docs/diagramas/` | Diagramas de secuencia y de estados de la cita (Archify): imagen PNG, versión interactiva HTML y fuente JSON | Wilhen Gutiérrez |
| `docs/contenedores.dsl` · `docs/contenedores.png` | Vista de contenedores C4 en Structurizr DSL y su imagen exportada; cada flecha indica protocolo y si espera respuesta | Javier Rincón |
| `docs/adr/ADR-001-eventos-agendamiento.md` | Borrador del ADR-001: el pago se confirma por webhook, y la sala y los avisos salen por evento | Nefer Rojas |

## Decisiones clave

- Atributos rectores, en orden: confidencialidad y auditabilidad > disponibilidad selectiva > integrabilidad sin fuga.
- Monolito modular (agenda, historia clínica, autorización), con el registro de auditoría append-only y los adaptadores de terceros fuera del proceso principal.
- El paciente espera solo los pasos 1 a 3: verificar disponibilidad, reservar el cupo (bloqueo de 15 min) e iniciar el pago (timeout de 5 s). El resultado del pago llega por webhook.
- Con `CitaConfirmada`, la creación de la sala (sin token) y el aviso con enlace al portal ocurren en paralelo. El token de vigencia corta se emite cuando el paciente entra a la consulta.
- La auditoría es síncrona para el acceso a la historia clínica y por evento para el metadato del agendamiento.
- La pasarela de pagos recibe solo el monto y una referencia opaca. Si se cae, la cita virtual no se agenda (decisión registrada en el ADR-000).

## Cómo ver la vista de contenedores

Abrir <https://structurizr.com/dsl>, pegar el contenido de `docs/contenedores.dsl` y presionar **Render**.
La imagen exportada está en `docs/contenedores.png`.
