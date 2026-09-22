workspace "Citas e Historia Clinica de la Red" "Grupo 4 - Caso 4 - Vista de contenedores (C4 nivel 2)" {

    model {
        paciente = person "Paciente" "Agenda, paga el copago, recibe el enlace y entra a la videoconsulta"
        profesional = person "Profesional de salud" "Atiende y registra la atencion en la historia clinica"
        administrativo = person "Personal administrativo" "Agenda presencial y atiende la bandeja de citas sin enlace"

        red = softwareSystem "Sistema de Citas e Historia Clinica de la Red" {
            nucleo = container "Nucleo asistencial" "Monolito modular: agenda, historia clinica, autorizacion. Orquesta la saga de agendamiento y publica eventos desde el outbox" "Node.js"
            bd = container "Base de datos del nucleo" "Agenda, citas, historia clinica y tabla outbox. Restriccion unica por profesional y franja" "PostgreSQL" "Database"
            auditoria = container "Registro de auditoria" "Servicio aparte, solo anexado, con credenciales propias" "Node.js"
            bdAuditoria = container "Almacen de trazas" "Eventos de acceso inmutables" "PostgreSQL append-only" "Database"
            broker = container "Broker" "Guarda los eventos hasta que alguien los procese; cola de mensajes muertos" "RabbitMQ" "Queue"
            adaptadorVideo = container "Adaptador de video" "Crea la sala por evento y emite el token al entrar. Idempotente por id de cita" "Node.js"
            notificador = container "Notificador" "Envia el enlace y los recordatorios. Idempotente por id de cita y tipo de mensaje" "Node.js"
            adaptadorLab = container "Adaptador de laboratorio" "Normaliza resultados heterogeneos" "Node.js"
        }

        pagos = softwareSystem "Pasarela de pagos" "Cobra el copago o la cuota moderadora" "Externo"
        video = softwareSystem "Proveedor de videoconsulta" "Salas de video de terceros" "Externo"
        mensajeria = softwareSystem "Pasarela de mensajeria" "SMS y correo" "Externo"
        laboratorios = softwareSystem "Laboratorios en convenio" "Envian resultados a su ritmo" "Externo"

        # Camino sincrono del agendamiento
        paciente -> nucleo "Agenda la cita virtual y paga el copago" "HTTPS, sincrono"
        administrativo -> nucleo "Agenda presencial, atiende citas sin enlace" "HTTPS, sincrono"
        profesional -> nucleo "Consulta agenda e historia, registra la atencion" "HTTPS, sincrono"
        nucleo -> bd "Reserva cupo, confirma cita y escribe outbox (una transaccion)" "SQL, sincrono"
        nucleo -> pagos "Cobra copago: monto y referencia opaca" "HTTPS, sincrono, timeout 8 s, clave de idempotencia"
        nucleo -> auditoria "Registra cada acceso a una historia clinica" "HTTPS, sincrono: sin traza no hay acceso"
        auditoria -> bdAuditoria "Anexa el evento de acceso" "SQL, solo INSERT"

        # Lo que va por evento
        nucleo -> broker "Publica CitaAgendada desde el outbox" "AMQP, asincrono" "Asincrono"
        broker -> adaptadorVideo "Entrega CitaAgendada" "al menos una vez" "Asincrono"
        broker -> notificador "Entrega CitaAgendada" "al menos una vez" "Asincrono"
        adaptadorVideo -> broker "Publica SalaCreada" "AMQP, asincrono" "Asincrono"
        adaptadorLab -> broker "Publica ResultadoNormalizado" "AMQP, asincrono" "Asincrono"
        broker -> nucleo "Entrega SalaCreada, resultados y mensajes muertos" "al menos una vez" "Asincrono"

        # Fronteras con terceros
        adaptadorVideo -> video "Crea la sala con id opaco" "HTTPS, sincrono, circuit breaker"
        notificador -> mensajeria "Envia fecha, hora, sede y enlace al portal" "HTTPS, sincrono, con reintentos"
        laboratorios -> adaptadorLab "Envia resultados en su formato" "HTTPS o SFTP, asincrono" "Asincrono"
    }

    views {
        container red "Contenedores" {
            include *
            autoLayout tb 300 200
        }

        styles {
            element "Person" {
                shape Person
                background #1f3a5f
                color #ffffff
            }
            element "Container" {
                background #2f6fbf
                color #ffffff
            }
            element "Database" {
                shape Cylinder
            }
            element "Queue" {
                shape Pipe
            }
            element "Externo" {
                background #8a8a8a
                color #ffffff
            }
            relationship "Relationship" {
                dashed false
            }
            relationship "Asincrono" {
                dashed true
            }
        }
    }
}
