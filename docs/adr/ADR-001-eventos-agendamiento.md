# ADR-001: El pago se confirma por webhook, y la sala y los avisos salen por evento

Estado: borrador · Semana 6, 2026-II · Grupo 4
Autor: Nefer Sneyder Rojas Porras (1152307)
Se deriva del ADR-000 y del escenario de calidad EC-02. Depende del supuesto A-02 (el copago de la cita virtual se
paga en línea).



## Contexto

Agendar una cita virtual con copago toca cuatro terceros: la pasarela de pagos, el proveedor de video, la pasarela de
mensajería y, más adelante en la vida de la cita, el laboratorio. La red no tiene equipo de seguridad ni de operación
permanente, y el escenario EC-02 exige que agenda e historia clínica sigan consultables cuando cualquiera de esos
terceros falle durante 30 minutos continuos.

De los cuatro, la pasarela de pagos es distinta a los demás: el paciente **sí** necesita saber en esa misma sesión que
su pago se intentó, porque de eso depende que su cita exista. La pregunta que este ADR responde es dónde termina lo que
el paciente espera y cómo se entera el sistema de lo que pasó después.

## Decisión

**El paciente espera hasta tener el cupo retenido y el enlace de pago, no hasta tener la cita confirmada.** El Núcleo
asistencial verifica la disponibilidad, retiene el cupo por 15 minutos y pide a la pasarela la creación de la
transacción de pago de forma síncrona, con timeout de 5 segundos. Con eso responde: referencia de pago y enlace. El
paciente paga por redirección, fuera de nuestra aplicación.

**El resultado del pago entra por webhook**, asíncrono, desde la pasarela hacia el Núcleo. Con un pago aprobado dentro
de la ventana de retención, la cita queda confirmada y se publica `CitaConfirmada`. Si la ventana vence sin resultado
aprobado, el cupo se libera y se publica `CitaCancelada`.

**Con `CitaConfirmada`, la sala y el mensaje salen en paralelo.** El Adaptador de video crea la sala del proveedor
**sin emitir token** y publica `SalaCreada`. El token de vigencia corta se emite cuando el paciente entra a la
consulta, no cuando se agenda. El Adaptador de mensajería consume el mismo `CitaConfirmada` —no `SalaCreada`— y envía
la confirmación con enlace **al portal del paciente**, nunca a la sala.

**Se mantiene síncrona y bloqueante una sola integración:** el registro de acceso a la historia clínica. Sin traza
escrita no se entrega la historia, aunque eso cueste latencia y aunque implique negar el acceso cuando el Servicio de
auditoría está caído. El metadato del agendamiento sí viaja por evento, porque ahí no se está entregando contenido
clínico a nadie.

**Los consumidores son idempotentes**, con la memoria persistida en una tabla `(idMensaje, consumidor, fecha)` con
restricción de unicidad, consultada antes de actuar, porque el broker entrega al menos una vez:

| Consumidor | Clave de idempotencia | Qué pasa sin ella |
|---|---|---|
| Núcleo, al recibir el webhook de pago | `idTransaccion` | La cita se confirma dos veces y se publican dos `CitaConfirmada` |
| Núcleo, al crear la transacción de pago | `idReserva` | Un doble clic abre dos transacciones y el paciente puede pagar dos veces |
| Adaptador de video | `idCita` | Salas huérfanas y cobro doble del proveedor |
| Adaptador de mensajería | (`idCita`, `tipoMensaje`) | El paciente recibe el mismo mensaje varias veces: ruido para él, costo por mensaje para la red |
| Servicio de auditoría | `idEvento` | La traza es solo anexado: un duplicado queda escrito dos veces y ensucia la evidencia |

**Respaldo del webhook.** Un webhook se puede perder o llegar fuera de orden, así que la confirmación no depende solo
de él: antes de vencer la retención, el Núcleo consulta el estado de la transacción a la pasarela. El webhook es el
camino rápido; la consulta es la red de seguridad.

## Alternativa descartada: hacer todo síncrono

**Qué habríamos ganado.** Una pieza menos que operar —el broker—, que para un equipo sin operación permanente no es
poca cosa. El paciente sabría en la misma respuesta que su pago quedó aprobado, que su sala existe y que su mensaje
salió. Y desaparecerían la idempotencia persistida, la cola de mensajes muertos y el tablero para vigilar colas.

**Qué nos habría costado, con las fuerzas de este caso.**

- Esperar la confirmación del pago dentro de la misma petición significa dejar una conexión abierta mientras el
  paciente escribe los datos de su tarjeta en otro sitio. No es una demora de segundos: es una demora de minutos, y
  depende de una persona, no de un sistema.
