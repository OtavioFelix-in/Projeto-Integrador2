const express = require('express');
const mysql = require('mysql2/promise'); // versão com promise, pra usar await
const path = require('path');
const bcrypt = require('bcryptjs');

const app = express();

// pasta das telas (fica ao lado da backend)
const mapa = path.join(__dirname, '..', 'frontend');

// lê o arquivo .env (usuário e senha do banco ficam fora do código e do github)
process.loadEnvFile(path.join(__dirname, '.env'));

// conexão com o banco
const banco = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  dateStrings: true // datas vêm como texto ('2026-10-28 14:30:00'), sem confusão de fuso
});

app.use(express.static(mapa)); // serve o html, css e js do frontend
app.use(express.json());       // pra conseguir ler o req.body


// ---------- funções de apoio ----------

// calcula a idade a partir da data de nascimento ('1990-05-10')
function idade(dataNascimento) {
  const [ano, mes, dia] = String(dataNascimento).slice(0, 10).split('-').map(Number);
  const hoje = new Date();
  let anos = hoje.getFullYear() - ano;
  const aindaNaoFezAniversario =
    hoje.getMonth() + 1 < mes ||
    (hoje.getMonth() + 1 === mes && hoje.getDate() < dia);
  if (aindaNaoFezAniversario) anos--;
  return anos;
}

// número que aparece na tela: AT + id com 4 dígitos (7 -> AT0007)
function numeroAtendimento(id) {
  return 'AT' + String(id).padStart(4, '0');
}

// deixa só os números (tira ponto e traço do CPF)
function soNumeros(texto) {
  return String(texto || '').replace(/\D/g, '');
}

// regras do paciente, usadas ao abrir e ao alterar
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
  return null; // tudo certo
}

// busca o atendimento pelo id (devolve undefined se não existir)
async function buscarAtendimento(id) {
  const [linhas] = await banco.query('SELECT * FROM atendimento WHERE id_atendimento = ?', [id]);
  return linhas[0];
}

// resposta padrão quando algo quebra
function erroServidor(res, error) {
  console.error(error);
  if (error.code === 'ER_DUP_ENTRY') {
    return res.status(400).json({ erro: 'Já existe um cadastro com esse CPF ou RG.' });
  }
  res.status(500).json({ erro: 'Erro no servidor.' });
}


// ---------- login e usuários ----------

// login pelo CPF e senha
app.post('/login', async (req, res) => {
  try {
    const cpf = soNumeros(req.body.cpf);
    const senha = req.body.senha;

    // só deixa entrar usuário ativo
    const [linhas] = await banco.query(
      'SELECT * FROM usuario WHERE cpf = ? AND ativo = TRUE',
      [cpf]
    );

    if (linhas.length === 0) {
      return res.status(401).json({ erro: 'CPF ou senha inválidos.' });
    }

    const user = linhas[0];

    // compara a senha digitada com o hash do banco
    const senhaCerta = await bcrypt.compare(senha, user.senha_hash);

    if (!senhaCerta) {
      return res.status(401).json({ erro: 'CPF ou senha inválidos.' });
    }

    // não manda o hash de volta
    res.json({ id_usuario: user.id_usuario, nome: user.nome, perfil: user.perfil });
  } catch (error) {
    erroServidor(res, error);
  }
});

