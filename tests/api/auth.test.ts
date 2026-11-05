/**
 * Módulo: Rotas de conta e sessão da Api (contratos/api.md §Contas; modulos-api.md §1 e §2;
 * contratos/banco.md; ADR-004, ADR-017).
 * Requisitos: RF-01 (cadastro, login, login só para criar), RF-19 (excluir a própria conta),
 * RNF-05 (hash argon2 + cookie HttpOnly), RNF-06 (cadastro só com nome, e-mail e senha).
 *
 * Integração: `construirApp` + `app.inject` contra o PostgreSQL do contêiner (ADR-016);
 * banco limpo antes de cada caso; armazenamento de imagens em memória.
 * Dados sintéticos: e-mails em `@exemplo.test`, senhas fixas, nenhum dado real.
 */
import { construirApp } from '@math-scape/api';
import { NOME_COOKIE_SESSAO } from '@math-scape/api/contrato';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { type ArmazenamentoMemoria, criarArmazenamentoMemoria } from '../support/armazenamento-memoria.ts';
import { limparBanco, urlBancoDeTeste } from '../support/banco.ts';
import { consultar, contar } from '../support/consulta.ts';

type App = Awaited<ReturnType<typeof construirApp>>;
type Resposta = Awaited<ReturnType<App['inject']>>;

const PESSOA_A = { nome: 'Pessoa Sintética A', email: 'pessoa.a@exemplo.test', senha: 'senha-sintetica-a-01' };
const PESSOA_B = { nome: 'Pessoa Sintética B', email: 'pessoa.b@exemplo.test', senha: 'senha-sintetica-b-02' };

/** PNG mínimo: assinatura `89 50 4E 47 0D 0A 1A 0A` + bytes fixos (ADR-010: tipo pelos bytes iniciais). */
const BYTES_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52]);
const FRONTEIRA = '----fronteira-sintetica-0001';

let app: App;
let armazenamento: ArmazenamentoMemoria;

beforeEach(async () => {
  await limparBanco();
  armazenamento = criarArmazenamentoMemoria();
  app = await construirApp({ urlBanco: urlBancoDeTeste(), armazenamento });
});

afterEach(async () => {
  await app?.close();
});

// ----- apoio -----

function cadastrar(dados: Record<string, unknown>, alvo: App = app): Promise<Resposta> {
  return alvo.inject({ method: 'POST', url: '/auth/cadastro', payload: dados });
}

function logar(email: string, senha: string, alvo: App = app): Promise<Resposta> {
  return alvo.inject({ method: 'POST', url: '/auth/login', payload: { email, senha } });
}

/** Linhas `Set-Cookie` da resposta, sempre como lista. */
function linhasSetCookie(res: Resposta): string[] {
  const valor = res.headers['set-cookie'];
  if (valor === undefined) return [];
  return Array.isArray(valor) ? valor.map(String) : [String(valor)];
}

/** Linha `Set-Cookie` do cookie de sessão (`sid`), se houver. */
function setCookieSessao(res: Resposta): string | undefined {
  return linhasSetCookie(res).find((linha) => linha.trim().startsWith(`${NOME_COOKIE_SESSAO}=`));
}

/** Valor e atributos (nomes em minúsculas) de uma linha `Set-Cookie`. */
function analisarCookie(linha: string): { valor: string; atributos: Map<string, string> } {
  const [par = '', ...resto] = linha.split(';');
  const valor = par.slice(par.indexOf('=') + 1).trim();
  const atributos = new Map<string, string>();
  for (const parte of resto) {
    const igual = parte.indexOf('=');
    const nome = (igual === -1 ? parte : parte.slice(0, igual)).trim().toLowerCase();
    const conteudo = igual === -1 ? '' : parte.slice(igual + 1).trim();
    if (nome) atributos.set(nome, conteudo);
  }
  return { valor, atributos };
}

/** Cookie limpo: valor vazio, `Max-Age=0` ou `Expires` no passado distante. */
function cookieFoiLimpo(linha: string): boolean {
  const { valor, atributos } = analisarCookie(linha);
  if (valor === '') return true;
  if (atributos.get('max-age') === '0') return true;
  const expira = atributos.get('expires');
  return expira !== undefined && Date.parse(expira) < Date.parse('2000-01-01T00:00:00Z');
}

