/**
 * Store do editor (modulos-editor.md §2): Zustand + zundo.
 * ADR-011: toda ação que altera o documento monta o documento novo, chama `validarFase` e só aplica se `ok`.
 * ADR-008: o histórico cobre só `documento` (partialize); trocar de parede ou selecionar não vira passo.
 * LAC-037: recusa = nada muda e nenhum passo de histórico.
 */
import { objetoPadrao, validarFase } from '@math-scape/schema';
import { PAREDES, type ErroValidacao, type Fase, type Objeto, type ParedeId } from '@math-scape/schema/contrato';
import { type TemporalState, temporal } from 'zundo';
import { type StoreApi, createStore } from 'zustand/vanilla';
import type { CriarStoreEditor, EstadoEditor, Geometria, ResultadoAcao } from '../../contrato/store.ts';

/** Parte do estado coberta pelo histórico (ADR-008). */
interface EstadoComHistorico {
  documento: Fase;
}
type StoreComHistorico = StoreApi<EstadoEditor> & { temporal: StoreApi<TemporalState<EstadoComHistorico>> };

const MSG_FRENTE = 'O objeto já está na frente de todos.';
const MSG_TRAS = 'O objeto já está atrás de todos.';
const MSG_SENHA = 'Ajuste os enigmas que revelam posições que deixariam de existir.';
/** Deslocamento da cópia ao duplicar (RF-05), limitado a 1. */
const DESLOCAMENTO_COPIA = 0.02;

const OK: ResultadoAcao = { ok: true };

function recusa(caminho: ErroValidacao['caminho'], mensagem: string): ResultadoAcao {
  return { ok: false, erros: [{ caminho, mensagem }] };
}

function objetoInexistente(id: string): ResultadoAcao {
  return recusa(['objetoId'], `O objeto "${id}" não existe nesta fase.`);
}

function limitar01(valor: number): number {
  return Math.min(1, Math.max(0, valor));
}

function normalizarRotacao(graus: number): number {
  const resto = ((graus % 360) + 360) % 360;
  return resto === 360 ? 0 : resto + 0; // "+ 0" troca -0 por 0
}

/** Parede onde está o objeto, ou null. */
function paredeDe(documento: Fase, objetoId: string): ParedeId | null {
  for (const parede of PAREDES) {
    if (documento.paredes[parede].objetos.some((o) => o.id === objetoId)) return parede;
  }
  return null;
}

function comObjetos(documento: Fase, parede: ParedeId, objetos: Objeto[]): Fase {
  return {
    ...documento,
    paredes: { ...documento.paredes, [parede]: { ...documento.paredes[parede], objetos } },
  };
}

/** Ordem de desenho: camada crescente, empate pela posição na lista. Devolve os índices na lista. */
function ordemVisual(objetos: Objeto[]): number[] {
  return objetos
    .map((o, indice) => ({ camada: o.camada, indice }))
    .sort((a, b) => a.camada - b.camada || a.indice - b.indice)
    .map(({ indice }) => indice);
}

function camadaMaisAlta(objetos: Objeto[]): number {
  return objetos.reduce((maior, o) => Math.max(maior, o.camada), -1);
}

/** ids dos enigmas que revelam alguma posição acima do tamanho dado. */
function enigmasAfetadosPor(documento: Fase, tamanho: number): string[] {
  const afetados: string[] = [];
  for (const parede of PAREDES) {
    for (const o of documento.paredes[parede].objetos) {
      if (o.interacao.tipo === 'enigma' && o.interacao.revela.some((posicao) => posicao > tamanho)) afetados.push(o.id);
    }
  }
  return afetados;
}

