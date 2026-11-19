// rotas do médico: painel e finalizar atendimento
const express = require('express');
const banco = require('../banco');
const exigir = require('../exigir');
const { idade, numeroAtendimento, buscarAtendimento, erroServidor } = require('../apoio');

const rotas = express.Router();

// painel: só os triados, do mais urgente pro menos urgente, depois por chegada.
// a classificação é número (1 vermelho ... 5 azul), então o ORDER BY já ordena certo
rotas.get('/painel', exigir('medico'), async (req, res) => {
  try {
    const [linhas] = await banco.query(
      `SELECT a.id_atendimento, a.data_hora_entrada,
              p.nome_completo, p.data_nascimento, p.sexo,
              t.pressao_arterial, t.temperatura, t.batimentos_cardiacos, t.queixas, t.classificacao
         FROM atendimento a
         JOIN paciente p ON p.id_paciente = a.id_paciente
         JOIN triagem t ON t.id_atendimento = a.id_atendimento
        WHERE a.status = 'triado'
        ORDER BY t.classificacao, a.data_hora_entrada`
    );

    res.json(linhas.map(l => ({
      ...l,
      numero_atendimento: numeroAtendimento(l.id_atendimento),
      idade: idade(l.data_nascimento)
    })));
  } catch (error) {
    erroServidor(res, error);
  }
});

// médico finaliza com o diagnóstico e a receita (receita pode ficar vazia)
rotas.patch('/atendimentos/:id/finalizar', exigir('medico'), async (req, res) => {
  try {
    const diagnostico = String(req.body.diagnostico || '').trim();
    if (!diagnostico) {
      return res.status(400).json({ erro: 'Informe o diagnóstico.' });
    }
    // a coluna do banco é VARCHAR(300)
    if (diagnostico.length > 300) {
      return res.status(400).json({ erro: 'O diagnóstico pode ter no máximo 300 caracteres.' });
    }

    const atend = await buscarAtendimento(req.params.id);
    if (!atend) {
      return res.status(404).json({ erro: 'Atendimento não encontrado.' });
    }
    // 409 = conflito: a tela fecha a consulta e atualiza o painel
    if (atend.status === 'cancelado') {
      return res.status(409).json({ erro: 'Esse atendimento foi cancelado pela recepção.' });
    }
    if (atend.status === 'atendido') {
      return res.status(409).json({ erro: 'Esse paciente já foi atendido por outro médico.' });
    }
    if (atend.status !== 'triado') {
      return res.status(400).json({ erro: 'Esse paciente ainda não passou pela triagem.' });
    }

    // grava quem atendeu (da sessão), o diagnóstico, a receita e a hora. status 'atendido' = vira histórico.
    // o "AND status = 'triado'" garante que, se dois médicos finalizarem juntos, só o primeiro grava
    const [resultado] = await banco.query(
      `UPDATE atendimento
          SET status = 'atendido', id_medico = ?, diagnostico = ?, receita = ?, data_hora_atendimento = NOW()
        WHERE id_atendimento = ? AND status = 'triado'`,
      [req.session.usuario.id_usuario, diagnostico, req.body.receita || null, req.params.id]
    );
    // nenhuma linha mudou: outro médico finalizou um instante antes
    if (resultado.affectedRows === 0) {
      return res.status(409).json({ erro: 'Esse paciente já foi atendido por outro médico.' });
    }
    res.json({ ok: true });
  } catch (error) {
    erroServidor(res, error);
  }
});

module.exports = rotas;
