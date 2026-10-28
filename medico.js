const usuario = JSON.parse(sessionStorage.getItem('usuario'));
if (!usuario || usuario.perfil !== 'medico') {
  window.location.href = 'login.html';
}

document.getElementById('nomeUsuario').textContent = usuario.nome;
document.getElementById('sair').addEventListener('click', () => {
  sessionStorage.clear();
  window.location.href = 'login.html';
});

const prioridades = {
  1: 'Emergência',
  2: 'Muito Urgente',
  3: 'Urgente',
  4: 'Pouco Urgente',
  5: 'Não Urgente'
};

let painel = [];
let atual = null;

function mostrarMensagem(texto, tipo) {
  const p = document.getElementById('mensagem');
  p.textContent = texto;
  p.className = tipo;
}

function minutosDesde(dataHora) {
  const inicio = new Date(dataHora.replace(' ', 'T'));
  return Math.floor((Date.now() - inicio) / 60000);
}

function atualizarResumo() {
  document.getElementById('totalAguardando').textContent = painel.length;

  const graves = painel.filter(a => a.prioridade <= 2);
  document.getElementById('totalGraves').textContent = graves.length;

  if (painel.length === 0) {
    document.getElementById('esperaMedia').textContent = 0;
    return;
  }

  let soma = 0;
  painel.forEach(a => {
    soma += minutosDesde(a.data_hora);
  });
  document.getElementById('esperaMedia').textContent = Math.round(soma / painel.length);
}

async function carregarPainel() {
  const resposta = await fetch('/painel');
  painel = await resposta.json();
  atualizarResumo();

  const tbody = document.getElementById('painel');
  tbody.innerHTML = '';

  if (painel.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6">Nenhum paciente aguardando.</td></tr>';
    return;
  }

  painel.forEach((a, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td><span class="etiqueta prioridade-' + a.prioridade + '">' + prioridades[a.prioridade] + '</span></td>' +
      '<td>' + a.numero_atendimento + '</td>' +
      '<td>' + escapar(a.nome_completo) + '</td>' +
      '<td>' + a.idade + '</td>' +
      '<td>' + escapar(a.queixas) + '</td>' +
      '<td><button class="botao" onclick="chamar(' + i + ')">Chamar</button></td>';
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
    tr.innerHTML = '<td>' + escapar(m.medicamento) + '</td><td>' + escapar(m.dosagem) + '</td><td>' + escapar(m.frequencia) + '</td>';
    tbody.appendChild(tr);
  });
}

function escapar(texto) {
  const div = document.createElement('div');
  div.textContent = texto;
  return div.innerHTML;
}

function chamar(i) {
  atual = painel[i];
  document.getElementById('consulta').hidden = false;
  document.getElementById('tituloConsulta').textContent =
    atual.numero_atendimento + ' - ' + atual.nome_completo + ' (' + atual.idade + ' anos)';
  document.getElementById('sinalPressao').textContent = atual.pressao_arterial;
  document.getElementById('sinalTemperatura').textContent = atual.temperatura + ' °C';
  document.getElementById('sinalBatimentos').textContent = atual.batimentos_cardiacos + ' bpm';
  document.getElementById('sinalQueixas').textContent = atual.queixas;
  document.getElementById('formPrescricao').reset();
  document.getElementById('formConfirmar').reset();
  mostrarMensagem('', '');
  carregarPrescricoes();
  document.getElementById('consulta').scrollIntoView({ behavior: 'smooth'});
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
