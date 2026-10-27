'use strict';

/**
 * Lê um relatório JUnit XML e devolve Map<idDoTeste, 'passou'|'falhou'|'pulado'>.
 * JUnit XML é o formato de saída comum a PHPUnit, JUnit/Maven, pytest e Jest
 * (via reporter), o que mantém o harness agnóstico de stack.
 */
function lerAtributo(atributos, nome) {
  const encontrado = new RegExp(`\\b${nome}="([^"]*)"`).exec(atributos);
  return encontrado ? encontrado[1] : '';
}

function interpretarJunit(xml) {
  const resultados = new Map();
  const padraoCaso = /<testcase\b([^>]*?)(\/>|>([\s\S]*?)<\/testcase>)/g;
  let caso;
  while ((caso = padraoCaso.exec(xml)) !== null) {
    const atributos = caso[1];
    const corpo = caso[3] || '';
    const id = `${lerAtributo(atributos, 'classname')}::${lerAtributo(atributos, 'name')}`;
    let situacao = 'passou';
    if (/<(failure|error)\b/.test(corpo)) situacao = 'falhou';
    else if (/<skipped\b/.test(corpo)) situacao = 'pulado';
    resultados.set(id, situacao);
  }
  return resultados;
}

/** "RF-09" casa com nomes como test_RF09_..., RF-09, rf_09. */
function pertenceAoRequisito(idDoTeste, reqId) {
  const [prefixo, numero] = reqId.split('-');
  return new RegExp(`${prefixo}[-_]?${numero}(?!\\d)`, 'i').test(idDoTeste);
}

module.exports = { interpretarJunit, pertenceAoRequisito };
