# Pasarela de pagos simulada

Proveedor de pagos falso para el sistema de citas médicas. **No procesa pagos
reales**: guarda todo en memoria, muestra una página para aprobar o rechazar a
mano y notifica al núcleo con un webhook firmado.

Corresponde a PAG-1.

## Cómo correrla

Desde la raíz del repositorio:

```bash
npm start -w @grupo4/pasarela-simulada
```

Queda en <http://localhost:4000> y el panel de desarrollo en `/`.

### Variables de entorno

La app carga el `.env` de su carpeta y el de la raíz del monorepo, en ese orden,
sin pisar las variables que ya estén definidas en el entorno. Es el mismo
criterio que `apps/core`, para que el secreto del webhook sea el mismo en los dos
procesos.

| Variable               | Por defecto                                  | Para qué                              |
| ---------------------- | -------------------------------------------- | ------------------------------------- |
| `PASARELA_PORT`        | `4000`                                       | Puerto HTTP                           |
| `PASARELA_BASE_URL`    | `http://localhost:4000`                      | Base para armar `urlPago`             |
| `PAGOS_WEBHOOK_URL`    | `http://localhost:3000/api/v1/pagos/webhook` | Destino del webhook                   |
| `PAGOS_WEBHOOK_SECRET` | `cambiar-en-local`                           | Secreto HMAC compartido con el núcleo |

## Rutas

| Método | Ruta                                    | Qué hace                                                                   |
| ------ | --------------------------------------- | -------------------------------------------------------------------------- |
| GET    | `/salud`                                | Estado y cantidad de transacciones                                         |
| POST   | `/transacciones`                        | Crea (o reutiliza por `referencia`) y devuelve `idTransaccion` y `urlPago` |
| GET    | `/transacciones/:id`                    | Consulta de respaldo: solo el estado                                       |
| GET    | `/pagar/:id`                            | Página para aprobar o rechazar                                             |
| POST   | `/pagar/:id/aprobar`                    | Aprueba y notifica                                                         |
| POST   | `/pagar/:id/rechazar`                   | Rechaza y notifica                                                         |
| POST   | `/transacciones/:id/reintentar-webhook` | Reenvía el webhook de una transacción resuelta                             |
| GET    | `/`                                     | Panel de desarrollo: listado, formulario y estado                          |

`POST /transacciones` recibe `{ "referencia": "cita-123", "monto": 50000 }`.
El monto es un entero en pesos colombianos y la `referencia` es el `idCita` del
núcleo: repetirla devuelve la misma transacción (idempotencia).

## Webhook

- `POST` a `PAGOS_WEBHOOK_URL` con `Content-Type: application/json`.
- Firma en el header `X-Firma`: HMAC-SHA256 del **cuerpo crudo** en hex minúscula.
- Cuerpo: `{ "idTransaccion", "referencia", "estado": "APROBADO" | "RECHAZADO" }`.
- Reintentos ante error: 5 intentos, esperas de 0, 1, 2, 4 y 8 segundos.

## Pruebas

```bash
npm test -w @grupo4/pasarela-simulada
```

Las pruebas levantan la pasarela y un receptor de webhooks en puertos efímeros,
así que no hace falta el núcleo ni red.
