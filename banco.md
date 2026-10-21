Banco MySQL (8.0.16 ou superior, por causa dos CHECK). Script completo em `create_table.sql`, que cria o banco `pronto_socorro`.

6 tabelas: `usuario`, `login`, `paciente`, `atendimento`, `triagem`, `prescricao`.

**usuario**
- `id_usuario` — INT, PK, AUTO_INCREMENT
- `nome` — VARCHAR(100), NOT NULL
- `cpf` — CHAR(11), NOT NULL, UNIQUE (só números)
- `perfil` — VARCHAR(20), NOT NULL, CHECK (recepcao / enfermagem / medico)

**login**
- `id_login` — INT, PK, AUTO_INCREMENT
- `id_usuario` — INT, NOT NULL, UNIQUE, FK → usuario (um login por usuário)
- `usuario` — VARCHAR(30), NOT NULL, UNIQUE
- `senha` — VARCHAR(255), NOT NULL

**paciente**
- `id_paciente` — INT, PK, AUTO_INCREMENT
- `nome_completo` — VARCHAR(150), NOT NULL
- `cpf` — CHAR(11), UNIQUE (só números)
- `rg` — VARCHAR(20), UNIQUE
- `data_nascimento` — DATE, NOT NULL
- `sexo` — CHAR(1), NOT NULL, CHECK (M / F)
- `telefone` — VARCHAR(11)
- `nome_pai` — VARCHAR(150)
- `nome_mae` — VARCHAR(150)
- `endereco` — VARCHAR(200)
- CHECK: pelo menos um entre `cpf` e `rg` preenchido. Menor de 18 anos exige pai ou mãe (validado no back-end).

**atendimento**
- `id_atendimento` — INT, PK, AUTO_INCREMENT
- `id_paciente` — INT, NOT NULL, FK → paciente
- `data_hora_entrada` — DATETIME, NOT NULL, DEFAULT CURRENT_TIMESTAMP
- `status` — VARCHAR(20), NOT NULL, DEFAULT 'aberto', CHECK (aberto / triado / confirmado / cancelado)
- `id_medico` — INT, FK → usuario (quem confirmou; vazio até a confirmação)
- `data_hora_confirmacao` — DATETIME
- `diagnostico` — VARCHAR(300)
- O número `AT0001` não é gravado: o back-end monta a partir do `id_atendimento`.

**triagem**
- `id_triagem` — INT, PK, AUTO_INCREMENT
- `id_atendimento` — INT, NOT NULL, UNIQUE, FK → atendimento
- `id_enfermeiro` — INT, NOT NULL, FK → usuario (enfermagem que fez)
- `data_hora` — DATETIME, NOT NULL, DEFAULT CURRENT_TIMESTAMP
- `pressao_arterial` — VARCHAR(7), NOT NULL (ex: 120/80)
- `temperatura` — DECIMAL(3,1), NOT NULL, CHECK 30.0 a 45.0 (ex: 36.5)
- `batimentos_cardiacos` — INT, NOT NULL, CHECK 0 a 300
- `queixas` — VARCHAR(255), NOT NULL
- `prioridade` — TINYINT, NOT NULL, CHECK 1 a 5 (Manchester: 1 vermelho, 2 laranja, 3 amarelo, 4 verde, 5 azul)

**prescricao**
- `id_prescricao` — INT, PK, AUTO_INCREMENT
- `id_atendimento` — INT, NOT NULL, FK → atendimento
- `medicamento` — VARCHAR(100), NOT NULL
- `dosagem` — VARCHAR(50), NOT NULL
- `frequencia` — VARCHAR(50), NOT NULL

**Logins de teste** (inseridos pelo `create_table.sql`)

| Usuário | Senha | Perfil |
|---|---|---|
| `recepcao` | `123` | recepcao |
| `enfermagem` | `123` | enfermagem |
| `medico` | `123` | medico |
