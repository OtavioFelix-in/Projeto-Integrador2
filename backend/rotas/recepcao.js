// rotas da recepção: abrir, buscar, alterar e cancelar atendimento
const express = require('express');
const banco = require('../banco');
const exigir = require('../exigir');
const { numeroAtendimento, numeroDoAtendimento, soNumeros, validarPaciente, buscarAtendimento, filtrosHistorico, erroServidor } = require('../apoio');

const rotas = express.Router();

// grava no cadastro do paciente o que a recepção conferiu com ele (usado ao abrir e ao alterar).
// campo vazio vira null, senão dois pacientes sem RG dariam "duplicado"
async function atualizarPaciente(idPaciente, p) {
  await banco.query(
    `UPDATE paciente
        SET nome_completo = ?, cpf = ?, rg = ?, data_nascimento = ?, sexo = ?,
            telefone = ?, nome_pai = ?, nome_mae = ?, endereco = ?, nao_identificado = ?
      WHERE id_paciente = ?`,
    [p.nome_completo, p.cpf || null, p.rg || null, p.data_nascimento || null, p.sexo,
     p.telefone || null, p.nome_pai || null, p.nome_mae || null, p.endereco || null,
     p.nao_identificado === true, idPaciente]
  );
}

// procura um atendimento em andamento (aberto ou triado) do paciente. um paciente só pode ter um por vez
async function atendimentoEmAndamento(idPaciente) {
  const [linhas] = await banco.query(
    "SELECT id_atendimento FROM atendimento WHERE id_paciente = ? AND status IN ('aberto', 'triado')",
    [idPaciente]
  );
  return linhas[0];
}

// busca paciente que já veio antes (caixa "Buscar paciente").
// a tela manda o tipo escolhido no "Buscar por": cpf, rg ou nome.
// devolve uma lista: quem confirma qual é o paciente é a recepcionista, olhando nascimento e mãe
rotas.get('/pacientes', exigir('recepcao'), async (req, res) => {
  try {
    const tipo = req.query.tipo;
    const busca = String(req.query.busca || '').trim();
    if (!busca) {
      return res.status(400).json({ erro: 'Digite o que quer buscar.' });
    }

    let filtro, valor;
    if (tipo === 'cpf') {
      filtro = 'cpf = ?';
      valor = soNumeros(busca);
    } else if (tipo === 'rg') {
      filtro = 'rg = ?';
      valor = busca;
    } else if (tipo === 'nome') {
      if (busca.length < 3) {
        return res.status(400).json({ erro: 'Digite pelo menos 3 letras do nome.' });
      }
      // o LIKE com % procura o texto em qualquer parte do nome ("silva" acha "Maria Silva Santos")
      filtro = 'nome_completo LIKE ?';
      valor = '%' + busca + '%';
    } else {
      return res.status(400).json({ erro: 'Escolha buscar por CPF, RG ou nome.' });
    }

    const [linhas] = await banco.query(
      `SELECT id_paciente, nome_completo, cpf, rg, data_nascimento, sexo, telefone,
              nome_pai, nome_mae, endereco, nao_identificado
         FROM paciente
        WHERE ${filtro}
        ORDER BY nome_completo
        LIMIT 20`,
      [valor]
    );
    res.json(linhas);
  } catch (error) {
    erroServidor(res, error);
  }
});

