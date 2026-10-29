const BASE = `${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/v1`;
// Nombre provisional: confirmar con el núcleo (FUN-3).
const CABECERA_USUARIO_DEV = 'X-Usuario-Dev';

export class ErrorApi extends Error {
  estado: number;
  constructor(estado: number, mensaje: string) {
    super(mensaje);
    this.estado = estado;
  }
}

export async function api<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  const headers = new Headers(opciones.headers);
  headers.set('Content-Type', 'application/json');
  if (import.meta.env.DEV) {
    const usuario = localStorage.getItem('usuarioDev');
    if (usuario) headers.set(CABECERA_USUARIO_DEV, usuario);
  }
  const res = await fetch(`${BASE}${ruta}`, { ...opciones, headers });
  if (!res.ok) throw new ErrorApi(res.status, `Error ${res.status} en ${ruta}`);
  return (await res.json()) as T;
}
