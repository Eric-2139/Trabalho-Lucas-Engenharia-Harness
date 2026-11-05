/**
 * Ponto de entrada de `@math-scape/schema`. Reexporta o contrato e liga cada
 * função à sua implementação, com o tipo do contrato (fase 4, agente 4).
 */
import type {
  FaseInicial,
  ObjetoPadrao,
  ProjetarParaJogo,
  ReferenciasDeAsset,
  ResolverImagem,
  RespostaConfere,
  SenhaConfere,
  ValidarEnvelope,
  ValidarFase,
  ValidarJogabilidade,
} from '../contrato/index.ts';
import {
  respostaConfere as respostaConfereImpl,
  senhaConfere as senhaConfereImpl,
} from './comparacao.ts';
import { validarJogabilidade as validarJogabilidadeImpl } from './jogabilidade.ts';
import { naoImplementado } from './nao-implementado.ts';
import { faseInicial as faseInicialImpl } from './padroes.ts';
import { projetarParaJogo as projetarParaJogoImpl } from './projecao.ts';
import { referenciasDeAsset as referenciasDeAssetImpl, resolverImagem as resolverImagemImpl } from './imagens.ts';
import { validarEnvelope as validarEnvelopeImpl, validarFase as validarFaseImpl } from './validar.ts';

export * from '../contrato/index.ts';

export const validarFase: ValidarFase = validarFaseImpl;
export const validarJogabilidade: ValidarJogabilidade = validarJogabilidadeImpl;
export const projetarParaJogo: ProjetarParaJogo = projetarParaJogoImpl;
export const faseInicial: FaseInicial = faseInicialImpl;
export const objetoPadrao: ObjetoPadrao = () => naoImplementado('objetoPadrao');
export const respostaConfere: RespostaConfere = respostaConfereImpl;
export const senhaConfere: SenhaConfere = senhaConfereImpl;
export const resolverImagem: ResolverImagem = resolverImagemImpl;
export const referenciasDeAsset: ReferenciasDeAsset = referenciasDeAssetImpl;
export const validarEnvelope: ValidarEnvelope = validarEnvelopeImpl;
