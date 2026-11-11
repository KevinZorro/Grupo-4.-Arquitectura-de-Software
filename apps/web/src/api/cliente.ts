const BASE = `${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/v1`;
// El núcleo espera aquí el correo de un usuario semilla (apps/core/README.md).
const CABECERA_USUARIO_DEV = 'X-Usuario-Dev';

/** El núcleo respondió con un código de error. */
export class ErrorApi extends Error {
  estado: number;
  detalle: string;
  constructor(estado: number, detalle: string) {
    super(detalle || `Error ${estado}`);
    this.estado = estado;
    this.detalle = detalle;
  }
}

/** No hubo respuesta: el núcleo está apagado o la red falló. */
export class ErrorRed extends Error {
  constructor() {
    super('No pudimos conectar con el servidor');
  }
}

async function leerDetalle(res: Response): Promise<string> {
  try {
    const cuerpo: unknown = await res.json();
    if (typeof cuerpo === 'object' && cuerpo !== null && 'message' in cuerpo) {
      const { message } = cuerpo as { message: unknown };
      if (typeof message === 'string') return message;
      if (Array.isArray(message)) return message.map(String).join('; ');
    }
  } catch {
    // El cuerpo no era JSON: se queda sin detalle.
  }
  return '';
}

export async function api<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  const headers = new Headers(opciones.headers);
  headers.set('Content-Type', 'application/json');
  if (import.meta.env.DEV) {
    const usuario = localStorage.getItem('usuarioDev');
    if (usuario) headers.set(CABECERA_USUARIO_DEV, usuario);
  }
  let res: Response;
  try {
    res = await fetch(`${BASE}${ruta}`, { ...opciones, headers });
  } catch {
    throw new ErrorRed();
  }
  if (!res.ok) throw new ErrorApi(res.status, await leerDetalle(res));
  return (await res.json()) as T;
}

/** Texto para mostrar al usuario cuando una consulta falla. */
export function textoError(error: unknown): string {
  if (error instanceof ErrorRed) {
    return 'No pudimos conectar con el servidor. Revisa que el núcleo esté encendido.';
  }
  if (error instanceof ErrorApi) {
    if (error.estado === 401) {
      return 'El núcleo no reconoció al usuario. Vuelve a elegirlo en el selector.';
    }
    if (error.estado === 403) return 'Esta pantalla es solo para pacientes.';
    return error.detalle || `El servidor respondió con el error ${error.estado}.`;
  }
  return 'Ocurrió un error inesperado.';
}
