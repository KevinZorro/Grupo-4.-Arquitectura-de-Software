# ADR-000: Visión arquitectónica y atributos de calidad rectores

Estado: borrador · Semana 6, 2026-II · Grupo 4
Autores: Wilhen Ferney Gutiérrez Pabón — atributos rectores (Cuestionario 1, recuperado) ·
Juan Camilo Uribe Mendoza (1152326) — decisiones derivadas, pregunta 8

## Decisión

Este ADR **no decide una tecnología**: fija los atributos de calidad que van a mandar el
diseño, contra los que se evaluará toda decisión posterior, y su orden de precedencia.

## Contexto — el problema de negocio

Doce IPS operan su agendamiento por separado y no tienen cómo llevar especialistas a
municipios que no los tienen. El sistema unifica el agendamiento de 3.500 citas diarias
entre 350 profesionales, habilita la videoconsulta para pacientes rurales y consolida cada
atención en una historia clínica única.

Lo más delicado es legal: la historia clínica está bajo reserva. Solo el paciente y el
personal autorizado que lo atiende pueden verla, y todo acceso debe quedar registrado de
forma inmutable. En el trayecto, el sistema ataca un ausentismo del 25 %, unas 875 citas
perdidas al día.

## Qué está en juego

- **Si se filtra una historia**, el daño es legal, personal e irreversible. El riesgo
  realista es el funcionario con credenciales válidas.
- **Si el sistema cae en jornada**, se detienen consultorios en 12 sedes: unas 125 citas
  **atendidas** por cada media hora de caída (no agendamientos: el caso no da una cifra de
  agendamientos por hora), y la agenda de mañana ya está llena.
- **Si el paciente rural no logra su videoconsulta**, no hay plan B: en su municipio no hay
  especialista.
- **Si la traza se puede alterar**, la auditoría pierde valor probatorio: es la diferencia
  entre un control y la evidencia de un control.

## Los atributos que mandan

| # | Atributo | Por qué manda y qué consecuencia se asume |
|---|---|---|
| 1 | Confidencialidad y auditabilidad (EC-01) | Su incumplimiento no admite compensación y no hay equipo de seguridad permanente. Precedencia sobre los demás: ante conflicto se deniega el acceso. Consecuencia: un único punto de decisión de acceso, con su fricción y latencia |
| 2 | Disponibilidad selectiva en jornada (EC-02) | Define qué puede caerse sin detener la atención: agenda e historia ≥ 99,5 % entre 6:00 y 20:00, sin depender de video, mensajería ni laboratorio. **La pasarela de pagos queda fuera de esta garantía**: iniciar el pago (paso 3) es síncrono con timeout de 5 s, así que si la pasarela se cae, la cita virtual sí se rechaza — se libera el cupo y no se agenda. Fue una decisión de grupo: el paciente paga fuera de nuestra aplicación, no hay forma de diferir esa dependencia sin diferir también el cobro. Consecuencia: se acepta degradar video, mensajería y laboratorio, pero no el pago |
| 3 | Integrabilidad sin fuga | Hay cuatro terceros (video, mensajería, laboratorio y, desde el supuesto A-02, la pasarela de pagos) y llegarán requisitos nuevos, incluida IA. Cada frontera declara qué campos la cruzan; por defecto ningún dato clínico sale — hacia la pasarela solo viaja monto y referencia opaca. Consecuencia: se paga indirección (adaptadores, colas, contratos) para que cambiar de proveedor sea local y barato |

**Lo que no manda:** rendimiento bruto, riqueza de interfaz y time-to-market agresivo.
Cuando una funcionalidad entre en conflicto con la confidencialidad, cede la funcionalidad.

## Alternativas descartadas

- Unificar solo la agenda y dejar cada historia en su IPS: más barato, pero multiplica por
  doce los sitios de acceso indebido.
- Construir la videoconsulta en casa: control total, pero exige operar infraestructura de
  medios sin el equipo para hacerlo.
- Auditoría en la misma base de la aplicación: más simple, pero el administrador podría
  alterarla.
- Distribuido desde la primera versión: aislamiento de infraestructura a cambio de más
  puntos donde omitir un chequeo de autorización.
- Pago también degradable (asíncrono desde el inicio): habría mantenido el 0 % de rechazo
  también para el copago, pero el paciente paga por redirección fuera de nuestra
  aplicación — no hay nada que colear ni diferir mientras él está en la página de la
  pasarela. Se descarta porque no resuelve nada, solo esconde el problema un paso más allá.

## 8. Decisiones derivadas

El escenario de calidad **EC-02** —ahora con la pasarela de pagos explícitamente fuera de
su garantía de disponibilidad— y el supuesto **A-02** (el copago de la cita virtual se paga
en línea) son las dos fuerzas que obligan a separar el flujo de agendamiento en decisiones
independientes, cada una registrada en su propio ADR:

1. **ADR-001 — Eventos del agendamiento.** Qué parte del flujo espera el paciente de forma
   síncrona (verificar disponibilidad, reservar el cupo e iniciar el pago) y qué parte
   llega después por evento (confirmación del pago vía webhook, creación de la sala y envío
   del aviso), de modo que la caída de un tercero *distinto de la pasarela* no bloquee el
   agendamiento.
2. **ADR-002 — Monolito modular.** Cómo se organiza el núcleo asistencial (agenda, historia
   clínica y autorización) como un único desplegable con módulos internos, en vez de
   servicios separados.
3. **ADR-003 — Videoconsulta con un tercero.** Por qué la sala de video se delega a un
   proveedor externo en lugar de construir esa capacidad dentro del núcleo.
4. **ADR-004 — Autorización de acceso por vínculo asistencial.** Quién puede consultar la
   historia clínica de un paciente, con base en si existe una relación asistencial vigente.
5. **ADR-005 — Normalización de laboratorio.** Cómo se homologan los resultados de
   laboratorio que llegan de distintas fuentes a un formato común dentro del sistema.

*Nota sobre la numeración.* Esta lista ya se renumeró dos veces. En el Cuestionario 1 el
monolito modular era el ADR-001; se corrió un puesto porque la actividad "Del flujo al
patrón" pedía que el ADR-001 fuera el del patrón clásico (agendamiento por evento). Con el
pivot al cobro de copago, ADR-001 cambia de alcance otra vez: ya no trata la confirmación de
la cita como un hecho aislado, sino el flujo completo con la pasarela de pagos (verificación,
reserva y pago síncronos; confirmación, sala y aviso por evento). ADR-002 a ADR-005
conservan su alcance original y solo se renumeran para dejar ADR-001 como punto de entrada
al flujo de agendamiento.
