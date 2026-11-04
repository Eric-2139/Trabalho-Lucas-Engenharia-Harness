//Primeiro digito da senha-caminho
function verificar_esquerda_horas() {
    const resposta_esquerda_horas = document.querySelector('input.resposta-esquerda-horas')
    const resesqh = document.querySelector('div.res-esquerda-horas')
    const txtresesqh = Number(resposta_esquerda_horas.value)
  
    if (txtresesqh == 15) {
      resesqh.innerHTML = 'Resposta correta, olhe para cima'
    } else {
      resesqh.innerHTML = 'Resposta Errada!!'
    }
  }
  
  function verificar_esquerda_min() {
    const resposta_esquerda_min = document.querySelector('input.resposta-esquerda-min')
    const resesqmin = document.querySelector('div.res-esquerda-min')
    const txtresesqmin = Number(resposta_esquerda_min.value)
  
    if (txtresesqmin == 40) {
      resesqmin.innerHTML = 'Resposta correta, olhe para cima'
    } else {
      resesqmin.innerHTML = 'Resposta Errada!!'
    }
  }
  
  //Dica
  function dica_esquerda() {
    alert('Voz desconhecida: Resolva primeiro o que está entre parênteses')
  }
  
  //Relógio Antigo
  function relogio_antigo() {
    alert('Você: Esse relógio nem funciona, acho que quem criou a sala tava sem ideia quando chegou nessa parte')
  }
  
  //Perguntas 
  function pergunta_horas() {
    alert('Você: Escreveram mais coisa na parede, falta de ideia é realmente algo complicado')
  }
  
  function pergunta_min() {
    alert('Você: Pelo menos não tem mais janelas, bom, nem faz sentido ter se não tem nada la fora')
  }
  
  //giz
  function giz_vermelho() {
    alert('Você: Então isso que foi utilizado para fazer alguns dos desafios dessa sala, acho que criador gosta de ficar escrevendo em paredes, parece criança')
  }