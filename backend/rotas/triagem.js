// rotas da triagem: fila de espera e gravar a triagem
const express = require('express');
const banco = require('../banco');
const exigir = require('../exigir');
const { idade, numeroAtendimento, numeroDoAtendimento, buscarAtendimento, filtrosHistorico, erroServidor } = require('../apoio');

const rotas = express.Router();

// pacientes esperando triagem: primeiro os com alerta da recepção, depois por ordem de chegada.
// só pega status 'aberto': quem já foi triado não aparece mais aqui.
// filtro opcional, igual ao da recepção: tipo = numero ou nome. sem busca = fila inteira
rotas.get('/triagem/fila', exigir('enfermagem', 'admin'), async (req, res) => {
  try {
    const tipo = req.query.tipo;
    const busca = String(req.query.busca || '').trim();

    let filtro = '';
    const valores = [];
    if (busca && tipo === 'numero') {
      const id = numeroDoAtendimento(busca); // 'AT0007' ou '7' -> 7
      if (!id) {
        return res.status(400).json({ erro: 'Digite só o número do atendimento. Ex: 8' });
      }
      filtro = 'AND a.id_atendimento = ?';
      valores.push(id);
    } else if (busca && tipo === 'nome') {
      filtro = 'AND p.nome_completo LIKE ?'; // procura o texto em qualquer parte do nome
      valores.push('%' + busca + '%');
    } else if (busca) {
      return res.status(400).json({ erro: 'Escolha buscar por número ou nome.' });
    }

    // alerta DESC: 1 (com alerta) vem antes de 0 (sem alerta)
    const [linhas] = await banco.query(
      `SELECT a.id_atendimento, a.data_hora_entrada, a.alerta, p.nome_completo, p.data_nascimento, p.sexo
         FROM atendimento a
         JOIN paciente p ON p.id_paciente = a.id_paciente
        WHERE a.status = 'aberto' ${filtro}
        ORDER BY a.alerta DESC, a.data_hora_entrada`,
      valores
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
    // faixas iguais às do CHECK do banco. conferir aqui faz a enfermeira ver a mensagem certa,
    // em vez de "Erro no servidor"
    const temperatura = Number(t.temperatura);
    if (!(temperatura >= 30 && temperatura <= 45)) {
      return res.status(400).json({ erro: 'Temperatura deve estar entre 30 e 45 °C.' });
    }
    const batimentos = Number(t.batimentos_cardiacos);
    if (!Number.isInteger(batimentos) || batimentos < 0 || batimentos > 300) {
      return res.status(400).json({ erro: 'Batimentos devem estar entre 0 e 300.' });
    }
    const classificacao = Number(t.classificacao);
    if (!Number.isInteger(classificacao) || classificacao < 1 || classificacao > 5) {
      return res.status(400).json({ erro: 'Classificação deve ser de 1 a 5.' });
    }
    // a coluna do banco é VARCHAR(255)
    if (String(t.queixas).length > 255) {
      return res.status(400).json({ erro: 'As queixas podem ter no máximo 255 caracteres.' });
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

    // primeiro muda o status: sai da fila da triagem e entra no painel do médico.
    // o "AND status = 'aberto'" garante que, se a recepção cancelou um instante antes, não passa por cima
    // (mesma proteção do cancelar e do finalizar)
    const [resultado] = await banco.query(
      "UPDATE atendimento SET status = 'triado' WHERE id_atendimento = ? AND status = 'aberto'",
      [req.params.id]
    );
    // nenhuma linha mudou: foi cancelado ou outra enfermeira triou um instante antes
    if (resultado.affectedRows === 0) {
      return res.status(409).json({ erro: 'Esse atendimento acabou de ser cancelado ou já foi triado.' });
    }

    // depois grava a triagem. quem fez vem da sessão
    await banco.query(
      `INSERT INTO triagem (id_atendimento, id_enfermeiro, pressao_arterial, temperatura, batimentos_cardiacos, queixas, classificacao)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.params.id, req.session.usuario.id_usuario, t.pressao_arterial, t.temperatura, t.batimentos_cardiacos, t.queixas, t.classificacao]
    );

    res.status(201).json({ ok: true });
  } catch (error) {
    erroServidor(res, error);
  }
});

// histórico: triagens de atendimentos encerrados (atendidos ou cancelados depois da triagem). só leitura.
// filtros na URL: de, ate, numero, status, classificacao. no máximo 200 linhas
rotas.get('/triagem/historico', exigir('enfermagem', 'admin'), async (req, res) => {
  try {
    const filtros = filtrosHistorico(req.query, 't.data_hora');
    if (filtros.erro) {
      return res.status(400).json({ erro: filtros.erro });
    }
    const { condicoes, valores } = filtros;
    condicoes.push("a.status IN ('atendido', 'cancelado')");
    if (req.query.status === 'atendido' || req.query.status === 'cancelado') {
      condicoes.push('a.status = ?');
      valores.push(req.query.status);
    }
    const classificacao = Number(req.query.classificacao);
    if (classificacao >= 1 && classificacao <= 5) {
      condicoes.push('t.classificacao = ?');
      valores.push(classificacao);
    }

    // e = enfermeiro(a) que fez a triagem
    const [linhas] = await banco.query(
      `SELECT a.id_atendimento, a.status, p.nome_completo, p.data_nascimento,
              DATE_FORMAT(t.data_hora, '%d/%m/%Y %H:%i') AS triagem_em,
              t.pressao_arterial, t.temperatura, t.batimentos_cardiacos, t.queixas, t.classificacao,
              e.nome AS triado
         FROM triagem t
         JOIN atendimento a ON a.id_atendimento = t.id_atendimento
         JOIN paciente p ON p.id_paciente = a.id_paciente
         JOIN usuario e ON e.id_usuario = t.id_enfermeiro
        WHERE ${condicoes.join(' AND ')}
        ORDER BY t.data_hora DESC
        LIMIT 200`,
      valores
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

module.exports = rotas;
