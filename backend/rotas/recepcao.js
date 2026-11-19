// rotas da recepção: abrir, buscar, alterar e cancelar atendimento
const express = require('express');
const banco = require('../banco');
const exigir = require('../exigir');
const { numeroAtendimento, soNumeros, validarPaciente, diferencasPaciente, buscarAtendimento, erroServidor } = require('../apoio');

const rotas = express.Router();

// abre um atendimento (cadastra o paciente se ele ainda não existe)
rotas.post('/atendimentos', exigir('recepcao'), async (req, res) => {
  try {
    const p = req.body;

    // confere as regras antes de gravar qualquer coisa. 400 = pedido inválido
    const erro = validarPaciente(p);
    if (erro) {
      return res.status(400).json({ erro });
    }

    // se o CPF já está cadastrado, confere os dados antes de reaproveitar
    let idPaciente = null;
    if (p.cpf) {
      const [achou] = await banco.query('SELECT * FROM paciente WHERE cpf = ?', [p.cpf]);
      if (achou.length > 0) {
        // a pessoa já tem cadastro: o que foi digitado bate com ele?
        const diferencas = diferencasPaciente(achou[0], p);
        if (diferencas.length > 0) {
          return res.status(400).json({
            erro: 'Esse CPF já tem cadastro com dados diferentes: ' + diferencas.join(', ') +
                  '. Use o botão Alterar para atualizar o cadastro, ou corrija os dados.'
          });
        }
        idPaciente = achou[0].id_paciente;

        // um paciente só pode ter um atendimento em andamento por vez
        // (barra o clique duplo e duas recepcionistas abrindo a mesma pessoa)
        const [emAndamento] = await banco.query(
          "SELECT id_atendimento FROM atendimento WHERE id_paciente = ? AND status IN ('aberto', 'triado')",
          [idPaciente]
        );
        if (emAndamento.length > 0) {
          return res.status(409).json({
            erro: 'Esse paciente já tem um atendimento em andamento (' + numeroAtendimento(emAndamento[0].id_atendimento) +
                  '). Cancele ou finalize antes de abrir outro.'
          });
        }
      }
    }

    // se não achou, cadastra o paciente novo.
    // campo vazio vira null, senão dois pacientes sem RG dariam "duplicado"
    if (!idPaciente) {
      const [novo] = await banco.query(
        `INSERT INTO paciente (nome_completo, cpf, rg, data_nascimento, sexo, telefone, nome_pai, nome_mae, endereco)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [p.nome_completo, p.cpf || null, p.rg || null, p.data_nascimento, p.sexo,
         p.telefone || null, p.nome_pai || null, p.nome_mae || null, p.endereco || null]
      );
      idPaciente = novo.insertId; // id que o banco acabou de criar
    }

    // abre o atendimento. o status começa como 'aberto' (DEFAULT do banco)
    // quem abriu vem da sessão, não da tela
    const [atend] = await banco.query(
      'INSERT INTO atendimento (id_paciente, id_recepcionista) VALUES (?, ?)',
      [idPaciente, req.session.usuario.id_usuario]
    );

    res.status(201).json({
      id_atendimento: atend.insertId,
      numero_atendimento: numeroAtendimento(atend.insertId)
    });
  } catch (error) {
    erroServidor(res, error);
  }
});

// busca por número (AT0001) ou CPF
rotas.get('/atendimentos', exigir('recepcao'), async (req, res) => {
  try {
    const busca = String(req.query.busca || '').trim().toUpperCase();

    // começou com AT: procura pelo número. senão: procura pelo CPF
    let filtro = 'p.cpf = ?';
    let valor = soNumeros(busca);
    if (busca.startsWith('AT')) {
      filtro = 'a.id_atendimento = ?';
      valor = Number(busca.slice(2)) || 0; // 'AT0007' -> 7
    }

    // junta atendimento com paciente, do mais novo pro mais antigo
    const [linhas] = await banco.query(
      `SELECT a.id_atendimento, a.status, a.data_hora_entrada,
              p.id_paciente, p.nome_completo, p.cpf, p.rg, p.data_nascimento, p.sexo,
              p.telefone, p.nome_pai, p.nome_mae, p.endereco
         FROM atendimento a
         JOIN paciente p ON p.id_paciente = a.id_paciente
        WHERE ${filtro}
        ORDER BY a.id_atendimento DESC`,
      [valor]
    );

    // acrescenta o número AT0001 em cada linha antes de mandar pra tela
    res.json(linhas.map(l => ({ ...l, numero_atendimento: numeroAtendimento(l.id_atendimento) })));
  } catch (error) {
    erroServidor(res, error);
  }
});

// altera os dados do paciente de um atendimento
rotas.put('/atendimentos/:id', exigir('recepcao'), async (req, res) => {
  try {
    const p = req.body;

    const erro = validarPaciente(p);
    if (erro) {
      return res.status(400).json({ erro });
    }

    // 404 = não existe
    const atend = await buscarAtendimento(req.params.id);
    if (!atend) {
      return res.status(404).json({ erro: 'Atendimento não encontrado.' });
    }
    // depois que o médico atendeu (ou foi cancelado), não muda mais
    if (atend.status === 'atendido' || atend.status === 'cancelado') {
      return res.status(400).json({ erro: 'Atendimento ' + atend.status + ' não pode ser alterado.' });
    }

    await banco.query(
      `UPDATE paciente
          SET nome_completo = ?, cpf = ?, rg = ?, data_nascimento = ?, sexo = ?,
              telefone = ?, nome_pai = ?, nome_mae = ?, endereco = ?
        WHERE id_paciente = ?`,
      [p.nome_completo, p.cpf || null, p.rg || null, p.data_nascimento, p.sexo,
       p.telefone || null, p.nome_pai || null, p.nome_mae || null, p.endereco || null,
       atend.id_paciente]
    );

    res.json({ ok: true });
  } catch (error) {
    erroServidor(res, error);
  }
});

// cancela, se o médico ainda não atendeu
rotas.patch('/atendimentos/:id/cancelar', exigir('recepcao'), async (req, res) => {
  try {
    const atend = await buscarAtendimento(req.params.id);
    if (!atend) {
      return res.status(404).json({ erro: 'Atendimento não encontrado.' });
    }
    if (atend.status === 'atendido') {
      return res.status(400).json({ erro: 'Atendimento já foi atendido pelo médico, não pode ser cancelado.' });
    }
    if (atend.status === 'cancelado') {
      return res.status(400).json({ erro: 'Atendimento já está cancelado.' });
    }

    await banco.query("UPDATE atendimento SET status = 'cancelado' WHERE id_atendimento = ?", [req.params.id]);
    res.json({ ok: true });
  } catch (error) {
    erroServidor(res, error);
  }
});

module.exports = rotas;