/** Cadastra e faz login; devolve o valor do cookie `sid`. */
async function entrar(pessoa: { nome: string; email: string; senha: string }, alvo: App = app): Promise<string> {
  const cadastro = await cadastrar(pessoa, alvo);
  expect(cadastro.statusCode).toBe(201);
  const login = await logar(pessoa.email, pessoa.senha, alvo);
  expect(login.statusCode).toBe(204);
  const linha = setCookieSessao(login);
  expect(linha).toBeDefined();
  return analisarCookie(linha ?? '').valor;
}

function comSessao(sid: string) {
  return { [NOME_COOKIE_SESSAO]: sid };
}

function criarFase(sid: string, titulo: string): Promise<Resposta> {
  return app.inject({ method: 'POST', url: '/fases', cookies: comSessao(sid), payload: { titulo } });
}

function enviarImagem(sid: string): Promise<Resposta> {
  const corpo = Buffer.concat([
    Buffer.from(
      `--${FRONTEIRA}\r\nContent-Disposition: form-data; name="arquivo"; filename="imagem-sintetica.png"\r\nContent-Type: image/png\r\n\r\n`,
    ),
    BYTES_PNG,
    Buffer.from(`\r\n--${FRONTEIRA}--\r\n`),
  ]);
  return app.inject({
    method: 'POST',
    url: '/assets',
    cookies: comSessao(sid),
    headers: { 'content-type': `multipart/form-data; boundary=${FRONTEIRA}` },
    payload: corpo,
  });
}

function excluirConta(sid: string | undefined, corpo?: unknown): Promise<Resposta> {
  return app.inject({
    method: 'DELETE',
    url: '/auth/conta',
    ...(sid === undefined ? {} : { cookies: comSessao(sid) }),
    ...(corpo === undefined ? {} : { payload: corpo as Record<string, unknown> }),
  });
}

async function linhaUsuario(email: string): Promise<Record<string, unknown> | undefined> {
  const linhas = await consultar('SELECT * FROM usuarios WHERE email = $1', [email]);
  return linhas[0];
}

