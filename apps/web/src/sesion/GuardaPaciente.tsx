import { Alert } from '@mui/material';
import { Outlet } from 'react-router-dom';
import { useSesion } from './SesionContext';

/** Deja pasar solo a un paciente. El `key` reinicia la pantalla al cambiar de usuario. */
export default function GuardaPaciente() {
  const { usuario } = useSesion();
  if (!usuario) {
    return <Alert severity="info">Elige un usuario paciente en el selector de arriba.</Alert>;
  }
  if (usuario.rol !== 'paciente') {
    return <Alert severity="warning">Esta pantalla es solo para pacientes.</Alert>;
  }
  return <Outlet key={usuario.correo} />;
}
