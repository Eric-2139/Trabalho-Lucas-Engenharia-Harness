/**
 * Módulo: MotorInteracoes + EstadoPartida (packages/player/contrato/motor.ts, modulos-player.md §1).
 * Requisitos: RF-16 (decoração não reage; fala mostra o texto), RF-17 (dica do enigma),
 * RF-15 na camada Player (acerto revela dígitos, erro não revela nada, porta abre só com a senha).
 * A comparação numérica das respostas é da Api/SchemaFase (tests/schema/comparacao.test.ts):
 * aqui o Verificador é sempre um falso injetado.
 */
import { criarPartida } from '@math-scape/player';
import { MENSAGENS } from '@math-scape/player/contrato';
import { describe, expect, test } from 'vitest';
import {
  DICA_FRENTE,
  FALA_DIREITA,
  FALA_FRENTE,
  PERGUNTA_FRENTE,
  acerto,
  erro,
  faseJogo,
  faseMotor,
  enigmaJogo,
  verificadorFalso,
  verificadorPorFuncao,
} from '../fixtures/fases-jogo.ts';

const estadoInicial = {
  paredeAtiva: 'frente',
  digitosRevelados: {},
  enigmasResolvidos: [],
  concluida: false,
};

describe('RF-16 · clicar', () => {
  // @req RF-16 @tipo feliz
  test('test_RF16_clicar_fala_mostra_o_texto_cadastrado', () => {
    const { verificador } = verificadorFalso({});
    const partida = criarPartida(faseMotor(), verificador);
    expect(partida.clicar('fala-frente')).toEqual({ tipo: 'fala', texto: FALA_FRENTE });
  });

  // @req RF-16 @tipo feliz
  test('test_RF16_clicar_fala_de_outra_parede_depois_de_trocar_mostra_o_texto', () => {
    const { verificador } = verificadorFalso({});
    const partida = criarPartida(faseMotor(), verificador);
    partida.trocarParede('direita');
    expect(partida.clicar('fala-direita')).toEqual({ tipo: 'fala', texto: FALA_DIREITA });
  });

  // @req RF-16 @tipo negativo
  test('test_RF16_clicar_decoracao_nao_gera_evento_nem_muda_o_estado', () => {
    const { verificador, enigma, porta } = verificadorFalso({});
    const partida = criarPartida(faseMotor(), verificador);
    const antes = structuredClone(partida.estado());
    expect(partida.clicar('decoracao-frente')).toEqual({ tipo: 'nenhum' });
    expect(partida.estado()).toEqual(antes);
    expect(enigma).not.toHaveBeenCalled();
    expect(porta).not.toHaveBeenCalled();
  });

  // @req RF-16 @tipo negativo
  test('test_RF16_clicar_objeto_inexistente_devolve_nenhum', () => {
    const { verificador } = verificadorFalso({});
    const partida = criarPartida(faseMotor(), verificador);
    expect(partida.clicar('objeto-que-nao-existe')).toEqual({ tipo: 'nenhum' });
    expect(partida.estado()).toEqual(estadoInicial);
  });

  // @req RF-16 @tipo borda
  test('test_RF16_clicar_fala_de_outra_parede_que_nao_a_ativa_devolve_nenhum', () => {
    const { verificador } = verificadorFalso({});
    const partida = criarPartida(faseMotor(), verificador);
    // A partida começa na frente; fala-direita está na direita.
    expect(partida.clicar('fala-direita')).toEqual({ tipo: 'nenhum' });
  });

  // @req RF-16 @tipo borda
  test('test_RF16_decoracao_continua_sem_reacao_em_outra_parede', () => {
    const { verificador } = verificadorFalso({});
    const partida = criarPartida(faseMotor(), verificador);
    partida.trocarParede('direita');
    const antes = structuredClone(partida.estado());
    expect(partida.clicar('decoracao-direita')).toEqual({ tipo: 'nenhum' });
    expect(partida.estado()).toEqual(antes);
  });

  // @req RF-16 @tipo borda
  test('test_RF16_so_objeto_fala_gera_fala_enigma_pede_resposta_e_porta_pede_senha', () => {
    const { verificador } = verificadorFalso({});
    const partida = criarPartida(faseMotor(), verificador);
    expect(partida.clicar('enigma-frente')).toEqual({
      tipo: 'pedirResposta',
      objetoId: 'enigma-frente',
      pergunta: PERGUNTA_FRENTE,
    });
    expect(partida.clicar('porta-1')).toEqual({ tipo: 'pedirSenha', objetoId: 'porta-1', tamanhoSenha: 5 });
  });
});

