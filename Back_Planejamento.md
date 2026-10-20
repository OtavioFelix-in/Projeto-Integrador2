# Planejamento do Back-End

## Como o sistema roda

Tudo roda local, no computador de quem apresenta. Não é site publicado e não precisa de internet.

```
MySQL  →  Node.js (server.js)  →  JS  →  HTML  →  CSS
```

- **MySQL** guarda os dados (`create_table.sql`).
- **Node.js + Express** (`server.js`) conversa com o MySQL e entrega as telas em `http://localhost:3000`.
- **JS** de cada tela chama o Node com `fetch` e troca dados em JSON.
- **HTML + CSS** são as telas.

Pacotes: `express` e `mysql2`. Os dois estão dentro do item 6 do plano de ensino (Node + npm + express).

## Estrutura de pastas

```
Projeto-Integrador2/
  create_table.sql
  iniciar.bat            dois cliques: sobe o Node e abre o navegador
  backend/
    server.js            rotas + conexão com o MySQL
    package.json
    public/
      login.html
      recepcao.html
      triagem.html
      medico.html
      css/style.css
      js/login.js
      js/recepcao.js
      js/triagem.js
      js/medico.js
```

## Banco (6 tabelas)

| Tabela | Para que serve |
|---|---|
| `usuario` | Profissional: nome, CPF e perfil (`recepcao`, `enfermagem`, `medico`) |
| `login` | Usuário e senha de cada profissional (1 login por usuário) |
| `paciente` | Dados do paciente (CPF ou RG obrigatório) |
| `atendimento` | Cada vinda ao pronto socorro; `status` controla o fluxo |
| `triagem` | Sinais vitais e prioridade de Manchester (1 por atendimento) |
| `prescricao` | Medicações lançadas pelo médico (várias por atendimento) |

Fluxo do status: `aberto` → `triado` → `confirmado` (ou `cancelado`).

O número `AT0001` não é guardado no banco: o back monta a partir do `id_atendimento` (`'AT' + id com 4 dígitos`).

## Rotas

| Método | Rota | Tela | O que faz |
|---|---|---|---|
| POST | `/login` | Login | Confere usuário e senha, devolve nome e perfil |
| POST | `/atendimentos` | Recepção | Cadastra paciente (ou reaproveita pelo CPF) e abre atendimento |
| GET | `/atendimentos?busca=` | Recepção | Busca por número do atendimento ou CPF |
| PUT | `/atendimentos/:id` | Recepção | Altera dados do paciente |
| PATCH | `/atendimentos/:id/cancelar` | Recepção | Cancela, se ainda não foi confirmado |
| GET | `/triagem/fila` | Triagem | Lista atendimentos `aberto` |
| POST | `/atendimentos/:id/triagem` | Triagem | Grava sinais vitais e prioridade, status vira `triado` |
| GET | `/painel` | Médico | Lista `triado` ordenado por prioridade e hora da triagem |
| POST | `/atendimentos/:id/prescricoes` | Médico | Lança medicação |
| PATCH | `/atendimentos/:id/confirmar` | Médico | Grava diagnóstico, status vira `confirmado` |

## Regras de negócio (no back-end)

1. **Menor de 18 anos**: exige `nome_pai` ou `nome_mae`. Se os dois vierem vazios, responde erro 400 antes de gravar.
2. **Cancelamento**: só se `status` ainda não for `confirmado`.
3. **Triagem**: só para atendimento `aberto`.
4. **Confirmação**: só para atendimento `triado`.
5. **Perfil**: cada tela confere o perfil guardado no login; recepção não abre a tela do médico.

## Para apresentar

1. Rodar o `create_table.sql` no MySQL (já cria 3 logins de teste, senha `123`).
2. Dentro de `backend/`, rodar `npm install` uma vez.
3. Dois cliques no `iniciar.bat`.
