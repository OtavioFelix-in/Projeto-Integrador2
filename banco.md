Banco MySQL (8.0.16 ou superior, por causa dos CHECK). Script completo em `create_table.sql`.

**usuario**
- `id_usuario` — INT, PK, AUTO_INCREMENT
- `nome` — VARCHAR(100), NOT NULL
- `cpf` — VARCHAR(11), NOT NULL, UNIQUE (só números)
- `telefone` — VARCHAR(11), NOT NULL
- `email` — VARCHAR(100)
- `login` — VARCHAR(30), NOT NULL, UNIQUE
- `senha_hash` — VARCHAR(255), NOT NULL (hash bcrypt, nunca senha pura)
- `perfil` — VARCHAR(20), NOT NULL, CHECK (recepcao / enfermagem / medico)
- `ativo` — TINYINT(1), NOT NULL, DEFAULT 1

**paciente**
- `id_paciente` — INT, PK, AUTO_INCREMENT
- `nome_completo` — VARCHAR(150), NOT NULL
- `cpf` — VARCHAR(11), UNIQUE (só números)
- `rg` — VARCHAR(20), UNIQUE
- `data_nascimento` — DATE, NOT NULL
- `sexo` — VARCHAR(20), NOT NULL
- `telefone` — VARCHAR(11)
- `nome_pai` — VARCHAR(150)
- `nome_mae` — VARCHAR(150)
- `endereco` — VARCHAR(200)
- CHECK: pelo menos um entre `cpf` e `rg` preenchido. Menor de 18 anos exige pai ou mãe (validado no back-end).

**atendimento**
- `id_atendimento` — INT, PK, AUTO_INCREMENT
- `numero_atendimento` — VARCHAR(10), UNIQUE (AT0001, preenchido logo após o INSERT a partir do `id_atendimento`)
- `id_paciente` — INT, NOT NULL, FK → paciente
- `data_hora_entrada` — DATETIME, NOT NULL, DEFAULT CURRENT_TIMESTAMP
- `status` — VARCHAR(20), NOT NULL, DEFAULT 'aberto', CHECK (aberto / triado / confirmado / cancelado)
- `id_medico` — INT, FK → usuario (quem confirmou)
- `data_hora_confirmacao` — DATETIME
- `diagnostico` — VARCHAR(300)
- `avaliacao_medica` — VARCHAR(300)
- `data_hora_saida` — DATETIME (alta)

**triagem**
- `id_triagem` — INT, PK, AUTO_INCREMENT
- `id_atendimento` — INT, NOT NULL, UNIQUE, FK → atendimento
- `id_usuario` — INT, NOT NULL, FK → usuario (enfermagem que fez)
- `pressao_arterial` — VARCHAR(7), NOT NULL (ex: 120/80)
- `temperatura` — DECIMAL(3,1), NOT NULL, CHECK 20.0 a 45.0 (ex: 36.5)
- `batimentos_cardiacos` — INT, NOT NULL, CHECK 0 a 300
- `queixas` — VARCHAR(255), NOT NULL
- `prioridade` — TINYINT, NOT NULL, CHECK 1 a 5 (Manchester: 1 vermelho, 2 laranja, 3 amarelo, 4 verde, 5 azul)

**prescricao**
- `id_prescricao` — INT, PK, AUTO_INCREMENT
- `id_atendimento` — INT, NOT NULL, FK → atendimento
- `medicamento` — VARCHAR(100), NOT NULL
- `dosagem` — VARCHAR(50), NOT NULL
- `frequencia` — VARCHAR(50), NOT NULL