describe('RF-17 · dica', () => {
  // @req RF-17 @tipo feliz
  test('test_RF17_enigma_com_dica_devolve_a_dica_cadastrada', () => {
    const { verificador } = verificadorFalso({});
    const partida = criarPartida(faseMotor(), verificador);
    expect(partida.dica('enigma-frente')).toBe(DICA_FRENTE);
  });

  // @req RF-17 @tipo negativo
  test('test_RF17_enigma_sem_dica_devolve_null_sem_icone', () => {
    const { verificador } = verificadorFalso({});
    const partida = criarPartida(faseMotor(), verificador);
    expect(partida.dica('enigma-sem-dica')).toBeNull();
  });

  // @req RF-17 @tipo negativo
  test('test_RF17_objeto_que_nao_e_enigma_nao_tem_dica', () => {
    const { verificador } = verificadorFalso({});
    const partida = criarPartida(faseMotor(), verificador);
    expect(partida.dica('decoracao-frente')).toBeNull();
    expect(partida.dica('fala-frente')).toBeNull();
    expect(partida.dica('porta-1')).toBeNull();
  });

  // @req RF-17 @tipo borda
  test('test_RF17_cada_enigma_mostra_a_propria_dica_na_mesma_parede', () => {
    const dicaA = 'Comece pelos parênteses.';
    const dicaB = 'x'.repeat(1000); // dica no limite de 1000 caracteres do schema
    const fase = faseJogo({
      frente: [enigmaJogo('enigma-a', 'Quanto é (2 + 3) x 4?', dicaA), enigmaJogo('enigma-b', 'Quanto é 1 + 1?', dicaB)],
    });
    const { verificador } = verificadorFalso({});
    const partida = criarPartida(fase, verificador);
    expect(partida.dica('enigma-a')).toBe(dicaA);
    expect(partida.dica('enigma-b')).toBe(dicaB);
  });

  // @req RF-17 @tipo borda
  test('test_RF17_dica_continua_disponivel_depois_de_resolver_o_enigma', async () => {
    const { verificador } = verificadorFalso({ enigma: acerto({ posicao: 1, valor: '6' }) });
    const partida = criarPartida(faseMotor(), verificador);
    await partida.responder('enigma-frente', '60');
    expect(partida.dica('enigma-frente')).toBe(DICA_FRENTE);
  });
});

