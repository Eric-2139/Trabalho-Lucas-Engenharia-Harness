/**
 * Rotas do criador (contratos/api.md §Fases do criador; modulos-api.md §2): exigem sessão (RF-01)
 * e, nas rotas `/fases/:id`, que a fase seja do usuário (ADR-005: outro dono → 404).
 * Implementadas: listar, criar, abrir, salvar, renomear, excluir, duplicar, publicar,
 * exportar e importar (RF-14, ADR-013). Falta (entra com o seu requisito): jogo-teste.
 */
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import {
  CorpoCriarFase,
  CorpoRenomearFase,
  CorpoSalvarFase,
  type Envelope,
  type Fase,
  type FaseDoDono,
  type RecusaPublicacao,
  type ResumoFase,
  faseInicial,
  referenciasDeAsset,
  validarEnvelope,
  validarFase,
  validarJogabilidade,
} from '@math-scape/schema';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { LIMITES_CORPO, type TipoImagem } from '../../contrato/index.ts';
import { type Banco, paraJson } from '../banco.ts';
import type { Contexto } from '../contexto.ts';
import { responderCorpoInvalido, responderErro } from '../erros.ts';
import { bytesDaDataUrl, dataUrlDe, detectarTipoImagem } from '../imagens.ts';
import { criarExigirDono, faseDoPedido } from '../plugins/exigir-dono.ts';
import { exigirLogin, idDoUsuario } from '../plugins/exigir-login.ts';

const MENSAGEM_FORA_DO_SCHEMA = 'O documento da fase não segue o schema.';
const MENSAGEM_ASSET_INVALIDO = 'A fase usa imagem inexistente ou de outro criador.';
const MENSAGEM_REVISAO = 'A fase foi alterada em outro lugar. Recarregue para continuar.';
const MENSAGEM_RECUSA_PUBLICACAO = 'A fase não pode ser publicada: há posições da senha sem enigma.';

const MENSAGEM_ARQUIVO_INVALIDO = 'O arquivo não é uma fase válida do Math Scape.';
const MENSAGEM_IMAGEM_GRANDE = 'Uma imagem do arquivo passa de 5 MB.';
const MENSAGEM_IMAGEM_INVALIDA = 'Uma imagem do arquivo não é PNG, JPG nem WebP.';

interface ImagemImportada {
  id: string;
  bytes: Uint8Array;
  mime: TipoImagem;
}

/** Troca as referências `asset:<antigo>` pelas novas em toda a fase; o resto fica igual (modulos-schema.md §4). */
function trocarReferencias(valor: unknown, trocas: ReadonlyMap<string, string>): unknown {
  if (typeof valor === 'string') return trocas.get(valor) ?? valor;
  if (Array.isArray(valor)) return valor.map((item) => trocarReferencias(item, trocas));
  if (typeof valor === 'object' && valor !== null) {
    return Object.fromEntries(Object.entries(valor).map(([chave, item]) => [chave, trocarReferencias(item, trocas)]));
  }
  return valor;
}

/** Toda referência `asset:` precisa existir e ser do dono da fase (ADR-010). */
async function assetsDoDono(banco: Banco, fase: Fase, donoId: string): Promise<boolean> {
  const uuids = referenciasDeAsset(fase);
  if (uuids.length === 0) return true;
  const encontrados = await banco.asset.count({ where: { id: { in: uuids }, donoId } });
  return encontrados === uuids.length;
}

/** Valida o documento (400 com os erros por campo) e as imagens do dono (400). Devolve a fase ou null se já respondeu. */
async function documentoAceito(
  banco: Banco,
  reply: FastifyReply,
  documento: unknown,
  donoId: string,
): Promise<Fase | null> {
  const resultado = validarFase(documento);
  if (!resultado.ok) {
    responderErro(reply, 400, MENSAGEM_FORA_DO_SCHEMA, resultado.erros);
    return null;
  }
  if (!(await assetsDoDono(banco, resultado.fase, donoId))) {
    responderErro(reply, 400, MENSAGEM_ASSET_INVALIDO);
    return null;
  }
  return resultado.fase;
}

