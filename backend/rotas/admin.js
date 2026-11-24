// rotas do administrador: cadastrar, listar e ativar/desativar profissionais
const express = require('express');
const bcrypt = require('bcryptjs'); // hash da senha
const banco = require('../banco');
const exigir = require('../exigir');
const { soNumeros, erroServidor } = require('../apoio');

const rotas = express.Router();

// perfis que podem ser cadastrados (os mesmos do CHECK do banco)
const PERFIS = ['recepcao', 'enfermagem', 'medico', 'admin'];

// lista todos os profissionais. a senha (hash) não vai pra tela
rotas.get('/usuarios', exigir('admin'), async (req, res) => {
  try {
    const [linhas] = await banco.query(
      'SELECT id_usuario, nome, cpf, telefone, email, perfil, ativo FROM usuario ORDER BY nome'
    );
    res.json(linhas);
  } catch (error) {
    erroServidor(res, error);
  }
});

// cadastra um profissional. o login é o CPF, igual aos usuários de teste
rotas.post('/usuarios', exigir('admin'), async (req, res) => {
  try {
    const u = req.body;
    const nome = String(u.nome || '').trim();
    const cpf = soNumeros(u.cpf);
    const telefone = soNumeros(u.telefone);
    const email = String(u.email || '').trim();
    const senha = String(u.senha || '');

    // campos obrigatórios. 400 = pedido inválido
    if (!nome || !cpf || !telefone || !senha || !u.perfil) {
      return res.status(400).json({ erro: 'Preencha nome, CPF, telefone, perfil e senha.' });
    }
    if (cpf.length !== 11) {
      return res.status(400).json({ erro: 'O CPF precisa ter 11 números.' });
    }
    if (telefone.length < 10 || telefone.length > 11) {
      return res.status(400).json({ erro: 'Telefone com DDD: 10 ou 11 números.' });
    }
    if (!PERFIS.includes(u.perfil)) {
      return res.status(400).json({ erro: 'Perfil inválido.' });
    }
    if (senha.length < 6) {
      return res.status(400).json({ erro: 'A senha precisa ter pelo menos 6 caracteres.' });
    }

    // guarda só o hash da senha, nunca a senha pura
    const senhaHash = await bcrypt.hash(senha, 10);

    await banco.query(
      `INSERT INTO usuario (nome, cpf, telefone, email, login, senha_hash, perfil)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [nome, cpf, telefone, email || null, cpf, senhaHash, u.perfil]
    );

    res.status(201).json({ ok: true });
  } catch (error) {
    // CPF (ou login, que é o CPF) repetido: o banco recusa por causa do UNIQUE
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ erro: 'Já existe um profissional com esse CPF.' });
    }
    erroServidor(res, error);
  }
});

// ativa ou desativa um profissional. inativo não consegue entrar (o login confere o ativo)
rotas.patch('/usuarios/:id/ativo', exigir('admin'), async (req, res) => {
  try {
    // o admin não pode desativar a si mesmo, senão ninguém mais entraria pra reativar
    if (Number(req.params.id) === req.session.usuario.id_usuario) {
      return res.status(400).json({ erro: 'Você não pode desativar o seu próprio usuário.' });
    }

    // NOT ativo inverte: ativo vira inativo e inativo vira ativo
    const [resultado] = await banco.query(
      'UPDATE usuario SET ativo = NOT ativo WHERE id_usuario = ?',
      [req.params.id]
    );
    if (resultado.affectedRows === 0) {
      return res.status(404).json({ erro: 'Profissional não encontrado.' });
    }
    res.json({ ok: true });
  } catch (error) {
    erroServidor(res, error);
  }
});

module.exports = rotas;
