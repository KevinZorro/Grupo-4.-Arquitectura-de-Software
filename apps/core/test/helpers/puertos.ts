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

/** Provides the payment port while no module does, the way PAG-2 will: globally. */
@Global()
@Module({
  providers: [{ provide: INICIADOR_PAGO, useValue: pagoDePrueba }],
  exports: [INICIADOR_PAGO],
})
class PuertosDePruebaModule {}

/**
 * The doubles win before and after the real adapters are wired: the module provides the payment
 * token while nobody else does, and the override replaces whichever adapter is there.
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
