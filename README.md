# Sistema de Atendimentos de Pronto Socorro

Sistema web para controle do fluxo de atendimento em um Pronto Socorro, desde a chegada do paciente na recepção até a alta médica. Desenvolvido como Projeto Integrador 2 do curso de Sistemas de Informação.

##  Sobre o projeto

O Projeto Integrador 2 tem como objetivo unir os conhecimentos dos componentes curriculares do semestre, como programação web, banco de dados, engenharia de processos e estrutura de dados/algoritmos, em um projeto prático e autogerenciado pela equipe, com acompanhamento (não técnico) de um professor orientador.

O sistema contempla três etapas do processo de atendimento de um Pronto Socorro. Na recepção acontece o cadastro do paciente e a abertura do atendimento. Na triagem, feita pela enfermagem, são coletados os sinais vitais e é definida a classificação de risco. E no atendimento médico o paciente é chamado por prioridade, recebe as medicações registradas e tem sua consulta confirmada.

##  atendimento

### 1. Recepção

O paciente chega e é feito o cadastro com seus dados pessoais: nome completo, endereço, RG, CPF, nome do pai, nome da mãe, data de nascimento, entre outros. A partir desse cadastro é gerado um número de atendimento único (por exemplo, `AT0001`). A recepção também pode incluir, alterar, consultar e cancelar um atendimento, desde que ele ainda não tenha sido confirmado pelo médico.

### 2. Triagem (Enfermagem)

O paciente é conduzido à enfermagem, onde são registrados os dados vitais vinculados ao atendimento: pressão arterial, temperatura corporal, batimentos cardíacos e as principais queixas (dor de cabeça, náusea, enjoo, dor muscular, suor excessivo etc.). É nesta etapa também que o atendimento é classificado conforme o Protocolo de Manchester.

### 3. Atendimento médico

O médico acessa o atendimento, registra as medicações e confirma a consulta. Ele conta ainda com um Painel de Atendimento, uma tela que lista os pacientes em ordem de prioridade segundo a classificação de Manchester, mostrando número do atendimento, nome do paciente, data de nascimento e outras informações que facilitam saber quem deve ser chamado a seguir.

##  Estrutura do sistema

O projeto é dividido em três frentes de desenvolvimento.

Front-end: reúne a interface deúne a interface da recepção, com inclusão, alteração, consulta e cancelamento de atendimentos; a interface da triagem, para a enfermagem registrar os dados do atendimento; e as interfaces do médico, que incluem o Painel de Atendimentos e a tela para lançamento de medicações e confirmação da consulta.

Back-end: camada responsável por conectar todas essas interfaces, processando e persistindo os dados que fazem o sistema funcionar.

Banco de dados: relacional, definido pela própria equipe, contemplando as tabelas necessárias para paciente, atendimento e demais informações do processo, como triagem, classificação e medicações.

Tecnologias

Ajuste esta seção conforme as decisões finais da equipe.

Front-end em HTML, CSS e JavaScript. Back-end em Node.js/JavaScript. Banco de dados relacional em SQL.
