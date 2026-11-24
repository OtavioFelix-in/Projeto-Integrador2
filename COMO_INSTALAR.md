# Sistema de Atendimento de Pronto Socorro

Projeto Integrador 2 - Sistemas de Informação, PUC-Campinas.

Este arquivo explica como instalar e rodar o sistema no Windows, no próprio computador (`localhost`).
Os detalhes técnicos do projeto (rotas, modelo do banco, regras) estão no [README](README.md).

## 1. O que precisa estar instalado

| Programa | Versão | Onde baixar |
|---|---|---|
| Node.js | 20.12 ou mais nova (pode ser a LTS) | https://nodejs.org |
| MySQL Server | 8.0.16 ou mais nova | https://dev.mysql.com/downloads/installer/ |
| MySQL Workbench | qualquer uma | vem junto no instalador do MySQL, acima |

Anote a senha do usuário `root` que você escolher na instalação do MySQL. Ela será usada no passo 3.

Para conferir o Node.js, abra o Prompt de Comando e digite `node -v`. Tem que aparecer v20.12 ou maior.

## 2. Criar o banco de dados

1. Baixe o projeto (botão verde **Code > Download ZIP**) e descompacte em qualquer pasta, ou clone o repositório.
2. Abra o **MySQL Workbench** e clique na conexão local (normalmente `Local instance MySQL80`). Digite a senha do `root`.
3. No menu, vá em **File > Open SQL Script** e escolha o arquivo `bd\create_table.sql`.
4. Clique no **raio** (Execute) na barra do script.
5. No painel da esquerda (SCHEMAS), clique no botão de atualizar. O banco `pronto_socorro` tem que aparecer.

Atenção: esse script apaga o banco `pronto_socorro` se ele já existir e cria tudo de novo, já com os usuários de teste.

## 3. Criar o arquivo `.env`

O sistema precisa saber a senha do MySQL do seu computador. Ela fica num arquivo chamado `.env`, que **não vai para o GitHub** de propósito.

1. Abra o Bloco de Notas e cole isto:

```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=COLOQUE_A_SENHA_DO_MYSQL_AQUI
DB_NAME=pronto_socorro
```

2. Troque `COLOQUE_A_SENHA_DO_MYSQL_AQUI` pela senha do `root` (sem aspas). Se o seu MySQL não tem senha, deixe em branco depois do `=`.
3. Vá em **Arquivo > Salvar como**, entre na pasta `backend`, escolha em **Tipo** a opção **Todos os arquivos** e digite o nome `.env`.

O nome tem que ser exatamente `.env`, e não `.env.txt`. Se preferir, copie o arquivo `backend/.env.example` e renomeie para `.env`.

## 4. Instalar e ligar o sistema

1. No Explorador de Arquivos, entre na pasta `backend`, clique na barra de endereço, digite `cmd` e aperte Enter. Abre o Prompt de Comando já dentro da pasta.
2. Instale as dependências (só na primeira vez, precisa de internet):

```
npm install
```

3. Ligue o servidor:

```
node server.js
```

Tem que aparecer `Servidor rodando em http://localhost:3000`. Deixe essa janela aberta enquanto usar o sistema.

4. Abra o navegador em **http://localhost:3000**.

Para desligar, volte na janela do Prompt e aperte `Ctrl + C`. Se o servidor for reiniciado, todo mundo é deslogado.

## 5. Usuários de teste

O login é o **CPF (só números)** e a senha está na tabela. São dados de exemplo, não são pessoas cadastradas de verdade. Cada perfil abre a sua tela. O script também cria 30 usuários genéricos da equipe, que não estão nas tabelas abaixo.

**Recepção** (tela da Recepção)

| Nome | CPF (login) | Senha |
|---|---|---|
| Leandro | 43141592608 | Leandro@2608 |
| Andrade | 46283185223 | Andrade@5223 |
| Adílio | 49424777868 | Adilio@7868 |
| Gerson | 52566370451 | Gerson@0451 |
| Everton Ribeiro | 55707963049 | Everton@3049 |

**Enfermagem** (tela da Triagem)

| Nome | CPF (login) | Senha |
|---|---|---|
| Júnior | 58849555610 | Junior@5610 |
| Petkovic | 61991148259 | Petkovic@8259 |
| Filipe Luís | 65132740871 | Filipe@0871 |
| Bruno Henrique | 68274333403 | Bruno@3403 |
| Pedro | 71415926018 | Pedro@6018 |

**Médico** (tela do Painel de Atendimentos)

| Nome | CPF (login) | Senha |
|---|---|---|
| Zico | 74557518699 | Zico@8699 |
| Romário | 77699111257 | Romario@1257 |
| Adriano | 80840703805 | Adriano@3805 |
| Arrascaeta | 83982296404 | Arrascaeta@6404 |
| Gabigol | 87123889045 | Gabigol@9045 |

**Administrador** (cadastra profissionais e vê todas as telas, sem operar nenhuma)

| Nome | CPF (login) | Senha |
|---|---|---|
| Jorge Jesus | 90265482137 | Jorge@2137 |

## 6. Como testar o fluxo completo

1. Entre como **Recepção** (Leandro) e abra um atendimento para um paciente.
2. Saia, entre como **Enfermagem** (Júnior), faça a triagem do paciente e escolha a classificação de risco.
3. Saia, entre como **Médico** (Zico), chame o paciente, escreva o diagnóstico e finalize.
4. O atendimento aparece no **Histórico** de cada perfil.

## 7. Se der algum erro

| Erro | O que fazer |
|---|---|
| `Cannot find module` | o `npm install` não foi feito, ou foi feito fora da pasta `backend` |
| `ENOENT ... .env` | o arquivo `.env` não está na pasta `backend`, ou ficou como `.env.txt` |
| `Access denied for user 'root'` | a senha no `.env` está errada |
| `ECONNREFUSED` ou `Unknown database` | o MySQL não está ligado, ou o passo 2 não foi feito |
| `EADDRINUSE` | já tem algo usando a porta 3000, feche o outro servidor |
