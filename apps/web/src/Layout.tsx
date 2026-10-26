import { AppBar, Box, Button, Container, Toolbar, Typography } from '@mui/material';
import { Link, Outlet } from 'react-router-dom';
import SelectorUsuario from './dev/SelectorUsuario';
import { useSesion, type Rol } from './sesion/SesionContext';

const MENU: Record<Rol, { ruta: string; texto: string }[]> = {
  paciente: [
    { ruta: '/franjas', texto: 'Buscar franjas' },
    { ruta: '/citas', texto: 'Mis citas' },
  ],
  profesional: [],
  administrativo: [],
  auditor: [],
};

export default function Layout() {
  const { usuario } = useSesion();
  return (
    <>
      <AppBar position="static">
        <Toolbar sx={{ gap: 1 }}>
          <Typography
            variant="h6"
            component={Link}
            to="/"
            sx={{ color: 'inherit', textDecoration: 'none' }}
          >
            Citas
          </Typography>
          {usuario &&
            MENU[usuario.rol].map((item) => (
              <Button key={item.ruta} color="inherit" component={Link} to={item.ruta}>
                {item.texto}
              </Button>
            ))}
          <Box sx={{ flexGrow: 1 }} />
          <SelectorUsuario />
        </Toolbar>
      </AppBar>
      <Container sx={{ py: 3 }}>
        <Outlet />
      </Container>
    </>
  );
}