-- CreateEnum
CREATE TYPE "estado_transaccion_pago" AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA');

-- CreateTable
CREATE TABLE "transaccion_pago" (
    "id_transaccion" TEXT NOT NULL,
    "id_cita" UUID NOT NULL,
    "monto" INTEGER NOT NULL,
    "estado" "estado_transaccion_pago" NOT NULL DEFAULT 'PENDIENTE',
    "url_pago" TEXT NOT NULL,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "transaccion_pago_pkey" PRIMARY KEY ("id_transaccion")
);

-- CreateIndex
CREATE UNIQUE INDEX "transaccion_pago_id_cita_key" ON "transaccion_pago"("id_cita");
