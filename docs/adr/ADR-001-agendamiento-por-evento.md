# ADR-001: La sala de video y el envío del enlace van por evento

Estado: borrador

## Decisión

El núcleo responde cuando el copago queda aprobado y la cita confirmada. Crear la sala de video y enviar el enlace
se hacen después, consumiendo el evento `CitaAgendada` desde un broker. El evento se escribe en una tabla outbox en la
misma transacción que confirma la cita, para que no exista una cita confirmada sin evento ni un evento sin cita.

Como el enlace apunta al portal y no a la sala, los dos consumidores son independientes.

## Alternativa descartada

Hacer todo síncrono. Habríamos tenido una pieza menos que operar, lo que pesa en una red sin equipo 24/7, y la certeza
de que la sala existe y el SMS salió antes de responder.

A cambio, el agendamiento de citas virtuales quedaría atado a dos terceros cuyo tiempo de respuesta no controlamos.
Una caída del proveedor de video o de la pasarela de SMS tumbaría el agendamiento, y eso contradice EC-02, que exige
0 % de rechazo en la agenda mientras falla un tercero.

También descartamos cobrar por evento: la compensación sería cancelar una cita que el paciente ya vio confirmada.

## Consecuencias

- Una pieza más que operar (el broker) y un relay de outbox dentro del monolito.
- Consistencia eventual: el paciente ve "confirmada" antes de que existan la sala y el enlace; el portal muestra "enlace en preparación".
- Los consumidores deben ser idempotentes por id de cita porque el broker entrega al menos una vez, y esa memoria hay que persistirla.
- Los mensajes muertos crean trabajo humano nuevo: la bandeja de la sede.
- Aparece un tercero nuevo en el contexto (pasarela de pagos) con su frontera declarada.

## Relación con otros ADR

El ADR-000 numeraba como ADR-001 el monolito modular; pasa a ADR-002 y los demás se corren un número.
