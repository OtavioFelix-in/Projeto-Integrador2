const express = require('express');
const mysql = require('mysql2/promise');

const app = express();
app.use(express.json());
app.use(express.static(__dirname + '/public'));

const banco = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'root',
  database: 'pronto_socorro',
  dateStrings: true
});

function numeroAtendimento(id) {
  return 'AT' + String(id).padStart(4, '0');
}

function idade(dataNascimento) {
  const hoje = new Date();
  const nasc = new Date(dataNascimento);
  let anos = hoje.getFullYear() - nasc.getFullYear();
  const mes = hoje.getMonth() - nasc.getMonth();
  if (mes < 0 || (mes === 0 && hoje.getDate() < nasc.getDate())) {
    anos--;
  }
  return anos;
}

function validarPaciente(p) {
  if (!p.nome_completo || !p.data_nascimento || !p.sexo) {
    return 'Preencha nome, data de nascimento e sexo.';
  }
  if (!p.cpf && !p.rg) {
    return 'Informe o CPF ou o RG.';
  }
  if (idade(p.data_nascimento) < 18 && !p.nome_pai && !p.nome_mae) {
    return 'Paciente menor de idade: informe o nome do pai ou da mãe.';
  }
  return null;
}

app.post('/login', async (req, res) => {
  const { usuario, senha } = req.body;
  const [linhas] = await banco.query(
    `SELECT u.id_usuario, u.nome, u.perfil
       FROM login l, usuario u
      WHERE u.id_usuario = l.id_usuario
        AND l.usuario = ? AND l.senha = ?`,
    [usuario, senha]
  );
  if (linhas.length === 0) {
    return res.status(401).json({ erro: 'Usuário ou senha inválidos.' });
  }
  res.json(linhas[0]);
});

