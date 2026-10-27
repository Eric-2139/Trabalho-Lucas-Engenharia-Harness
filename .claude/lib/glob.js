'use strict';

/**
 * Conversor mínimo de glob para regex: "**" atravessa diretórios, "*" não.
 * Evita dependência externa (minimatch) para o único uso do harness, que é
 * checar o escopo de arquivos declarado no projeto do componente.
 */
function globParaRegex(glob) {
  let padrao = '';
  for (let i = 0; i < glob.length; i += 1) {
    const caractere = glob[i];
    if (caractere === '*' && glob[i + 1] === '*') {
      const seguidoDeBarra = glob[i + 2] === '/';
      padrao += seguidoDeBarra ? '(?:.*/)?' : '.*';
      i += seguidoDeBarra ? 2 : 1;
    } else if (caractere === '*') {
      padrao += '[^/]*';
    } else if (caractere === '?') {
      padrao += '[^/]';
    } else {
      padrao += caractere.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${padrao}$`, process.platform === 'win32' ? 'i' : '');
}

function casaAlgumGlob(caminhoRelativo, globs) {
  return globs.some((glob) => globParaRegex(glob).test(caminhoRelativo));
}

module.exports = { globParaRegex, casaAlgumGlob };
