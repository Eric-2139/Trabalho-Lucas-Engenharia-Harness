//Quarto digito da senha
function verificar_fundo() {
    const resposta_fundo = document.querySelector('input.resposta-fundo')
    const resfundo = document.querySelector('div.res-fundo')
    const txtresfundo = Number(resposta_fundo.value)
    const arvore_seca = document.querySelector('.arvore-seca')
    const selo_magico = document.querySelector('.pentagrama')
    let num_4 = document.querySelector('.num-pent-4')
    let num_23 = document.querySelector('.num-pent-23')
    let num_42 = document.querySelector('.num-pent-42')
    let num_61 = document.querySelector('.num-pent-61')
    let num_input = document.querySelector('.resposta-fundo')

    if (txtresfundo == -15 || txtresfundo == 80) {
        resfundo.innerHTML = 'O selo foi quebrado. O quarto digito da senha é 9'
        selo_magico.src = ''
        selo_magico.style.background = 'none'
        arvore_seca.src = '/Fu_ArvSc'
        arvore_seca.style.top = '206px'
        arvore_seca.style.left = '607px'
        arvore_seca.style.width = '585px'
        arvore_seca.style.height = '710px'
        num_4.remove()
        num_23.remove()
        num_42.remove()
        num_61.remove()
        num_input.remove()
        alert('Voz desconhecida: Ó, você conseguiu quebrar o selo, agora a minha bela árvore pode volta a crescer, obrigado')

    } else {
        resfundo.innerHTML = 'O selo continua intacto!!'
    }
}

//Dica
function dica_fundo() {
    alert('Voz desconhecida: Os números no selo são uma sequência numérica, basta você descobrir o padrão')
}

//Janelas
function janela_3() {
    alert('Você: O esperado, vazio')
}

function janela_4() {
    alert('Você: Acho que não vale muito a pena ficar olhando as janelas')
}  

//Selo
function pentagrama() {
    alert('Você: curioso, uma pessoa que eu conheço certamente diria que isso aqui é um sharingan, hmmm, acho que essa não era pra ser a reação esperada')
}