// =====================================================================
// RF-01 · cadastro, login; login só para criar, jogar não exige login
// =====================================================================
describe('RF-01 · cadastro, login e acesso', () => {
  // @req RF-01 @tipo feliz
  test('test_RF01_visitante_cadastrado_com_nome_email_e_senha_consegue_fazer_login', async () => {
    const cadastro = await cadastrar(PESSOA_A);
    expect(cadastro.statusCode).toBe(201);
    const criado = cadastro.json() as { id: string; nome: string; email: string };
    expect(criado.nome).toBe(PESSOA_A.nome);
    expect(criado.email).toBe(PESSOA_A.email);
    expect(typeof criado.id).toBe('string');

    const login = await logar(PESSOA_A.email, PESSOA_A.senha);
    expect(login.statusCode).toBe(204);
    expect(setCookieSessao(login)).toBeDefined();
  });

  // @req RF-01 @tipo feliz
  test('test_RF01_com_login_a_rota_do_criador_responde', async () => {
    const sid = await entrar(PESSOA_A);
    const lista = await app.inject({ method: 'GET', url: '/fases', cookies: comSessao(sid) });
    expect(lista.statusCode).toBe(200);
    expect(lista.json()).toEqual([]);

    const criada = await criarFase(sid, 'Fase sintética do criador');
    expect(criada.statusCode).toBe(201);
  });

  // @req RF-01 @tipo feliz
  test('test_RF01_sem_login_a_lista_de_fases_publicadas_responde_200', async () => {
    const res = await app.inject({ method: 'GET', url: '/publicadas' });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
  });

  // @req RF-01 @tipo negativo
  test('test_RF01_sem_login_as_rotas_do_criador_respondem_401', async () => {
    const listar = await app.inject({ method: 'GET', url: '/fases' });
    expect(listar.statusCode).toBe(401);
    const criar = await app.inject({ method: 'POST', url: '/fases', payload: { titulo: 'Fase sem dono' } });
    expect(criar.statusCode).toBe(401);
    expect(await contar('fases')).toBe(0);
  });

  // @req RF-01 @tipo negativo
  test('test_RF01_cookie_de_sessao_forjado_responde_401_na_rota_do_criador', async () => {
    await entrar(PESSOA_A);
    const res = await app.inject({
      method: 'GET',
      url: '/fases',
      cookies: comSessao('token-sintetico-que-nao-existe-0000000000000000'),
    });
    expect(res.statusCode).toBe(401);
  });

  // @req RF-01 @tipo negativo
  test('test_RF01_senha_errada_e_email_desconhecido_dao_401_sem_dizer_qual_campo_errou', async () => {
    await cadastrar(PESSOA_A);
    const senhaErrada = await logar(PESSOA_A.email, 'senha-sintetica-errada');
    const emailDesconhecido = await logar('ninguem@exemplo.test', PESSOA_A.senha);

    expect(senhaErrada.statusCode).toBe(401);
    expect(emailDesconhecido.statusCode).toBe(401);
    expect(setCookieSessao(senhaErrada)).toBeUndefined();
    expect(setCookieSessao(emailDesconhecido)).toBeUndefined();
    // Mesma resposta nos dois casos: quem tenta não descobre se o e-mail existe.
    expect(senhaErrada.json()).toEqual(emailDesconhecido.json());
    expect(await contar('sessoes')).toBe(0);
  });

  // @req RF-01 @tipo negativo
  test('test_RF01_cadastro_sem_email_ou_com_email_invalido_responde_400', async () => {
    const semEmail = await cadastrar({ nome: PESSOA_A.nome, senha: PESSOA_A.senha });
    expect(semEmail.statusCode).toBe(400);
    const emailInvalido = await cadastrar({ ...PESSOA_A, email: 'nao-e-um-email' });
    expect(emailInvalido.statusCode).toBe(400);
    expect(await contar('usuarios')).toBe(0);
  });

  // @req RF-01 @tipo borda
  test('test_RF01_email_e_gravado_e_comparado_em_minusculas_no_login', async () => {
    const cadastro = await cadastrar({ ...PESSOA_A, email: 'Pessoa.A@Exemplo.TEST' });
    expect(cadastro.statusCode).toBe(201);
    expect(await linhaUsuario('pessoa.a@exemplo.test')).toBeDefined();

    const minusculas = await logar('pessoa.a@exemplo.test', PESSOA_A.senha);
    expect(minusculas.statusCode).toBe(204);
    const maiusculas = await logar('PESSOA.A@EXEMPLO.TEST', PESSOA_A.senha);
    expect(maiusculas.statusCode).toBe(204);
  });

  // @req RF-01 @tipo borda
  test('test_RF01_email_ja_em_uso_mesmo_com_outra_caixa_responde_409', async () => {
    expect((await cadastrar(PESSOA_A)).statusCode).toBe(201);
    const repetido = await cadastrar({ ...PESSOA_B, email: PESSOA_A.email });
    expect(repetido.statusCode).toBe(409);
    const outraCaixa = await cadastrar({ ...PESSOA_B, email: PESSOA_A.email.toUpperCase() });
    expect(outraCaixa.statusCode).toBe(409);
    expect(await contar('usuarios')).toBe(1);
  });

  // @req RF-01 @tipo borda
  test('test_RF01_logout_invalida_a_sessao_no_servidor', async () => {
    const sid = await entrar(PESSOA_A);
    const sair = await app.inject({ method: 'POST', url: '/auth/logout', cookies: comSessao(sid) });
    expect(sair.statusCode).toBe(204);
    expect(await contar('sessoes')).toBe(0);

    // O mesmo cookie, reenviado depois do logout, não abre mais a rota do criador.
    const depois = await app.inject({ method: 'GET', url: '/fases', cookies: comSessao(sid) });
    expect(depois.statusCode).toBe(401);
  });

  // @req RF-01 @tipo borda
  test('test_RF01_usuario_com_hash_que_nao_e_argon2_recebe_401_e_nao_500', async () => {
    // Como o usuário de sistema do seed: senha_hash que não corresponde a nenhuma senha.
    await consultar(
      'INSERT INTO usuarios (id, nome, email, senha_hash, criado_em) VALUES ($1, $2, $3, $4, $5)',
      ['00000000-0000-4000-8000-000000000001', 'Sistema Sintético', 'sistema@exemplo.test', '!desativado', '2026-01-01T00:00:00Z'],
    );
    const res = await logar('sistema@exemplo.test', '!desativado');
    expect(res.statusCode).toBe(401);
    expect(setCookieSessao(res)).toBeUndefined();
  });
});

