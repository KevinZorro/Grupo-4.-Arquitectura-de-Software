import { createContext, useContext, useState, type ReactNode } from 'react';

export type Rol = 'paciente' | 'profesional' | 'administrativo' | 'auditor';
export interface UsuarioSemilla {
  correo: string;
  nombre: string;
  rol: Rol;
}

// Usuarios de la semilla del núcleo (apps/core/README.md). El correo es lo que viaja en X-Usuario-Dev.
export const USUARIOS_SEMILLA: UsuarioSemilla[] = [
  { correo: 'ana.perez@ejemplo.test', nombre: 'Ana Lucía Pérez', rol: 'paciente' },
  { correo: 'luis.moreno@ejemplo.test', nombre: 'Luis Alberto Moreno', rol: 'paciente' },
  { correo: 'sara.rincon@ejemplo.test', nombre: 'Sara Valentina Rincón', rol: 'paciente' },
  { correo: 'pedro.castellanos@ejemplo.test', nombre: 'Pedro Castellanos', rol: 'paciente' },
  { correo: 'maria.quintana@ejemplo.test', nombre: 'María José Quintana', rol: 'paciente' },
  { correo: 'jorge.salcedo@ejemplo.test', nombre: 'Jorge Iván Salcedo', rol: 'paciente' },
  { correo: 'laura.contreras@ejemplo.test', nombre: 'Laura Contreras', rol: 'profesional' },
  { correo: 'camila.villamizar@ejemplo.test', nombre: 'Camila Villamizar', rol: 'profesional' },
  { correo: 'ricardo.penaranda@ejemplo.test', nombre: 'Ricardo Peñaranda', rol: 'profesional' },
  { correo: 'gabriela.sepulveda@ejemplo.test', nombre: 'Gabriela Sepúlveda', rol: 'profesional' },
  { correo: 'admin.cucuta@ejemplo.test', nombre: 'Marta Cecilia Ruiz', rol: 'administrativo' },
  { correo: 'admin.tibu@ejemplo.test', nombre: 'Edgar Fabián Oliveros', rol: 'administrativo' },
  { correo: 'auditor@ejemplo.test', nombre: 'Hernán Cáceres', rol: 'auditor' },
];

interface Sesion {
  usuario: UsuarioSemilla | null;
  elegir: (correo: string) => void;
}

const SesionContext = createContext<Sesion>({ usuario: null, elegir: () => {} });

export function SesionProvider({ children }: { children: ReactNode }) {
  const [correo, setCorreo] = useState(() => {
    const guardado = localStorage.getItem('usuarioDev') ?? '';
    if (USUARIOS_SEMILLA.some((u) => u.correo === guardado)) return guardado;
    localStorage.removeItem('usuarioDev'); // valor de una versión anterior: el núcleo no lo reconocería
    return '';
  });
  const usuario = USUARIOS_SEMILLA.find((u) => u.correo === correo) ?? null;
  const elegir = (nuevo: string) => {
    if (nuevo) localStorage.setItem('usuarioDev', nuevo);
    else localStorage.removeItem('usuarioDev');
    setCorreo(nuevo);
  };
  return <SesionContext.Provider value={{ usuario, elegir }}>{children}</SesionContext.Provider>;
}

export const useSesion = () => useContext(SesionContext);
