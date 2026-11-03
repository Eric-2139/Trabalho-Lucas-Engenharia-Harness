# Contrato — Player (`packages/player` + `apps/player`)

Decisões: ADR-003, ADR-006, ADR-009, ADR-012, ADR-014. Depende de: SchemaFase (tipo `FaseJogo`), Api.

## Pacote `packages/player` (motor)
```ts
type Limitado = { limitado: true; tentarEmSegundos: number };   // 429 da Api (ADR-003)
interface Verificador {
  enigma(objetoId: string, resposta: string): Promise<{ correto: boolean; digitos: { posicao: number; valor: string }[] } | Limitado>;
  porta(objetoId: string, senha: string): Promise<{ aberta: boolean } | Limitado>;
}
function criarPartida(fase: FaseJogo, verificador: Verificador): Partida;
// Partida: paredeAtiva, trocarParede(p), clicar(objetoId) → evento, responder(objetoId, texto), digitosRevelados (posição → valor), concluida
```
- O motor só recebe `FaseJogo` (sem respostas nem senha) e nunca decide acerto sozinho (RNF-04).
- `decoracao`: clique não gera evento (RF-16). `fala`: evento com o texto (RF-16).
- `enigma`: pede resposta; se `correto`, guarda os dígitos devolvidos por posição; errado mostra "Resposta Errada!!" e não revela nada (RF-15). Se o enigma tem `dica`, mostra ícone que exibe esse texto; sem `dica`, não há ícone (RF-17).
- `Limitado`: mostra "Muitas tentativas, aguarde N s"; não conta como erro nem revela nada.
- Imagens resolvidas por `resolverImagem` do pacote de schema (ADR-012).
- **Tema visual** (`packages/player/src/tema.ts`): tokens de cor e foco, conferidos contra 4,5:1 (RNF-07); o Editor importa o mesmo tema.
- `porta`: pede a senha; `aberta` conclui a partida; senão "Senha incorreta!" (RF-15).
- Usado pelo modo testar do editor com verificador `modo=teste` (RF-11).

## App `apps/player` (público, sem login)
| Tela | Comportamento | Requisito |
|---|---|---|
| Inicial | Apresentação e acesso a Escolher Fase e ao editor | — |
| Escolher Fase | Lista `GET /publicadas`; fase não publicada não aparece | RF-13 |
| Jogo | 5 paredes trocadas por botões; palco 16:9; aviso abaixo de 1280x720 | RNF-01, RNF-02 |

A fase original (`escola-01`) aparece em Escolher Fase e é jogável igual ao critério do RF-18.

## Não funcionais
- RNF-07: textos em português; contraste WCAG 2.1 AA (4,5:1; 3:1 para texto grande); **Escolher Fase** operável só pelo teclado (Tab percorre as fases, Enter abre), com foco visível. Editor e Player usam os mesmos tokens de cor, conferidos contra 4,5:1.
- RNF-01: matriz de navegadores e aviso da ADR-006.
