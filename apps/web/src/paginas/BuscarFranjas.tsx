import { useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  LinearProgress,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { api, ErrorApi, textoError } from '../api/cliente';
import type { Franja, Modalidad, Reserva } from '../api/tipos';
import { useConsulta } from '../api/useConsulta';
import { formatoHora } from './formato';
import ResumenFranja from './ResumenFranja';

interface Filtros {
  especialidadId: string;
  sedeId: string;
  profesionalId: string;
  modalidad: '' | Modalidad;
  fecha: string;
}

const SIN_FILTROS: Filtros = {
  especialidadId: '',
  sedeId: '',
  profesionalId: '',
  modalidad: '',
  fecha: '',
};

// El núcleo aún no tiene rutas para listar sedes, especialidades ni profesionales: las opciones
// de los filtros salen de las franjas que van llegando.
interface Catalogo {
  sedes: Record<string, string>;
  especialidades: Record<string, string>;
  profesionales: Record<string, { nombre: string; especialidadId: string }>;
}

function ampliar(previo: Catalogo, franjas: Franja[]): Catalogo {
  const nuevo: Catalogo = {
    sedes: { ...previo.sedes },
    especialidades: { ...previo.especialidades },
    profesionales: { ...previo.profesionales },
  };
  for (const f of franjas) {
    nuevo.sedes[f.sede.id] = `${f.sede.nombre} (${f.sede.ciudad})`;
    nuevo.especialidades[f.especialidad.id] = f.especialidad.nombre;
    nuevo.profesionales[f.profesional.id] = {
      nombre: f.profesional.nombre,
      especialidadId: f.especialidad.id,
    };
  }
  return nuevo;
}

function aConsulta(filtros: Filtros): string {
  const params = new URLSearchParams();
  for (const [campo, valor] of Object.entries(filtros)) {
    if (valor) params.set(campo, valor);
  }
  const texto = params.toString();
  return texto ? `?${texto}` : '';
}

function opciones(mapa: Record<string, string>): [string, string][] {
  return Object.entries(mapa).sort((a, b) => a[1].localeCompare(b[1], 'es'));
}

interface SelectorFiltroProps {
  etiqueta: string;
  valor: string;
  opciones: [string, string][];
  alCambiar: (valor: string) => void;
}

function SelectorFiltro({ etiqueta, valor, opciones, alCambiar }: SelectorFiltroProps) {
  return (
    <TextField
      select
      size="small"
      label={etiqueta}
      value={valor}
      onChange={(e) => alCambiar(e.target.value)}
      sx={{ minWidth: 200 }}
      slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
    >
      <MenuItem value="">Todas</MenuItem>
      {opciones.map(([id, texto]) => (
        <MenuItem key={id} value={id}>
          {texto}
        </MenuItem>
      ))}
    </TextField>
  );
}

interface Aviso {
  tipo: 'success' | 'warning' | 'error';
  texto: string;
  urlPago?: string;
  verCitas?: boolean;
}

function avisoDeReserva(reserva: Reserva): Aviso {
  if (reserva.estado === 'CONFIRMADA') {
    return { tipo: 'success', texto: 'Cita confirmada.', verCitas: true };
  }
  if (reserva.estado === 'PENDIENTE_PAGO') {
    const hasta = reserva.bloqueoVenceEn
      ? ` Paga antes de las ${formatoHora(reserva.bloqueoVenceEn)}.`
      : '';
    // Solo se ofrece un enlace http(s), venga lo que venga del servidor.
    const urlPago =
      reserva.urlPago && /^https?:\/\//.test(reserva.urlPago) ? reserva.urlPago : undefined;
    return {
      tipo: 'warning',
      texto: `Franja reservada, falta el pago del copago.${hasta}`,
      urlPago,
      verCitas: true,
    };
  }
  return { tipo: 'error', texto: 'La cita quedó cancelada.', verCitas: true };
}

function mensajeReserva(error: unknown): string {
  if (error instanceof ErrorApi) {
    if (error.estado === 404) return 'La franja ya no existe.';
    if (error.estado === 409) return 'Esa franja ya fue tomada por otra persona. Elige otra.';
    if (error.estado === 422) return 'La franja ya empezó o no corresponde a esa modalidad.';
    if (error.estado === 503) {
      return 'La pasarela de pago no respondió. La cita quedó cancelada y la franja sigue libre; puedes intentarlo de nuevo.';
    }
  }
  return textoError(error);
}

export default function BuscarFranjas() {
  const [filtros, setFiltros] = useState<Filtros>(SIN_FILTROS);
  const [catalogo, setCatalogo] = useState<Catalogo>({
    sedes: {},
    especialidades: {},
    profesionales: {},
  });
  const [reservando, setReservando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  // Una clave por intento de reserva: si falla la red y el paciente reintenta, no se duplica la cita.
  const claves = useRef(new Map<string, string>());

  const { datos, error, cargando, recargar } = useConsulta<Franja[]>(
    `/franjas${aConsulta(filtros)}`,
    (franjas) => setCatalogo((previo) => ampliar(previo, franjas)),
  );

  const cambiar = (campo: keyof Filtros, valor: string) => {
    setFiltros((previo) => {
      const nuevo = { ...previo, [campo]: valor };
      if (campo === 'especialidadId' && valor && nuevo.profesionalId) {
        if (catalogo.profesionales[nuevo.profesionalId]?.especialidadId !== valor) {
          nuevo.profesionalId = '';
        }
      }
      return nuevo;
    });
  };

  const profesionales = Object.entries(catalogo.profesionales)
    .filter(([, p]) => !filtros.especialidadId || p.especialidadId === filtros.especialidadId)
    .map(([id, p]): [string, string] => [id, p.nombre])
    .sort((a, b) => a[1].localeCompare(b[1], 'es'));

  async function reservar(franja: Franja) {
    setReservando(franja.id);
    setAviso(null);
    let clave = claves.current.get(franja.id);
    if (!clave) {
      clave = crypto.randomUUID();
      claves.current.set(franja.id, clave);
    }
    try {
      const reserva = await api<Reserva>('/citas', {
        method: 'POST',
        headers: { 'Idempotency-Key': clave },
        body: JSON.stringify({ franjaId: franja.id, modalidad: franja.modalidad }),
      });
      claves.current.delete(franja.id);
      setAviso(avisoDeReserva(reserva));
      recargar();
    } catch (e) {
      if (e instanceof ErrorApi) {
        // El núcleo respondió: este intento terminó. Si fue un fallo de red se conserva la clave.
        claves.current.delete(franja.id);
        recargar();
      }
      setAviso({ tipo: 'error', texto: mensajeReserva(e) });
    } finally {
      setReservando(null);
    }
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h5" component="h1">
        Buscar franjas
      </Typography>

      <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 2 }}>
        <SelectorFiltro
          etiqueta="Especialidad"
          valor={filtros.especialidadId}
          opciones={opciones(catalogo.especialidades)}
          alCambiar={(v) => cambiar('especialidadId', v)}
        />
        <SelectorFiltro
          etiqueta="Sede"
          valor={filtros.sedeId}
          opciones={opciones(catalogo.sedes)}
          alCambiar={(v) => cambiar('sedeId', v)}
        />
        <SelectorFiltro
          etiqueta="Profesional"
          valor={filtros.profesionalId}
          opciones={profesionales}
          alCambiar={(v) => cambiar('profesionalId', v)}
        />
        <SelectorFiltro
          etiqueta="Modalidad"
          valor={filtros.modalidad}
          opciones={[
            ['VIRTUAL', 'Virtual'],
            ['PRESENCIAL', 'Presencial'],
          ]}
          alCambiar={(v) => cambiar('modalidad', v)}
        />
        <TextField
          type="date"
          size="small"
          label="Fecha"
          value={filtros.fecha}
          onChange={(e) => cambiar('fecha', e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <Button onClick={() => setFiltros(SIN_FILTROS)}>Limpiar filtros</Button>
      </Stack>

      {aviso && (
        <Alert
          severity={aviso.tipo}
          onClose={() => setAviso(null)}
          action={
            <>
              {aviso.urlPago && (
                <Button
                  color="inherit"
                  size="small"
                  href={aviso.urlPago}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Ir a pagar
                </Button>
              )}
              {aviso.verCitas && (
                <Button color="inherit" size="small" component={RouterLink} to="/citas">
                  Mis citas
                </Button>
              )}
            </>
          }
        >
          {aviso.texto}
        </Alert>
      )}

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
        <Alert severity="info">No hay franjas libres con esos filtros.</Alert>
      )}
      {datos?.map((franja) => (
        <Card key={franja.id} variant="outlined">
          <CardContent>
            <ResumenFranja franja={franja} />
          </CardContent>
          <CardActions>
            <Box sx={{ flexGrow: 1 }} />
            <Button
              variant="contained"
              disabled={reservando !== null}
              onClick={() => void reservar(franja)}
            >
              {reservando === franja.id ? 'Reservando…' : 'Reservar'}
            </Button>
          </CardActions>
        </Card>
      ))}
    </Stack>
  );
}
