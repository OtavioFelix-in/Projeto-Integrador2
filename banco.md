# Banco de Dados — Oracle

Script de criação das tabelas em Oracle (SQL + PL/SQL). Requer Oracle 12c ou superior (usa `GENERATED AS IDENTITY`).

## Dicionário de dados

### Cadastro e acesso (novo)

**funcionario**
- `id_funcionario` — NUMBER, PK, IDENTITY
- `nome_completo` — VARCHAR2(150), NOT NULL
- `cpf` — VARCHAR2(14), NOT NULL, UNIQUE
- `email` — VARCHAR2(120), NOT NULL, UNIQUE
- `telefone` — VARCHAR2(20)
- `data_cadastro` — DATE, NOT NULL, DEFAULT SYSDATE
- `ativo` — CHAR(1), NOT NULL, DEFAULT 'S' ('S' / 'N')

**usuario** (login de quem acessa o sistema; 1:1 com funcionario)
- `id_usuario` — NUMBER, PK, IDENTITY
- `id_funcionario` — NUMBER, NOT NULL, UNIQUE, FK → funcionario
- `login` — VARCHAR2(50), NOT NULL, UNIQUE
- `senha_hash` — VARCHAR2(255), NOT NULL (hash bcrypt, nunca a senha pura)
- `perfil` — VARCHAR2(20), NOT NULL (recepcao / enfermagem / medico / admin)
- `ativo` — CHAR(1), NOT NULL, DEFAULT 'S'
- `ultimo_acesso` — TIMESTAMP

**medico** (especialização de funcionario)
- `id_funcionario` — NUMBER, PK, FK → funcionario
- `crm` — VARCHAR2(10), NOT NULL
- `uf_crm` — CHAR(2), NOT NULL (CRM é único por UF)
- `especialidade` — VARCHAR2(80)

**enfermeiro** (especialização de funcionario)
- `id_funcionario` — NUMBER, PK, FK → funcionario
- `coren` — VARCHAR2(15), NOT NULL
- `uf_coren` — CHAR(2), NOT NULL
- `turno` — VARCHAR2(20)

### Fluxo de atendimento

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
- `id_funcionario_abertura` — NUMBER, NOT NULL, FK → funcionario (quem abriu na recepção)
- `id_medico` — NUMBER, FK → medico (preenchido na confirmação da consulta)

**triagem**
- `id_triagem` — NUMBER, PK, IDENTITY
- `id_atendimento` — NUMBER, NOT NULL, UNIQUE, FK → atendimento
- `pressao_arterial` — VARCHAR2(10) (ex: 120/80)
- `temperatura` — NUMBER(3,1) (ex: 36.5)
- `batimentos_cardiacos` — NUMBER
- `queixas` — VARCHAR2(255)
- `prioridade` — NUMBER(1), NOT NULL (1 a 5)
- `id_enfermeiro` — NUMBER, NOT NULL, FK → enfermeiro (quem fez a triagem)

**prescricao**
- `id_prescricao` — NUMBER, PK, IDENTITY
- `id_atendimento` — NUMBER, NOT NULL, FK → atendimento
- `medicamento` — VARCHAR2(100), NOT NULL
- `dosagem` — VARCHAR2(50)
- `id_medico` — NUMBER, NOT NULL, FK → medico (quem prescreveu)

## Script de criação

