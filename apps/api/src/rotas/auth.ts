/**
 * Rotas de conta (contratos/api.md §Contas; modulos-api.md §2).
 * RF-01 cadastro/login/logout · RF-19 excluir conta · RNF-05 argon2id + cookie HttpOnly ·
 * RNF-06 cadastro só com nome, e-mail e senha (campos extras descartados pelo schema).
 */
import { randomBytes } from 'node:crypto';
import { CorpoCadastro, CorpoExcluirConta, CorpoLogin, type UsuarioCriado } from '@math-scape/schema';
import { argon2id, hash, verify } from 'argon2';
import type { FastifyInstance } from 'fastify';
import { violouUnicidade } from '../banco.ts';
import type { Contexto } from '../contexto.ts';
import { responderCorpoInvalido, responderErro } from '../erros.ts';
import { exigirLogin, idDoUsuario } from '../plugins/exigir-login.ts';

const MENSAGEM_CREDENCIAL = 'E-mail ou senha incorretos.';
const MENSAGEM_EMAIL_EM_USO = 'Este e-mail já está cadastrado.';

/**
 * Hash de referência para e-mail desconhecido: o login gasta o mesmo tempo de argon2
 * exista ou não a conta. Gerado sob demanda a partir de bytes aleatórios (não é senha de ninguém).
 */
let hashDeReferencia: Promise<string> | undefined;
function obterHashDeReferencia(): Promise<string> {
  hashDeReferencia ??= hash(randomBytes(32).toString('hex'), { type: argon2id });
  return hashDeReferencia;
}

/** `verify` lança erro para hash que não é argon2 (usuário de sistema do seed): conta como credencial errada. */
async function senhaConfere(hashGravado: string, senha: string): Promise<boolean> {
  try {
    return await verify(hashGravado, senha);
  } catch {
    return false;
  }
}

export function registrarRotasAuth(app: FastifyInstance, ctx: Contexto): void {
  const { banco, armazenamento, sessoes } = ctx;

  app.post('/auth/cadastro', async (request, reply) => {
    const corpo = CorpoCadastro.safeParse(request.body);
    if (!corpo.success) return responderCorpoInvalido(reply, corpo.error.issues);
    const { nome, senha } = corpo.data;
    const email = corpo.data.email.toLowerCase();

    const existente = await banco.usuario.findUnique({ where: { email }, select: { id: true } });
    if (existente) return responderErro(reply, 409, MENSAGEM_EMAIL_EM_USO);

    const senhaHash = await hash(senha, { type: argon2id });
    try {
      const usuario = await banco.usuario.create({
        data: { nome, email, senhaHash },
        select: { id: true, nome: true, email: true },
      });
      const resposta: UsuarioCriado = usuario;
      return reply.code(201).send(resposta);
    } catch (erro) {
      // Dois cadastros simultâneos com o mesmo e-mail: o índice único decide.
      if (violouUnicidade(erro)) return responderErro(reply, 409, MENSAGEM_EMAIL_EM_USO);
      throw erro;
    }
  });

  app.post('/auth/login', async (request, reply) => {
    const corpo = CorpoLogin.safeParse(request.body);
    if (!corpo.success) return responderCorpoInvalido(reply, corpo.error.issues);
    const email = corpo.data.email.toLowerCase();

    const usuario = await banco.usuario.findUnique({ where: { email }, select: { id: true, senhaHash: true } });
    if (!usuario) {
      await senhaConfere(await obterHashDeReferencia(), corpo.data.senha);
      return responderErro(reply, 401, MENSAGEM_CREDENCIAL);
    }
    if (!(await senhaConfere(usuario.senhaHash, corpo.data.senha))) {
      return responderErro(reply, 401, MENSAGEM_CREDENCIAL);
    }

    await sessoes.criar(reply, usuario.id);
    return reply.code(204).send();
  });

  app.post('/auth/logout', async (request, reply) => {
    await sessoes.encerrar(request, reply);
    return reply.code(204).send();
  });

  app.delete('/auth/conta', { preHandler: exigirLogin }, async (request, reply) => {
    const corpo = CorpoExcluirConta.safeParse(request.body);
    if (!corpo.success) return responderCorpoInvalido(reply, corpo.error.issues);
    // O alvo é sempre o dono da sessão: ids no corpo são ignorados.
    const usuarioId = idDoUsuario(request);

    // `arquivo` é a chave da imagem no Armazenamento (a rota de upload grava com ela).
    const imagens = await banco.asset.findMany({ where: { donoId: usuarioId }, select: { arquivo: true } });
    // CASCADE remove sessões, fases e registros de imagem (contratos/banco.md, RF-19).
    await banco.usuario.delete({ where: { id: usuarioId } });
    for (const imagem of imagens) await armazenamento.apagar(imagem.arquivo);

    sessoes.limparCookie(reply);
    return reply.code(204).send();
  });
}
