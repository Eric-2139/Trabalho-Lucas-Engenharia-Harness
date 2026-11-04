//Relogio
const hourHand = document.querySelector('.hour-hand')
const minuteHand = document.querySelector('.minute-hand')
const secondHand = document.querySelector('.second-hand')

const getTime = () => {
    const date = new Date()

    return {
        hours: date.getHours(),
        minutes: date.getMinutes(),
        seconds: date.getSeconds(),
    }
}

setInterval(() => {

    const { seconds, minutes, hours } = getTime()

    secondHand.style.transform = `translate(0, -50%) rotate(${seconds * 6}deg)`
    minuteHand.style.transform = `translate(0, -50%) rotate(${minutes * 6}deg)`
    hourHand.style.transform = `translate(0, -50%) rotate(${hours * 30}deg)`

}, 1000)

//Primeiro digito da senha
function verificar_teto() {
    const resposta_teto = document.querySelector('input.resposta-teto')
    const resteto = document.querySelector('div.res-teto')
    const txtresteto = Number(resposta_teto.value)

    if (txtresteto == 55) {
        resteto.innerHTML = 'O primeiro digito da senha é 92'
    } else {
        resteto.innerHTML = 'Resposta Errada!!'
    }
}

//Dica
function dica_teto() {
    alert('Voz desconhecida: Não use as horas e minutos do relógio que você está vendo no momento, use os dados que você conseguiu nas contas perto do relógio antigo')
}

//God Eye
function olho_de_deus() {
    alert('Você: Agora entendo de onde vem a voz misteriosa, seria isso uma espécie de deus ou ser superior?')
    alert('Tet: kkkkkkkkkkkkkkk, muito bem, corretíssimo, me chamo Tet, o deus dos jogos, continue a brincar nesse mini mundo que eu criei')
}