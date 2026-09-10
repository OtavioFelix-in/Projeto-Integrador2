# Planejamento do Back-End
 
## Stack
 
- **Node.js + Express** — reduz boilerplate de rota, é o mais comum em material didático de 2º semestre
- **Banco de dados: Oracle com PL/SQL** — driver `oracledb` no Node.js pra conexão
- **Trigger em PL/SQL** — usada pra gerar o `numero_atendimento` automaticamente antes do INSERT (ver seção de regras de negócio, item 3)
**Decidido:** um único arquivo `server.js`. Sem separação em `routes/`/`controllers/` — todas as rotas, a conexão com o banco e a lógica ficam no mesmo arquivo. Mais simples de navegar num projeto pequeno de 4 tabelas.
 
```
backend/
  server.js
  package.json
```
 
---
 
## Rotas
 
| Método | Rota | Perfil | Ação |
|---|---|---|---|
| POST | `/atendimentos` | Recepção | Cria paciente + atendimento |
| GET | `/atendimentos?busca=` | Recepção | Consulta por nº ou CPF |
| PUT | `/atendimentos/:id` | Recepção | Altera dados |
| PATCH | `/atendimentos/:id/cancelar` | Recepção | Cancela (só se `status != 'confirmado'`) |
| GET | `/atendimentos/:numero` | Triagem | Busca atendimento pra iniciar triagem |
| POST | `/atendimentos/:id/triagem` | Triagem | Registra dados vitais + prioridade |
| GET | `/painel` | Médico | Lista `status = 'triado'`, ordenado por prioridade |
| POST | `/atendimentos/:id/prescricoes` | Médico | Lança medicação |
| PATCH | `/atendimentos/:id/confirmar` | Médico | Confirma consulta (`status = 'confirmado'`) |
 
---
 
## Regras de negócio (validação no back-end, não no banco nem só no front)
 
### 1. Nome do pai/mãe obrigatório para menores de idade
 
A documentação pede especificamente os campos `nome do pai` e `nome da mãe` no cadastro do paciente — não fala em "responsável". Mantemos os dois campos como estão.
 
Regra decidida com o Otavio: calcular a idade a partir de `data_nascimento` no momento do `POST /atendimentos`, **antes do INSERT**:
 
```
idade = hoje - data_nascimento
 
se idade < 18 anos:
    exige nome_pai OU nome_mae preenchido (pelo menos um dos dois)
    → se os dois vierem vazios, retorna erro 400 antes de gravar
senão:
    nome_pai e nome_mae continuam opcionais
```
 
Cobre também o caso de recém-nascido — é só o extremo de "menor de idade", não precisa de tratamento especial.
 
**Por que no back-end e não no banco:** validar dependendo do valor de outra coluna da mesma linha exigiria `CHECK` com lógica de data, que o MySQL não valida de forma confiável em todas as versões. Fica mais simples e mais fácil de testar como `if` no controller antes do `INSERT`.
 
**Por que não só no front:** JS de navegador é burlável (DevTools, Postman direto na API). O front pode (e deve) also validar pra dar feedback rápido ao usuário, mas a validação que vale é a do back-end.
 
### 2. Cancelamento só antes da confirmação médica
 
`PATCH /atendimentos/:id/cancelar` verifica `status` atual antes de aplicar. Se `status = 'confirmado'`, retorna erro — não deixa cancelar.
 
### 3. Numeração do atendimento (via TRIGGER em PL/SQL)
 
**Decidido:** gerar `numero_atendimento` por uma trigger `BEFORE INSERT` na tabela `ATENDIMENTO`, em PL/SQL. O `INSERT` do back-end manda os dados sem o número; o próprio Oracle preenche o campo antes de gravar.
 
Oracle não tem `AUTO_INCREMENT` — o padrão é usar uma **SEQUENCE** combinada com a trigger:
 
```sql
-- 1. Sequence que controla o contador
CREATE SEQUENCE seq_atendimento
    START WITH 1
    INCREMENT BY 1;
 
-- 2. Trigger que monta o número formatado (AT0001, AT0002...)
CREATE OR REPLACE TRIGGER trg_gerar_numero_atendimento
BEFORE INSERT ON ATENDIMENTO
FOR EACH ROW
DECLARE
    v_proximo NUMBER;
BEGIN
    SELECT seq_atendimento.NEXTVAL INTO v_proximo FROM DUAL;
    :NEW.numero_atendimento := 'AT' || LPAD(v_proximo, 4, '0');
END;
/
```
 
Diferenças pra quem só conhece MySQL, se alguém do grupo for pesquisar:
 
- Não existe `DELIMITER` — o `/` no final é o que manda o SQL*Plus/Oracle executar o bloco.
- `:NEW.coluna` em vez de `NEW.coluna` (o dois-pontos é obrigatório em PL/SQL).
- Contador vem de uma `SEQUENCE` separada (`.NEXTVAL`), não de `SELECT MAX(...)` na própria tabela — inclusive isso evita o problema de condição de corrida que existiria fazendo `MAX` manualmente.
- `FROM DUAL` é a tabela fictícia do Oracle pra rodar `SELECT` de expressões sem tabela real (não existe em MySQL).
### 4. Tipos de dado — ajuste de MySQL para Oracle
 
As tabelas definidas antes usavam sintaxe MySQL. Em Oracle, os tipos equivalentes são:
 
| MySQL (planejado antes) | Oracle (correto) |
|---|---|
| `INT AUTO_INCREMENT` | `NUMBER` + `SEQUENCE` (ou `GENERATED AS IDENTITY` se for Oracle 12c+) |
| `VARCHAR(n)` | `VARCHAR2(n)` |
| `DATE` | `DATE` (igual) |
| `DATETIME` | `DATE` (Oracle guarda data+hora no mesmo tipo `DATE`) ou `TIMESTAMP` |
| `DECIMAL(3,1)` | `NUMBER(3,1)` |
 
Se a versão do Oracle do laboratório for 12c ou mais nova, dá pra simplificar o PK sem sequence manual:
 
```sql
id_atendimento NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY
```
 
Vale confirmar qual versão vocês têm disponível antes de escolher entre `IDENTITY` e `SEQUENCE` manual — se não souberem, `SEQUENCE` + trigger funciona em qualquer versão.
 
---
 
## Melhorias futuras (fora do escopo atual)
 
- Trocar `nome_pai` / `nome_mae` por uma tabela `responsavel` (nome, parentesco, telefone, CPF) ligada N:1 ao paciente — permite mais de um responsável e mais dados de contato. Não faz parte da entrega atual porque a documentação pede os dois campos nomeados especificamente.
