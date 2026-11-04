//Porta com senha
const button = document.querySelector('.button')
const input = document.querySelector('.input')


button.addEventListener('click', () => {
    const password = input.value;

    if (password === '92139') {
        window.location.href = '/3opcao'
        alert('Tet: Meus parabéns, agora lhe compartilho o meu poder de criação de mundos, se divirta criando e explorando o universo, afinal, não só nós que possímos esse poder!!');
    } else {
        alert('Senha incorreta!');
    }
});

//Terceiro digito da senha
function verificar_frente() {
    const resposta = document.querySelector('input.resposta')
    const res = document.querySelector('div.res')
    const txtres = Number(resposta.value)

    if (txtres == 310) {
        res.innerHTML = 'O terceiro digito da senha é 3'
    } else {
        res.innerHTML = 'Resposta Errada!!'
    }
}

//Dica
function dica_frente() {
    alert('Voz desconhecida: Realize primeiro a multiplicação, depois a adição')
}

//Relogios
function relogio_1() {
    alert('Você: Estranho, parece que esses relógios estão me observando')
}

function relogio_2() {
    alert('Você: Estranho, parece que esses relógios estão me observando')
}

//Porta
function porta() {
    alert('Você: Por que "Saída?", será que depois disso ainda tem mais?')
}

//Giz
function giz() {
    alert('Você: Parece que esse giz vai ser a coisa menos tecnológica que eu vou ver nessa sala cheia de telas e botões')
}