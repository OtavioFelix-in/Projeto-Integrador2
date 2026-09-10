**paciente**
- `id_paciente` — INT, PK, AUTO_INCREMENT
- `nome_completo` — VARCHAR(150), NOT NULL
- `cpf` — VARCHAR(14), NOT NULL, UNIQUE
- `rg` — VARCHAR(12), NOT NULL, UNIQUE
- `data_nascimento` — DATE, NOT NULL
- `nome_pai` — VARCHAR(150)
- `nome_mae` — VARCHAR(150)
- `endereco` — VARCHAR(200)

**atendimento**
- `id_atendimento` — INT, PK, AUTO_INCREMENT
- `numero_atendimento` — VARCHAR(10), NOT NULL, UNIQUE (AT0001)
- `data_hora_entrada` — DATETIME, NOT NULL
- `status` — VARCHAR(20), NOT NULL (aberto / triado / confirmado / cancelado)
- `id_paciente` — INT, NOT NULL, FK → paciente

**triagem**
- `id_triagem` — INT, PK, AUTO_INCREMENT
- `id_atendimento` — INT, NOT NULL, UNIQUE, FK → atendimento
- `pressao_arterial` — VARCHAR(10) (ex: 120/80)
- `temperatura` — DECIMAL(3,1) (ex: 36.5)
- `batimentos_cardiacos` — INT
- `queixas` — VARCHAR(255)
- `prioridade` — INT, NOT NULL (1 a 5)

**prescricao**
- `id_prescricao` — INT, PK, AUTO_INCREMENT
- `id_atendimento` — INT, NOT NULL, FK → atendimento
- `medicamento` — VARCHAR(100), NOT NULL
- `dosagem` — VARCHAR(50)
