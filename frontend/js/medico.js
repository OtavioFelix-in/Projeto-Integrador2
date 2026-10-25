const usuario = JSON.parse(sessionStorage.getItem('usuario'));
if (!usuario || usuario.perfil !== 'medico') {
  window.location.href = 'login.html';
}

document.getElementById('nomeUsuario').textContent = usuario.nome;
document.getElementById('sair').addEventListener('click', () => {
  sessionStorage.clear();
  window.location.href = 'login.html';
});

const cores = {
  1: 'Vermelho',
  2: 'Laranja',
  3: 'Amarelo',
  4: 'Verde',
  5: 'Azul'
};

let painel = [];
let atual = null;

function mostrarMensagem(texto, tipo) {
  const p = document.getElementById('mensagem');
  p.textContent = texto;
  p.className = tipo;
}

async function carregarPainel() {
  const resposta = await fetch('/painel');
  painel = await resposta.json();

  const tbody = document.getElementById('painel');
  tbody.innerHTML = '';

  if (painel.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6">Nenhum paciente aguardando.</td></tr>';
    return;
  }

  painel.forEach((a, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td>' + cores[a.prioridade] + '</td>' +
      '<td>' + a.numero_atendimento + '</td>' +
      '<td>' + a.nome_completo + '</td>' +
      '<td>' + a.idade + '</td>' +
      '<td>' + a.queixas + '</td>' +
      '<td><button onclick="chamar(' + i + ')">Chamar</button></td>';
    tbody.appendChild(tr);
  });
}

async function carregarPrescricoes() {
  const resposta = await fetch('/atendimentos/' + atual.id_atendimento + '/prescricoes');
  const lista = await resposta.json();

  const tbody = document.getElementById('prescricoes');
  tbody.innerHTML = '';

  if (lista.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3">Nenhuma medicação lançada.</td></tr>';
    return;
  }

  lista.forEach(m => {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td>' + m.medicamento + '</td><td>' + m.dosagem + '</td><td>' + m.frequencia + '</td>';
    tbody.appendChild(tr);
  });
}

function chamar(i) {
  atual = painel[i];
  document.getElementById('consulta').hidden = false;
  document.getElementById('tituloConsulta').textContent =
    atual.numero_atendimento + ' - ' + atual.nome_completo + ' (' + atual.idade + ' anos)';
  document.getElementById('dadosTriagem').textContent =
    'Pressão: ' + atual.pressao_arterial +
    ' | Temperatura: ' + atual.temperatura + ' °C' +
    ' | Batimentos: ' + atual.batimentos_cardiacos + ' bpm' +
    ' | Queixas: ' + atual.queixas;
  document.getElementById('formPrescricao').reset();
  document.getElementById('formConfirmar').reset();
  mostrarMensagem('', '');
  carregarPrescricoes();
}

document.getElementById('formPrescricao').addEventListener('submit', async (evento) => {
  evento.preventDefault();

  const resposta = await fetch('/atendimentos/' + atual.id_atendimento + '/prescricoes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      medicamento: document.getElementById('medicamento').value.trim(),
      dosagem: document.getElementById('dosagem').value.trim(),
      frequencia: document.getElementById('frequencia').value.trim()
    })
  });
  const dados = await resposta.json();

  if (!resposta.ok) {
    mostrarMensagem(dados.erro, 'erro');
    return;
  }

  document.getElementById('formPrescricao').reset();
  carregarPrescricoes();
});

document.getElementById('formConfirmar').addEventListener('submit', async (evento) => {
  evento.preventDefault();

  const resposta = await fetch('/atendimentos/' + atual.id_atendimento + '/confirmar', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id_medico: usuario.id_usuario,
      diagnostico: document.getElementById('diagnostico').value.trim()
    })
  });
  const dados = await resposta.json();

  if (!resposta.ok) {
    mostrarMensagem(dados.erro, 'erro');
    return;
  }

  document.getElementById('consulta').hidden = true;
  mostrarMensagem('Consulta de ' + atual.numero_atendimento + ' confirmada.', 'sucesso');
  atual = null;
  carregarPainel();
});

document.getElementById('fechar').addEventListener('click', () => {
  document.getElementById('consulta').hidden = true;
  atual = null;
});

document.getElementById('atualizar').addEventListener('click', carregarPainel);
carregarPainel();
