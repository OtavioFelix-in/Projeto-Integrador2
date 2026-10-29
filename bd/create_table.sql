-- Projeto Integrador 2 - Sistema de Atendimento de Pronto Socorro
-- MySQL 8.0.16 ou superior (por causa dos CHECK)
-- 6 tabelas: usuario, paciente, atendimento, triagem, medicamento, prescricao

-- Apaga e recria o banco do zero (roda quantas vezes precisar)
DROP DATABASE IF EXISTS pronto_socorro;
CREATE DATABASE pronto_socorro;
USE pronto_socorro;

-- Profissionais que usam o sistema (recepção, enfermagem, médico)
CREATE TABLE usuario (
    id_usuario  INT AUTO_INCREMENT PRIMARY KEY,
    nome        VARCHAR(100) NOT NULL,
    cpf         CHAR(11)     NOT NULL UNIQUE,          -- só números
    telefone    VARCHAR(11)  NOT NULL,                 -- só números, com DDD
    email       VARCHAR(120),
    login       VARCHAR(30)  NOT NULL UNIQUE,
    senha_hash  VARCHAR(255) NOT NULL,                 -- bcrypt, nunca a senha pura
    perfil      VARCHAR(20)  NOT NULL,
    ativo       BOOLEAN      NOT NULL DEFAULT TRUE,    -- inativo não entra no sistema
    CONSTRAINT ck_usuario_perfil CHECK (perfil IN ('recepcao', 'enfermagem', 'medico'))
);

-- Dados pessoais do paciente, cadastrado uma vez só
CREATE TABLE paciente (
    id_paciente      INT AUTO_INCREMENT PRIMARY KEY,
    nome_completo    VARCHAR(150) NOT NULL,
    cpf              CHAR(11)     UNIQUE,              -- só números
    rg               VARCHAR(20)  UNIQUE,
    data_nascimento  DATE         NOT NULL,
    sexo             CHAR(1)      NOT NULL,
    telefone         VARCHAR(11),
    endereco         VARCHAR(200),
    nome_pai         VARCHAR(150),
    nome_mae         VARCHAR(150),
    CONSTRAINT ck_paciente_documento CHECK (cpf IS NOT NULL OR rg IS NOT NULL),
    CONSTRAINT ck_paciente_sexo      CHECK (sexo IN ('M', 'F'))
);

-- A esteira: cada ida ao pronto socorro (número AT0001 = 'AT' + id_atendimento)
-- status: aberto (recepção) -> triado (enfermagem) -> atendido (médico), ou cancelado
CREATE TABLE atendimento (
    id_atendimento         INT AUTO_INCREMENT PRIMARY KEY,
    id_paciente            INT          NOT NULL,
    status                 VARCHAR(20)  NOT NULL DEFAULT 'aberto',
    id_recepcionista       INT          NOT NULL,
    data_hora_entrada      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    id_medico              INT,                        -- vazio até o médico atender
    data_hora_atendimento  DATETIME,
    diagnostico            VARCHAR(300),
    CONSTRAINT fk_atendimento_paciente      FOREIGN KEY (id_paciente)      REFERENCES paciente (id_paciente),
    CONSTRAINT fk_atendimento_recepcionista FOREIGN KEY (id_recepcionista) REFERENCES usuario (id_usuario),
    CONSTRAINT fk_atendimento_medico        FOREIGN KEY (id_medico)        REFERENCES usuario (id_usuario),
    CONSTRAINT ck_atendimento_status        CHECK (status IN ('aberto', 'triado', 'atendido', 'cancelado'))
);

