import { createContext, useContext, useState, type ReactNode } from 'react';

export type Rol = 'paciente' | 'profesional' | 'administrativo' | 'auditor';
export interface UsuarioSemilla {
  id: string;
  nombre: string;
  rol: Rol;
}

// Provisional: ajustar a los ids de la semilla del núcleo (FUN-3).
export const USUARIOS_SEMILLA: UsuarioSemilla[] = [
  { id: 'paciente-1', nombre: 'Paciente demo', rol: 'paciente' },
  { id: 'profesional-1', nombre: 'Profesional demo', rol: 'profesional' },
  { id: 'administrativo-1', nombre: 'Administrativo demo', rol: 'administrativo' },
  { id: 'auditor-1', nombre: 'Auditor demo', rol: 'auditor' },
];

interface Sesion {
  usuario: UsuarioSemilla | null;
  elegir: (id: string) => void;
}

const SesionContext = createContext<Sesion>({ usuario: null, elegir: () => {} });

export function SesionProvider({ children }: { children: ReactNode }) {
  const [id, setId] = useState(() => localStorage.getItem('usuarioDev') ?? '');
  const usuario = USUARIOS_SEMILLA.find((u) => u.id === id) ?? null;
  const elegir = (nuevo: string) => {
    localStorage.setItem('usuarioDev', nuevo);
    setId(nuevo);
  };
  return <SesionContext.Provider value={{ usuario, elegir }}>{children}</SesionContext.Provider>;
}

export const useSesion = () => useContext(SesionContext);