// =====================================================================
// RNF-05 · hash argon2 e cookie de sessão HttpOnly
// =====================================================================
describe('RNF-05 · hash da senha e cookie da sessão', () => {
  // @req RNF-05 @tipo feliz
  test('test_RNF05_senha_e_gravada_como_hash_argon2id', async () => {
    await cadastrar(PESSOA_A);
    const linha = await linhaUsuario(PESSOA_A.email);
    const hash = String(linha?.senha_hash);
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(hash).not.toContain(PESSOA_A.senha);
  });

  // @req RNF-05 @tipo feliz
  test('test_RNF05_login_responde_com_cookie_sid_httponly', async () => {
    await cadastrar(PESSOA_A);
    const login = await logar(PESSOA_A.email, PESSOA_A.senha);
    expect(login.statusCode).toBe(204);
    const linha = setCookieSessao(login);
    expect(linha).toBeDefined();
    const { valor, atributos } = analisarCookie(linha ?? '');
    expect(valor.length).toBeGreaterThan(0);
    expect(atributos.has('httponly')).toBe(true);
  });

  // @req RNF-05 @tipo borda
  test('test_RNF05_fora_de_producao_cookie_e_samesite_lax_path_raiz_e_sem_secure', async () => {
    await cadastrar(PESSOA_A);
    const login = await logar(PESSOA_A.email, PESSOA_A.senha);
    const { atributos } = analisarCookie(setCookieSessao(login) ?? '');
    expect(atributos.get('samesite')?.toLowerCase()).toBe('lax');
    expect(atributos.get('path')).toBe('/');
    expect(atributos.has('secure')).toBe(false);
    expect(atributos.has('httponly')).toBe(true);
  });

  // @req RNF-05 @tipo borda
  test('test_RNF05_em_producao_cookie_tem_secure_e_continua_httponly', async () => {
    const appProducao = await construirApp({ urlBanco: urlBancoDeTeste(), armazenamento, producao: true });
    try {
      expect((await cadastrar(PESSOA_A, appProducao)).statusCode).toBe(201);
      const login = await logar(PESSOA_A.email, PESSOA_A.senha, appProducao);
      expect(login.statusCode).toBe(204);
      const { atributos } = analisarCookie(setCookieSessao(login) ?? '');
      expect(atributos.has('secure')).toBe(true);
      expect(atributos.has('httponly')).toBe(true);
      expect(atributos.get('samesite')?.toLowerCase()).toBe('lax');
    } finally {
      await appProducao.close();
    }
  });

  // @req RNF-05 @tipo borda
  test('test_RNF05_mesma_senha_em_duas_contas_gera_hashes_diferentes', async () => {
    const senhaComum = 'senha-sintetica-comum-03';
    await cadastrar({ ...PESSOA_A, senha: senhaComum });
    await cadastrar({ ...PESSOA_B, senha: senhaComum });
    const a = String((await linhaUsuario(PESSOA_A.email))?.senha_hash);
    const b = String((await linhaUsuario(PESSOA_B.email))?.senha_hash);
    expect(a.startsWith('$argon2id$')).toBe(true);
    expect(b.startsWith('$argon2id$')).toBe(true);
    expect(a).not.toBe(b);
  });

  // @req RNF-05 @tipo negativo
  test('test_RNF05_banco_nao_guarda_senha_nem_token_de_sessao_em_claro', async () => {
    const sid = await entrar(PESSOA_A);
    const usuarios = JSON.stringify(await consultar('SELECT * FROM usuarios'));
    expect(usuarios).not.toContain(PESSOA_A.senha);

    const sessoes = await consultar<{ id_hash: string }>('SELECT * FROM sessoes');
    expect(sessoes).toHaveLength(1);
    expect(sessoes[0]?.id_hash).not.toBe(sid);
    expect(JSON.stringify(sessoes)).not.toContain(sid);
  });

  // @req RNF-05 @tipo negativo
  test('test_RNF05_respostas_de_cadastro_e_login_nao_expoem_senha_nem_hash', async () => {
    const cadastro = await cadastrar(PESSOA_A);
    const hash = String((await linhaUsuario(PESSOA_A.email))?.senha_hash);
    expect(cadastro.body).not.toContain(PESSOA_A.senha);
    expect(cadastro.body).not.toContain(hash);
    expect(cadastro.body).not.toContain('senha');

    const login = await logar(PESSOA_A.email, PESSOA_A.senha);
    expect(login.body).not.toContain(PESSOA_A.senha);
    expect(login.body).not.toContain(hash);
  });
});