-- Triagem da enfermagem, uma por atendimento
-- classificacao (Manchester): 1 vermelho, 2 laranja, 3 amarelo, 4 verde, 5 azul
CREATE TABLE triagem (
    id_triagem            INT AUTO_INCREMENT PRIMARY KEY,
    id_atendimento        INT          NOT NULL UNIQUE,
    id_enfermeiro         INT          NOT NULL,
    data_hora             DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    pressao_arterial      VARCHAR(7)   NOT NULL,       -- ex: 120/80
    temperatura           DECIMAL(3,1) NOT NULL,       -- ex: 36.5
    batimentos_cardiacos  INT          NOT NULL,
    queixas               VARCHAR(255) NOT NULL,
    classificacao         TINYINT      NOT NULL,
    CONSTRAINT fk_triagem_atendimento  FOREIGN KEY (id_atendimento) REFERENCES atendimento (id_atendimento),
    CONSTRAINT fk_triagem_enfermeiro   FOREIGN KEY (id_enfermeiro)  REFERENCES usuario (id_usuario),
    CONSTRAINT ck_triagem_temperatura  CHECK (temperatura BETWEEN 30.0 AND 45.0),
    CONSTRAINT ck_triagem_batimentos   CHECK (batimentos_cardiacos BETWEEN 0 AND 300),
    CONSTRAINT ck_triagem_classificacao CHECK (classificacao BETWEEN 1 AND 5)
);

-- Catálogo de remédios que o médico seleciona
CREATE TABLE medicamento (
    id_medicamento  INT AUTO_INCREMENT PRIMARY KEY,
    nome            VARCHAR(100) NOT NULL,
    apresentacao    VARCHAR(100) NOT NULL,             -- ex: 500 mg comprimido
    ativo           BOOLEAN      NOT NULL DEFAULT TRUE, -- inativo sai da lista
    CONSTRAINT uk_medicamento UNIQUE (nome, apresentacao)
);

-- Remédios passados em cada atendimento
CREATE TABLE prescricao (
    id_prescricao   INT AUTO_INCREMENT PRIMARY KEY,
    id_atendimento  INT         NOT NULL,
    id_medicamento  INT         NOT NULL,
    dosagem         VARCHAR(50) NOT NULL,              -- ex: 1 comprimido
    frequencia      VARCHAR(50) NOT NULL,              -- ex: 6 em 6 horas
    CONSTRAINT fk_prescricao_atendimento FOREIGN KEY (id_atendimento) REFERENCES atendimento (id_atendimento),
    CONSTRAINT fk_prescricao_medicamento FOREIGN KEY (id_medicamento) REFERENCES medicamento (id_medicamento)
);

-- Usuários de teste: login recepcao / enfermagem / medico, senha 123 (hash bcrypt)
INSERT INTO usuario (nome, cpf, telefone, email, login, senha_hash, perfil) VALUES
    ('Recepcionista Teste', '11111111111', '19911111111', NULL, 'recepcao',   '$2a$10$vEzRVwkt1ryy0HfwUMON1u4n6J09fDOksEEGnDSD9MDOuiihuRfx2', 'recepcao'),
    ('Enfermeira Teste',    '22222222222', '19922222222', NULL, 'enfermagem', '$2a$10$vEzRVwkt1ryy0HfwUMON1u4n6J09fDOksEEGnDSD9MDOuiihuRfx2', 'enfermagem'),
    ('Medico Teste',        '33333333333', '19933333333', NULL, 'medico',     '$2a$10$vEzRVwkt1ryy0HfwUMON1u4n6J09fDOksEEGnDSD9MDOuiihuRfx2', 'medico');

-- Lista inicial de medicamentos comuns de pronto socorro
INSERT INTO medicamento (nome, apresentacao) VALUES
    ('Dipirona',             '500 mg comprimido'),
    ('Dipirona',             '500 mg/ml injetável'),
    ('Paracetamol',          '750 mg comprimido'),
    ('Ibuprofeno',           '600 mg comprimido'),
    ('Cetoprofeno',          '100 mg injetável'),
    ('Tramadol',             '50 mg/ml injetável'),
    ('Escopolamina',         '20 mg/ml injetável'),
    ('Ondansetrona',         '8 mg injetável'),
    ('Metoclopramida',       '10 mg injetável'),
    ('Omeprazol',            '40 mg injetável'),
    ('Amoxicilina',          '500 mg cápsula'),
    ('Azitromicina',         '500 mg comprimido'),
    ('Cefalexina',           '500 mg cápsula'),
    ('Loratadina',           '10 mg comprimido'),
    ('Prometazina',          '25 mg/ml injetável'),
    ('Dexametasona',         '4 mg/ml injetável'),
    ('Hidrocortisona',       '100 mg injetável'),
    ('Salbutamol',           '100 mcg spray'),
    ('Captopril',            '25 mg comprimido'),
    ('Soro fisiológico 0,9%', '500 ml');
