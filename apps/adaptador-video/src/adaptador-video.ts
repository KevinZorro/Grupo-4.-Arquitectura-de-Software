import {
  consumir,
  crearEvento,
  declararTopologia,
  publicar,
  type CitaConfirmada,
} from '@citas/eventos';
import type { ConfirmChannel } from 'amqplib';
import type { Pool } from 'pg';
import { ProveedorVideoSimulado, type ProveedorVideo } from './proveedor-video';

export class AdaptadorVideo {
  constructor(
    private readonly canal: ConfirmChannel,
    private readonly pool: Pool,
    private readonly proveedor: ProveedorVideo = new ProveedorVideoSimulado(),
  ) {}

  async iniciar(): Promise<string> {
    await declararTopologia(this.canal);

    return consumir({
      canal: this.canal,
      pool: this.pool,
      cola: 'video.cita-confirmada',
      claveIdempotencia: (evento) => evento.idCita,
      procesar: (evento) => this.procesar(evento),
    });
  }

  private async procesar(evento: CitaConfirmada): Promise<void> {
    if (evento.modalidad !== 'VIRTUAL') {
      return;
    }

    const sala = await this.proveedor.crearSala(evento.idCita);

    const salaCreada = crearEvento('sala.creada', {
      idCita: evento.idCita,
      idSala: sala.idSala,
    });

    await publicar(this.canal, 'sala.creada', salaCreada);
  }
}
