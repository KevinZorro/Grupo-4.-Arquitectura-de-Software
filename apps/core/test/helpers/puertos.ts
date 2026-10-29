import { Global, Module } from '@nestjs/common';
import type { AjustesDePrueba } from './app';
import { vi } from 'vitest';
import {
  BANDEJA_SALIDA,
  INICIADOR_PAGO,
  type BandejaSalida,
  type IniciadorPago,
} from '../../src/agenda';

/** Doubles for the gateway (PAG-2) and the outbox (EVT-3); each test sets how they answer. */
export const pagoDePrueba = { iniciarPago: vi.fn<IniciadorPago['iniciarPago']>() };
export const bandejaDePrueba = { encolar: vi.fn<BandejaSalida['encolar']>() };

/** Provides the agenda's ports while no module does, the way PAG-2 and EVT-3 will: globally. */
@Global()
@Module({
  providers: [
    { provide: INICIADOR_PAGO, useValue: pagoDePrueba },
    { provide: BANDEJA_SALIDA, useValue: bandejaDePrueba },
  ],
  exports: [INICIADOR_PAGO, BANDEJA_SALIDA],
})
class PuertosDePruebaModule {}

/**
 * The doubles win both before and after the real adapters are wired: the module provides the
 * tokens while nobody else does, and the override replaces them once PAG-2 and EVT-3 do.
 */
export const conPuertosDePrueba: AjustesDePrueba = {
  imports: [PuertosDePruebaModule],
  ajustar: (builder) =>
    builder
      .overrideProvider(INICIADOR_PAGO)
      .useValue(pagoDePrueba)
      .overrideProvider(BANDEJA_SALIDA)
      .useValue(bandejaDePrueba),
};

/** Back to a gateway that answers and an outbox that stores, with no calls recorded. */
export function reiniciarPuertos(): void {
  pagoDePrueba.iniciarPago.mockReset().mockImplementation((idCita) =>
    Promise.resolve({
      idTransaccion: `tx-${idCita}`,
      urlPago: `http://localhost:4000/pagar/${idCita}`,
    }),
  );
  bandejaDePrueba.encolar.mockReset().mockResolvedValue();
}