// =====================================================================
// RNF-06 · cadastro coleta só nome, e-mail e senha
// =====================================================================
describe('RNF-06 · dados coletados no cadastro', () => {
  const COLUNAS_PERMITIDAS = ['id', 'nome', 'email', 'senha_hash', 'criado_em'];

  // @req RNF-06 @tipo feliz
  test('test_RNF06_cadastro_grava_so_nome_email_e_hash', async () => {
    const res = await cadastrar(PESSOA_A);
    expect(res.statusCode).toBe(201);
    const corpo = res.json() as Record<string, unknown>;
    expect(Object.keys(corpo).sort()).toEqual(['email', 'id', 'nome']);

    const linha = await linhaUsuario(PESSOA_A.email);
    expect(linha).toBeDefined();
    for (const coluna of Object.keys(linha ?? {})) expect(COLUNAS_PERMITIDAS).toContain(coluna);
    expect(linha?.nome).toBe(PESSOA_A.nome);
    expect(linha?.email).toBe(PESSOA_A.email);
  });

  // @req RNF-06 @tipo borda
  test('test_RNF06_campos_extras_sao_descartados_e_nao_gravados', async () => {
    const extras = {
      cpf: '000.000.000-00',
      telefone: '+55 00 00000-0000',
      endereco: 'Rua Sintética, 0',
      dataNascimento: '1900-01-01',
    };
    const res = await cadastrar({ ...PESSOA_A, ...extras });
    expect(res.statusCode).toBe(201);
    expect(Object.keys(res.json() as object).sort()).toEqual(['email', 'id', 'nome']);

    const linhas = await consultar('SELECT * FROM usuarios');
    expect(linhas).toHaveLength(1);
    const gravado = JSON.stringify(linhas);
    for (const valor of Object.values(extras)) expect(gravado).not.toContain(valor);
    for (const coluna of Object.keys(linhas[0] ?? {})) expect(COLUNAS_PERMITIDAS).toContain(coluna);
  });

  // @req RNF-06 @tipo borda
  test('test_RNF06_campo_extra_com_nome_de_coluna_nao_sobrescreve_id_nem_hash', async () => {
    const idFornecido = '00000000-0000-4000-8000-0000000000aa';
    const res = await cadastrar({ ...PESSOA_A, id: idFornecido, senha_hash: 'hash-sintetico-em-claro' });
    expect(res.statusCode).toBe(201);
    const linha = await linhaUsuario(PESSOA_A.email);
    expect(linha?.id).not.toBe(idFornecido);
    expect(String(linha?.senha_hash).startsWith('$argon2id$')).toBe(true);
    // A senha do corpo continua sendo a que vale para o login.
    expect((await logar(PESSOA_A.email, PESSOA_A.senha)).statusCode).toBe(204);
  });

  // @req RNF-06 @tipo negativo
  test('test_RNF06_cadastro_sem_nome_ou_sem_senha_responde_400_e_nada_e_gravado', async () => {
    const semNome = await cadastrar({ email: PESSOA_A.email, senha: PESSOA_A.senha });
    expect(semNome.statusCode).toBe(400);
    const semSenha = await cadastrar({ nome: PESSOA_A.nome, email: PESSOA_A.email });
    expect(semSenha.statusCode).toBe(400);
    expect(await contar('usuarios')).toBe(0);
  });
});

