// funções de apoio usadas pelas rotas (regras e coisas que se repetem)
const banco = require('./banco');

// calcula a idade a partir da data de nascimento ('1990-05-10')
function idade(dataNascimento) {
  const [ano, mes, dia] = String(dataNascimento).slice(0, 10).split('-').map(Number);
  const hoje = new Date();
  let anos = hoje.getFullYear() - ano;
  // se ainda não chegou o aniversário deste ano, tira 1
  const aindaNaoFezAniversario =
    hoje.getMonth() + 1 < mes ||
    (hoje.getMonth() + 1 === mes && hoje.getDate() < dia);
  if (aindaNaoFezAniversario) anos--;
  return anos;
}

// número que aparece na tela: AT + id com 4 dígitos (7 -> AT0007)
// não fica gravado no banco, é montado a partir do id
function numeroAtendimento(id) {
  return 'AT' + String(id).padStart(4, '0');
}

// deixa só os números (tira ponto e traço do CPF)
function soNumeros(texto) {
  return String(texto || '').replace(/\D/g, '');
}

// regras do paciente, usadas ao abrir e ao alterar
// devolve a mensagem de erro, ou null se estiver tudo certo
function validarPaciente(p) {
  if (!p.nome_completo || !p.data_nascimento || !p.sexo) {
    return 'Preencha nome, data de nascimento e sexo.';
  }
  // precisa de pelo menos um documento
  if (!p.cpf && !p.rg) {
    return 'Informe o CPF ou o RG.';
  }
  // menor de idade precisa de um responsável
  if (idade(p.data_nascimento) < 18 && !p.nome_pai && !p.nome_mae) {
    return 'Paciente menor de idade: informe o nome do pai ou da mãe.';
  }
  return null;
}

// compara o cadastro do banco com o que a recepção digitou
// devolve a lista do que está diferente (lista vazia = tudo igual)
function diferencasPaciente(cadastro, digitado) {
  // campo do banco -> nome que aparece no aviso
  const campos = {
    nome_completo: 'nome',
    rg: 'RG',
    data_nascimento: 'data de nascimento',
    sexo: 'sexo',
    telefone: 'telefone',
    nome_pai: 'nome do pai',
    nome_mae: 'nome da mãe',
    endereco: 'endereço'
  };

  const diferencas = [];
  for (const campo in campos) {
    const novo = String(digitado[campo] || '').trim();
    const antigo = String(cadastro[campo] || '').trim();

    // campo em branco na tela não conta: a recepção pode só não ter preenchido
    if (!novo) continue;

    // compara sem ligar pra maiúscula e minúscula ("otavio" = "OTAVIO")
    if (novo.toLowerCase() !== antigo.toLowerCase()) {
      diferencas.push(campos[campo] + ' (cadastro: ' + (antigo || 'vazio') + ', digitado: ' + novo + ')');
    }
  }
  return diferencas;
}

// busca o atendimento pelo id (devolve undefined se não existir)
async function buscarAtendimento(id) {
  const [linhas] = await banco.query('SELECT * FROM atendimento WHERE id_atendimento = ?', [id]);
  return linhas[0];
}

// resposta padrão quando algo quebra dentro de uma rota
function erroServidor(res, error) {
  console.error(error); // o erro completo aparece no terminal
  // CPF ou RG repetido: o banco recusa por causa do UNIQUE
  if (error.code === 'ER_DUP_ENTRY') {
    return res.status(400).json({ erro: 'Já existe um cadastro com esse CPF ou RG.' });
  }
  res.status(500).json({ erro: 'Erro no servidor.' });
}

module.exports = { idade, numeroAtendimento, soNumeros, validarPaciente, diferencasPaciente, buscarAtendimento, erroServidor };
