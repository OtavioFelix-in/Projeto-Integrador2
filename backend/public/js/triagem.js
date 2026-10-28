const usuario = JSON.parse(sessionStorage.getItem('usuario'));
if (!usuario || usuario.perfil !== 'enfermagem') {
  window.location.href = 'login.html';
}

document.getElementById('nomeUsuario').textContent = usuario.nome;
document.getElementById('sair').addEventListener('click', () => {
  sessionStorage.clear();
  window.location.href = 'login.html';
});

let fila = [];

function mostrarMensagem(texto, tipo) {
  const p = document.getElementById('mensagem');
  p.textContent = texto;
  p.className = tipo;
}

function escapar(texto) {
  const div = document.createElement('div');
  div.textContent = texto;
  return div.innerHTML;
}

async function carregarFila() {
  const resposta = await fetch('/triagem/fila');
  fila = await resposta.json();

  const tbody = document.getElementById('fila');
  tbody.innerHTML = '';

  if (fila.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5">Nenhum paciente aguardando.</td></tr>';
    return;
  }

  fila.forEach((a, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td>' + a.numero_atendimento + '</td>' +
      '<td>' + escapar(a.nome_completo) + '</td>' +
      '<td>' + a.idade + '</td>' +
      '<td>' + a.data_hora_entrada + '</td>' +
      '<td><button class="botao" onclick="abrirTriagem(' + i + ')">Fazer triagem</button></td>';
    tbody.appendChild(tr);
  });
}

function abrirTriagem(i) {
  const a = fila[i];
  const form = document.getElementById('formTriagem');
  form.reset();
  form.hidden = false;
  document.getElementById('idAtendimento').value = a.id_atendimento;
  document.getElementById('tituloTriagem').textContent = a.numero_atendimento + ' - ' + a.nome_completo;
  mostrarMensagem('', '');
}

document.getElementById('fechar').addEventListener('click', () => {
  document.getElementById('formTriagem').hidden = true;
});

document.getElementById('formTriagem').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const id = document.getElementById('idAtendimento').value;

  const resposta = await fetch('/atendimentos/' + id + '/triagem', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id_enfermeiro: usuario.id_usuario,
      pressao_arterial: document.getElementById('pressao_arterial').value.trim(),
      temperatura: document.getElementById('temperatura').value,
      batimentos_cardiacos: document.getElementById('batimentos_cardiacos').value,
      queixas: document.getElementById('queixas').value.trim(),
      prioridade: document.getElementById('prioridade').value
    })
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

document.getElementById('atualizar').addEventListener('click', carregarFila);
carregarFila();
