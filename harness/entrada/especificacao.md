# Math Scape — Especificação para a análise de requisitos

Fontes: "Math Scape: Plano de Reengenharia com IA" (Eric, 27/10/2026), engenharia reversa do repositório legado Math_Scape_Telas (31/10/2026) e decisões da equipe PEND-01 a PEND-10. Preparada por Roberta Telles como entrada do agente de requisitos.

## 1. Objetivo
Transformar o Math Scape, um escape room de matemática feito em HTML/CSS/JS há 3 anos, em uma plataforma de criação de fases: um editor visual onde qualquer pessoa monta a própria sala arrastando objetos, e um player que roda essas fases. A IA é usada para construir o software, não dentro do produto: quem cria as fases é sempre a pessoa.

## 2. Perfis
- Criador: pessoa cadastrada que monta, testa e publica fases. Não precisa saber programar.
- Jogador: pessoa que escolhe e joga fases publicadas.

## 3. Glossário
- Fase: uma sala de escape room com 5 paredes, objetos e uma senha final.
- Parede: uma das 5 superfícies da sala: frente, direita, fundo, esquerda e teto.
- Objeto: elemento colocado na parede: decoração, fala, enigma ou porta.
- Enigma: objeto com pergunta e resposta; ao ser resolvido, revela um dígito da senha.
- Senha final: sequência de dígitos que abre a porta e termina a fase.
- Legado: versão atual do jogo, em HTML/CSS/JS.
- Editor: tela onde o criador monta a fase.
- Player: parte do sistema que executa a fase para o jogador.

## 4. O sistema legado hoje
Telas: Tela Inicial, Login/Cadastro, Opções, Criador de Fases, Escolher Fase e Jogo. Fluxo: Tela Inicial, Login/Cadastro, Opções, Escolher Fase, Jogo; ao abrir a porta, o jogo volta para Opções.
- Login/Cadastro tem nickname, e-mail e senha, mas não guarda nem confere nada.
- O Criador de Fases é só a casca visual: menu e barra de ferramentas sem função; o JS apenas troca a aba da parede.
- Escolher Fase mostra uma única fase, "Escola", e o link aponta para uma pasta com nome errado.
- O jogo é uma sala com 5 paredes. Cada parede é um div com imagens posicionadas por CSS, e cada objeto tem um onclick com função própria (relogio_1(), giz(), pentagrama()).
- As respostas dos enigmas e a senha final da porta (92139) ficam no JavaScript do navegador, visíveis no DevTools.

Regras do jogo que o legado já tem: cada enigma resolvido revela um dígito; a porta pede a senha completa; ícones de interrogação dão dicas; objetos decorativos mostram falas.

Inventário da fase original "Escola":
- Esquerda: duas perguntas na parede, com respostas 15 e 40 (horas e minutos), que revelam "Olhe para cima" e servem de dado para o enigma do teto. Objetos com fala: relógio antigo e giz vermelho.
- Teto: somar horas e minutos do relógio antigo, resposta 55; revela o primeiro pedaço da senha: 92. Tem um relógio animado com a hora real e o olho de Deus, que revela o personagem Tet.
- Direita: conta seguindo setas, resposta 123; revela o segundo dígito: 1. Duas janelas.
- Frente: expressão com multiplicação e adição, resposta 310; revela o terceiro dígito: 3. Dois relógios, porta e giz.
- Fundo: sequência numérica no selo mágico, resposta -15 ou 80; revela o quarto dígito: 9; o selo some e a árvore seca muda de imagem. Duas janelas.
- Porta (frente): senha final 92139; termina a fase com a mensagem do Tet e volta para Opções; senha errada mostra "Senha incorreta!".
- Cada parede tem um ícone de dica com uma fala da "Voz desconhecida". Resposta errada de enigma mostra "Resposta Errada!!".

Problemas do legado: a fase é o próprio código, e criar fase nova exige escrever HTML, CSS e JS do zero; respostas e senha ficam visíveis no navegador; nada é reaproveitável; o editor nunca saiu do papel; não existe conta de usuário de verdade.

