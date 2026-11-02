import {
  Alert,
  Button,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import type { Cita } from '../api/tipos';
import { useConsulta } from '../api/useConsulta';
import { COLOR_ESTADO, ETIQUETA_ESTADO, formatoFecha } from './formato';
import ResumenFranja from './ResumenFranja';

export default function MisCitas() {
  const { datos, error, cargando, recargar } = useConsulta<Cita[]>('/citas/mias');

  return (
    <Stack spacing={2}>
      <Typography variant="h5" component="h1">
        Mis citas
      </Typography>
      {cargando && <LinearProgress />}
      {error && (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={recargar}>
              Reintentar
            </Button>
          }
        >
          {error}
        </Alert>
      )}
      {datos && datos.length === 0 && (
        <Alert severity="info">Aún no tienes citas. Reserva una en «Buscar franjas».</Alert>
      )}
      {datos?.map((cita) => (
        <Card key={cita.id} variant="outlined">
          <CardContent>
            <Stack spacing={1}>
              <Chip
                size="small"
                color={COLOR_ESTADO[cita.estado]}
                label={ETIQUETA_ESTADO[cita.estado]}
                sx={{ alignSelf: 'flex-start' }}
              />
              <ResumenFranja franja={cita.franja} />
              {cita.estado === 'PENDIENTE_PAGO' && cita.bloqueoVenceEn && (
                <Typography variant="body2" color="warning.main">
                  La franja se libera si no pagas antes de {formatoFecha(cita.bloqueoVenceEn)}.
                </Typography>
              )}
            </Stack>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}
