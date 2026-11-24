// quem fez login (o login.js guardou no sessionStorage)
const usuario = JSON.parse(sessionStorage.getItem('usuario'));

// sem login ou com outro perfil, volta pro login
if (!usuario || (usuario.perfil !== 'enfermagem' && usuario.perfil !== 'admin')) {
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

// admin só olha a fila: não aparece o botão Fazer triagem
// (o servidor também não deixa: a rota que grava a triagem só aceita a enfermagem)
const somenteVer = usuario.perfil === 'admin';

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
// o servidor só devolve atendimentos com status 'aberto', primeiro os com alerta e depois por chegada.
// manda junto o filtro da tela (Buscar por). campo vazio = fila inteira.
// como lê o filtro toda vez, a atualização de 30 em 30 segundos continua filtrando
async function carregarFila() {
  const tipo = document.getElementById('tipoBusca').value;
  const busca = document.getElementById('busca').value.trim();
  const resposta = await pedir('/triagem/fila?tipo=' + tipo + '&busca=' + encodeURIComponent(busca));
  const dados = await resposta.json();

  // limpa a tabela antes de montar de novo
  const tbody = document.getElementById('fila');
  tbody.innerHTML = '';

  // o servidor deu erro (ex: número digitado errado): mostra o motivo dentro da tabela,
  // que some sozinho quando a busca é corrigida
  if (!resposta.ok) {
    fila = [];
    const tr = document.createElement('tr');
    celula(tr, dados.erro).colSpan = 5;
    tbody.appendChild(tr);
    return;
  }
  fila = dados;

  if (fila.length === 0) {
    const tr = document.createElement('tr');
    const aviso = busca ? 'Nenhum paciente encontrado com esse filtro.' : 'Nenhum paciente aguardando.';
    celula(tr, aviso).colSpan = 5;
    tbody.appendChild(tr);
    return;
  }

  // uma linha por paciente, com o botão Fazer triagem no final
  fila.forEach((a, i) => {
    const tr = document.createElement('tr');
    celula(tr, a.numero_atendimento);
    const nome = celula(tr, a.nome_completo + ' ');
    celula(tr, a.idade);

    // recepção marcou sinal de alerta: linha em vermelho e etiqueta do lado do nome
    if (a.alerta) {
      tr.className = 'linha-alerta';
      const span = document.createElement('span');
      span.className = 'etiqueta prioridade-1';
      span.textContent = 'alerta';
      nome.appendChild(span);
    }
    celula(tr, a.data_hora_entrada);

    const acao = celula(tr, '');
    if (!somenteVer) {
      const botao = document.createElement('button');
      botao.className = 'botao';
      botao.textContent = 'Fazer triagem';
      botao.addEventListener('click', () => abrirTriagem(i));
      acao.appendChild(botao);
    }

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

    // 409 = outra pessoa já triou ou a recepção cancelou: fecha o formulário e atualiza a fila
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

// Buscar: carrega a fila com o filtro digitado
document.getElementById('botaoBuscar').addEventListener('click', carregarFila);

// Ver todos: apaga o filtro e mostra a fila inteira
document.getElementById('botaoTodos').addEventListener('click', () => {
  document.getElementById('busca').value = '';
  carregarFila();
});

// carrega a fila quando a tela abre
carregarFila();

// a cada 30 segundos busca a fila de novo, pra paciente novo aparecer sozinho
setInterval(carregarFila, 30000);
