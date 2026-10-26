import { MenuItem, Select } from '@mui/material';
import { USUARIOS_SEMILLA, useSesion } from '../sesion/SesionContext';

// Solo desarrollo: el login real llega en IDN-2.
export default function SelectorUsuario() {
  const { usuario, elegir } = useSesion();
  if (!import.meta.env.DEV) return null;
  return (
    <Select
      size="small"
      displayEmpty
      value={usuario?.id ?? ''}
      onChange={(e) => elegir(e.target.value)}
      sx={{ bgcolor: 'white' }}
    >
      <MenuItem value="">Elegir usuario semilla</MenuItem>
      {USUARIOS_SEMILLA.map((u) => (
        <MenuItem key={u.id} value={u.id}>
          {u.nombre}
        </MenuItem>
      ))}
    </Select>
  );
}