- El agendamiento pasaría a tardar lo que tarden pasarela de pagos, proveedor de video y pasarela de mensajería
  sumados, y quedaría caído cuando cualquiera de los tres lo esté. El caso no da una cifra de agendamientos por hora
  —las 250 y 500 citas por hora de la tabla de supuestos son citas **atendidas**, no agendamientos—, así que el
  argumento no es un número de agendamientos perdidos: es que el agendamiento de las 12 sedes quedaría colgado de un
  tercero que no atiende a nadie.
- Para el video, además, sería incorrecto y no solo frágil. Crear la sala y emitir el token al agendar entrega un
  token vencido, porque la vigencia es corta y la cita puede ser dentro de días. Por eso la sala se crea sin token y el
  token se emite al entrar.

## Consecuencias negativas

- **Una pieza más que operar y vigilar: el broker.** Es infraestructura nueva para un equipo que no tiene turno
  permanente, y si se cae, se cae con él todo lo diferido.
- **La cita nace en un estado intermedio.** Entre la respuesta al paciente y el webhook hay una ventana de hasta 15
  minutos en la que el cupo está retenido y la cita no existe todavía. El portal debe mostrar «pago pendiente» y no un
  espacio en blanco, porque un espacio en blanco genera una llamada a la sede.
- **Pago aprobado fuera de la ventana.** Si el webhook llega después de que la retención venció y el cupo ya fue
  tomado, hay dinero cobrado sin cita. No se confirma nada de forma automática: el caso entra a una bandeja de
  conciliación para reagendar o devolver. Es la consecuencia más incómoda de esta decisión y hay que nombrarla, no
  esconderla.
- **Idempotencia que hay que persistir y mantener:** la tabla de arriba crece con cada cita, hay que purgarla y hay
  que ampliarla cuando aparezca un consumidor nuevo.
- **El error del tercero ya no aparece en la respuesta HTTP.** Ahora vive en la cola de mensajes muertos y en la
  bandeja de la sede. Si nadie las mira, el fallo se vuelve silencioso, que es peor que ruidoso.
- **Una frontera más por donde pueden salir datos.** Lo que viaja en los eventos y hacia la pasarela de pagos es el
  mínimo: monto y referencia opaca, identificadores de cita y de paciente; nunca diagnóstico, especialidad ni motivo
  de consulta.

## Qué señal nos haría cambiar de opinión

- Si la pasarela de pagos dejara de entregar webhooks confiables y tuviéramos que consultar el estado en todos los
  casos, el camino rápido sobra: el respaldo pasa a ser el mecanismo principal y el webhook se elimina.
- Si el proveedor de video ofreciera salas con enlace permanente por cita y respondiera de forma estable por debajo de
  los 300 ms, la creación de la sala podría volver al camino síncrono y el broker quedaría solo para mensajería,
  auditoría y laboratorio.
- Si el volumen de mensajes resultara tan bajo que operar un broker no se justifique, se reemplaza por una tabla de
  salida (outbox) en la base clínica, leída por un proceso programado: se pierde el aislamiento de procesos, se gana
  una pieza menos.
- Si aparece un cuarto o quinto consumidor de `CitaConfirmada`, la decisión se refuerza y conviene revisar el reparto
  de colas por integración.

## Qué cambió frente al Cuestionario 1

- **Nueva integración: la pasarela de pagos.** En el Cuestionario 1 no había cobro, así que los terceros eran tres.
  Con el supuesto A-02 son cuatro, y el nuevo es el único que el paciente percibe mientras espera.
- **La creación de la sala pasa a ser un paso propio y sale del camino síncrono.** En el cuestionario iba implícita en
  «enviar el enlace de la videoconsulta». Ahora la sala se crea sin token al confirmarse la cita, y el token se emite
  cuando el paciente entra.
- **La traza tiene dos regímenes.** Acceso a historia clínica, síncrono y bloqueante. Metadato del agendamiento, por
  evento. El cuestionario decía «sin traza no hay acceso» sin distinguir, y aplicado al pie de la letra ese principio
  habría obligado a esperar a la auditoría para confirmar una cita, lo cual no protege nada porque en ese momento no se
  está entregando ningún dato clínico.

## Nota sobre las cifras

Ninguna medida de este ADR usa un número que no esté en la tabla de supuestos del Cuestionario 1. Las 125 citas por
cada media hora de caída son citas **atendidas** y sirven para dimensionar una caída del núcleo asistencial, no para
medir agendamientos perdidos: el caso no dice cuántos agendamientos ocurren por hora. Por eso el argumento contra la
alternativa síncrona se sostiene en la indisponibilidad del agendamiento, no en un número derivado que no tenemos.
