# ADR-000: Visión arquitectónica y atributos de calidad rectores

Sistema de Citas e Historia Clínica de la Red · *Autor: Wilhen Gutiérrez*

Estado: propuesto — Semana 4, 2026-II · Grupo 4

## Decisión

Este ADR **no decide una tecnología**: fija los tres atributos de calidad que van a mandar el diseño, contra los que se
evaluará toda decisión posterior, y su orden de precedencia.

## Contexto — el problema de negocio

Doce IPS operan su agendamiento por separado y no tienen cómo llevar especialistas a municipios que no los tienen.
El sistema unifica el agendamiento de 3.500 citas diarias entre 350 profesionales, habilita la videoconsulta para
pacientes rurales y consolida cada atención en una historia clínica única.

Lo más delicado es legal: la historia clínica está bajo reserva. Solo el paciente y el personal autorizado que lo
atiende pueden verla, y todo acceso debe quedar registrado de forma inmutable. En el trayecto, el sistema ataca un
ausentismo del 25 %, unas 875 citas perdidas al día.

## Qué está en juego

- **Si se filtra una historia**, el daño es legal, personal e irreversible. El riesgo realista es el funcionario con credenciales válidas.
- **Si el sistema cae en jornada**, se detienen consultorios en 12 sedes: unas 125 citas por cada media hora, y la agenda de mañana ya está llena.
- **Si el paciente rural no logra su videoconsulta**, no hay plan B: en su municipio no hay especialista.
- **Si la traza se puede alterar**, la auditoría pierde valor probatorio: es la diferencia entre un control y la evidencia de un control.

## Los tres atributos que mandan

| # | Atributo | Por qué manda y qué consecuencia se asume |
|---|---|---|
| 1 | Confidencialidad y auditabilidad (EC-01) | Su incumplimiento no admite compensación y no hay equipo de seguridad permanente. Precedencia sobre los demás: ante conflicto se deniega el acceso. Consecuencia: un único punto de decisión de acceso, con su fricción y latencia |
| 2 | Disponibilidad selectiva en jornada (EC-02) | Define qué puede caerse sin detener la atención: agenda e historia ≥ 99,5 % entre 6:00 y 20:00, sin depender de video, mensajería ni laboratorios. Consecuencia: se acepta degradar todo lo demás |
| 3 | Integrabilidad sin fuga | Hay tres terceros y llegarán requisitos nuevos, incluida IA. Cada frontera declara qué campos la cruzan; por defecto ningún dato clínico sale. Consecuencia: se paga indirección (adaptadores, colas, contratos) para que cambiar de proveedor sea local y barato |

**Lo que no manda:** rendimiento bruto, riqueza de interfaz y time-to-market agresivo. Cuando una funcionalidad entre
en conflicto con la confidencialidad, cede la funcionalidad.

## Alternativas descartadas

- Unificar solo la agenda y dejar cada historia en su IPS: más barato, pero multiplica por doce los sitios de acceso indebido.
- Construir la videoconsulta en casa: control total, pero exige operar infraestructura de medios sin el equipo para hacerlo.
- Auditoría en la misma base de la aplicación: más simple, pero el administrador podría alterarla.
- Distribuido desde la primera versión: aislamiento de infraestructura a cambio de más puntos donde omitir un chequeo de autorización.

## Decisiones derivadas

- ADR-001: la sala de video y el envío del enlace van por evento (actividad "Del flujo al patrón").
- ADR-002: el monolito modular con auditoría e integraciones externas fuera del proceso principal.
- ADR-003: la videoconsulta integrada con un tercero y sus cláusulas contractuales.
- ADR-004: el modelo de autorización por vínculo asistencial vigente, con traza de solo anexado.
- ADR-005: el patrón de normalización de formatos heterogéneos de laboratorio.

> Nota: en la versión entregada del Cuestionario 1 el monolito modular era el ADR-001. Se corrió un número porque la
> actividad "Del flujo al patrón" pide que el ADR-001 sea el del patrón clásico.