## 5. Escopo do MVP
Dentro: 1 sala por fase, 5 paredes, 4 tipos de objeto (decoração, fala, enigma, porta), upload de imagens, modo editar e modo jogar, salvar e publicar, exportar e importar JSON, fase original migrada.
Fora (versão 2): inventário, condições encadeadas ("porta só abre se pegou o giz"), múltiplas salas por fase, edição colaborativa, app mobile, perfis de professor e aluno, estatísticas de tempo e de uso de dicas, mudança de cena (objetos que somem ou trocam de imagem).

## 6. Requisitos funcionais
- O usuário pode se cadastrar e fazer login. O login é exigido só para criar fases; jogar fases publicadas não exige login.
- O criador pode criar, renomear, duplicar e excluir fase.
- O editor permite editar as 5 paredes da sala em um canvas com proporção fixa, alternando entre elas por abas.
- O editor oferece uma biblioteca de objetos padrão (porta, quadro, janela, relógio etc.) para arrastar ao canvas.
- O criador pode mover, redimensionar, rotacionar, ordenar camadas, duplicar e excluir objetos.
- O criador pode enviar imagem própria para fundo de parede e para objetos, nos formatos PNG, JPG ou WebP, com até 5 MB.
- Cada objeto é de um dos 4 tipos: decoração, fala, enigma ou porta.
- O criador configura a interação do objeto: fala (texto), enigma (pergunta, resposta, dica, dígito revelado), porta (senha final).
- Um enigma pode ter mais de uma resposta certa (ex.: -15 ou 80 no fundo) e pode revelar mais de um dígito (ex.: o "92" do teto).
- A senha final tem de 4 a 8 dígitos, escolhidos pelo criador; o padrão é 5.
- O editor tem desfazer e refazer (Ctrl+Z / Ctrl+Y).
- O editor salva automaticamente a cada 30 segundos e sempre que o criador troca de parede, além do salvamento manual.
- O modo testar permite jogar a fase dentro do editor.
- O sistema valida se a fase é jogável antes de publicar: todos os dígitos da senha atribuídos a um enigma.
- O criador pode publicar fase, e a tela Escolher Fase lista as fases publicadas.
- O jogador joga uma fase publicada, com verificação de respostas no servidor.
- O criador pode exportar e importar fase em JSON.
- A fase original "Escola" é recriada no novo sistema com os mesmos enigmas, respostas, dígitos e senha, e se comporta igual ao legado. A animação do selo e da árvore fica para a versão 2.

## 7. Requisitos não funcionais
- Navegadores desktop atuais (Chrome, Edge, Firefox); resolução mínima 1280x720.
- Canvas em proporção 16:9 com coordenadas relativas (0 a 1), para a fase funcionar em qualquer tamanho de tela.
- Arrastar objetos com no mínimo 30 quadros por segundo com até 50 objetos por parede.
- Respostas e senha nunca enviadas ao navegador do jogador.
- Senhas de usuário com hash (argon2 ou bcrypt); login por sessão em cookie httpOnly.
- Conformidade básica com a LGPD: o cadastro coleta só nome, e-mail e senha.
- Interface em português; contraste e navegação por teclado nos menus.
- Uma pessoa sem conhecimento de programação cria e publica uma fase jogável em menos de 30 minutos.
- Toda fase é um documento JSON (paredes, objetos, posições, interações), validado por um schema único.

## 8. Restrições tecnológicas
TypeScript no front e no back; React + Vite; react-konva no canvas do editor; Zustand + zundo para estado e desfazer/refazer; Zod para schema e validação no front e no back; Node.js + Fastify no backend; PostgreSQL com a fase em coluna JSONB; Prisma como ORM; imagens no disco do servidor no MVP e armazenamento S3 compatível depois; testes com Vitest, Testing Library e Playwright; monorepo com pnpm workspaces e GitHub Actions.
