//Segundo digito da senha
function verificar_direita() {
    const resposta_direita = document.querySelector('input.resposta-direita')
    const resdir = document.querySelector('div.res-direita')
    const txtresdir = Number(resposta_direita.value)

    if (txtresdir == 123) {
        resdir.innerHTML = 'O segundo digito da senha é 1'
    } else {
        resdir.innerHTML = 'Resposta Errada!!'
    }
}

//Dica
function dica_direita() {
    alert('Voz desconhecida: Se você tentar fazer de cabeça, é provavel que você se perca, escreva a equação em algum lugar, seguindo a ordem das setas, resolva primeiro as multiplicações e divisões, e depois as adições e subtrações')
}

//Janelas
function janela_1() {
    alert('Você: Trancada e um breu do lado de fora, será mesmo que existe uma saída?')
}

function janela_2() {
    alert('Você: Trancada e um breu do lado de fora, será mesmo que existe uma saída?')
}