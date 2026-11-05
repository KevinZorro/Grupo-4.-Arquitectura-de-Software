import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Layout from './Layout';
import BuscarFranjas from './paginas/BuscarFranjas';
import MisCitas from './paginas/MisCitas';
import GuardaPaciente from './sesion/GuardaPaciente';
import { SesionProvider } from './sesion/SesionContext';

const Pagina = ({ titulo }: { titulo: string }) => <h1>{titulo}</h1>;

export default function App() {
  return (
    <SesionProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Pagina titulo="Inicio" />} />
            <Route element={<GuardaPaciente />}>
              <Route path="/franjas" element={<BuscarFranjas />} />
              <Route path="/citas" element={<MisCitas />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </SesionProvider>
  );
}
