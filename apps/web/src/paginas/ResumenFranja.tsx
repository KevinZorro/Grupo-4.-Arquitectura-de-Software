import { Chip, Stack, Typography } from '@mui/material';
import type { Franja } from '../api/tipos';
import { ETIQUETA_MODALIDAD, formatoFecha, formatoHora } from './formato';

export default function ResumenFranja({ franja }: { franja: Franja }) {
  return (
    <Stack spacing={0.5}>
      <Typography variant="subtitle1">{franja.profesional.nombre}</Typography>
      <Typography variant="body2" color="text.secondary">
        {franja.especialidad.nombre} · {franja.sede.nombre} ({franja.sede.ciudad})
      </Typography>
      <Typography variant="body2">
        {formatoFecha(franja.iniciaEn)} a {formatoHora(franja.terminaEn)}
      </Typography>
      <Chip
        size="small"
        label={ETIQUETA_MODALIDAD[franja.modalidad]}
        sx={{ alignSelf: 'flex-start' }}
      />
    </Stack>
  );
}
