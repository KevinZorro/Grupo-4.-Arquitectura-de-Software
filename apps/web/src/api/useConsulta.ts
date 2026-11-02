import { useEffect, useRef, useState } from 'react';
import { api, textoError } from './cliente';

interface Resultado<T> {
  clave: string;
  datos?: T;
  error?: string;
}

/** GET que se repite al cambiar la ruta o al llamar a `recargar`. `alCargar` recibe cada respuesta. */
export function useConsulta<T>(ruta: string, alCargar?: (datos: T) => void) {
  const [recarga, setRecarga] = useState(0);
  const [resultado, setResultado] = useState<Resultado<T> | null>(null);
  const clave = `${ruta}#${recarga}`;
  const alCargarRef = useRef(alCargar);

  useEffect(() => {
    alCargarRef.current = alCargar;
  });

  useEffect(() => {
    let activo = true;
    api<T>(ruta).then(
      (datos) => {
        if (!activo) return;
        alCargarRef.current?.(datos);
        setResultado({ clave, datos });
      },
      (error: unknown) => {
        if (activo) setResultado({ clave, error: textoError(error) });
      },
    );
    return () => {
      activo = false;
    };
  }, [ruta, clave]);

  const actual = resultado?.clave === clave ? resultado : null;
  return {
    datos: actual?.datos ?? null,
    error: actual?.error ?? null,
    cargando: actual === null,
    recargar: () => setRecarga((n) => n + 1),
  };
}
