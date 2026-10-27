import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service';
import { PagosService } from './pagos.service';
import type { PasarelaClient } from './pasarela.client';

const URL_PAGO = 'http://pasarela.test/pagar/tx-1';

function crearServicio() {
  const prisma = {
    transaccionPago: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  };
  const pasarela = { crearTransaccion: vi.fn() };
  return {
    servicio: new PagosService(
      prisma as unknown as PrismaService,
      pasarela as unknown as PasarelaClient,
    ),
    prisma,
    pasarela,
  };
}

describe('PagosService', () => {
  it('crea la transacción con el id de la cita y la guarda como pendiente', async () => {
    const { servicio, prisma, pasarela } = crearServicio();
    prisma.transaccionPago.findUnique.mockResolvedValue(null);
    pasarela.crearTransaccion.mockResolvedValue({ idTransaccion: 'tx-1', urlPago: URL_PAGO });
    prisma.transaccionPago.upsert.mockResolvedValue({ idTransaccion: 'tx-1', urlPago: URL_PAGO });

    await expect(servicio.iniciarPago('cita-1', 50_000)).resolves.toEqual({
      idTransaccion: 'tx-1',
      urlPago: URL_PAGO,
    });

    expect(prisma.transaccionPago.findUnique).toHaveBeenCalledWith({
      where: { idCita: 'cita-1' },
      select: { idTransaccion: true, urlPago: true },
    });
    expect(pasarela.crearTransaccion).toHaveBeenCalledWith({
      referencia: 'cita-1',
      monto: 50_000,
    });
    expect(prisma.transaccionPago.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { idCita: 'cita-1' },
        create: expect.objectContaining({
          idTransaccion: 'tx-1',
          idCita: 'cita-1',
          monto: 50_000,
          urlPago: URL_PAGO,
        }),
      }),
    );
  });

  it('es idempotente por idCita: si ya existe, no vuelve a llamar a la pasarela', async () => {
    const { servicio, prisma, pasarela } = crearServicio();
    prisma.transaccionPago.findUnique.mockResolvedValue({
      idTransaccion: 'tx-1',
      urlPago: URL_PAGO,
    });

    await expect(servicio.iniciarPago('cita-1', 50_000)).resolves.toEqual({
      idTransaccion: 'tx-1',
      urlPago: URL_PAGO,
    });

    expect(pasarela.crearTransaccion).not.toHaveBeenCalled();
    expect(prisma.transaccionPago.upsert).not.toHaveBeenCalled();
  });

  it('propaga la falla de la pasarela sin guardar nada', async () => {
    const { servicio, prisma, pasarela } = crearServicio();
    prisma.transaccionPago.findUnique.mockResolvedValue(null);
    pasarela.crearTransaccion.mockRejectedValue(new Error('La pasarela no respondió en 5000 ms'));

    await expect(servicio.iniciarPago('cita-1', 50_000)).rejects.toThrow(
      'La pasarela no respondió en 5000 ms',
    );
    expect(prisma.transaccionPago.upsert).not.toHaveBeenCalled();
  });

  it('si otra solicitud ganó la carrera, conserva la fila existente', async () => {
    const { servicio, prisma, pasarela } = crearServicio();
    prisma.transaccionPago.findUnique.mockResolvedValue(null);
    pasarela.crearTransaccion.mockResolvedValue({ idTransaccion: 'tx-1', urlPago: URL_PAGO });
    prisma.transaccionPago.upsert.mockResolvedValue({ idTransaccion: 'tx-1', urlPago: URL_PAGO });

    await servicio.iniciarPago('cita-1', 50_000);

    expect(prisma.transaccionPago.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: {} }),
    );
  });
});
