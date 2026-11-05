/**
 * Verificar (contratos/api.md §Jogo; modulos-api.md §2 "Verificar"; ADR-003): a conferência é
 * sempre no servidor (RNF-04). A resposta traz só o veredito e os dígitos revelados, nunca a
 * resposta cadastrada nem a senha.
 * - público: lê `documento_publicado`; fase não publicada ou inexistente → 404;
 * - `?modo=teste` (RF-11): lê o `documento` em edição, só para o dono (sem sessão → 401, outro dono → 404).
 * Objeto inexistente, ou que não é enigma nem porta → 404.
 * O limite de tentativas (`plugins/limite-verificar.ts`) entra com o RF-15.
 */
import {
  CorpoVerificar,
  type Fase,
  type Objeto,
  PAREDES,
  type RespostaVerificarEnigma,
  type RespostaVerificarPorta,
  respostaConfere,
  senhaConfere,
} from '@math-scape/schema';
import type { FastifyInstance } from 'fastify';
import type { Contexto } from '../contexto.ts';
import { responderCorpoInvalido, responderErro } from '../erros.ts';
import { faseGuardada } from '../projecao.ts';

const MENSAGEM_FASE_NAO_ENCONTRADA = 'Fase não encontrada.';
const MENSAGEM_OBJETO_NAO_ENCONTRADO = 'Objeto não encontrado.';
const MENSAGEM_LOGIN = 'Faça login para continuar.';
/** A coluna `id` é uuid: qualquer outro formato não existe (e não deve chegar ao banco). */
const PADRAO_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Pedido {
  Params: { id: string };
  Querystring: { modo?: string };
}

function objetoDaFase(fase: Fase, objetoId: string): Objeto | undefined {
  for (const parede of PAREDES) {
    const objeto = fase.paredes[parede].objetos.find((o) => o.id === objetoId);
    if (objeto) return objeto;
  }
  return undefined;
}

export function registrarRotaVerificar(app: FastifyInstance, ctx: Contexto): void {
  const { banco } = ctx;

  app.post<Pedido>('/fases/:id/verificar', async (request, reply) => {
    const { id } = request.params;
    const modoTeste = request.query.modo === 'teste';
    const usuario = request.usuario;
    if (modoTeste && !usuario) return responderErro(reply, 401, MENSAGEM_LOGIN);
    if (!PADRAO_ID.test(id)) return responderErro(reply, 404, MENSAGEM_FASE_NAO_ENCONTRADA);

    let documento: unknown = null;
    if (modoTeste && usuario) {
      // Só o dono testa (ADR-005): outro dono vê 404, como fase inexistente.
      const fase = await banco.fase.findFirst({
        where: { id, donoId: usuario.id },
        select: { documento: true },
      });
      documento = fase?.documento ?? null;
    } else {
      const fase = await banco.fase.findFirst({
        where: { id, publicadaEm: { not: null } },
        select: { documentoPublicado: true },
      });
      documento = fase?.documentoPublicado ?? null;
    }
    if (documento === null) return responderErro(reply, 404, MENSAGEM_FASE_NAO_ENCONTRADA);

    const corpo = CorpoVerificar.safeParse(request.body);
    if (!corpo.success) return responderCorpoInvalido(reply, corpo.error.issues);

    const fase = faseGuardada(documento);
    const objeto = objetoDaFase(fase, corpo.data.objetoId);
    if (objeto?.interacao.tipo === 'enigma') {
      const correto = respostaConfere(corpo.data.resposta, objeto.interacao.respostas);
      const resposta: RespostaVerificarEnigma = {
        correto,
        digitos: correto
          ? objeto.interacao.revela.map((posicao) => ({ posicao, valor: fase.senha.charAt(posicao - 1) }))
          : [],
      };
      return resposta;
    }
    if (objeto?.interacao.tipo === 'porta') {
      const resposta: RespostaVerificarPorta = { aberta: senhaConfere(corpo.data.resposta, fase.senha) };
      return resposta;
    }
    return responderErro(reply, 404, MENSAGEM_OBJETO_NAO_ENCONTRADO);
  });
}