export const criarStoreEditor: CriarStoreEditor = (documentoInicial) => {
  const store: StoreComHistorico = createStore<EstadoEditor>()(
    temporal(
      (set, get) => {
        /** ADR-011: valida o documento novo e só aplica se passar; um `set` = um passo de histórico. */
        function aplicar(novo: Fase, extra: Partial<Pick<EstadoEditor, 'selecionado'>> = {}): ResultadoAcao {
          const validacao = validarFase(novo);
          if (!validacao.ok) return { ok: false, erros: validacao.erros };
          set({ documento: novo, ...extra });
          return OK;
        }

        function historico(): TemporalState<EstadoComHistorico> {
          return store.temporal.getState();
        }

        return {
          documento: documentoInicial,
          paredeAtiva: 'frente',
          selecionado: null,

          trocarParede(parede) {
            set({ paredeAtiva: parede });
          },

          selecionar(objetoId) {
            set({ selecionado: objetoId });
          },

          adicionarObjeto(tipo, imagem, id, posicao) {
            const { documento, paredeAtiva } = get();
            const objetos = documento.paredes[paredeAtiva].objetos;
            const novo: Objeto = { ...objetoPadrao(tipo, imagem, id), camada: camadaMaisAlta(objetos) + 1 };
            if (posicao) {
              // LAC-045: centro no ponto solto, limitado para o objeto caber na parede.
              novo.x = Math.min(Math.max(posicao.x - novo.largura / 2, 0), Math.max(0, 1 - novo.largura));
              novo.y = Math.min(Math.max(posicao.y - novo.altura / 2, 0), Math.max(0, 1 - novo.altura));
            }
            return aplicar(comObjetos(documento, paredeAtiva, [...objetos, novo]), { selecionado: id });
          },

          alterarGeometria(objetoId, geometria: Partial<Geometria>) {
            const { documento } = get();
            const parede = paredeDe(documento, objetoId);
            if (!parede) return objetoInexistente(objetoId);
            const objetos = documento.paredes[parede].objetos.map((o) => {
              if (o.id !== objetoId) return o;
              const alterado: Objeto = { ...o };
              if (geometria.x !== undefined) alterado.x = limitar01(geometria.x);
              if (geometria.y !== undefined) alterado.y = limitar01(geometria.y);
              if (geometria.largura !== undefined) alterado.largura = limitar01(geometria.largura);
              if (geometria.altura !== undefined) alterado.altura = limitar01(geometria.altura);
              if (geometria.rotacao !== undefined) alterado.rotacao = normalizarRotacao(geometria.rotacao);
              return alterado;
            });
            return aplicar(comObjetos(documento, parede, objetos));
          },

          mudarCamada(objetoId, direcao) {
            const { documento } = get();
            const parede = paredeDe(documento, objetoId);
            if (!parede) return objetoInexistente(objetoId);
            const atuais = documento.paredes[parede].objetos;
            const ordem = ordemVisual(atuais);
            const posicao = ordem.findIndex((indice) => atuais[indice]?.id === objetoId);
            const vizinho = direcao === 'frente' ? posicao + 1 : posicao - 1;
            if (vizinho >= ordem.length) return recusa(['camada'], MSG_FRENTE);
            if (vizinho < 0) return recusa(['camada'], MSG_TRAS);
            const trocada = [...ordem];
            [trocada[posicao], trocada[vizinho]] = [trocada[vizinho] as number, trocada[posicao] as number];
            const novaCamada = new Map(trocada.map((indice, camada) => [indice, camada]));
            const objetos = atuais.map((o, indice) => ({ ...o, camada: novaCamada.get(indice) ?? o.camada }));
            return aplicar(comObjetos(documento, parede, objetos));
          },

          duplicarObjeto(objetoId, novoId) {
            const { documento } = get();
            const parede = paredeDe(documento, objetoId);
            if (!parede) return objetoInexistente(objetoId);
            const objetos = documento.paredes[parede].objetos;
            const original = objetos.find((o) => o.id === objetoId) as Objeto;
            const copia: Objeto = {
              ...structuredClone(original),
              id: novoId,
              x: Math.min(1, original.x + DESLOCAMENTO_COPIA),
              y: Math.min(1, original.y + DESLOCAMENTO_COPIA),
              camada: camadaMaisAlta(objetos) + 1,
            };
            return aplicar(comObjetos(documento, parede, [...objetos, copia]));
          },

          excluirObjeto(objetoId) {
            const { documento } = get();
            const parede = paredeDe(documento, objetoId);
            if (!parede) return objetoInexistente(objetoId);
            const objetos = documento.paredes[parede].objetos.filter((o) => o.id !== objetoId);
            return aplicar(comObjetos(documento, parede, objetos), { selecionado: null });
          },

          alterarInteracao(objetoId, interacao) {
            const { documento } = get();
            const parede = paredeDe(documento, objetoId);
            if (!parede) return objetoInexistente(objetoId);
            const objetos = documento.paredes[parede].objetos.map((o) => (o.id === objetoId ? { ...o, interacao } : o));
            return aplicar(comObjetos(documento, parede, objetos));
          },

          alterarImagem(objetoId, imagem) {
            const { documento } = get();
            const parede = paredeDe(documento, objetoId);
            if (!parede) return objetoInexistente(objetoId);
            const objetos = documento.paredes[parede].objetos.map((o) => (o.id === objetoId ? { ...o, imagem } : o));
            return aplicar(comObjetos(documento, parede, objetos));
          },

          definirFundo(parede, imagem) {
            const { documento } = get();
            return aplicar({
              ...documento,
              paredes: { ...documento.paredes, [parede]: { ...documento.paredes[parede], fundo: imagem } },
            });
          },

          alterarPropriedadesFase({ titulo, senha }) {
            const { documento } = get();
            if (senha !== undefined && senha.length < documento.senha.length) {
              const afetados = enigmasAfetadosPor(documento, senha.length);
              if (afetados.length > 0) {
                return { ok: false, erros: [{ caminho: ['senha'], mensagem: MSG_SENHA }], enigmasAfetados: afetados };
              }
            }
            return aplicar({
              ...documento,
              ...(titulo !== undefined ? { titulo } : {}),
              ...(senha !== undefined ? { senha } : {}),
            });
          },

          carregar(documento) {
            set({ documento, selecionado: null });
            historico().clear();
          },

          desfazer() {
            historico().undo();
          },

          refazer() {
            historico().redo();
          },

          podeDesfazer() {
            return historico().pastStates.length > 0;
          },

          podeRefazer() {
            return historico().futureStates.length > 0;
          },
        };
      },
      {
        partialize: (estado): EstadoComHistorico => ({ documento: estado.documento }),
        // Só vira passo quando o documento muda (ADR-008).
        equality: (antes, depois) => antes.documento === depois.documento,
      },
    ),
  );
  return store;
};