describe('RF-15 · estado inicial e responder enigma', () => {
  // @req RF-15 @tipo borda
  test('test_RF15_partida_comeca_na_frente_sem_digitos_e_nao_concluida', () => {
    const { verificador } = verificadorFalso({});
    const partida = criarPartida(faseMotor(), verificador);
    expect(partida.estado()).toEqual(estadoInicial);
  });

  // @req RF-15 @tipo feliz
  test('test_RF15_acerto_grava_digitos_por_posicao_e_resolve_o_enigma', async () => {
    const digitos = [
      { posicao: 2, valor: '4' },
      { posicao: 1, valor: '7' },
    ];
    const { verificador, enigma } = verificadorFalso({ enigma: acerto(...digitos) });
    const partida = criarPartida(faseMotor(), verificador);

    const resultado = await partida.responder('enigma-frente', '60');

    expect(enigma).toHaveBeenCalledTimes(1);
    expect(enigma.mock.calls[0]?.[0]).toBe('enigma-frente');
    expect(resultado).toEqual({ tipo: 'correto', digitos, mensagem: MENSAGENS.respostaCorreta(digitos) });
    expect(partida.estado().digitosRevelados).toEqual({ 1: '7', 2: '4' });
    expect(partida.estado().enigmasResolvidos).toEqual(['enigma-frente']);
    expect(partida.estado().concluida).toBe(false);
  });

  // @req RF-15 @tipo feliz
  test('test_RF15_enigma_com_respostas_A_e_B_resolve_com_qualquer_uma_aceita_pelo_verificador', async () => {
    // A Api aceita "-15" e "80" (respostas cadastradas A e B); o motor só repassa o veredito.
    const { verificador } = verificadorPorFuncao((_id, resposta) =>
      resposta === '-15' || resposta === '80' ? acerto({ posicao: 3, valor: '9' }) : erro(),
    );
    const comA = criarPartida(faseMotor(), verificador);
    expect((await comA.responder('enigma-frente', '-15')).tipo).toBe('correto');
    expect(comA.estado().digitosRevelados).toEqual({ 3: '9' });

    const comB = criarPartida(faseMotor(), verificador);
    expect((await comB.responder('enigma-frente', '80')).tipo).toBe('correto');
    expect(comB.estado().digitosRevelados).toEqual({ 3: '9' });
  });

  // @req RF-15 @tipo borda
  test('test_RF15_acerto_sem_digitos_resolve_o_enigma_com_resposta_correta', async () => {
    const { verificador } = verificadorFalso({ enigma: acerto() });
    const partida = criarPartida(faseMotor(), verificador);

    const resultado = await partida.responder('enigma-frente', '15');

    expect(resultado).toEqual({ tipo: 'correto', digitos: [], mensagem: 'Resposta correta!' });
    expect(partida.estado().digitosRevelados).toEqual({});
    expect(partida.estado().enigmasResolvidos).toEqual(['enigma-frente']);
  });

  // @req RF-15 @tipo borda
  test('test_RF15_repetir_o_acerto_repete_a_mensagem_sem_mudar_o_estado', async () => {
    const digitos = [{ posicao: 4, valor: '3' }];
    const { verificador } = verificadorFalso({ enigma: acerto(...digitos) });
    const partida = criarPartida(faseMotor(), verificador);
    await partida.responder('enigma-frente', '60');
    const depoisDoPrimeiro = structuredClone(partida.estado());

    const segundo = await partida.responder('enigma-frente', '60');

    expect(segundo).toEqual({ tipo: 'correto', digitos, mensagem: MENSAGENS.respostaCorreta(digitos) });
    expect(partida.estado()).toEqual(depoisDoPrimeiro);
  });

  // @req RF-15 @tipo borda
  test('test_RF15_errar_depois_de_acertar_nao_apaga_digitos_revelados', async () => {
    const { verificador } = verificadorPorFuncao((_id, resposta) =>
      resposta === '60' ? acerto({ posicao: 1, valor: '5' }) : erro(),
    );
    const partida = criarPartida(faseMotor(), verificador);
    await partida.responder('enigma-frente', '60');
    const depoisDoAcerto = structuredClone(partida.estado());

    const resultado = await partida.responder('enigma-frente', '61');

    expect(resultado).toEqual({ tipo: 'errado', mensagem: MENSAGENS.respostaErrada });
    expect(partida.estado()).toEqual(depoisDoAcerto);
  });

  // @req RF-15 @tipo negativo
  test('test_RF15_resposta_errada_mostra_mensagem_e_nao_revela_nada', async () => {
    const { verificador } = verificadorFalso({ enigma: erro() });
    const partida = criarPartida(faseMotor(), verificador);

    const resultado = await partida.responder('enigma-frente', 'oitenta');

    expect(resultado).toEqual({ tipo: 'errado', mensagem: 'Resposta Errada!!' });
    expect(partida.estado()).toEqual(estadoInicial);
  });

  // @req RF-15 @tipo feliz
  test('test_RF15_acerto_avisa_os_assinantes_uma_vez_com_o_novo_estado', async () => {
    const { verificador } = verificadorFalso({ enigma: acerto({ posicao: 2, valor: '8' }) });
    const partida = criarPartida(faseMotor(), verificador);
    const recebidos: unknown[] = [];
    partida.assinar((estado) => recebidos.push(structuredClone(estado)));

    await partida.responder('enigma-frente', '60');

    expect(recebidos).toHaveLength(1);
    expect(recebidos[0]).toMatchObject({ digitosRevelados: { 2: '8' }, enigmasResolvidos: ['enigma-frente'] });
  });

  // @req RF-15 @tipo borda
  test('test_RF15_limitado_mostra_aguarde_sem_contar_erro_nem_revelar', async () => {
    const { verificador } = verificadorFalso({ enigma: { limitado: true, tentarEmSegundos: 42 } });
    const partida = criarPartida(faseMotor(), verificador);

    const resultado = await partida.responder('enigma-frente', '60');

    expect(resultado).toEqual({ tipo: 'limitado', tentarEmSegundos: 42, mensagem: MENSAGENS.limitado(42) });
    expect(resultado).toEqual(expect.objectContaining({ mensagem: 'Muitas tentativas, aguarde 42 s' }));
    expect(partida.estado()).toEqual(estadoInicial);
  });

  // @req RF-15 @tipo negativo
  test('test_RF15_verificador_que_rejeita_vira_falha_de_rede_sem_rejeitar_a_promessa', async () => {
    const { verificador } = verificadorFalso({ enigma: new Error('rede caiu') });
    const partida = criarPartida(faseMotor(), verificador);

    await expect(partida.responder('enigma-frente', '60')).resolves.toEqual({
      tipo: 'falha',
      mensagem: MENSAGENS.falhaDeRede,
    });
    expect(partida.estado()).toEqual(estadoInicial);
  });

  // @req RF-15 @tipo negativo
  test('test_RF15_responder_decoracao_ou_fala_vira_falha_sem_chamar_o_verificador', async () => {
    const { verificador, enigma, porta } = verificadorFalso({ enigma: acerto({ posicao: 1, valor: '1' }) });
    const partida = criarPartida(faseMotor(), verificador);

    await expect(partida.responder('decoracao-frente', '60')).resolves.toEqual({
      tipo: 'falha',
      mensagem: MENSAGENS.semPergunta,
    });
    await expect(partida.responder('fala-frente', '60')).resolves.toEqual({
      tipo: 'falha',
      mensagem: MENSAGENS.semPergunta,
    });
    expect(enigma).not.toHaveBeenCalled();
    expect(porta).not.toHaveBeenCalled();
    expect(partida.estado()).toEqual(estadoInicial);
  });

  // @req RF-15 @tipo negativo
  test('test_RF15_responder_enigma_fora_da_parede_ativa_vira_falha_sem_revelar', async () => {
    const { verificador, enigma } = verificadorFalso({ enigma: acerto({ posicao: 1, valor: '1' }) });
    const partida = criarPartida(faseMotor(), verificador);

    // enigma-direita está na direita; a parede ativa é a frente.
    await expect(partida.responder('enigma-direita', '63')).resolves.toEqual({
      tipo: 'falha',
      mensagem: MENSAGENS.semPergunta,
    });
    expect(enigma).not.toHaveBeenCalled();
    expect(partida.estado()).toEqual(estadoInicial);
  });
});

