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

-- Equipe de teste: 10 recepção, 10 enfermagem, 10 médicos. O login é o CPF.
-- As senhas estão no README (aqui fica só o hash bcrypt)
INSERT INTO usuario (nome, cpf, telefone, email, login, senha_hash, perfil) VALUES
    ('Ana Paula Ferreira', '10736842705', '19981234567', 'ana.ferreira@prontosocorro.exemplo.com', '10736842705', '$2b$10$FVB4gT7y77rT5ZjOoErBu.jjyzzhJVz0sPL7NyTMUr.p4S2MX6S5i', 'recepcao'),
    ('Bruno Henrique Lima', '11473685460', '19982469134', 'bruno.lima@prontosocorro.exemplo.com', '11473685460', '$2b$10$o2OLlnfXzadLmjNvPPpPuuru2tdcxnxoH6C1kzE.4nb.5lLkJea2G', 'recepcao'),
    ('Camila Rodrigues Souza', '12210528100', '19983703701', 'camila.souza@prontosocorro.exemplo.com', '12210528100', '$2b$10$FRRVcQrutK0eCmirWZ3ZR.UQUV8HwaOl3XEcHIqg/sDdUMzzZ5j26', 'recepcao'),
    ('Diego Martins Alves', '12947370821', '19984938268', 'diego.alves@prontosocorro.exemplo.com', '12947370821', '$2b$10$tIHAFBb8UT/mZCISuhFb8usXKDWQCN3I0lwrB1P.dMPhv.9mEfSAG', 'recepcao'),
    ('Fernanda Costa Ribeiro', '13684213500', '19986172835', 'fernanda.ribeiro@prontosocorro.exemplo.com', '13684213500', '$2b$10$hohOQ7GVCWxEPn5b6RasKuJagUlesmWJB68XqtA3mXCcx8orO2fd2', 'recepcao'),
    ('Gustavo Pereira Nunes', '14421056235', '19987407402', 'gustavo.nunes@prontosocorro.exemplo.com', '14421056235', '$2b$10$O6Kzvkm8sURSg2phReUgCOyV4lOLsnefBM6k50SZzwAnPLNAy4Raq', 'recepcao'),
    ('Juliana Almeida Rocha', '15157898967', '19988641969', 'juliana.rocha@prontosocorro.exemplo.com', '15157898967', '$2b$10$4JP7G/HhXOxASMuYw7MdTONQeLricnNChicbQMVB1DTAaXM5vh2FS', 'recepcao'),
    ('Lucas Oliveira Prado', '15894741637', '19989876536', 'lucas.prado@prontosocorro.exemplo.com', '15894741637', '$2b$10$SBITwCB0i76j9B7L8vT5xuN5/9MHrKR1WCAOzfzhzGS7.KK.h6wQC', 'recepcao'),
    ('Mariana Gomes Teixeira', '16631584361', '19991111103', 'mariana.teixeira@prontosocorro.exemplo.com', '16631584361', '$2b$10$POKlNBbfXat1g.PBBZb2uO9gx7/.SCOeqcnazKTQmbKfl4u7H4w8S', 'recepcao'),
    ('Rafael Carvalho Dias', '17368427060', '19992345670', 'rafael.dias@prontosocorro.exemplo.com', '17368427060', '$2b$10$qEVk.1QjwtWi4cYdlI9gvOklI9GnCX91RcmOIV557Fg9WKbZ.Hl2O', 'recepcao'),
    ('Beatriz Santos Moreira', '18105269732', '19993580237', 'beatriz.moreira@prontosocorro.exemplo.com', '18105269732', '$2b$10$XgjrGItXKlaHG0rmG.09o.yf1hjpOCAMOxKCSYoONEBXIzz3F6mPC', 'enfermagem'),
    ('Carla Mendes Barbosa', '18842112402', '19994814804', 'carla.barbosa@prontosocorro.exemplo.com', '18842112402', '$2b$10$ngsb1Qu/.rBjoop/DJXIau75k4lUcgu945hx1fcaFUSmpM4eW68YS', 'enfermagem'),
    ('Daniela Freitas Lopes', '19578955197', '19996049371', 'daniela.lopes@prontosocorro.exemplo.com', '19578955197', '$2b$10$Gf.U.Ui/jkLWgdxCNTyureJ9bcViQw0cUVuoS6mwdDXgQR77k0Iay', 'enfermagem'),
    ('Eduardo Ramos Cardoso', '20315797894', '19997283938', 'eduardo.cardoso@prontosocorro.exemplo.com', '20315797894', '$2b$10$Nb2Y/Tf8MCWPOWIaRwYCMeL8Ds44w.pRtoIcmcWO0BF/QsL/5h2yS', 'enfermagem'),
    ('Gabriela Araujo Pinto', '21052640508', '19998518505', 'gabriela.pinto@prontosocorro.exemplo.com', '21052640508', '$2b$10$j22Q91MxbP1e4CQduvhqU.JElHQGVFBGJYap7BvgPjBr0eofNH2x6', 'enfermagem'),
    ('Helena Duarte Campos', '21789483247', '19999753072', 'helena.campos@prontosocorro.exemplo.com', '21789483247', '$2b$10$wnmTaoUa6bZe1T.4xGx7eePz6ujTP0KzwEXoVivMNE6NI0zwq/ciG', 'enfermagem'),
    ('Igor Fernandes Vieira', '22526325935', '19980987640', 'igor.vieira@prontosocorro.exemplo.com', '22526325935', '$2b$10$M.7OQrqIjk4.fASVAM6JDeqokZEPHVUpV7fUq7f.92ElxZ5votoxC', 'enfermagem'),
    ('Larissa Monteiro Cruz', '23263168606', '19982222207', 'larissa.cruz@prontosocorro.exemplo.com', '23263168606', '$2b$10$qYMLziEA4Lb2l.VBA61kw.qFoRfo/n8.SmAKDxgcoXK2eo1J41JAq', 'enfermagem'),
    ('Patricia Azevedo Reis', '24000011383', '19983456774', 'patricia.reis@prontosocorro.exemplo.com', '24000011383', '$2b$10$NN6ZOqMK3pSXwELXiO875uqk8a7PP49rher8cl1sfFf31pDeAorPG', 'enfermagem'),
    ('Thiago Correia Batista', '24736854014', '19984691341', 'thiago.batista@prontosocorro.exemplo.com', '24736854014', '$2b$10$mxay0ptrZiBqfOb21SYopeNb6hhHvPI3tHGaXQ5DmGWpihwFWMhTS', 'enfermagem'),
    ('Andre Luiz Cavalcanti', '25473696724', '19985925908', 'andre.cavalcanti@prontosocorro.exemplo.com', '25473696724', '$2b$10$yMGgWqqOwds2QYkeCOali.9WHF/jkNP1NhbvKiuiBNZqsCbxKnxYi', 'medico'),
    ('Claudia Regina Fonseca', '26210539475', '19987160475', 'claudia.fonseca@prontosocorro.exemplo.com', '26210539475', '$2b$10$hSpSdItWxRDQqC/MYpBQUO.aY1EbkwsUDaODQzVitfdC91Yld.k/K', 'medico'),
    ('Felipe Augusto Machado', '26947382149', '19988395042', 'felipe.machado@prontosocorro.exemplo.com', '26947382149', '$2b$10$1rElBLtaJbGDzuE5K/0R9OrnAgixK3edf604PbHBbUAuMMZoUBfMy', 'medico'),
    ('Isabela Torres Medeiros', '27684224875', '19989629609', 'isabela.medeiros@prontosocorro.exemplo.com', '27684224875', '$2b$10$uhdkWxpyJUvDWyvHNf.W.OP.lWtRtHfh6KDwWX76zjc4ZvgrUyRGq', 'medico'),
    ('Joao Pedro Sampaio', '28421067508', '19990864176', 'joao.sampaio@prontosocorro.exemplo.com', '28421067508', '$2b$10$15OWDH6bxg6jUjCMnxoL8uIQLehL4PjAR7enp/f7tS9KPB.V2ye1K', 'medico'),
    ('Leticia Moura Andrade', '29157910235', '19992098743', 'leticia.andrade@prontosocorro.exemplo.com', '29157910235', '$2b$10$9est3TR8P3ptYk45Y8BOVeJa.Cn3gH37qNF0W8eJ/C9ArleCIdwNS', 'medico'),
    ('Marcelo Antunes Brito', '29894752900', '19993333310', 'marcelo.brito@prontosocorro.exemplo.com', '29894752900', '$2b$10$EcraR87of9TnMT7wclTlL.PbW0lUzd4truv./KpO87scgo17lv/RC', 'medico'),
    ('Natalia Farias Coelho', '30631595651', '19994567877', 'natalia.coelho@prontosocorro.exemplo.com', '30631595651', '$2b$10$61iiMDMgqBo6DWpASfX0delCkBZNgMdCHYzsWWampqEhIVTK6HBRK', 'medico'),
    ('Ricardo Bastos Siqueira', '31368438350', '19995802444', 'ricardo.siqueira@prontosocorro.exemplo.com', '31368438350', '$2b$10$XnPKWk0J/XTL.l752obgMu2/ESTlNsVK35ttp2PVZtCiXlG/G/8MG', 'medico'),
    ('Vanessa Lima Guimaraes', '32105281010', '19997037011', 'vanessa.guimaraes@prontosocorro.exemplo.com', '32105281010', '$2b$10$YbuzlMmT780ATL4nqQut2..kIkcn.eMhxjQgC4fYAvcOH4VXJDmU.', 'medico');

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
