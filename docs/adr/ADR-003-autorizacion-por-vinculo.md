# ADR-003: La historia clínica solo se entrega con un vínculo asistencial vigente y con el acceso ya registrado

Estado: propuesto · Segundo previo, 2026-II · Grupo 4
Autores: Kevin David Zorro Hernández (autorización por vínculo) · Juan Camilo Uribe Mendoza (auditoría síncrona y costo)
Responde al escenario de calidad EC-01 (visión §4) y aplica el registro síncrono que fija el ADR-001. Es la decisión que
el ADR-000 §8 reservaba como «autorización de acceso por vínculo asistencial», y el diseño de referencia de AUT-1, AUD-3
y AUT-2 del plan de trabajo. Se implementa en `escenario/`, un prototipo en JavaScript del camino de EC-01.

## Contexto y fuerzas

- **El riesgo tiene nombre propio.** No es un atacante externo: es el funcionario con credenciales legítimas que abre la
  historia de un conocido (caso §4). La autorización tiene que ser fina: mi paciente, mi episodio, mi rol.
- **EC-01 ya trae la medida.** Batería de 200 casos con el 100 % de los intentos sin vínculo negados y cero falsos
  permisos; decisión de autorización en 300 ms o menos (p95); el 100 % de los accesos registrados en 2 s o menos; y sin
  confirmar que el paciente existe.
- **Los requisitos lo piden.** RF-08.1: autorizar por vínculo vigente y negar por defecto. RF-08.2: registrar cada
  acceso antes de entregar la historia y negarlo si la auditoría no responde. RNF-02: decidir en 300 ms (p95) y fallar
  cerrado.
- **La traza va primero.** La visión §7 y el ADR-001 fijaron que el registro del acceso a la historia es síncrono y
  bloqueante: sin traza escrita no se entrega la historia.
- **Nadie vigila de noche.** La red no tiene equipo de seguridad 24/7 (caso §5), así que la regla tiene que vivir en el
  código y probarse, no depender de que alguien revise.

## Decisión

Dos tácticas en el punto de decisión `abrirHistoria`, en el orden en que entraron al repositorio:

1. **Auditoría síncrona con falla cerrada** (commit `9bddc4a`). Cada intento, permitido o negado, se registra con
   usuario, paciente, hora, origen y justificación antes de responder. Si la auditoría falla o no confirma en 2 s, la
   respuesta es 503 y no lleva contenido.
2. **Autorización por vínculo asistencial** (commit `a0e2aa1`). Quien pide sale de la sesión, nunca de la petición, que no
   trae ningún identificador del profesional. La historia solo se busca y se entrega si ese usuario tiene un vínculo
   vigente con el paciente: cita, episodio o interconsulta. Sin vínculo la respuesta es 404, la misma que recibe un
   paciente inexistente. Si la consulta de vínculos falla, no hay cómo decidir y la respuesta es 503.

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Comparar con el `profesionalId` del cuerpo o de la URL | Lo controla quien hace la petición: basta poner el de un colega que sí tiene la cita. Es un IDOR |
| Autorizar solo por rol | El riesgo de EC-01 es justamente un funcionario con rol legítimo. Con solo el rol, los 80 casos sin vínculo de la batería abrirían la historia |
| Responder 403 al negar | Confirma que el paciente existe y deja enumerar documentos reales. EC-01 pide no revelarlo |
| Validar en el frontend | El frontend es del usuario: cualquiera llama a la API sin pasar por él |
| Bandeja de salida para la auditoría del acceso | Entregaría la historia antes de que exista la traza. Choca con la visión §7 y el ADR-001. La bandeja sí sirve para el metadato del agendamiento |

## Ventaja

La regla «solo quien atiende ve la historia» deja de ser una promesa y pasa a ser una regla del sistema con su prueba
(caso §6). Con las dos tácticas, la prueba de EC-01 pasa: 80 de 80 intentos sin vínculo negados, 120 de 120 con vínculo
abiertos (cero falsos rechazos), la decisión dentro de los 300 ms en p95 y 200 de 200 accesos registrados en 2 s o
menos.

## Costo

- **Latencia.** Antes de las tácticas (commit `fff0c75`, 30 rondas de 200 casos, máquina de Juan Camilo, Node 22.23):
  decisión p50 0,29 ms y p95 2,79 ms; respuesta completa p50 0,29 ms y p95 2,8 ms. Después:
  **[PENDIENTE: Juan Camilo, con `npm run medir` en la misma máquina]** decisión p50 __ ms y p95 __ ms; respuesta
  completa p50 __ ms y p95 __ ms. La decisión ahora espera la consulta de vínculos, y la respuesta espera además el
  registro de auditoría.
- **Las demoras son simuladas.** Por supuesto declarado, los vínculos tardan 20 ms y la auditoría 30 ms
  (`escenario/src/puertos.js`). El costo medido es una estimación, no una medición del núcleo real.
- **Código.** Desde el commit en rojo, las dos tácticas agregan 144 líneas y quitan 11 en `escenario/src/`
  (`git diff --stat 942e435 -- escenario/src/`): las 74 de `registrarAcceso.js`, que es nuevo, y 70 en
  `abrirHistoria.js`. La autorización sola agrega 39 y quita 10, buena parte de ellas en comentarios.
- **Falla nueva.** Con la auditoría o los vínculos caídos nadie abre una historia, ni siquiera quien tiene la cita: la
  operación falla cerrada con 503. Se ve con `npm run escenario:auditoria-caida` y con la prueba
  `vinculos-falla-cerrada.test.js`.
- **Urgencias.** Una urgencia sin cita, episodio ni interconsulta queda bloqueada hasta que exista el acceso de
  emergencia con justificación (EMG, RF-08.6), que no está en el prototipo.
- **Estado nuevo.** Aparece la respuesta 503 «no disponible por seguridad», distinta de «no encontrado», y la pantalla de
  consulta tiene que mostrarla. La auditoría acumula intentos negados que alguien tiene que revisar: la alerta tras tres
  intentos en 24 h es la medida 5 de EC-01, pendiente.

## Cómo se verifica que funciona

```
cd escenario
npm run escenario                  # EC-01 en verde: 80/80 negados, 120/120 abiertos y 200/200 registrados
npm run escenario:sin-falla        # solo los 120 casos con vínculo
npm run escenario:auditoria-caida  # la falla nueva: con la auditoría caída nadie abre, y EC-01 queda en rojo a propósito
npm run medir                      # p50 y p95 de la decisión y de la respuesta completa
```

Para ver el rojo de antes de las tácticas: `git checkout 942e435` y `npm run escenario`; después, `git checkout main`.
La salida de ese commit está guardada en `escenario/salida/commit-2-en-rojo.txt`.

El prototipo no simula una consulta de vínculos colgada: su caída responde con error de inmediato. El plazo de 2 s de
RNF-02 para esa consulta queda para AUT-2, en el núcleo.

## Qué señal nos haría cambiar de opinión

- Si con 350 sesiones concurrentes el p95 de la decisión pasa de 300 ms, la consulta de vínculos necesita un índice o
  una caché de vigencia corta. Esa caché tendría su propio costo: un vínculo revocado seguiría abriendo la historia
  mientras dure la copia.
- Si las urgencias sin vínculo empiezan a resolverse con excepciones manuales, el acceso de emergencia (EMG) pasa
  delante de cualquier otra mejora.
