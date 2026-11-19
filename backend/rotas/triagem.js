// rotas da triagem: fila de espera e gravar a triagem
const express = require('express');
const banco = require('../banco');
const exigir = require('../exigir');
const { idade, numeroAtendimento, buscarAtendimento, erroServidor } = require('../apoio');

const rotas = express.Router();

// pacientes esperando triagem, por ordem de chegada.
// só pega status 'aberto': quem já foi triado não aparece mais aqui
rotas.get('/triagem/fila', exigir('enfermagem'), async (req, res) => {
  try {
    const [linhas] = await banco.query(
      `SELECT a.id_atendimento, a.data_hora_entrada, p.nome_completo, p.data_nascimento, p.sexo
         FROM atendimento a
         JOIN paciente p ON p.id_paciente = a.id_paciente
        WHERE a.status = 'aberto'
        ORDER BY a.data_hora_entrada`
    );

    // acrescenta o número e a idade em cada linha
    res.json(linhas.map(l => ({
      ...l,
      numero_atendimento: numeroAtendimento(l.id_atendimento),
      idade: idade(l.data_nascimento)
    })));
  } catch (error) {
    erroServidor(res, error);
  }
});

// grava a triagem e manda o paciente pro médico
rotas.post('/atendimentos/:id/triagem', exigir('enfermagem'), async (req, res) => {
  try {
    const t = req.body;

    // campo vazio = não veio ou veio em branco. 0 é um valor de verdade (batimentos pode ser 0)
    const vazio = valor => valor === undefined || valor === null || String(valor).trim() === '';
    if (vazio(t.pressao_arterial) || vazio(t.temperatura) || vazio(t.batimentos_cardiacos) || vazio(t.queixas) || vazio(t.classificacao)) {
      return res.status(400).json({ erro: 'Preencha todos os campos da triagem.' });
    }
    // pressão tem que ser tipo 120/80 (2 ou 3 números, barra, 2 ou 3 números)
    if (!/^\d{2,3}\/\d{2,3}$/.test(t.pressao_arterial)) {
      return res.status(400).json({ erro: 'Pressão no formato 120/80.' });
    }

    const atend = await buscarAtendimento(req.params.id);
    if (!atend) {
      return res.status(404).json({ erro: 'Atendimento não encontrado.' });
    }
    // não deixa triar duas vezes. 409 = conflito: a tela fecha o formulário e atualiza a fila
    if (atend.status === 'cancelado') {
      return res.status(409).json({ erro: 'Esse atendimento foi cancelado pela recepção.' });
    }
    if (atend.status !== 'aberto') {
      return res.status(409).json({ erro: 'Esse paciente já foi triado.' });
    }

    // quem fez a triagem vem da sessão
    await banco.query(
      `INSERT INTO triagem (id_atendimento, id_enfermeiro, pressao_arterial, temperatura, batimentos_cardiacos, queixas, classificacao)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.params.id, req.session.usuario.id_usuario, t.pressao_arterial, t.temperatura, t.batimentos_cardiacos, t.queixas, t.classificacao]
    );
    // muda o status: sai da fila da triagem e entra no painel do médico
    await banco.query("UPDATE atendimento SET status = 'triado' WHERE id_atendimento = ?", [req.params.id]);

    res.status(201).json({ ok: true });
  } catch (error) {
    // duas enfermeiras salvaram ao mesmo tempo: o UNIQUE da triagem barrou a segunda
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ erro: 'Esse paciente já foi triado.' });
    }
    erroServidor(res, error);
  }
});

module.exports = rotas;
