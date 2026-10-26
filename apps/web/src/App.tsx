import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Layout from './Layout';
import { SesionProvider } from './sesion/SesionContext';

// Las pantallas reales llegan con AGE-8.
const Pagina = ({ titulo }: { titulo: string }) => <h1>{titulo}</h1>;

export default function App() {
  return (
    <SesionProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Pagina titulo="Inicio" />} />
            <Route path="/franjas" element={<Pagina titulo="Buscar franjas" />} />
            <Route path="/citas" element={<Pagina titulo="Mis citas" />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </SesionProvider>
  );
}