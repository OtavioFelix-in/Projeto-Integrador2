-- Projeto Integrador 2 - Pronto Socorro (MySQL 8.0.16+, por causa dos CHECK)
-- 5 tabelas: usuario, paciente, atendimento, triagem, prescricao

CREATE TABLE usuario (
    id_usuario  INT AUTO_INCREMENT PRIMARY KEY,
    nome        VARCHAR(100) NOT NULL,
    cpf         VARCHAR(11)  NOT NULL UNIQUE,       -- so numeros
    telefone    VARCHAR(11)  NOT NULL,
    email       VARCHAR(100),
    login       VARCHAR(30)  NOT NULL UNIQUE,
    senha_hash  VARCHAR(255) NOT NULL,              -- nunca guardar senha pura (usar bcrypt no back)
    perfil      VARCHAR(20)  NOT NULL,
    ativo       TINYINT(1)   NOT NULL DEFAULT 1,
    CONSTRAINT ck_usuario_perfil CHECK (perfil IN ('recepcao', 'enfermagem', 'medico'))
);

CREATE TABLE paciente (
    id_paciente      INT AUTO_INCREMENT PRIMARY KEY,
    nome_completo    VARCHAR(150) NOT NULL,
    cpf              VARCHAR(11)  UNIQUE,            -- so numeros
    rg               VARCHAR(20)  UNIQUE,
    data_nascimento  DATE         NOT NULL,
    sexo             VARCHAR(20)  NOT NULL,
    telefone         VARCHAR(11),
    nome_pai         VARCHAR(150),
    nome_mae         VARCHAR(150),
    endereco         VARCHAR(200),
    -- precisa de pelo menos um documento (CPF ou RG)
    CONSTRAINT ck_paciente_documento CHECK (cpf IS NOT NULL OR rg IS NOT NULL)
    -- regra de menor de 18 (pai ou mae obrigatorio) fica no back-end
);

CREATE TABLE atendimento (
    id_atendimento         INT AUTO_INCREMENT PRIMARY KEY,
    numero_atendimento     VARCHAR(10) UNIQUE,       -- AT0001, preenchido logo apos o INSERT (ver abaixo)
    id_paciente            INT         NOT NULL,
    data_hora_entrada      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status                 VARCHAR(20) NOT NULL DEFAULT 'aberto',
    id_medico              INT,                      -- quem confirmou
    data_hora_confirmacao  DATETIME,
    diagnostico            VARCHAR(300),             -- preenchidos pelo medico
    avaliacao_medica       VARCHAR(300),
    data_hora_saida        DATETIME,                 -- alta
    CONSTRAINT fk_atendimento_paciente FOREIGN KEY (id_paciente) REFERENCES paciente (id_paciente),
    CONSTRAINT fk_atendimento_medico   FOREIGN KEY (id_medico)   REFERENCES usuario (id_usuario),
    CONSTRAINT ck_atendimento_status   CHECK (status IN ('aberto', 'triado', 'confirmado', 'cancelado'))
);
-- Numero do atendimento (rodar na mesma transacao do INSERT):
--   UPDATE atendimento
--      SET numero_atendimento = CONCAT('AT', LPAD(id_atendimento, 4, '0'))
--    WHERE id_atendimento = LAST_INSERT_ID();

CREATE TABLE triagem (
    id_triagem            INT AUTO_INCREMENT PRIMARY KEY,
    id_atendimento        INT          NOT NULL UNIQUE,   -- 1:1
    id_usuario            INT          NOT NULL,          -- enfermagem que fez
    pressao_arterial      VARCHAR(7)   NOT NULL,          -- ex: 120/80
    temperatura           DECIMAL(3,1) NOT NULL,          -- ex: 36.5
    batimentos_cardiacos  INT          NOT NULL,
    queixas               VARCHAR(255) NOT NULL,
    prioridade            TINYINT      NOT NULL,          -- 1 vermelho, 2 laranja, 3 amarelo, 4 verde, 5 azul
    CONSTRAINT fk_triagem_atendimento FOREIGN KEY (id_atendimento) REFERENCES atendimento (id_atendimento),
    CONSTRAINT fk_triagem_usuario     FOREIGN KEY (id_usuario)     REFERENCES usuario (id_usuario),
    CONSTRAINT ck_triagem_temperatura CHECK (temperatura BETWEEN 20.0 AND 45.0),
    CONSTRAINT ck_triagem_batimentos  CHECK (batimentos_cardiacos BETWEEN 0 AND 300),
    CONSTRAINT ck_triagem_prioridade  CHECK (prioridade BETWEEN 1 AND 5)
);

CREATE TABLE prescricao (
    id_prescricao   INT AUTO_INCREMENT PRIMARY KEY,
    id_atendimento  INT          NOT NULL,                -- 1:N
    medicamento     VARCHAR(100) NOT NULL,
    dosagem         VARCHAR(50)  NOT NULL,
    frequencia      VARCHAR(50)  NOT NULL,
    CONSTRAINT fk_prescricao_atendimento FOREIGN KEY (id_atendimento) REFERENCES atendimento (id_atendimento)
);
