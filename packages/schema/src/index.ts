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
import { naoImplementado } from './nao-implementado.ts';
import { validarFase as validarFaseImpl } from './validar.ts';

export * from '../contrato/index.ts';

export const validarFase: ValidarFase = validarFaseImpl;
export const validarJogabilidade: ValidarJogabilidade = () => naoImplementado('validarJogabilidade');
export const projetarParaJogo: ProjetarParaJogo = () => naoImplementado('projetarParaJogo');
export const faseInicial: FaseInicial = () => naoImplementado('faseInicial');
export const objetoPadrao: ObjetoPadrao = () => naoImplementado('objetoPadrao');
export const respostaConfere: RespostaConfere = () => naoImplementado('respostaConfere');
export const senhaConfere: SenhaConfere = () => naoImplementado('senhaConfere');
export const resolverImagem: ResolverImagem = () => naoImplementado('resolverImagem');
export const referenciasDeAsset: ReferenciasDeAsset = () => naoImplementado('referenciasDeAsset');
export const validarEnvelope: ValidarEnvelope = () => naoImplementado('validarEnvelope');