app.post('/atendimentos', async (req, res) => {
  const p = req.body;
  const erro = validarPaciente(p);
  if (erro) {
    return res.status(400).json({ erro });
  }

  let idPaciente;
  if (p.cpf) {
    const [achou] = await banco.query('SELECT id_paciente FROM paciente WHERE cpf = ?', [p.cpf]);
    if (achou.length > 0) {
      idPaciente = achou[0].id_paciente;
    }
  }

  if (!idPaciente) {
    const [novo] = await banco.query(
      `INSERT INTO paciente (nome_completo, cpf, rg, data_nascimento, sexo, telefone, nome_pai, nome_mae, endereco)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [p.nome_completo, p.cpf || null, p.rg || null, p.data_nascimento, p.sexo,
       p.telefone || null, p.nome_pai || null, p.nome_mae || null, p.endereco || null]
    );
    idPaciente = novo.insertId;
  }

  const [atend] = await banco.query('INSERT INTO atendimento (id_paciente) VALUES (?)', [idPaciente]);
  res.status(201).json({
    id_atendimento: atend.insertId,
    numero_atendimento: numeroAtendimento(atend.insertId)
  });
});

app.get('/atendimentos', async (req, res) => {
  const busca = (req.query.busca || '').trim().toUpperCase();
  let filtro = 'p.cpf = ?';
  let valor = busca;
  if (busca.startsWith('AT')) {
    filtro = 'a.id_atendimento = ?';
    valor = Number(busca.substring(2));
  }

  const [linhas] = await banco.query(
    `SELECT a.id_atendimento, a.status, a.data_hora_entrada,
            p.id_paciente, p.nome_completo, p.cpf, p.rg, p.data_nascimento, p.sexo,
            p.telefone, p.nome_pai, p.nome_mae, p.endereco
       FROM atendimento a, paciente p
      WHERE p.id_paciente = a.id_paciente
        AND ${filtro}
      ORDER BY a.id_atendimento DESC`,
    [valor]
  );

  res.json(linhas.map(l => ({ ...l, numero_atendimento: numeroAtendimento(l.id_atendimento) })));
});

app.put('/atendimentos/:id', async (req, res) => {
  const p = req.body;
  const erro = validarPaciente(p);
  if (erro) {
    return res.status(400).json({ erro });
  }

  const [atend] = await banco.query('SELECT id_paciente, status FROM atendimento WHERE id_atendimento = ?', [req.params.id]);
  if (atend.length === 0) {
    return res.status(404).json({ erro: 'Atendimento não encontrado.' });
  }
  if (atend[0].status === 'confirmado' || atend[0].status === 'cancelado') {
    return res.status(400).json({ erro: 'Atendimento ' + atend[0].status + ' não pode ser alterado.' });
  }

  await banco.query(
    `UPDATE paciente
        SET nome_completo = ?, cpf = ?, rg = ?, data_nascimento = ?, sexo = ?,
            telefone = ?, nome_pai = ?, nome_mae = ?, endereco = ?
      WHERE id_paciente = ?`,
    [p.nome_completo, p.cpf || null, p.rg || null, p.data_nascimento, p.sexo,
     p.telefone || null, p.nome_pai || null, p.nome_mae || null, p.endereco || null,
     atend[0].id_paciente]
  );
  res.json({ ok: true });
});

app.patch('/atendimentos/:id/cancelar', async (req, res) => {
  const [atend] = await banco.query('SELECT status FROM atendimento WHERE id_atendimento = ?', [req.params.id]);
  if (atend.length === 0) {
    return res.status(404).json({ erro: 'Atendimento não encontrado.' });
  }
  if (atend[0].status === 'confirmado') {
    return res.status(400).json({ erro: 'Atendimento já confirmado pelo médico, não pode ser cancelado.' });
  }
  if (atend[0].status === 'cancelado') {
    return res.status(400).json({ erro: 'Atendimento já está cancelado.' });
  }

  await banco.query("UPDATE atendimento SET status = 'cancelado' WHERE id_atendimento = ?", [req.params.id]);
  res.json({ ok: true });
});

app.get('/triagem/fila', async (req, res) => {
  const [linhas] = await banco.query(
    `SELECT a.id_atendimento, a.data_hora_entrada, p.nome_completo, p.data_nascimento, p.sexo
       FROM atendimento a, paciente p
      WHERE p.id_paciente = a.id_paciente
        AND a.status = 'aberto'
      ORDER BY a.data_hora_entrada`
  );
  res.json(linhas.map(l => ({ ...l, numero_atendimento: numeroAtendimento(l.id_atendimento), idade: idade(l.data_nascimento) })));
});

app.post('/atendimentos/:id/triagem', async (req, res) => {
  const t = req.body;
  if (!t.pressao_arterial || !t.temperatura || !t.batimentos_cardiacos || !t.queixas || !t.prioridade) {
    return res.status(400).json({ erro: 'Preencha todos os campos da triagem.' });
  }
  if (!/^\d{2,3}\/\d{2,3}$/.test(t.pressao_arterial)) {
    return res.status(400).json({ erro: 'Pressão no formato 120/80.' });
  }

  const [atend] = await banco.query('SELECT status FROM atendimento WHERE id_atendimento = ?', [req.params.id]);
  if (atend.length === 0) {
    return res.status(404).json({ erro: 'Atendimento não encontrado.' });
  }
  if (atend[0].status !== 'aberto') {
    return res.status(400).json({ erro: 'Só dá para fazer triagem de atendimento aberto.' });
  }

  await banco.query(
    `INSERT INTO triagem (id_atendimento, id_enfermeiro, pressao_arterial, temperatura, batimentos_cardiacos, queixas, prioridade)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [req.params.id, t.id_enfermeiro, t.pressao_arterial, t.temperatura, t.batimentos_cardiacos, t.queixas, t.prioridade]
  );
  await banco.query("UPDATE atendimento SET status = 'triado' WHERE id_atendimento = ?", [req.params.id]);
  res.json({ ok: true });
});

app.get('/painel', async (req, res) => {
  const [linhas] = await banco.query(
    `SELECT a.id_atendimento, p.nome_completo, p.data_nascimento, p.sexo,
            t.pressao_arterial, t.temperatura, t.batimentos_cardiacos, t.queixas, t.prioridade, t.data_hora
       FROM atendimento a, paciente p, triagem t
      WHERE p.id_paciente = a.id_paciente
        AND t.id_atendimento = a.id_atendimento
        AND a.status = 'triado'
      ORDER BY t.prioridade, t.data_hora`
  );
  res.json(linhas.map(l => ({ ...l, numero_atendimento: numeroAtendimento(l.id_atendimento), idade: idade(l.data_nascimento) })));
});

app.get('/atendimentos/:id/prescricoes', async (req, res) => {
  const [linhas] = await banco.query(
    'SELECT medicamento, dosagem, frequencia FROM prescricao WHERE id_atendimento = ? ORDER BY id_prescricao',
    [req.params.id]
  );
  res.json(linhas);
});

app.post('/atendimentos/:id/prescricoes', async (req, res) => {
  const m = req.body;
  if (!m.medicamento || !m.dosagem || !m.frequencia) {
    return res.status(400).json({ erro: 'Preencha medicamento, dosagem e frequência.' });
  }

  const [atend] = await banco.query('SELECT status FROM atendimento WHERE id_atendimento = ?', [req.params.id]);
  if (atend.length === 0 || atend[0].status !== 'triado') {
    return res.status(400).json({ erro: 'Só dá para prescrever em atendimento triado.' });
  }

  await banco.query(
    'INSERT INTO prescricao (id_atendimento, medicamento, dosagem, frequencia) VALUES (?, ?, ?, ?)',
    [req.params.id, m.medicamento, m.dosagem, m.frequencia]
  );
  res.status(201).json({ ok: true });
});

app.patch('/atendimentos/:id/confirmar', async (req, res) => {
  if (!req.body.diagnostico) {
    return res.status(400).json({ erro: 'Informe o diagnóstico.' });
  }

  const [atend] = await banco.query('SELECT status FROM atendimento WHERE id_atendimento = ?', [req.params.id]);
  if (atend.length === 0 || atend[0].status !== 'triado') {
    return res.status(400).json({ erro: 'Só dá para confirmar atendimento triado.' });
  }

  await banco.query(
    `UPDATE atendimento
        SET status = 'confirmado', id_medico = ?, diagnostico = ?, data_hora_confirmacao = NOW()
      WHERE id_atendimento = ?`,
    [req.body.id_medico, req.body.diagnostico, req.params.id]
  );
  res.json({ ok: true });
});

app.use((err, req, res, next) => {
  console.error(err);
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(400).json({ erro: 'CPF ou RG já cadastrado para outro paciente.' });
  }
  res.status(500).json({ erro: 'Erro no servidor.' });
});

app.listen(3000, () => {
  console.log('Sistema rodando em http://localhost:3000');
});