// =====================================================================
// RF-19 · excluir a própria conta e os dados (LGPD)
// =====================================================================
describe('RF-19 · excluir a própria conta', () => {
  // @req RF-19 @tipo feliz
  test('test_RF19_excluir_conta_confirmada_apaga_usuario_sessoes_fases_e_imagens', async () => {
    const sid = await entrar(PESSOA_A);
    expect((await criarFase(sid, 'Fase sintética a apagar')).statusCode).toBe(201);
    const imagem = await enviarImagem(sid);
    expect(imagem.statusCode).toBe(201);
    expect(armazenamento.gravados.length).toBeGreaterThan(0);

    const res = await excluirConta(sid, { confirmar: true });
    expect(res.statusCode).toBe(204);

    expect(await linhaUsuario(PESSOA_A.email)).toBeUndefined();
    expect(await contar('usuarios')).toBe(0);
    expect(await contar('sessoes')).toBe(0);
    expect(await contar('fases')).toBe(0);
    expect(await contar('assets')).toBe(0);
    // Os arquivos de imagem saem do armazenamento, não só o registro no banco.
    for (const id of armazenamento.gravados) expect(armazenamento.apagados).toContain(id);
    expect(armazenamento.arquivos.size).toBe(0);
  });

  // @req RF-19 @tipo feliz
  test('test_RF19_apos_excluir_a_sessao_acaba_o_cookie_e_limpo_e_o_login_e_recusado', async () => {
    const sid = await entrar(PESSOA_A);
    const res = await excluirConta(sid, { confirmar: true });
    expect(res.statusCode).toBe(204);

    const linha = setCookieSessao(res);
    expect(linha).toBeDefined();
    expect(cookieFoiLimpo(linha ?? '')).toBe(true);

    const comCookieAntigo = await app.inject({ method: 'GET', url: '/fases', cookies: comSessao(sid) });
    expect(comCookieAntigo.statusCode).toBe(401);

    const login = await logar(PESSOA_A.email, PESSOA_A.senha);
    expect(login.statusCode).toBe(401);
    expect(setCookieSessao(login)).toBeUndefined();
  });

  // @req RF-19 @tipo borda
  test('test_RF19_sem_confirmacao_a_exclusao_e_recusada_e_a_conta_continua', async () => {
    const sid = await entrar(PESSOA_A);
    expect((await criarFase(sid, 'Fase sintética que fica')).statusCode).toBe(201);

    for (const corpo of [undefined, {}, { confirmar: false }, { confirmar: 'true' }]) {
      const res = await excluirConta(sid, corpo);
      expect(res.statusCode).toBe(400);
    }

    expect(await linhaUsuario(PESSOA_A.email)).toBeDefined();
    expect(await contar('fases')).toBe(1);
    const lista = await app.inject({ method: 'GET', url: '/fases', cookies: comSessao(sid) });
    expect(lista.statusCode).toBe(200);
    expect((await logar(PESSOA_A.email, PESSOA_A.senha)).statusCode).toBe(204);
  });

  // @req RF-19 @tipo borda
  test('test_RF19_excluir_a_propria_conta_nao_afeta_outro_usuario', async () => {
    const sidA = await entrar(PESSOA_A);
    const sidB = await entrar(PESSOA_B);
    expect((await criarFase(sidA, 'Fase sintética de A')).statusCode).toBe(201);
    expect((await criarFase(sidB, 'Fase sintética de B')).statusCode).toBe(201);

    expect((await excluirConta(sidB, { confirmar: true })).statusCode).toBe(204);

    expect(await linhaUsuario(PESSOA_B.email)).toBeUndefined();
    expect(await linhaUsuario(PESSOA_A.email)).toBeDefined();
    const listaA = await app.inject({ method: 'GET', url: '/fases', cookies: comSessao(sidA) });
    expect(listaA.statusCode).toBe(200);
    const fasesA = listaA.json() as { titulo: string }[];
    expect(fasesA.map((f) => f.titulo)).toEqual(['Fase sintética de A']);
  });

  // @req RF-19 @tipo negativo
  test('test_RF19_excluir_conta_sem_sessao_responde_401_e_nada_e_apagado', async () => {
    await entrar(PESSOA_A);
    const res = await excluirConta(undefined, { confirmar: true });
    expect(res.statusCode).toBe(401);
    expect(await contar('usuarios')).toBe(1);
    expect(await contar('sessoes')).toBe(1);
  });

  // @req RF-19 @tipo negativo
  test('test_RF19_nao_e_possivel_excluir_a_conta_de_outro_usuario_pelo_corpo', async () => {
    await entrar(PESSOA_A);
    const idA = String((await linhaUsuario(PESSOA_A.email))?.id);
    const sidB = await entrar(PESSOA_B);

    // B tenta apontar a conta de A; no máximo a própria conta de B pode ser apagada.
    await excluirConta(sidB, { confirmar: true, id: idA, usuarioId: idA, email: PESSOA_A.email });

    expect(await linhaUsuario(PESSOA_A.email)).toBeDefined();
    expect((await logar(PESSOA_A.email, PESSOA_A.senha)).statusCode).toBe(204);
  });
});