```sql
-- FUNCIONARIO
CREATE TABLE funcionario (
    id_funcionario  NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nome_completo   VARCHAR2(150) NOT NULL,
    cpf             VARCHAR2(14)  NOT NULL,
    email           VARCHAR2(120) NOT NULL,
    telefone        VARCHAR2(20),
    data_cadastro   DATE DEFAULT SYSDATE NOT NULL,
    ativo           CHAR(1) DEFAULT 'S' NOT NULL,
    CONSTRAINT uk_funcionario_cpf   UNIQUE (cpf),
    CONSTRAINT uk_funcionario_email UNIQUE (email),
    CONSTRAINT ck_funcionario_ativo CHECK (ativo IN ('S', 'N'))
);

-- USUARIO (login; 1:1 com funcionario)
CREATE TABLE usuario (
    id_usuario      NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_funcionario  NUMBER NOT NULL,
    login           VARCHAR2(50)  NOT NULL,
    senha_hash      VARCHAR2(255) NOT NULL,
    perfil          VARCHAR2(20)  NOT NULL,
    ativo           CHAR(1) DEFAULT 'S' NOT NULL,
    ultimo_acesso   TIMESTAMP,
    CONSTRAINT uk_usuario_funcionario UNIQUE (id_funcionario),
    CONSTRAINT uk_usuario_login       UNIQUE (login),
    CONSTRAINT ck_usuario_perfil
        CHECK (perfil IN ('recepcao', 'enfermagem', 'medico', 'admin')),
    CONSTRAINT ck_usuario_ativo CHECK (ativo IN ('S', 'N')),
    CONSTRAINT fk_usuario_funcionario
        FOREIGN KEY (id_funcionario) REFERENCES funcionario (id_funcionario)
);

-- MEDICO (especialização de funcionario)
CREATE TABLE medico (
    id_funcionario  NUMBER PRIMARY KEY,
    crm             VARCHAR2(10) NOT NULL,
    uf_crm          CHAR(2)      NOT NULL,
    especialidade   VARCHAR2(80),
    CONSTRAINT uk_medico_crm UNIQUE (crm, uf_crm),
    CONSTRAINT fk_medico_funcionario
        FOREIGN KEY (id_funcionario) REFERENCES funcionario (id_funcionario)
);

-- ENFERMEIRO (especialização de funcionario)
CREATE TABLE enfermeiro (
    id_funcionario  NUMBER PRIMARY KEY,
    coren           VARCHAR2(15) NOT NULL,
    uf_coren        CHAR(2)      NOT NULL,
    turno           VARCHAR2(20),
    CONSTRAINT uk_enfermeiro_coren UNIQUE (coren, uf_coren),
    CONSTRAINT fk_enfermeiro_funcionario
        FOREIGN KEY (id_funcionario) REFERENCES funcionario (id_funcionario)
);

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
    id_funcionario_abertura NUMBER NOT NULL,
    id_medico           NUMBER,
    CONSTRAINT uk_atendimento_numero UNIQUE (numero_atendimento),
    CONSTRAINT ck_atendimento_status
        CHECK (status IN ('aberto', 'triado', 'confirmado', 'cancelado')),
    CONSTRAINT fk_atendimento_paciente
        FOREIGN KEY (id_paciente) REFERENCES paciente (id_paciente),
    CONSTRAINT fk_atendimento_abertura
        FOREIGN KEY (id_funcionario_abertura) REFERENCES funcionario (id_funcionario),
    CONSTRAINT fk_atendimento_medico
        FOREIGN KEY (id_medico) REFERENCES medico (id_funcionario)
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
    id_enfermeiro         NUMBER NOT NULL,
    CONSTRAINT uk_triagem_atendimento UNIQUE (id_atendimento),
    CONSTRAINT ck_triagem_prioridade CHECK (prioridade BETWEEN 1 AND 5),
    CONSTRAINT fk_triagem_atendimento
        FOREIGN KEY (id_atendimento) REFERENCES atendimento (id_atendimento),
    CONSTRAINT fk_triagem_enfermeiro
        FOREIGN KEY (id_enfermeiro) REFERENCES enfermeiro (id_funcionario)
);

-- PRESCRICAO (1:N com atendimento)
CREATE TABLE prescricao (
    id_prescricao   NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_atendimento  NUMBER NOT NULL,
    medicamento     VARCHAR2(100) NOT NULL,
    dosagem         VARCHAR2(50),
    id_medico       NUMBER NOT NULL,
    CONSTRAINT fk_prescricao_atendimento
        FOREIGN KEY (id_atendimento) REFERENCES atendimento (id_atendimento),
    CONSTRAINT fk_prescricao_medico
        FOREIGN KEY (id_medico) REFERENCES medico (id_funcionario)
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
CREATE INDEX idx_atendimento_medico   ON atendimento (id_medico);
CREATE INDEX idx_triagem_enfermeiro   ON triagem (id_enfermeiro);
CREATE INDEX idx_prescricao_medico    ON prescricao (id_medico);
```