describe('RF-15 · responder porta', () => {
  // @req RF-15 @tipo feliz
  test('test_RF15_porta_aberta_conclui_a_partida', async () => {
    const { verificador, porta } = verificadorFalso({ porta: { aberta: true } });
    const partida = criarPartida(faseMotor(), verificador);

    const resultado = await partida.responder('porta-1', '56781');

    expect(porta).toHaveBeenCalledTimes(1);
    expect(porta.mock.calls[0]?.[0]).toBe('porta-1');
    expect(resultado).toEqual({ tipo: 'aberta' });
    expect(partida.estado().concluida).toBe(true);
  });

  // @req RF-15 @tipo borda
  test('test_RF15_porta_abre_sem_exigir_enigmas_resolvidos_antes', async () => {
    const { verificador, enigma } = verificadorFalso({ porta: { aberta: true } });
    const partida = criarPartida(faseMotor(), verificador);

    expect(await partida.responder('porta-1', '56781')).toEqual({ tipo: 'aberta' });
    expect(enigma).not.toHaveBeenCalled();
    expect(partida.estado().concluida).toBe(true);
  });

  // @req RF-15 @tipo negativo
  test('test_RF15_senha_errada_mostra_senha_incorreta_e_nao_conclui', async () => {
    const { verificador } = verificadorFalso({ porta: { aberta: false } });
    const partida = criarPartida(faseMotor(), verificador);

    const resultado = await partida.responder('porta-1', '5678');

    expect(resultado).toEqual({ tipo: 'senhaIncorreta', mensagem: 'Senha incorreta!' });
    expect(partida.estado()).toEqual(estadoInicial);
  });

  // @req RF-15 @tipo borda
  test('test_RF15_porta_limitada_mostra_aguarde_e_nao_conclui', async () => {
    const { verificador } = verificadorFalso({ porta: { limitado: true, tentarEmSegundos: 600 } });
    const partida = criarPartida(faseMotor(), verificador);

    const resultado = await partida.responder('porta-1', '56781');

    expect(resultado).toEqual({ tipo: 'limitado', tentarEmSegundos: 600, mensagem: MENSAGENS.limitado(600) });
    expect(partida.estado()).toEqual(estadoInicial);
  });

  // @req RF-15 @tipo negativo
  test('test_RF15_porta_com_verificador_que_rejeita_vira_falha_de_rede_e_nao_conclui', async () => {
    const { verificador } = verificadorFalso({ porta: new Error('sem conexão') });
    const partida = criarPartida(faseMotor(), verificador);

    await expect(partida.responder('porta-1', '56781')).resolves.toEqual({
      tipo: 'falha',
      mensagem: MENSAGENS.falhaDeRede,
    });
    expect(partida.estado().concluida).toBe(false);
  });
});
