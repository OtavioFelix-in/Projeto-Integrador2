// quem fez login (o login.js guardou no sessionStorage)
const usuario = JSON.parse(sessionStorage.getItem('usuario'));

// sem login ou com outro perfil, volta pro login
if (!usuario || usuario.perfil !== 'enfermagem') {
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

// pacientes esperando triagem (o botão Fazer triagem pega os dados daqui)
let fila = [];

// escreve uma mensagem embaixo da tela (verde ou vermelha)
function mostrarMensagem(texto, tipo) {
  const p = document.getElementById('mensagem');
  p.textContent = texto;
  p.className = tipo;
}

// cria uma célula de tabela com texto
function celula(tr, texto) {
  const td = document.createElement('td');
  td.textContent = texto;
  tr.appendChild(td);
  return td;
}

// busca no servidor quem está esperando triagem e monta a tabela.
// o servidor só devolve atendimentos com status 'aberto', por ordem de chegada
async function carregarFila() {
  const resposta = await pedir('/triagem/fila');
  const dados = await resposta.json();

  // limpa a tabela antes de montar de novo
  const tbody = document.getElementById('fila');
  tbody.innerHTML = '';

  // o servidor deu erro (ex: banco fora do ar): avisa em vez de mostrar a fila vazia
  if (!resposta.ok) {
    fila = [];
    mostrarMensagem(dados.erro, 'erro');
    return;
  }
  fila = dados;

  if (fila.length === 0) {
    const tr = document.createElement('tr');
    celula(tr, 'Nenhum paciente aguardando.').colSpan = 5;
    tbody.appendChild(tr);
    return;
  }

  // uma linha por paciente, com o botão Fazer triagem no final
  fila.forEach((a, i) => {
    const tr = document.createElement('tr');
    celula(tr, a.numero_atendimento);
    celula(tr, a.nome_completo);
    celula(tr, a.idade);
    celula(tr, a.data_hora_entrada);

    const botao = document.createElement('button');
    botao.className = 'botao';
    botao.textContent = 'Fazer triagem';
    botao.addEventListener('click', () => abrirTriagem(i));
    celula(tr, '').appendChild(botao);

    tbody.appendChild(tr);
  });
}

// abre o formulário pro paciente escolhido
function abrirTriagem(i) {
  const a = fila[i];
  const form = document.getElementById('formTriagem');
  form.reset();        // limpa o que estava digitado
  form.hidden = false; // mostra o formulário (começa escondido no html)
  // guarda qual atendimento está sendo triado
  document.getElementById('idAtendimento').value = a.id_atendimento;
  document.getElementById('tituloTriagem').textContent = a.numero_atendimento + ' - ' + a.nome_completo;
  mostrarMensagem('', '');
}

// botão Fechar: esconde o formulário sem salvar
document.getElementById('fechar').addEventListener('click', () => {
  document.getElementById('formTriagem').hidden = true;
});

// salvar triagem
document.getElementById('formTriagem').addEventListener('submit', async (evento) => {
  evento.preventDefault(); // não deixa a página recarregar
  const id = document.getElementById('idAtendimento').value;

  // os nomes são iguais às colunas da tabela triagem
  const triagem = {
    pressao_arterial: document.getElementById('pressao_arterial').value.trim(),
    temperatura: document.getElementById('temperatura').value,
    batimentos_cardiacos: document.getElementById('batimentos_cardiacos').value,
    queixas: document.getElementById('queixas').value.trim(),
    classificacao: document.getElementById('classificacao').value // 1 a 5 (Manchester)
  };

  // desliga o botão enquanto o servidor responde, pra não mandar a triagem duas vezes
  const botaoSalvar = evento.submitter;
  botaoSalvar.disabled = true;

  try {
    const resposta = await pedir('/atendimentos/' + id + '/triagem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(triagem)
    });
    const dados = await resposta.json();

    // 409 = outra pessoa já triou esse paciente: fecha o formulário e atualiza a fila
    if (resposta.status === 409) {
      document.getElementById('formTriagem').hidden = true;
      mostrarMensagem(dados.erro, 'erro');
      carregarFila();
      return;
    }

    // o servidor recusou (campo faltando, pressão fora do formato...): mostra o motivo
    if (!resposta.ok) {
      mostrarMensagem(dados.erro, 'erro');
      return;
    }

    // deu certo: o status virou 'triado', então recarregar a fila tira o paciente da lista
    document.getElementById('formTriagem').hidden = true;
    mostrarMensagem('Triagem salva. Paciente enviado para o médico.', 'sucesso');
    carregarFila();
  } catch (erro) {
    // servidor desligado ou sem rede
    mostrarMensagem('Sem conexão com o servidor. Tente de novo.', 'erro');
  } finally {
    botaoSalvar.disabled = false; // liga o botão de novo
  }
});

// botão Atualizar, e já carrega a fila quando a tela abre
document.getElementById('atualizar').addEventListener('click', carregarFila);
carregarFila();
