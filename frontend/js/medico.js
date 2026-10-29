// quem fez login (guardado pelo login.js)
const usuario = JSON.parse(sessionStorage.getItem('usuario'));

// sem login ou com outro perfil, volta pro login
if (!usuario || usuario.perfil !== 'medico') {
  window.location.href = 'login.html';
}

// mostra o nome no topo
document.getElementById('nomeUsuario').textContent = usuario.nome;

// botão sair: limpa o login e volta pra tela de entrada
document.getElementById('sair').addEventListener('click', () => {
  sessionStorage.clear();
  window.location.href = 'login.html';
});

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

// minutos que passaram desde uma data do banco ('2026-10-28 14:30:00')
function minutosDesde(dataHora) {
  const inicio = new Date(dataHora.replace(' ', 'T'));
  return Math.floor((Date.now() - inicio) / 60000);
}

// cartões do topo: quantos esperam, quantos graves e espera média
function atualizarResumo() {
  document.getElementById('totalAguardando').textContent = painel.length;

  const graves = painel.filter(a => a.classificacao <= 2); // vermelho e laranja
  document.getElementById('totalGraves').textContent = graves.length;

  if (painel.length === 0) {
    document.getElementById('esperaMedia').textContent = 0;
    return;
  }

  let soma = 0;
  painel.forEach(a => {
    soma += minutosDesde(a.data_hora_triagem);
  });
  document.getElementById('esperaMedia').textContent = Math.round(soma / painel.length);
}

// busca os triados no servidor e monta a tabela (já vem na ordem certa)
async function carregarPainel() {
  const resposta = await fetch('/painel');
  painel = await resposta.json();
  atualizarResumo();

  const tbody = document.getElementById('painel');
  tbody.innerHTML = '';

  if (painel.length === 0) {
    const tr = document.createElement('tr');
    celula(tr, 'Nenhum paciente aguardando.').colSpan = 6;
    tbody.appendChild(tr);
    return;
  }

  painel.forEach((a, i) => {
    const tr = document.createElement('tr');
    // etiqueta colorida com a classificação
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

// preenche a lista de medicamentos (uma vez só, quando a tela abre)
async function carregarMedicamentos() {
  const resposta = await fetch('/medicamentos');
  const lista = await resposta.json();

  const select = document.getElementById('id_medicamento');
  lista.forEach(m => {
    const opcao = document.createElement('option');
    opcao.value = m.id_medicamento;
    opcao.textContent = m.nome + ' - ' + m.apresentacao;
    select.appendChild(opcao);
  });
}

// mostra os remédios que já foram passados pro paciente atual
async function carregarPrescricoes() {
  const resposta = await fetch('/atendimentos/' + atual.id_atendimento + '/prescricoes');
  const lista = await resposta.json();

  const tbody = document.getElementById('prescricoes');
  tbody.innerHTML = '';

  if (lista.length === 0) {
    const tr = document.createElement('tr');
    celula(tr, 'Nenhuma medicação lançada.').colSpan = 3;
    tbody.appendChild(tr);
    return;
  }

  lista.forEach(m => {
    const tr = document.createElement('tr');
    celula(tr, m.nome + ' - ' + m.apresentacao);
    celula(tr, m.dosagem);
    celula(tr, m.frequencia);
    tbody.appendChild(tr);
  });
}

// médico chama o paciente: abre a parte da consulta
function chamar(i) {
  atual = painel[i];
  document.getElementById('consulta').hidden = false;
  document.getElementById('tituloConsulta').textContent =
    atual.numero_atendimento + ' - ' + atual.nome_completo + ' (' + atual.idade + ' anos)';
  // sinais vitais nos cartões
  document.getElementById('sinalPressao').textContent = atual.pressao_arterial;
  document.getElementById('sinalTemperatura').textContent = atual.temperatura + ' °C';
  document.getElementById('sinalBatimentos').textContent = atual.batimentos_cardiacos + ' bpm';
  document.getElementById('sinalQueixas').textContent = atual.queixas;
  document.getElementById('formPrescricao').reset();
  document.getElementById('formFinalizar').reset();
  mostrarMensagem('', '');
  carregarPrescricoes();
  document.getElementById('consulta').scrollIntoView({ behavior: 'smooth' }); // rola até a consulta
}

// adicionar medicação
document.getElementById('formPrescricao').addEventListener('submit', async (evento) => {
  evento.preventDefault();

  const prescricao = {
    id_medicamento: document.getElementById('id_medicamento').value,
    dosagem: document.getElementById('dosagem').value.trim(),
    frequencia: document.getElementById('frequencia').value.trim()
  };

  const resposta = await fetch('/atendimentos/' + atual.id_atendimento + '/prescricoes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(prescricao)
  });
  const dados = await resposta.json();

  if (!resposta.ok) {
    mostrarMensagem(dados.erro, 'erro');
    return;
  }

  document.getElementById('formPrescricao').reset();
  carregarPrescricoes();
});

// finalizar atendimento com o diagnóstico
document.getElementById('formFinalizar').addEventListener('submit', async (evento) => {
  evento.preventDefault();

  const resposta = await fetch('/atendimentos/' + atual.id_atendimento + '/finalizar', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id_medico: usuario.id_usuario, // quem atendeu
      diagnostico: document.getElementById('diagnostico').value.trim()
    })
  });
  const dados = await resposta.json();

  if (!resposta.ok) {
    mostrarMensagem(dados.erro, 'erro');
    return;
  }

  document.getElementById('consulta').hidden = true;
  mostrarMensagem('Atendimento ' + atual.numero_atendimento + ' finalizado.', 'sucesso');
  atual = null;
  carregarPainel();
});

// botão Fechar
document.getElementById('fechar').addEventListener('click', () => {
  document.getElementById('consulta').hidden = true;
  atual = null;
});

// botão Atualizar e carga inicial
document.getElementById('atualizar').addEventListener('click', carregarPainel);
carregarPainel();
carregarMedicamentos();
