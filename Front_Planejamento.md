# Planejamento do Front-End — Telas por Perfil
 
Baseado no descritivo do escopo. Três arquivos HTML, um por perfil, cada um consumindo rotas próprias do back-end (Node.js/Express + Oracle).
 
---
 
## 1. `recepcao.html`
 
**Responsável por:** abrir, alterar, consultar e cancelar atendimentos.
 
### O que a tela mostra
 
- Formulário de cadastro do paciente + abertura de atendimento (tudo em uma ação só, no fluxo real da recepção)
- Campo de busca por número de atendimento ou CPF, para consulta/alteração
- Botão de cancelar, habilitado **somente se** `status != 'confirmado'`
### Campos do formulário (cadastro/abertura)
 
| Campo | Tabela | Obrigatório |
|---|---|---|
| nome_completo | paciente | sim |
| cpf | paciente | sim |
| rg | paciente | sim |
| data_nascimento | paciente | sim |
| nome_pai | paciente | condicional* |
| nome_mae | paciente | condicional* |
| endereco | paciente | não |
 
\* **Regra do responsável para menores de idade:** se o paciente for menor de 18 anos (calculado a partir de `data_nascimento`), pelo menos um dos dois — `nome_pai` OU `nome_mae` — precisa vir preenchido. Se for maior de idade, os dois continuam opcionais. A validação de verdade acontece no back-end (na trigger/lógica antes do INSERT); o front pode replicar essa checagem em JS só pra dar feedback imediato, mas isso é enfeite, não a barreira real.
 
O `numero_atendimento` (ex: `AT0001`) **não é digitado nem gerado pelo Node.js** — é preenchido por uma trigger em PL/SQL no Oracle, no momento do INSERT (ver `planejamento-backend.md`, item 3). O formulário da recepção nem precisa desse campo no corpo da requisição.
 
### Rotas consumidas
 
| Ação | Método | Rota |
|---|---|---|
| Criar paciente + atendimento | `POST` | `/atendimentos` |
| Consultar por nº ou CPF | `GET` | `/atendimentos?busca=...` |
| Alterar dados | `PUT` | `/atendimentos/:id` |
| Cancelar | `PATCH` | `/atendimentos/:id/cancelar` |
 
### Regra de tela
 
O botão "Cancelar" e os campos de edição ficam desabilitados via JS quando o `status` retornado pelo `GET` for `'confirmado'`. A validação de verdade acontece no back-end (front nunca é a única barreira).
 
---
 
## 2. `triagem.html`
 
**Responsável por:** registrar os dados vitais e a classificação de Manchester em cima de um atendimento já existente.
 
Não é um painel — é um formulário simples. O documento não menciona lista, fila ou visualização de outros atendimentos nesta tela.
 
### O que a tela mostra
 
- Campo pra localizar o atendimento (por número, ex: `AT0001`)
- Depois de localizado: formulário com os dados a preencher
### Campos do formulário
 
| Campo | Tabela | Observação |
|---|---|---|
| pressao_arterial | triagem | texto livre, ex: `120/80` |
| temperatura | triagem | numérico, ex: `36.5` |
| batimentos_cardiacos | triagem | numérico |
| queixas | triagem | texto livre |
| prioridade | triagem | select fechado (1 a 5), mapeado pra cor no front |
 
### Mapeamento prioridade → cor (só exibição, feito no JS)
 
```
1 = Vermelho (emergência)
2 = Laranja  (muito urgente)
3 = Amarelo  (urgente)
4 = Verde    (pouco urgente)
5 = Azul     (não urgente)
```
 
### Rotas consumidas
 
| Ação | Método | Rota |
|---|---|---|
| Buscar atendimento por número | `GET` | `/atendimentos/:numero` |
| Registrar triagem | `POST` | `/atendimentos/:id/triagem` |
 
Ao salvar, o back-end muda `atendimento.status` de `'aberto'` para `'triado'`.
 
---
 
## 3. `medico.html`
 
**Responsável por:** duas funções, na mesma página, que o documento chama de "Interfaces do Médico" — o Painel de Atendimentos e a tela de medicação/confirmação.
 
### Seção A — Painel de Atendimentos
 
Lista os atendimentos com `status = 'triado'`, ordenados por prioridade (1 primeiro) e, dentro da mesma prioridade, por ordem de chegada.
 
**Colunas exibidas** (conforme citado no documento): número do atendimento, nome do paciente, data de nascimento, prioridade/cor.
 
| Ação | Método | Rota |
|---|---|---|
| Carregar painel | `GET` | `/painel` |
 
Sem atualização automática — carrega ao abrir a página e tem um botão "Atualizar" que refaz o `GET`. O documento não pede tempo real.
 
### Seção B — Lançar medicação e confirmar
 
Abre ao clicar num atendimento da lista (mesma página, sem trocar de HTML).
 
| Campo | Tabela |
|---|---|
| medicamento | prescricao |
| dosagem | prescricao |
 
| Ação | Método | Rota |
|---|---|---|
| Lançar medicação | `POST` | `/atendimentos/:id/prescricoes` |
| Confirmar consulta | `PATCH` | `/atendimentos/:id/confirmar` |
 
Confirmar muda `atendimento.status` para `'confirmado'` — e é esse campo que trava o cancelamento lá na recepção.
 
---
 
## Resumo das rotas do back-end (visão geral)
 
| Método | Rota | Usada por |
|---|---|---|
| POST | `/atendimentos` | Recepção |
| GET | `/atendimentos?busca=` | Recepção |
| PUT | `/atendimentos/:id` | Recepção |
| PATCH | `/atendimentos/:id/cancelar` | Recepção |
| GET | `/atendimentos/:numero` | Triagem |
| POST | `/atendimentos/:id/triagem` | Triagem |
| GET | `/painel` | Médico |
| POST | `/atendimentos/:id/prescricoes` | Médico |
| PATCH | `/atendimentos/:id/confirmar` | Médico |
 
