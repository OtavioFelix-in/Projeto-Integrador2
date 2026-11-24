// funções de apoio usadas pelas rotas (regras e coisas que se repetem)
const banco = require('./banco');

// calcula a idade a partir da data de nascimento ('1990-05-10')
// sem data (paciente não identificado) devolve null, e a tela mostra vazio
function idade(dataNascimento) {
  if (!dataNascimento) return null;
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
  // CPF, quando informado, só com os 11 números (sem ponto e traço), que é como a busca procura
  if (p.cpf && !/^\d{11}$/.test(p.cpf)) {
    return 'O CPF precisa ter 11 números, sem ponto e traço.';
  }

  // não identificado (chegou sem documento e sem conseguir informar): só o sexo é obrigatório.
  // o atendimento abre na hora e a recepção completa o cadastro depois, pelo Alterar
  if (p.nao_identificado === true) {
    if (!p.sexo) {
      return 'Informe o sexo.';
    }
    return null;
  }

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

// busca o atendimento pelo id (devolve undefined se não existir)
async function buscarAtendimento(id) {
  const [linhas] = await banco.query('SELECT * FROM atendimento WHERE id_atendimento = ?', [id]);
  return linhas[0];
}

// número do atendimento digitado na busca: '8', '0008' ou 'AT0008' -> 8.
// qualquer outra coisa (abc, 0, -2, 0.8) devolve null. usado em todas as buscas por número
function numeroDoAtendimento(texto) {
  const digitado = String(texto || '').trim();
  if (!/^(AT)?\d{1,9}$/i.test(digitado)) return null;
  const id = Number(digitado.replace(/^AT/i, ''));
  return id === 0 ? null : id;
}

// confere se a data existe de verdade: '2026-02-30' tem o formato certo mas não existe
function dataExiste(texto) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false; // formato do campo de data: 2026-11-23
  const d = new Date(texto + 'T00:00:00Z');
  // o JS arruma data impossível (30/02 vira 02/03), então se mudou é porque não existia
  return !isNaN(d) && d.toISOString().slice(0, 10) === texto;
}

// filtros que as 3 telas de histórico têm em comum: data (de / até) e número do atendimento.
// devolve os pedaços do WHERE e os valores dos ?, ou { erro } se algum filtro estiver errado.
// cada rota acrescenta os filtros só dela.
// colunaData vem do código da rota (nunca da tela), por isso pode ir direto no texto do SQL
function filtrosHistorico(query, colunaData) {
  const condicoes = [];
  const valores = [];
  // String() garante texto mesmo se o endereço mandar o mesmo parâmetro duas vezes
  const de = String(query.de || '').trim();
  const ate = String(query.ate || '').trim();
  const numero = String(query.numero || '').trim();

  // campo vazio = filtro desligado. campo preenchido errado = erro com mensagem
  if (de && !dataExiste(de)) {
    return { erro: 'Data inicial inválida.' };
  }
  if (ate && !dataExiste(ate)) {
    return { erro: 'Data final inválida.' };
  }
  if (de && ate && de > ate) {
    return { erro: 'A data inicial não pode ser depois da data final.' };
  }
  if (de) {
    condicoes.push(colunaData + ' >= ?');
    valores.push(de);
  }
  // "até" pega o dia inteiro: vai até as 23:59:59 daquele dia
  if (ate) {
    condicoes.push(colunaData + ' <= ?');
    valores.push(ate + ' 23:59:59');
  }

  // número do atendimento: campo preenchido errado é erro
  if (numero) {
    const id = numeroDoAtendimento(numero);
    if (!id) {
      return { erro: 'Digite só o número do atendimento. Ex: 8' };
    }
    condicoes.push('a.id_atendimento = ?');
    valores.push(id);
  }
  return { condicoes, valores };
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

module.exports = { idade, numeroAtendimento, numeroDoAtendimento, soNumeros, validarPaciente, buscarAtendimento, filtrosHistorico, erroServidor };
