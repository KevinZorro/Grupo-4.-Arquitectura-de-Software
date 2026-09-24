# ADR-000: Visión y atributos de calidad

Estado: borrador · Semana 6, 2026-II · Grupo 4
Autor: Juan Camilo Uribe Mendoza - 1152326

## 8. ¿Qué decisiones de arquitectura (ADR) se derivan de este análisis?

El escenario de calidad **EC-02** —agenda e historia clínica deben seguir
consultables, con 0 % de solicitudes de agendamiento rechazadas, cuando
cualquier tercero falle durante 30 minutos continuos— es el que más presiona
el diseño, junto con el nuevo supuesto **A-02** (el copago de la cita
virtual se paga en línea). Entre los dos obligan a separar el flujo de
agendamiento en decisiones independientes, cada una registrada en su propio
ADR:

1. **ADR-001 — Eventos del agendamiento.** Qué parte del flujo espera el
   paciente de forma síncrona (verificar disponibilidad, reservar el cupo e
   iniciar el pago) y qué parte llega después por evento (confirmación del
   pago vía webhook, creación de la sala y envío del aviso), de modo que la
   caída de un tercero no bloquee el agendamiento.
2. **ADR-002 — Monolito modular.** Cómo se organiza el núcleo asistencial
   (agenda, historia clínica y autorización) como un único desplegable con
   módulos internos, en vez de servicios separados.
3. **ADR-003 — Videoconsulta con un tercero.** Por qué la sala de video se
   delega a un proveedor externo en lugar de construir esa capacidad dentro
   del núcleo.
4. **ADR-004 — Autorización de acceso por vínculo asistencial.** Quién
   puede consultar la historia clínica de un paciente, con base en si
   existe una relación asistencial vigente.
5. **ADR-005 — Normalización de laboratorio.** Cómo se homologan los
   resultados de laboratorio que llegan de distintas fuentes a un formato
   común dentro del sistema.

*Nota.* Frente al Cuestionario 1, ADR-001 cambia de alcance: ya no trata
la confirmación de la cita como un hecho aislado, sino el flujo completo
con la nueva pasarela de pagos (verificación, reserva y pago síncronos;
confirmación, sala y aviso por evento). ADR-002 a ADR-005 conservan su
alcance original y solo se renumeran para dejar ADR-001 como punto de
entrada al flujo de agendamiento.
