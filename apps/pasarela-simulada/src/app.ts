import express, { type NextFunction, type Request, type Response } from 'express';

import { renderPagina } from './pagina';
import { renderPanel } from './panel';
import { RepositorioTransacciones, type EstadoResuelto, type Transaccion } from './transacciones';
import { enviarWebhook, type PeticionHttp } from './webhook';

export interface OpcionesApp {
  /** Secreto compartido con el núcleo para firmar el webhook. */
  secreto: string;
  /** URL del `POST /api/v1/pagos/webhook` del núcleo. */
  urlWebhook: string;
  /** Base pública de esta pasarela, para armar `urlPago`. */
  baseUrl: string;
  esperasWebhook?: readonly number[];
  peticion?: PeticionHttp;
  dormir?: (ms: number) => Promise<void>;
  repositorio?: RepositorioTransacciones;
}

type Validacion = { ok: true; referencia: string; monto: number } | { ok: false; error: string };

function validarTransaccion(datos: { referencia?: unknown; monto?: unknown }): Validacion {
  const { referencia, monto } = datos;

  if (typeof referencia !== 'string' || referencia.trim() === '' || referencia.length > 200) {
    return { ok: false, error: 'referencia debe ser un texto no vacío de hasta 200 caracteres' };
  }

  if (typeof monto !== 'number' || !Number.isInteger(monto) || monto <= 0) {
    return { ok: false, error: 'monto debe ser un entero positivo en pesos colombianos' };
  }

  return { ok: true, referencia, monto };
}

export function crearApp(opciones: OpcionesApp): express.Express {
  const app = express();
  const repositorio = opciones.repositorio ?? new RepositorioTransacciones();
  const baseUrl = opciones.baseUrl.replace(/\/+$/, '');

  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));
  app.use(express.urlencoded({ extended: false, limit: '16kb' }));

  const notificar = (transaccion: Transaccion): void => {
    void enviarWebhook(transaccion, {
      url: opciones.urlWebhook,
      secreto: opciones.secreto,
      esperas: opciones.esperasWebhook,
      peticion: opciones.peticion,
      dormir: opciones.dormir,
    }).catch(() => undefined);
  };

  app.get('/salud', (_req, res) => {
    res.json({ estado: 'ok', transacciones: repositorio.total });
  });

  app.post('/transacciones', (req, res) => {
    // Se leen solo estos dos campos: cualquier otro se descarta (RNF-09).
    const validacion = validarTransaccion((req.body ?? {}) as Record<string, unknown>);

    if (!validacion.ok) {
      res.status(400).json({ error: validacion.error });
      return;
    }

    const { transaccion, creada } = repositorio.crear({
      referencia: validacion.referencia,
      monto: validacion.monto,
    });

    res.status(creada ? 201 : 200).json({
      idTransaccion: transaccion.idTransaccion,
      urlPago: `${baseUrl}/pagar/${transaccion.idTransaccion}`,
    });
  });

  app.get('/', (req, res) => {
    const error = typeof req.query.error === 'string' ? req.query.error : undefined;
    res.type('html').send(renderPanel(repositorio.listar(), { error }));
  });

  app.post('/panel/transacciones', (req, res) => {
    const cuerpo = (req.body ?? {}) as Record<string, unknown>;

    // El formulario manda todo como texto; se convierte solo si parece un entero.
    const montoCrudo = cuerpo.monto;
    const monto =
      typeof montoCrudo === 'string' && /^\d+$/.test(montoCrudo.trim())
        ? Number(montoCrudo.trim())
        : montoCrudo;

    const validacion = validarTransaccion({ referencia: cuerpo.referencia, monto });

    if (!validacion.ok) {
      res.redirect(303, `/?error=${encodeURIComponent(validacion.error)}`);
      return;
    }

    // Si la referencia ya existe se reutiliza: misma idempotencia que el API.
    const { transaccion } = repositorio.crear({
      referencia: validacion.referencia,
      monto: validacion.monto,
    });

    res.redirect(303, `/pagar/${transaccion.idTransaccion}`);
  });

  app.get('/pagar/:idTransaccion', (req, res) => {
    const transaccion = repositorio.buscar(req.params.idTransaccion);
    if (!transaccion) {
      res.status(404).json({ error: 'transacción no encontrada' });
      return;
    }

    res.type('html').send(renderPagina(transaccion));
  });

  const resolver = (estado: EstadoResuelto) => (req: Request, res: Response) => {
    const resultado = repositorio.resolver(req.params.idTransaccion, estado);
    if (!resultado) {
      res.status(404).json({ error: 'transacción no encontrada' });
      return;
    }

    // Se responde antes de notificar: si el núcleo está caído, el paciente no
    // espera. Si ya estaba resuelta, no se reenvía el webhook.
    res.redirect(303, `/pagar/${resultado.transaccion.idTransaccion}`);

    if (resultado.cambio) {
      notificar(resultado.transaccion);
    }
  };

  app.post('/pagar/:idTransaccion/aprobar', resolver('APROBADA'));
  app.post('/pagar/:idTransaccion/rechazar', resolver('RECHAZADA'));

  app.post('/transacciones/:idTransaccion/reintentar-webhook', (req, res) => {
    const transaccion = repositorio.buscar(req.params.idTransaccion);

    if (!transaccion || transaccion.estado === 'PENDIENTE') {
      res.status(404).json({ error: 'transacción resuelta no encontrada' });
      return;
    }

    res.redirect(303, `/pagar/${transaccion.idTransaccion}`);
    notificar(transaccion);
  });

  app.get('/transacciones/:idTransaccion', (req, res) => {
    const transaccion = repositorio.buscar(req.params.idTransaccion);
    if (!transaccion) {
      res.status(404).json({ error: 'transacción no encontrada' });
      return;
    }

    res.json({ estado: transaccion.estado });
  });

  app.use((_req, res) => {
    res.status(404).json({ error: 'ruta no encontrada' });
  });

  app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      next(error);
      return;
    }

    const conEstado = error as { status?: unknown } | null;
    const estado = typeof conEstado?.status === 'number' ? conEstado.status : 500;

    res.status(estado).json({ error: estado === 400 ? 'cuerpo JSON inválido' : 'error interno' });
  });

  return app;
}