export function registrarRotasFases(app: FastifyInstance, ctx: Contexto): void {
  const { banco, armazenamento } = ctx;
  const exigirDono = criarExigirDono(banco);
  /** Rotas `/fases/:id`: sem sessão → 401; outro dono ou inexistente → 404. */
  const doDono = { preHandler: [exigirLogin, exigirDono] };

  app.get('/fases', { preHandler: exigirLogin }, async (request) => {
    const fases = await banco.fase.findMany({
      where: { donoId: idDoUsuario(request) },
      select: { id: true, titulo: true, publicadaEm: true, atualizadaEm: true },
      orderBy: [{ atualizadaEm: 'desc' }, { id: 'asc' }],
    });
    return fases.map(
      (f): ResumoFase => ({
        id: f.id,
        titulo: f.titulo,
        publicada: f.publicadaEm !== null,
        atualizadaEm: f.atualizadaEm.toISOString(),
      }),
    );
  });

  app.post('/fases', { preHandler: exigirLogin }, async (request, reply) => {
    // Título vazio → 400 antes de montar a fase (modulos-api.md §2).
    const corpo = CorpoCriarFase.safeParse(request.body);
    if (!corpo.success) return responderCorpoInvalido(reply, corpo.error.issues);
    const documento = faseInicial(corpo.data.titulo);
    const fase = await banco.fase.create({
      data: { donoId: idDoUsuario(request), titulo: documento.titulo, documento: paraJson(documento), revisao: 0 },
      select: { id: true, revisao: true },
    });
    return reply.code(201).send({ id: fase.id, revisao: fase.revisao, documento });
  });

  app.get('/fases/:id', doDono, async (request) => {
    const fase = faseDoPedido(request);
    const publicada = fase.publicadaEm !== null;
    const resposta: FaseDoDono = {
      id: fase.id,
      revisao: fase.revisao,
      documento: fase.documento,
      publicada,
      // Compara o rascunho com a versão publicada (ADR-002, LAC-018); sem publicada, não há o que comparar.
      alteracoesNaoPublicadas: publicada && !isDeepStrictEqual(fase.documento, fase.documentoPublicado),
    };
    return resposta;
  });

  app.put('/fases/:id', doDono, async (request, reply) => {
    const fase = faseDoPedido(request);
    // Ordem do contrato: corpo/schema (400) → imagens (400) → revisão (409).
    const corpo = CorpoSalvarFase.safeParse(request.body);
    if (!corpo.success) return responderCorpoInvalido(reply, corpo.error.issues);
    const documento = await documentoAceito(banco, reply, corpo.data.documento, fase.donoId);
    if (!documento) return reply;

    // Concorrência otimista: só grava se a revisão ainda é a enviada (ADR-002).
    const { count } = await banco.fase.updateMany({
      where: { id: fase.id, revisao: corpo.data.revisao },
      data: { documento: paraJson(documento), titulo: documento.titulo, revisao: { increment: 1 } },
    });
    if (count === 0) return responderErro(reply, 409, MENSAGEM_REVISAO);
    return { revisao: corpo.data.revisao + 1 };
  });

  app.patch('/fases/:id', doDono, async (request, reply) => {
    const fase = faseDoPedido(request);
    const corpo = CorpoRenomearFase.safeParse(request.body);
    if (!corpo.success) return responderCorpoInvalido(reply, corpo.error.issues);
    const { titulo } = corpo.data;
    // Renomear altera `documento.titulo` e a coluna; não toca na versão publicada (ADR-002).
    const documento = { ...(fase.documento as Record<string, unknown>), titulo };
    const atualizada = await banco.fase.update({
      where: { id: fase.id },
      data: { documento: paraJson(documento), titulo, revisao: { increment: 1 } },
      select: { revisao: true },
    });
    return { revisao: atualizada.revisao };
  });

  app.delete('/fases/:id', doDono, async (request, reply) => {
    const fase = faseDoPedido(request);
    // Exclusão física, sem lixeira (ADR-002): sai também de Escolher Fase se estava publicada.
    await banco.fase.deleteMany({ where: { id: fase.id, donoId: fase.donoId } });
    return reply.code(204).send();
  });

  app.post('/fases/:id/duplicar', doDono, async (request, reply) => {
    const fase = faseDoPedido(request);
    // Copia a versão em edição (não a publicada) para uma fase nova, não publicada, do mesmo dono.
    const copia = await banco.fase.create({
      data: { donoId: fase.donoId, titulo: fase.titulo, documento: paraJson(fase.documento), revisao: 0 },
      select: { id: true },
    });
    return reply.code(201).send({ id: copia.id });
  });

  app.post('/fases/:id/publicar', doDono, async (request, reply) => {
    const fase = faseDoPedido(request);
    const documento = await documentoAceito(banco, reply, fase.documento, fase.donoId);
    if (!documento) return reply;
    const { posicoesSemEnigma } = validarJogabilidade(documento);
    if (posicoesSemEnigma.length > 0) {
      const recusa: RecusaPublicacao = { erro: MENSAGEM_RECUSA_PUBLICACAO, posicoesSemEnigma };
      return reply.code(422).send(recusa);
    }
    const publicada = await banco.fase.update({
      where: { id: fase.id },
      data: { documentoPublicado: paraJson(documento), publicadaEm: new Date() },
      select: { publicadaEm: true },
    });
    return { publicadaEm: publicada.publicadaEm?.toISOString() };
  });

  app.get('/fases/:id/exportar', doDono, async (request, reply) => {
    const fase = faseDoPedido(request);
    // Versão em edição (não a publicada), com as imagens próprias embutidas (ADR-013).
    const resultado = validarFase(fase.documento);
    if (!resultado.ok) return responderErro(reply, 400, MENSAGEM_FORA_DO_SCHEMA, resultado.erros);
    const documento = resultado.fase;
    const uuids = referenciasDeAsset(documento);
    const registros =
      uuids.length === 0
        ? []
        : await banco.asset.findMany({ where: { id: { in: uuids }, donoId: fase.donoId }, select: { id: true, arquivo: true } });
    const imagens: Record<string, string> = {};
    for (const registro of registros) {
      const arquivo = await armazenamento.ler(registro.arquivo);
      if (!arquivo) throw new Error(`imagem ${registro.id} sem arquivo no armazenamento`);
      imagens[registro.id] = dataUrlDe(arquivo.bytes, arquivo.mime);
    }
    if (Object.keys(imagens).length !== uuids.length) throw new Error('fase com referência a imagem inexistente');
    const resposta: Envelope = { formato: 'math-scape-fase', versao: 1, fase: documento, imagens };
    return resposta;
  });

  app.post(
    '/fases/importar',
    // Corpo até 50 MB (ADR-013): acima disso o Fastify responde 413 antes de ler o JSON.
    { bodyLimit: LIMITES_CORPO.importar, preHandler: exigirLogin },
    async (request, reply) => {
      const donoId = idDoUsuario(request);
      // Ordem: envelope e fase (400) → imagens (413/415) → gravação numa transação.
      const resultado = validarEnvelope(request.body);
      if (!resultado.ok) return responderErro(reply, 400, MENSAGEM_ARQUIVO_INVALIDO, resultado.erros);

      const novas: ImagemImportada[] = [];
      const trocas = new Map<string, string>();
      for (const [uuidAntigo, dataUrl] of Object.entries(resultado.imagens)) {
        const bytes = bytesDaDataUrl(dataUrl);
        if (bytes.length > LIMITES_CORPO.asset) return responderErro(reply, 413, MENSAGEM_IMAGEM_GRANDE);
        const mime = detectarTipoImagem(bytes);
        if (!mime) return responderErro(reply, 415, MENSAGEM_IMAGEM_INVALIDA);
        // O id novo é também a chave do arquivo no Armazenamento (coluna `arquivo`, RF-19).
        const id = randomUUID();
        trocas.set(`asset:${uuidAntigo}`, `asset:${id}`);
        novas.push({ id, bytes, mime });
      }
      const documento = trocarReferencias(resultado.fase, trocas) as Fase;

      // Tudo ou nada (ADR-013): se algo falhar, a transação desfaz o banco e os arquivos gravados são apagados.
      const gravados: string[] = [];
      try {
        const criada = await banco.$transaction(async (tx) => {
          for (const imagem of novas) {
            await tx.asset.create({
              data: { id: imagem.id, donoId, arquivo: imagem.id, mime: imagem.mime, bytes: imagem.bytes.length },
            });
            gravados.push(imagem.id);
            await armazenamento.gravar(imagem.id, imagem.bytes, imagem.mime);
          }
          return tx.fase.create({
            data: { donoId, titulo: documento.titulo, documento: paraJson(documento), revisao: 0 },
            select: { id: true },
          });
        });
        return reply.code(201).send({ id: criada.id });
      } catch (erro) {
        for (const id of gravados) await armazenamento.apagar(id).catch(() => undefined);
        throw erro;
      }
    },
  );
}
