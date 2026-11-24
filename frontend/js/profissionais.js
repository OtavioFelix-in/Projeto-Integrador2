// tela do administrador: cadastrar profissionais e ativar/desativar

// quem fez login (o login.js guardou no sessionStorage)
const usuario = JSON.parse(sessionStorage.getItem('usuario'));

// sem login ou com outro perfil, volta pro login
// (isso só esconde a tela, quem protege de verdade é o servidor)
if (!usuario || usuario.perfil !== 'admin') {
  window.location.replace('login.html');
  throw new Error('sem login'); // para o resto do código
}

// voltou pelo Voltar e não tem mais login: manda pro login
window.addEventListener('pageshow', (evento) => {
  if (evento.persisted && !sessionStorage.getItem('usuario')) {
    window.location.replace('login.html');
  }
});

// mostra o nome no topo
document.getElementById('nomeUsuario').textContent = usuario.nome;

// botão sair: limpa o login e volta pra tela de entrada
document.getElementById('sair').addEventListener('click', async () => {
  try {
    await fetch('/logout', { method: 'POST' }); // apaga a sessão no servidor
  } catch (erro) {
    // servidor fora do ar: sai mesmo assim
  }
  sessionStorage.clear();
  window.location.replace('login.html');
});

// fetch que volta pro login se a sessão do servidor acabou (ex: reiniciou o node)
async function pedir(url, opcoes) {
  const resposta = await fetch(url, opcoes);
  if (resposta.status === 401) {
    sessionStorage.clear();
    window.location.replace('login.html');
    throw new Error('sessão acabou');
  }
  return resposta;
}

// perfil do banco -> nome que aparece na tela
const nomesPerfil = {
  recepcao: 'Recepção',
  enfermagem: 'Enfermagem',
  medico: 'Médico',
  admin: 'Administrador'
};

// pega o valor de um campo pelo id, sem espaços nas pontas
function campo(id) {
  return document.getElementById(id).value.trim();
}

// escreve uma mensagem embaixo do formulário
function mostrarMensagem(texto, tipo) {
  const p = document.getElementById('mensagem');
  p.textContent = texto;
  p.className = tipo; // 'erro' (vermelho) ou 'sucesso' (verde), cores no style.css
}

// cria uma célula de tabela com texto
function celula(tr, texto) {
  const td = document.createElement('td');
  td.textContent = texto;
  tr.appendChild(td);
  return td;
}

// busca a equipe no servidor e monta a tabela
async function carregarEquipe() {
  const resposta = await pedir('/usuarios');
  const equipe = await resposta.json();

  const tbody = document.getElementById('equipe');
  tbody.innerHTML = '';

  if (!resposta.ok) {
    mostrarMensagem(equipe.erro, 'erro');
    return;
  }

  equipe.forEach(u => {
    const tr = document.createElement('tr');
    celula(tr, u.nome);
    celula(tr, u.cpf);
    celula(tr, u.telefone);
    celula(tr, u.email || '');
    celula(tr, nomesPerfil[u.perfil]);

    // etiqueta verde (ativo) ou cinza (inativo)
    const span = document.createElement('span');
    span.className = 'etiqueta ' + (u.ativo ? 'situacao-ativo' : 'situacao-inativo');
    span.textContent = u.ativo ? 'ativo' : 'inativo';
    celula(tr, '').appendChild(span);

    // botão Desativar / Reativar. o admin logado não aparece com botão (não pode se desativar)
    const acao = celula(tr, '');
    acao.className = 'botoes';
    if (u.id_usuario !== usuario.id_usuario) {
      const botao = document.createElement('button');
      botao.className = u.ativo ? 'botao botao-secundario' : 'botao';
      botao.textContent = u.ativo ? 'Desativar' : 'Reativar';
      botao.addEventListener('click', () => trocarAtivo(u.id_usuario, botao));
      acao.appendChild(botao);
    }

    tbody.appendChild(tr);
  });
}

// ativa ou desativa e recarrega a tabela
async function trocarAtivo(id, botao) {
  botao.disabled = true; // não deixa clicar duas vezes
  try {
    const resposta = await pedir('/usuarios/' + id + '/ativo', { method: 'PATCH' });
    const dados = await resposta.json();
    if (!resposta.ok) {
      mostrarMensagem(dados.erro, 'erro');
      return;
    }
    carregarEquipe();
  } catch (erro) {
    mostrarMensagem('Sem conexão com o servidor. Tente de novo.', 'erro');
  } finally {
    botao.disabled = false;
  }
}

// cadastrar: manda o formulário pro servidor
document.getElementById('formProfissional').addEventListener('submit', async (evento) => {
  evento.preventDefault(); // não deixa a página recarregar

  const profissional = {
    nome: campo('nome'),
    cpf: campo('cpf'),
    telefone: campo('telefone'),
    email: campo('email'),
    perfil: campo('perfil'),
    senha: document.getElementById('senha').value // senha sem trim: espaço pode fazer parte dela
  };

  const botao = evento.submitter;
  botao.disabled = true; // não deixa cadastrar duas vezes
  try {
    const resposta = await pedir('/usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profissional)
    });
    const dados = await resposta.json();

    // o servidor recusou (CPF repetido, campo faltando...): mostra o motivo
    if (!resposta.ok) {
      mostrarMensagem(dados.erro, 'erro');
      return;
    }
    mostrarMensagem(profissional.nome + ' cadastrado. O login é o CPF.', 'sucesso');
    evento.target.reset(); // limpa o formulário
    carregarEquipe();
  } catch (erro) {
    mostrarMensagem('Sem conexão com o servidor. Tente de novo.', 'erro');
  } finally {
    botao.disabled = false;
  }
});

// ao abrir a tela, já mostra a equipe
carregarEquipe();