// cadastro de profissional (requisito 5.1 da documentação)
app.post('/usuarios', async (req, res) => {
  try {
    const u = req.body;
    const cpf = soNumeros(u.cpf);

    if (!u.nome || cpf.length !== 11 || !u.telefone || !u.senha || !u.perfil) {
      return res.status(400).json({ erro: 'Preencha nome, CPF (11 números), telefone, senha e perfil.' });
    }
    if (!['recepcao', 'enfermagem', 'medico'].includes(u.perfil)) {
      return res.status(400).json({ erro: 'Perfil deve ser recepcao, enfermagem ou medico.' });
    }

    // a senha nunca é gravada pura
    const hash = await bcrypt.hash(u.senha, 10);

    // o login é o próprio CPF
    const [novo] = await banco.query(
      `INSERT INTO usuario (nome, cpf, telefone, email, login, senha_hash, perfil)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [u.nome, cpf, u.telefone, u.email || null, cpf, hash, u.perfil]
    );

    res.status(201).json({ id_usuario: novo.insertId });
  } catch (error) {
    erroServidor(res, error);
  }
});


// ---------- recepção ----------

// abre um atendimento (cadastra o paciente se ele ainda não existe)
app.post('/atendimentos', async (req, res) => {
  try {
    const p = req.body;

    const erro = validarPaciente(p);
    if (erro) {
      return res.status(400).json({ erro });
    }

    // se o CPF já está cadastrado, reaproveita o paciente
    let idPaciente = null;
    if (p.cpf) {
      const [achou] = await banco.query('SELECT id_paciente FROM paciente WHERE cpf = ?', [p.cpf]);
      if (achou.length > 0) {
        idPaciente = achou[0].id_paciente;
      }
    }

    // se não achou, cadastra o paciente novo (campo vazio vira null)
    if (!idPaciente) {
      const [novo] = await banco.query(
        `INSERT INTO paciente (nome_completo, cpf, rg, data_nascimento, sexo, telefone, nome_pai, nome_mae, endereco)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [p.nome_completo, p.cpf || null, p.rg || null, p.data_nascimento, p.sexo,
         p.telefone || null, p.nome_pai || null, p.nome_mae || null, p.endereco || null]
      );
      idPaciente = novo.insertId;
    }

    // abre o atendimento (status começa como 'aberto')
    const [atend] = await banco.query(
      'INSERT INTO atendimento (id_paciente, id_recepcionista) VALUES (?, ?)',
      [idPaciente, p.id_recepcionista]
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
app.get('/atendimentos', async (req, res) => {
  try {
    const busca = String(req.query.busca || '').trim().toUpperCase();

    let filtro = 'p.cpf = ?';
    let valor = soNumeros(busca);
    if (busca.startsWith('AT')) {
      filtro = 'a.id_atendimento = ?';
      valor = Number(busca.slice(2)) || 0;
    }

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

    res.json(linhas.map(l => ({ ...l, numero_atendimento: numeroAtendimento(l.id_atendimento) })));
  } catch (error) {
    erroServidor(res, error);
  }
});

// altera os dados do paciente de um atendimento
app.put('/atendimentos/:id', async (req, res) => {
  try {
    const p = req.body;

    const erro = validarPaciente(p);
    if (erro) {
      return res.status(400).json({ erro });
    }

    const atend = await buscarAtendimento(req.params.id);
    if (!atend) {
      return res.status(404).json({ erro: 'Atendimento não encontrado.' });
    }
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
app.patch('/atendimentos/:id/cancelar', async (req, res) => {
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


// ---------- triagem ----------

// pacientes esperando triagem, por ordem de chegada
app.get('/triagem/fila', async (req, res) => {
  try {
    const [linhas] = await banco.query(
      `SELECT a.id_atendimento, a.data_hora_entrada, p.nome_completo, p.data_nascimento, p.sexo
         FROM atendimento a
         JOIN paciente p ON p.id_paciente = a.id_paciente
        WHERE a.status = 'aberto'
        ORDER BY a.data_hora_entrada`
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

// grava a triagem e manda o paciente pro médico
app.post('/atendimentos/:id/triagem', async (req, res) => {
  try {
    const t = req.body;

    if (!t.pressao_arterial || !t.temperatura || !t.batimentos_cardiacos || !t.queixas || !t.classificacao) {
      return res.status(400).json({ erro: 'Preencha todos os campos da triagem.' });
    }
    if (!/^\d{2,3}\/\d{2,3}$/.test(t.pressao_arterial)) {
      return res.status(400).json({ erro: 'Pressão no formato 120/80.' });
    }

    const atend = await buscarAtendimento(req.params.id);
    if (!atend) {
      return res.status(404).json({ erro: 'Atendimento não encontrado.' });
    }
    if (atend.status !== 'aberto') {
      return res.status(400).json({ erro: 'Só dá para fazer triagem de atendimento aberto.' });
    }

    await banco.query(
      `INSERT INTO triagem (id_atendimento, id_enfermeiro, pressao_arterial, temperatura, batimentos_cardiacos, queixas, classificacao)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.params.id, t.id_enfermeiro, t.pressao_arterial, t.temperatura, t.batimentos_cardiacos, t.queixas, t.classificacao]
    );
    await banco.query("UPDATE atendimento SET status = 'triado' WHERE id_atendimento = ?", [req.params.id]);

    res.status(201).json({ ok: true });
  } catch (error) {
    erroServidor(res, error);
  }
});


// ---------- médico ----------

// painel: triados, do mais urgente pro menos urgente, depois por chegada
app.get('/painel', async (req, res) => {
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

// lista de remédios pro médico escolher
app.get('/medicamentos', async (req, res) => {
  try {
    const [linhas] = await banco.query(
      'SELECT id_medicamento, nome, apresentacao FROM medicamento WHERE ativo = TRUE ORDER BY nome, apresentacao'
    );
    res.json(linhas);
  } catch (error) {
    erroServidor(res, error);
  }
});

// remédios já passados nesse atendimento
app.get('/atendimentos/:id/prescricoes', async (req, res) => {
  try {
    const [linhas] = await banco.query(
      `SELECT pr.id_prescricao, m.nome, m.apresentacao, pr.dosagem, pr.frequencia
         FROM prescricao pr
         JOIN medicamento m ON m.id_medicamento = pr.id_medicamento
        WHERE pr.id_atendimento = ?
        ORDER BY pr.id_prescricao`,
      [req.params.id]
    );
    res.json(linhas);
  } catch (error) {
    erroServidor(res, error);
  }
});

// médico passa um remédio
app.post('/atendimentos/:id/prescricoes', async (req, res) => {
  try {
    const m = req.body;
    if (!m.id_medicamento || !m.dosagem || !m.frequencia) {
      return res.status(400).json({ erro: 'Escolha o medicamento e preencha dosagem e frequência.' });
    }

    const atend = await buscarAtendimento(req.params.id);
    if (!atend || atend.status !== 'triado') {
      return res.status(400).json({ erro: 'Só dá para prescrever em atendimento triado.' });
    }

    await banco.query(
      'INSERT INTO prescricao (id_atendimento, id_medicamento, dosagem, frequencia) VALUES (?, ?, ?, ?)',
      [req.params.id, m.id_medicamento, m.dosagem, m.frequencia]
    );
    res.status(201).json({ ok: true });
  } catch (error) {
    erroServidor(res, error);
  }
});

// médico finaliza com o diagnóstico (vira histórico)
app.patch('/atendimentos/:id/finalizar', async (req, res) => {
  try {
    if (!req.body.diagnostico) {
      return res.status(400).json({ erro: 'Informe o diagnóstico.' });
    }

    const atend = await buscarAtendimento(req.params.id);
    if (!atend || atend.status !== 'triado') {
      return res.status(400).json({ erro: 'Só dá para finalizar atendimento triado.' });
    }

    await banco.query(
      `UPDATE atendimento
          SET status = 'atendido', id_medico = ?, diagnostico = ?, data_hora_atendimento = NOW()
        WHERE id_atendimento = ?`,
      [req.body.id_medico, req.body.diagnostico, req.params.id]
    );
    res.json({ ok: true });
  } catch (error) {
    erroServidor(res, error);
  }
});


app.listen(3000, () => {
  console.log('Servidor rodando em http://localhost:3000');
});
