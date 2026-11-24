// rotas de login e logout
const express = require('express');
const bcrypt = require('bcryptjs'); // hash da senha
const banco = require('../banco');
const { soNumeros, erroServidor } = require('../apoio');

const rotas = express.Router();

// login pelo CPF e senha
rotas.post('/login', async (req, res) => {
  try {
    const cpf = soNumeros(req.body.cpf);
    const senha = req.body.senha;

    // sem CPF ou sem senha nem consulta o banco (o bcrypt quebra se a senha vier vazia)
    if (!cpf || !senha) {
      return res.status(401).json({ erro: 'CPF ou senha inválidos.' });
    }

    // procura o usuário pelo CPF, e só se estiver ativo.
    // o ? é preenchido pelo mysql2 com segurança (evita SQL injection)
    const [linhas] = await banco.query(
      'SELECT * FROM usuario WHERE cpf = ? AND ativo = TRUE',
      [cpf]
    );

    // não achou: 401 = não autorizado
    if (linhas.length === 0) {
      return res.status(401).json({ erro: 'CPF ou senha inválidos.' });
    }

    const user = linhas[0];

    // compara a senha digitada com o hash do banco (dá true ou false)
    const senhaCerta = await bcrypt.compare(senha, user.senha_hash);

    // mesma mensagem do erro de cima, pra ninguém descobrir quais CPFs existem
    if (!senhaCerta) {
      return res.status(401).json({ erro: 'CPF ou senha inválidos.' });
    }

    // deu certo: guarda na sessão e devolve quem entrou. o hash não vai junto
    const logado = { id_usuario: user.id_usuario, nome: user.nome, perfil: user.perfil };
    req.session.usuario = logado;
    res.json(logado);
  } catch (error) {
    erroServidor(res, error);
  }
});

// sair: apaga a sessão no servidor
rotas.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

module.exports = rotas;
