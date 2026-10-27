'use strict';

/**
 * Filtro de dado pessoal aplicado ao log ANTES de ele chegar ao modelo (P2 do
 * agente de manutenção). Fica em código e não em config: afrouxar o
 * mascaramento precisa passar por revisão de código, não por edição de JSON.
 * A ordem importa — padrões mais específicos (CNPJ) antes dos mais genéricos.
 */
const REGRAS_MASCARAMENTO = [
  { nome: 'email', padrao: /[\w.+-]+@[\w-]+(\.[\w-]+)+/g, substituto: '[EMAIL]' },
  { nome: 'cnpj', padrao: /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, substituto: '[CNPJ]' },
  { nome: 'cpf', padrao: /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, substituto: '[CPF]' },
  { nome: 'cartao', padrao: /\b(?:\d[ -]?){13,19}\b/g, substituto: '[CARTAO]' },
  { nome: 'telefone', padrao: /\(?\b\d{2}\)?\s?9?\d{4}-\d{4}\b/g, substituto: '[TELEFONE]' },
  {
    nome: 'campo_identificador',
    padrao: /\b(nome|name|cliente|endereco|address|telefone|phone)=("[^"]*"|\S+)/gi,
    substituto: '$1=[MASCARADO]',
  },
];

function mascarar(linha) {
  return REGRAS_MASCARAMENTO.reduce((texto, regra) => texto.replace(regra.padrao, regra.substituto), linha);
}

module.exports = { mascarar, REGRAS_MASCARAMENTO };
