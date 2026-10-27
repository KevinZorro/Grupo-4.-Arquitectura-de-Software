-- CreateTable
CREATE TABLE "evento_saliente" (
    "secuencia" BIGSERIAL NOT NULL,
    "id_evento" UUID NOT NULL,
    "clave" TEXT NOT NULL,
    "contenido" JSONB NOT NULL,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enviado_en" TIMESTAMPTZ(3),

    CONSTRAINT "evento_saliente_pkey" PRIMARY KEY ("secuencia")
);

-- CreateIndex
CREATE UNIQUE INDEX "evento_saliente_id_evento_key" ON "evento_saliente"("id_evento");

-- CreateIndex
CREATE INDEX "evento_saliente_enviado_en_secuencia_idx" ON "evento_saliente"("enviado_en", "secuencia");
