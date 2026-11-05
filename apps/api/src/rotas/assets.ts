/**
 * Imagens (contratos/api.md §Imagens; modulos-api.md §1 e §2 "Assets"; ADR-010): envio multipart
 * de 1 arquivo pelo criador (RF-06) e leitura pública por id.
 * O tamanho é decidido por `limits.fileSize` (413); o tipo, pela assinatura dos bytes (415).
 * Recusa não grava nada; registro e arquivo são gravados juntos.
 */
import { randomUUID } from 'node:crypto';
import { type AssetCriado, resolverImagem } from '@math-scape/schema';
import type { FastifyInstance } from 'fastify';
import { LIMITES_CORPO, PREFIXO_PUBLICO } from '../../contrato/index.ts';
import type { Contexto } from '../contexto.ts';
import { responderErro } from '../erros.ts';
import { detectarTipoImagem } from '../imagens.ts';
import { exigirLogin, idDoUsuario } from '../plugins/exigir-login.ts';

const MENSAGEM_SEM_ARQUIVO = 'Envie um arquivo de imagem.';
const MENSAGEM_GRANDE = 'A imagem passa de 5 MB.';
const MENSAGEM_TIPO = 'A imagem precisa ser PNG, JPG ou WebP.';
const MENSAGEM_NAO_ENCONTRADA = 'Imagem não encontrada.';

/** A coluna `id` é uuid: qualquer outro formato não existe (e não deve chegar ao banco). */
const PADRAO_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Folga para o envelope multipart (fronteiras e cabeçalhos da parte): o 413 é decidido por `limits.fileSize`. */
const FOLGA_ENVELOPE = 64 * 1024;

export function registrarRotasAssets(app: FastifyInstance, ctx: Contexto): void {
  const { banco, armazenamento } = ctx;

  app.post(
    '/assets',
    { bodyLimit: LIMITES_CORPO.asset + FOLGA_ENVELOPE, preHandler: exigirLogin },
    async (request, reply) => {
      const donoId = idDoUsuario(request);
      if (!request.isMultipart()) return responderErro(reply, 400, MENSAGEM_SEM_ARQUIVO);

      const parte = await request.file({ limits: { fileSize: LIMITES_CORPO.asset, files: 1 }, throwFileSizeLimit: true });
      if (!parte) return responderErro(reply, 400, MENSAGEM_SEM_ARQUIVO);

      let bytes: Buffer;
      try {
        bytes = await parte.toBuffer();
      } catch (erro) {
        if (erro instanceof app.multipartErrors.RequestFileTooLargeError) {
          return responderErro(reply, 413, MENSAGEM_GRANDE);
        }
        throw erro;
      }
      if (bytes.length > LIMITES_CORPO.asset) return responderErro(reply, 413, MENSAGEM_GRANDE);
      // Tipo pelos bytes iniciais, nunca pelo nome nem pelo tipo declarado (ADR-010).
      const mime = detectarTipoImagem(bytes);
      if (!mime) return responderErro(reply, 415, MENSAGEM_TIPO);

      // O id é também a chave do arquivo no Armazenamento (coluna `arquivo`, RF-19).
      const id = randomUUID();
      let gravou = false;
      try {
        await banco.$transaction(async (tx) => {
          await tx.asset.create({ data: { id, donoId, arquivo: id, mime, bytes: bytes.length } });
          gravou = true;
          await armazenamento.gravar(id, new Uint8Array(bytes), mime);
        });
      } catch (erro) {
        if (gravou) await armazenamento.apagar(id).catch(() => undefined);
        throw erro;
      }

      const ref = `asset:${id}` as const;
      const resposta: AssetCriado = { id, ref, url: resolverImagem(ref, PREFIXO_PUBLICO) };
      return reply.code(201).send(resposta);
    },
  );

  app.get<{ Params: { id: string } }>('/assets/:id', async (request, reply) => {
    const { id } = request.params;
    if (!PADRAO_ID.test(id)) return responderErro(reply, 404, MENSAGEM_NAO_ENCONTRADA);
    const registro = await banco.asset.findUnique({ where: { id }, select: { arquivo: true } });
    if (!registro) return responderErro(reply, 404, MENSAGEM_NAO_ENCONTRADA);
    const arquivo = await armazenamento.ler(registro.arquivo);
    if (!arquivo) return responderErro(reply, 404, MENSAGEM_NAO_ENCONTRADA);
    return reply.code(200).type(arquivo.mime).send(Buffer.from(arquivo.bytes));
  });
}
