-- Migration inicial do componente Banco (contratos/banco.md; ADR-002, ADR-004, ADR-010).

-- CreateTable
CREATE TABLE "usuarios" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha_hash" TEXT NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessoes" (
    "id_hash" TEXT NOT NULL,
    "usuario_id" UUID NOT NULL,
    "criada_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expira_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sessoes_pkey" PRIMARY KEY ("id_hash")
);

-- CreateTable
CREATE TABLE "fases" (
    "id" UUID NOT NULL,
    "dono_id" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "documento" JSONB NOT NULL,
    "documento_publicado" JSONB,
    "publicada_em" TIMESTAMPTZ(3),
    "revisao" INTEGER NOT NULL DEFAULT 0,
    "criada_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizada_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" UUID NOT NULL,
    "dono_id" UUID NOT NULL,
    "arquivo" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id"),
    -- Até 5 MB por imagem (ADR-010, LIMITES_CORPO.asset).
    CONSTRAINT "assets_bytes_max" CHECK ("bytes" <= 5242880)
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE INDEX "sessoes_usuario_id_idx" ON "sessoes"("usuario_id");

-- CreateIndex
CREATE INDEX "fases_dono_id_idx" ON "fases"("dono_id");

-- CreateIndex (parcial: lista de Escolher Fase)
CREATE INDEX "fases_publicada_em_idx" ON "fases"("publicada_em") WHERE "publicada_em" IS NOT NULL;

-- CreateIndex
CREATE INDEX "assets_dono_id_idx" ON "assets"("dono_id");

-- AddForeignKey
ALTER TABLE "sessoes" ADD CONSTRAINT "sessoes_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fases" ADD CONSTRAINT "fases_dono_id_fkey" FOREIGN KEY ("dono_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_dono_id_fkey" FOREIGN KEY ("dono_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
