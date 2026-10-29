// quem fez login (guardado pelo login.js)
const usuario = JSON.parse(sessionStorage.getItem('usuario'));

// sem login ou com outro perfil, volta pro login
if (!usuario || usuario.perfil !== 'enfermagem') {
  window.location.href = 'login.html';
}

// mostra o nome no topo
document.getElementById('nomeUsuario').textContent = usuario.nome;

// botão sair: limpa o login e volta pra tela de entrada
document.getElementById('sair').addEventListener('click', () => {
  sessionStorage.clear();
  window.location.href = 'login.html';
});

// pacientes que estão esperando (usado no botão Fazer triagem)
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

// busca no servidor quem está esperando triagem e monta a tabela
async function carregarFila() {
  const resposta = await fetch('/triagem/fila');
  fila = await resposta.json();

  const tbody = document.getElementById('fila');
  tbody.innerHTML = '';

  if (fila.length === 0) {
    const tr = document.createElement('tr');
    celula(tr, 'Nenhum paciente aguardando.').colSpan = 5;
    tbody.appendChild(tr);
    return;
  }

  fila.forEach((a, i) => {
    const tr = document.createElement('tr');
    celula(tr, a.numero_atendimento);
    celula(tr, a.nome_completo);
    celula(tr, a.idade);
    celula(tr, a.data_hora_entrada);

    const botao = document.createElement('button');
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
  form.reset();
  form.hidden = false;
  document.getElementById('idAtendimento').value = a.id_atendimento;
  document.getElementById('tituloTriagem').textContent = a.numero_atendimento + ' - ' + a.nome_completo;
  mostrarMensagem('', '');
}

// botão Fechar
document.getElementById('fechar').addEventListener('click', () => {
  document.getElementById('formTriagem').hidden = true;
});

// salvar triagem
document.getElementById('formTriagem').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const id = document.getElementById('idAtendimento').value;

  const triagem = {
    id_enfermeiro: usuario.id_usuario, // quem fez a triagem
    pressao_arterial: document.getElementById('pressao_arterial').value.trim(),
    temperatura: document.getElementById('temperatura').value,
    batimentos_cardiacos: document.getElementById('batimentos_cardiacos').value,
    queixas: document.getElementById('queixas').value.trim(),
    classificacao: document.getElementById('classificacao').value
  };

  const resposta = await fetch('/atendimentos/' + id + '/triagem', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(triagem)
  });
  const dados = await resposta.json();

  if (!resposta.ok) {
    mostrarMensagem(dados.erro, 'erro');
    return;
  }

  document.getElementById('formTriagem').hidden = true;
  mostrarMensagem('Triagem salva. Paciente enviado para o médico.', 'sucesso');
  carregarFila();
});

// botão Atualizar e carga inicial
document.getElementById('atualizar').addEventListener('click', carregarFila);
carregarFila();
