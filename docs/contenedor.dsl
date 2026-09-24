workspace "Citas y telemedicina" "Caso 4 - Grupo 4" {

    model {
        paciente = person "Paciente" "Agenda citas, paga el copago y entra a la videoconsulta"

        profesional = person "Profesional de salud" "Atiende la cita y consulta la historia clínica autorizada"

        administrativo = person "Personal administrativo" "Gestiona citas y consulta la disponibilidad de la agenda"

        plataforma = softwareSystem "Plataforma de citas y telemedicina" {

            nucleo = container "Nucleo asistencial" "Monolito modular: agenda, historia clinica, autorizacion y orquestacion del agendamiento" "NestJS"

            bd = container "Base de datos" "Citas, estados, bandeja de salida de eventos y llaves de idempotencia" "PostgreSQL" "BaseDatos"

            auditoria = container "Servicio de auditoria" "Traza append-only con credenciales propias" "Node.js"

            broker = container "Broker" "Guarda los eventos hasta que los consumidores los procesen" "RabbitMQ" "Broker"

            workerVideo = container "Adaptador de video" "Consume eventos de citas confirmadas y solicita la sala al proveedor de video" "Node.js"

            workerMensajeria = container "Adaptador de mensajeria" "Envia confirmaciones y recordatorios con fecha, hora y sede, sin datos clinicos" "Node.js"

            workerLaboratorio = container "Worker de laboratorio" "Recibe resultados, normaliza formatos y concilia cada resultado con una orden y un paciente" "Node.js"
        }

        pasarela = softwareSystem "Pasarela de pagos" "Cobra el copago de la cita virtual" "Externo"

        video = softwareSystem "Proveedor de video" "Proporciona la sala de videoconsulta" "Externo"

        mensajeria = softwareSystem "Pasarela de mensajeria" "Envia SMS y correo electronico" "Externo"

        laboratorio = softwareSystem "Laboratorio en convenio" "Entrega resultados de examenes en formatos heterogeneos" "Externo"

        paciente -> nucleo "Agenda una cita virtual y consulta su estado" "HTTPS, sincrono"

        paciente -> pasarela "Paga el copago de la cita por redireccion" "HTTPS, redireccion"

        profesional -> nucleo "Consulta la agenda y accede a la historia clinica autorizada" "HTTPS, sincrono"

        administrativo -> nucleo "Agenda, reprograma y consulta disponibilidad" "HTTPS, sincrono"

        nucleo -> pasarela "Crea la transaccion y concilia su estado" "HTTPS, sincrono, timeout 5 s"

        pasarela -> nucleo "Avisa si el pago fue aprobado mediante webhook" "HTTPS firmado, asincrono" "Asincrono"

        nucleo -> bd "Guarda la cita, los estados, la bandeja outbox y las llaves de idempotencia" "SQL, sincrono"

        nucleo -> auditoria "Registra cada cambio de estado y operacion sensible" "HTTPS, sincrono"

        auditoria -> nucleo "Confirma la recepcion de la traza de auditoria" "HTTPS, sincrono"

        nucleo -> broker "Publica CitaConfirmada y CitaCancelada" "AMQP, asincrono" "Asincrono"

        broker -> nucleo "Entrega eventos de SalaCreada y cambios de estado" "AMQP, al menos una vez" "Asincrono"

        broker -> workerVideo "Entrega el evento CitaConfirmada" "AMQP, al menos una vez" "Asincrono"

        workerVideo -> broker "Publica el evento SalaCreada" "AMQP, asincrono" "Asincrono"

        broker -> workerMensajeria "Entrega el evento SalaCreada para notificacion" "AMQP, al menos una vez" "Asincrono"

        workerVideo -> video "Crea la sala de videoconsulta" "HTTPS, sincrono, con timeout"

        nucleo -> workerVideo "Solicita el token temporal cuando el paciente entra a la videoconsulta" "HTTPS, sincrono, con timeout"

        workerVideo -> video "Solicita un token temporal de acceso para la sala" "HTTPS, sincrono, con timeout"

        workerMensajeria -> mensajeria "Envia la confirmacion o el recordatorio con datos minimos" "HTTPS, sincrono"

        laboratorio -> workerLaboratorio "Entrega el resultado del examen con el identificador de la orden" "HTTPS, asincrono" "Asincrono"

        workerLaboratorio -> broker "Publica ResultadoRecibido o ResultadoNoConciliado" "AMQP, asincrono" "Asincrono"

        broker -> workerLaboratorio "Entrega resultados pendientes para procesamiento" "AMQP, al menos una vez" "Asincrono"

        workerLaboratorio -> bd "Consulta la orden y guarda el resultado conciliado" "SQL, sincrono"
    }

    views {
        container plataforma "Contenedores" {
            include *

            title "Plataforma de citas y telemedicina - Vista de contenedores"

            description "Monolito modular con auditoria separada, procesamiento por eventos e integraciones externas."

            autoLayout lr
        }

        styles {
            element "Person" {
                shape Person
                background #0F6E5C
                color #FFFFFF
            }

            element "Container" {
                background #1F8A74
                color #FFFFFF
            }

            element "BaseDatos" {
                shape Cylinder
            }

            element "Broker" {
                shape Pipe
            }

            element "Externo" {
                background #7E8C87
                color #FFFFFF
            }

            relationship "Relationship" {
                dashed false
            }

            relationship "Asincrono" {
                dashed true
                color #9A5A0C
            }
        }
    }
}