// abre um atendimento.
// paciente que já veio antes: a tela manda o id_paciente escolhido no "Usar este paciente",
// e o que a recepção mudou no formulário (telefone novo, endereço novo...) atualiza o cadastro dele.
// paciente novo: cadastra e abre
rotas.post('/atendimentos', exigir('recepcao'), async (req, res) => {
  try {
    const p = req.body;

    // confere as regras antes de gravar qualquer coisa. 400 = pedido inválido
    const erro = validarPaciente(p);
    if (erro) {
      return res.status(400).json({ erro });
    }
    // não identificado sem nome: grava 'Não identificado' (o nome não pode ficar vazio no banco)
    if (p.nao_identificado === true && !p.nome_completo) {
      p.nome_completo = 'Não identificado';
    }

    let idPaciente = Number(p.id_paciente) || null;

    if (idPaciente) {
      // paciente escolhido na busca: confere se existe
      const [achou] = await banco.query('SELECT id_paciente FROM paciente WHERE id_paciente = ?', [idPaciente]);
      if (achou.length === 0) {
        return res.status(404).json({ erro: 'Paciente não encontrado. Busque de novo.' });
      }
      // um paciente só pode ter um atendimento em andamento por vez
      // (barra o clique duplo e duas recepcionistas abrindo a mesma pessoa)
      const emAndamento = await atendimentoEmAndamento(idPaciente);
      if (emAndamento) {
        return res.status(409).json({
          erro: 'Esse paciente já tem um atendimento em andamento (' + numeroAtendimento(emAndamento.id_atendimento) +
                '). Cancele ou finalize antes de abrir outro.'
        });
      }
      await atualizarPaciente(idPaciente, p);
    } else {
      // paciente novo: se o CPF ou o RG já existe, a pessoa já tem cadastro.
      // pede pra buscar e escolher, em vez de criar um cadastro duplicado
      const [existe] = await banco.query('SELECT id_paciente FROM paciente WHERE cpf = ? OR rg = ?', [p.cpf || null, p.rg || null]);
      if (existe.length > 0) {
        return res.status(409).json({ erro: 'Já existe um paciente com esse CPF ou RG. Use o "Buscar paciente" e clique em "Usar este paciente".' });
      }

      const [novo] = await banco.query(
        `INSERT INTO paciente (nome_completo, cpf, rg, data_nascimento, sexo, telefone, nome_pai, nome_mae, endereco, nao_identificado)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [p.nome_completo, p.cpf || null, p.rg || null, p.data_nascimento || null, p.sexo,
         p.telefone || null, p.nome_pai || null, p.nome_mae || null, p.endereco || null, p.nao_identificado === true]
      );
      idPaciente = novo.insertId; // id que o banco acabou de criar
    }

    // abre o atendimento. o status começa como 'aberto' (DEFAULT do banco)
    // quem abriu vem da sessão, não da tela
    // alerta = a recepção viu sinal grave na chegada (sangramento, desmaio...). quem classifica continua sendo a enfermagem
    const [atend] = await banco.query(
      'INSERT INTO atendimento (id_paciente, id_recepcionista, alerta) VALUES (?, ?, ?)',
      [idPaciente, req.session.usuario.id_usuario, p.alerta === true]
    );

    res.status(201).json({
      id_atendimento: atend.insertId,
      numero_atendimento: numeroAtendimento(atend.insertId)
    });
  } catch (error) {
    erroServidor(res, error);
  }
});

// consulta atendimento (caixa "Consultar atendimento").
// a tela manda o tipo escolhido no "Buscar por": numero ou cpf.
// busca vazia (botão Ver todos): lista os atendimentos em andamento (aberto ou triado)
rotas.get('/atendimentos', exigir('recepcao', 'admin'), async (req, res) => {
  try {
    const tipo = req.query.tipo;
    const busca = String(req.query.busca || '').trim();

    let filtro, valores;
    let ordem = 'a.id_atendimento DESC'; // do mais novo pro mais antigo
    if (busca === '') {
      // em andamento, por ordem de chegada (quem chegou antes espera há mais tempo)
      filtro = "a.status IN ('aberto', 'triado')";
      valores = [];
      ordem = 'a.data_hora_entrada';
    } else if (tipo === 'numero') {
      const id = numeroDoAtendimento(busca); // 'AT0007' ou '7' -> 7
      if (!id) {
        return res.status(400).json({ erro: 'Digite só o número do atendimento. Ex: 8' });
      }
      filtro = 'a.id_atendimento = ?';
      valores = [id];
    } else if (tipo === 'cpf') {
      filtro = 'p.cpf = ?';
      valores = [soNumeros(busca)];
    } else {
      return res.status(400).json({ erro: 'Escolha buscar por número ou CPF.' });
    }

    // junta atendimento com paciente
    const [linhas] = await banco.query(
      `SELECT a.id_atendimento, a.status, a.data_hora_entrada, a.alerta,
              p.id_paciente, p.nome_completo, p.cpf, p.rg, p.data_nascimento, p.sexo,
              p.telefone, p.nome_pai, p.nome_mae, p.endereco, p.nao_identificado
         FROM atendimento a
         JOIN paciente p ON p.id_paciente = a.id_paciente
        WHERE ${filtro}
        ORDER BY ${ordem}`,
      valores
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
    // não identificado sem nome: grava 'Não identificado' (o nome não pode ficar vazio no banco)
    if (p.nao_identificado === true && !p.nome_completo) {
      p.nome_completo = 'Não identificado';
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

    // não identificado sendo identificado: se o CPF ou o RG digitado já é de outro cadastro,
    // a pessoa já tinha vindo antes. liga o atendimento ao cadastro dela em vez de dar "duplicado"
    const [atual] = await banco.query('SELECT nao_identificado FROM paciente WHERE id_paciente = ?', [atend.id_paciente]);
    if (atual[0].nao_identificado && (p.cpf || p.rg)) {
      const [outro] = await banco.query(
        'SELECT id_paciente FROM paciente WHERE (cpf = ? OR rg = ?) AND id_paciente <> ?',
        [p.cpf || null, p.rg || null, atend.id_paciente]
      );
      if (outro.length > 0) {
        const idCadastro = outro[0].id_paciente;
        const emAndamento = await atendimentoEmAndamento(idCadastro);
        if (emAndamento) {
          return res.status(409).json({
            erro: 'Esse paciente já tem outro atendimento em andamento (' + numeroAtendimento(emAndamento.id_atendimento) + ').'
          });
        }
        await banco.query('UPDATE atendimento SET id_paciente = ? WHERE id_atendimento = ?', [idCadastro, atend.id_atendimento]);
        // o cadastro provisório de "não identificado" ficou sem atendimento: apaga
        await banco.query(
          'DELETE FROM paciente WHERE id_paciente = ? AND NOT EXISTS (SELECT 1 FROM atendimento WHERE id_paciente = ?)',
          [atend.id_paciente, atend.id_paciente]
        );
        atend.id_paciente = idCadastro; // daqui pra baixo atualiza o cadastro certo
      }
    }

    // grava o que a recepção alterou (e, no não identificado, os dados de quando ele for identificado)
    await atualizarPaciente(atend.id_paciente, p);

    // o alerta só muda enquanto o paciente espera a triagem. depois de triado, quem manda é a classificação
    await banco.query(
      "UPDATE atendimento SET alerta = ? WHERE id_atendimento = ? AND status = 'aberto'",
      [p.alerta === true, atend.id_atendimento]
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

    // grava quem cancelou (da sessão) e a hora.
    // o "AND status IN (...)" garante que, se o médico finalizar ao mesmo tempo, o cancelamento não passa por cima
    const [resultado] = await banco.query(
      `UPDATE atendimento
          SET status = 'cancelado', id_cancelou = ?, data_hora_cancelamento = NOW()
        WHERE id_atendimento = ? AND status IN ('aberto', 'triado')`,
      [req.session.usuario.id_usuario, req.params.id]
    );
    // nenhuma linha mudou: o médico finalizou um instante antes
    if (resultado.affectedRows === 0) {
      return res.status(409).json({ erro: 'Esse atendimento acabou de ser finalizado e não pode mais ser cancelado.' });
    }
    res.json({ ok: true });
  } catch (error) {
    erroServidor(res, error);
  }
});

// histórico: atendimentos encerrados (atendidos ou cancelados) de todas as recepcionistas. só leitura.
// filtros na URL: de, ate, numero, status. no máximo 200 linhas
rotas.get('/recepcao/historico', exigir('recepcao', 'admin'), async (req, res) => {
  try {
    // a data filtra pelo encerramento (atendimento ou cancelamento), que é o que a tabela mostra.
    // cancelado de antes da coluna existir não tem essa data: cai na entrada
    const filtros = filtrosHistorico(req.query, 'COALESCE(a.data_hora_atendimento, a.data_hora_cancelamento, a.data_hora_entrada)');
    if (filtros.erro) {
      return res.status(400).json({ erro: filtros.erro });
    }
    const { condicoes, valores } = filtros;
    condicoes.push("a.status IN ('atendido', 'cancelado')");
    if (req.query.status === 'atendido' || req.query.status === 'cancelado') {
      condicoes.push('a.status = ?');
      valores.push(req.query.status);
    }

    // a tabela usuario entra 3 vezes, cada uma com um apelido:
    // r = quem abriu, m = médico que atendeu, c = quem cancelou.
    // LEFT JOIN no m e no c porque um dos dois sempre fica vazio
    const [linhas] = await banco.query(
      `SELECT a.id_atendimento, a.status, p.nome_completo, p.cpf,
              DATE_FORMAT(a.data_hora_entrada, '%d/%m/%Y %H:%i') AS entrada,
              DATE_FORMAT(COALESCE(a.data_hora_atendimento, a.data_hora_cancelamento), '%d/%m/%Y %H:%i') AS encerrado_em,
              r.nome AS aberto,
              COALESCE(m.nome, c.nome) AS encerrado
         FROM atendimento a
         JOIN paciente p ON p.id_paciente = a.id_paciente
         JOIN usuario r ON r.id_usuario = a.id_recepcionista
         LEFT JOIN usuario m ON m.id_usuario = a.id_medico
         LEFT JOIN usuario c ON c.id_usuario = a.id_cancelou
        WHERE ${condicoes.join(' AND ')}
        ORDER BY a.id_atendimento DESC
        LIMIT 200`,
      valores
    );

    res.json(linhas.map(l => ({ ...l, numero_atendimento: numeroAtendimento(l.id_atendimento) })));
  } catch (error) {
    erroServidor(res, error);
  }
});

module.exports = rotas;
