-- Projeto Integrador 2 - Pronto Socorro (MySQL 8.0.16+, por causa dos CHECK)
-- 6 tabelas: usuario, login, paciente, atendimento, triagem, prescricao

CREATE DATABASE IF NOT EXISTS pronto_socorro;
USE pronto_socorro;

CREATE TABLE usuario (
    id_usuario  INT AUTO_INCREMENT PRIMARY KEY,
    nome        VARCHAR(100) NOT NULL,
    cpf         CHAR(11)     NOT NULL UNIQUE,
    perfil      VARCHAR(20)  NOT NULL,
    CONSTRAINT ck_usuario_perfil CHECK (perfil IN ('recepcao', 'enfermagem', 'medico'))
);

CREATE TABLE login (
    id_login    INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario  INT          NOT NULL UNIQUE,
    usuario     VARCHAR(30)  NOT NULL UNIQUE,
    senha       VARCHAR(255) NOT NULL,
    CONSTRAINT fk_login_usuario FOREIGN KEY (id_usuario) REFERENCES usuario (id_usuario)
);

CREATE TABLE paciente (
    id_paciente      INT AUTO_INCREMENT PRIMARY KEY,
    nome_completo    VARCHAR(150) NOT NULL,
    cpf              CHAR(11)     UNIQUE,
    rg               VARCHAR(20)  UNIQUE,
    data_nascimento  DATE         NOT NULL,
    sexo             CHAR(1)      NOT NULL,
    telefone         VARCHAR(11),
    nome_pai         VARCHAR(150),
    nome_mae         VARCHAR(150),
    endereco         VARCHAR(200),
    CONSTRAINT ck_paciente_documento CHECK (cpf IS NOT NULL OR rg IS NOT NULL),
    CONSTRAINT ck_paciente_sexo      CHECK (sexo IN ('M', 'F'))
);

CREATE TABLE atendimento (
    id_atendimento         INT AUTO_INCREMENT PRIMARY KEY,
    id_paciente            INT          NOT NULL,
    data_hora_entrada      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status                 VARCHAR(20)  NOT NULL DEFAULT 'aberto',
    id_medico              INT,
    data_hora_confirmacao  DATETIME,
    diagnostico            VARCHAR(300),
    CONSTRAINT fk_atendimento_paciente FOREIGN KEY (id_paciente) REFERENCES paciente (id_paciente),
    CONSTRAINT fk_atendimento_medico   FOREIGN KEY (id_medico)   REFERENCES usuario (id_usuario),
    CONSTRAINT ck_atendimento_status   CHECK (status IN ('aberto', 'triado', 'confirmado', 'cancelado'))
);

CREATE TABLE triagem (
    id_triagem            INT AUTO_INCREMENT PRIMARY KEY,
    id_atendimento        INT          NOT NULL UNIQUE,
    id_enfermeiro         INT          NOT NULL,
    data_hora             DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    pressao_arterial      VARCHAR(7)   NOT NULL,
    temperatura           DECIMAL(3,1) NOT NULL,
    batimentos_cardiacos  INT          NOT NULL,
    queixas               VARCHAR(255) NOT NULL,
    prioridade            TINYINT      NOT NULL,
    CONSTRAINT fk_triagem_atendimento FOREIGN KEY (id_atendimento) REFERENCES atendimento (id_atendimento),
    CONSTRAINT fk_triagem_enfermeiro  FOREIGN KEY (id_enfermeiro)  REFERENCES usuario (id_usuario),
    CONSTRAINT ck_triagem_temperatura CHECK (temperatura BETWEEN 30.0 AND 45.0),
    CONSTRAINT ck_triagem_batimentos  CHECK (batimentos_cardiacos BETWEEN 0 AND 300),
    CONSTRAINT ck_triagem_prioridade  CHECK (prioridade BETWEEN 1 AND 5)
);

CREATE TABLE prescricao (
    id_prescricao   INT AUTO_INCREMENT PRIMARY KEY,
    id_atendimento  INT          NOT NULL,
    medicamento     VARCHAR(100) NOT NULL,
    dosagem         VARCHAR(50)  NOT NULL,
    frequencia      VARCHAR(50)  NOT NULL,
    CONSTRAINT fk_prescricao_atendimento FOREIGN KEY (id_atendimento) REFERENCES atendimento (id_atendimento)
);

INSERT INTO usuario (nome, cpf, perfil) VALUES
    ('Recepcao Teste',  '11111111111', 'recepcao'),
    ('Enfermeira Teste','22222222222', 'enfermagem'),
    ('Medico Teste',    '33333333333', 'medico');

INSERT INTO login (id_usuario, usuario, senha) VALUES
    (1, 'recepcao',   '123'),
    (2, 'enfermagem', '123'),
    (3, 'medico',     '123');
