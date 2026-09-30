# Banco de Dados — Oracle

Script de criação das tabelas em Oracle (SQL + PL/SQL). Requer Oracle 12c ou superior (usa `GENERATED AS IDENTITY`).

## Dicionário de dados

**paciente**
- `id_paciente` — NUMBER, PK, IDENTITY
- `nome_completo` — VARCHAR2(150), NOT NULL
- `cpf` — VARCHAR2(14), NOT NULL, UNIQUE
- `rg` — VARCHAR2(12), NOT NULL, UNIQUE
- `data_nascimento` — DATE, NOT NULL
- `nome_pai` — VARCHAR2(150)
- `nome_mae` — VARCHAR2(150)
- `endereco` — VARCHAR2(200)

**atendimento**
- `id_atendimento` — NUMBER, PK, IDENTITY
- `numero_atendimento` — VARCHAR2(10), NOT NULL, UNIQUE (AT0001) — preenchido pela trigger
- `data_hora_entrada` — TIMESTAMP, NOT NULL, DEFAULT SYSTIMESTAMP
- `status` — VARCHAR2(20), NOT NULL (aberto / triado / confirmado / cancelado)
- `id_paciente` — NUMBER, NOT NULL, FK → paciente

**triagem**
- `id_triagem` — NUMBER, PK, IDENTITY
- `id_atendimento` — NUMBER, NOT NULL, UNIQUE, FK → atendimento
- `pressao_arterial` — VARCHAR2(10) (ex: 120/80)
- `temperatura` — NUMBER(3,1) (ex: 36.5)
- `batimentos_cardiacos` — NUMBER
- `queixas` — VARCHAR2(255)
- `prioridade` — NUMBER(1), NOT NULL (1 a 5)

**prescricao**
- `id_prescricao` — NUMBER, PK, IDENTITY
- `id_atendimento` — NUMBER, NOT NULL, FK → atendimento
- `medicamento` — VARCHAR2(100), NOT NULL
- `dosagem` — VARCHAR2(50)

## Script de criação

```sql
-- PACIENTE
CREATE TABLE paciente (
    id_paciente      NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nome_completo    VARCHAR2(150) NOT NULL,
    cpf              VARCHAR2(14)  NOT NULL,
    rg               VARCHAR2(12)  NOT NULL,
    data_nascimento  DATE          NOT NULL,
    nome_pai         VARCHAR2(150),
    nome_mae         VARCHAR2(150),
    endereco         VARCHAR2(200),
    CONSTRAINT uk_paciente_cpf UNIQUE (cpf),
    CONSTRAINT uk_paciente_rg  UNIQUE (rg)
);

-- ATENDIMENTO
CREATE TABLE atendimento (
    id_atendimento      NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    numero_atendimento  VARCHAR2(10) NOT NULL,
    data_hora_entrada   TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
    status              VARCHAR2(20) DEFAULT 'aberto' NOT NULL,
    id_paciente         NUMBER NOT NULL,
    CONSTRAINT uk_atendimento_numero UNIQUE (numero_atendimento),
    CONSTRAINT ck_atendimento_status
        CHECK (status IN ('aberto', 'triado', 'confirmado', 'cancelado')),
    CONSTRAINT fk_atendimento_paciente
        FOREIGN KEY (id_paciente) REFERENCES paciente (id_paciente)
);

-- TRIAGEM (1:1 com atendimento)
CREATE TABLE triagem (
    id_triagem            NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_atendimento        NUMBER NOT NULL,
    pressao_arterial      VARCHAR2(10),
    temperatura           NUMBER(3,1),
    batimentos_cardiacos  NUMBER,
    queixas               VARCHAR2(255),
    prioridade            NUMBER(1) NOT NULL,
    CONSTRAINT uk_triagem_atendimento UNIQUE (id_atendimento),
    CONSTRAINT ck_triagem_prioridade CHECK (prioridade BETWEEN 1 AND 5),
    CONSTRAINT fk_triagem_atendimento
        FOREIGN KEY (id_atendimento) REFERENCES atendimento (id_atendimento)
);

-- PRESCRICAO (1:N com atendimento)
CREATE TABLE prescricao (
    id_prescricao   NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_atendimento  NUMBER NOT NULL,
    medicamento     VARCHAR2(100) NOT NULL,
    dosagem         VARCHAR2(50),
    CONSTRAINT fk_prescricao_atendimento
        FOREIGN KEY (id_atendimento) REFERENCES atendimento (id_atendimento)
);

-- Sequence que controla o contador do número do atendimento
CREATE SEQUENCE seq_atendimento START WITH 1 INCREMENT BY 1;

-- Trigger que monta o número formatado (AT0001, AT0002...)
CREATE OR REPLACE TRIGGER trg_gerar_numero_atendimento
BEFORE INSERT ON atendimento
FOR EACH ROW
DECLARE
    v_proximo NUMBER;
BEGIN
    SELECT seq_atendimento.NEXTVAL INTO v_proximo FROM DUAL;
    :NEW.numero_atendimento := 'AT' || LPAD(v_proximo, 4, '0');
END;
/

-- Índices de apoio às consultas do sistema
CREATE INDEX idx_atendimento_paciente ON atendimento (id_paciente);
CREATE INDEX idx_atendimento_status   ON atendimento (status);
CREATE INDEX idx_prescricao_atend     ON prescricao (id_atendimento);
```
