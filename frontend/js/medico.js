// quem fez login (o login.js guardou no sessionStorage)
const usuario = JSON.parse(sessionStorage.getItem('usuario'));

// sem login ou com outro perfil, volta pro login
if (!usuario || usuario.perfil !== 'medico') {
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
  await fetch('/logout', { method: 'POST' }); // apaga a sessão no servidor
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

// classificação de Manchester: número -> nome (a cor vem do style.css, classe prioridade-N)
const classificacoes = {
  1: 'Emergência',
  2: 'Muito urgente',
  3: 'Urgente',
  4: 'Pouco urgente',
  5: 'Não urgente'
};

let painel = [];   // pacientes esperando
let atual = null;  // paciente que o médico chamou

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

// cartões do topo: quantos esperam e quantos são graves
function atualizarResumo() {
  document.getElementById('totalAguardando').textContent = painel.length;

  // filter separa só os que passam na condição
  const graves = painel.filter(a => a.classificacao <= 2); // vermelho e laranja
  document.getElementById('totalGraves').textContent = graves.length;
}

// busca os triados no servidor e monta a tabela.
// já vem na ordem certa: o servidor ordena por classificação e depois por chegada
async function carregarPainel() {
  const resposta = await pedir('/painel');
  painel = await resposta.json();
  atualizarResumo();

  // limpa a tabela antes de montar de novo
  const tbody = document.getElementById('painel');
  tbody.innerHTML = '';

  if (painel.length === 0) {
    const tr = document.createElement('tr');
    celula(tr, 'Nenhum paciente aguardando.').colSpan = 6;
    tbody.appendChild(tr);
    return;
  }

  // uma linha por paciente
  painel.forEach((a, i) => {
    const tr = document.createElement('tr');

    // etiqueta colorida com a classificação (ex: classe prioridade-1 = vermelho)
    const span = document.createElement('span');
    span.className = 'etiqueta prioridade-' + a.classificacao;
    span.textContent = classificacoes[a.classificacao];
    celula(tr, '').appendChild(span);

    celula(tr, a.numero_atendimento);
    celula(tr, a.nome_completo);
    celula(tr, a.idade);
    celula(tr, a.queixas);

    const botao = document.createElement('button');
    botao.className = 'botao';
    botao.textContent = 'Chamar';
    botao.addEventListener('click', () => chamar(i));
    celula(tr, '').appendChild(botao);

    tbody.appendChild(tr);
  });
}

// médico chama o paciente: abre a parte da consulta com os dados da triagem
function chamar(i) {
  atual = painel[i]; // guarda quem está sendo atendido
  document.getElementById('consulta').hidden = false;
  document.getElementById('tituloConsulta').textContent =
    atual.numero_atendimento + ' - ' + atual.nome_completo + ' (' + atual.idade + ' anos)';
  // sinais vitais nos cartões
  document.getElementById('sinalPressao').textContent = atual.pressao_arterial;
  document.getElementById('sinalTemperatura').textContent = atual.temperatura + ' °C';
  document.getElementById('sinalBatimentos').textContent = atual.batimentos_cardiacos + ' bpm';
  document.getElementById('sinalQueixas').textContent = atual.queixas;
  // limpa o formulário do paciente anterior
  document.getElementById('formFinalizar').reset();
  mostrarMensagem('', '');
  document.getElementById('consulta').scrollIntoView({ behavior: 'smooth' }); // rola até a consulta
}

// finalizar atendimento com o diagnóstico e a receita
document.getElementById('formFinalizar').addEventListener('submit', async (evento) => {
  evento.preventDefault(); // não deixa a página recarregar

  const resposta = await pedir('/atendimentos/' + atual.id_atendimento + '/finalizar', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      diagnostico: document.getElementById('diagnostico').value.trim(),
      receita: document.getElementById('receita').value.trim() // pode ficar vazia
    })
  });
  const dados = await resposta.json();

  if (!resposta.ok) {
    mostrarMensagem(dados.erro, 'erro');
    return;
  }

  // deu certo: o status virou 'atendido', então recarregar o painel tira o paciente da lista
  document.getElementById('consulta').hidden = true;
  mostrarMensagem('Atendimento ' + atual.numero_atendimento + ' finalizado.', 'sucesso');
  atual = null;
  carregarPainel();
});

// botão Fechar: esconde a consulta sem finalizar
document.getElementById('fechar').addEventListener('click', () => {
  document.getElementById('consulta').hidden = true;
  atual = null;
});

// botão Atualizar, e já carrega o painel quando a tela abre
document.getElementById('atualizar').addEventListener('click', carregarPainel);
carregarPainel();
