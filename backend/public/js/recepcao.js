const usuario = JSON.parse(sessionStorage.getItem('usuario'));
if (!usuario || usuario.perfil !== 'recepcao') {
  window.location.href = 'login.html';
}

document.getElementById('nomeUsuario').textContent = usuario.nome;
document.getElementById('sair').addEventListener('click', () => {
  sessionStorage.clear();
  window.location.href = 'login.html';
});

const campos = ['nome_completo', 'cpf', 'rg', 'data_nascimento', 'sexo', 'telefone', 'nome_pai', 'nome_mae', 'endereco'];
let encontrados = [];

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

function limparFormulario() {
  document.getElementById('formPaciente').reset();
  document.getElementById('idAtendimento').value = '';
  document.getElementById('tituloForm').textContent = 'Novo atendimento';
  document.getElementById('botaoSalvar').textContent = 'Abrir atendimento';
}

function lerFormulario() {
  const dados = {};
  campos.forEach(campo => {
    dados[campo] = document.getElementById(campo).value.trim();
  });
  return dados;
}

document.getElementById('formPaciente').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const id = document.getElementById('idAtendimento').value;

  const resposta = await fetch(id ? '/atendimentos/' + id : '/atendimentos', {
    method: id ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(lerFormulario())
  });
  const dados = await resposta.json();

  if (!resposta.ok) {
    mostrarMensagem(dados.erro, 'erro');
    return;
  }

  if (id) {
    mostrarMensagem('Dados alterados.', 'sucesso');
  } else {
    mostrarMensagem('Atendimento aberto: ' + dados.numero_atendimento, 'sucesso');
  }
  limparFormulario();
});

document.getElementById('limpar').addEventListener('click', () => {
  limparFormulario();
  mostrarMensagem('', '');
});

async function buscar() {
  const busca = document.getElementById('busca').value.trim();
  if (!busca) {
    return;
  }

  const resposta = await fetch('/atendimentos?busca=' + encodeURIComponent(busca));
  encontrados = await resposta.json();

  const tbody = document.getElementById('resultado');
  tbody.innerHTML = '';

  if (encontrados.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5">Nenhum atendimento encontrado.</td></tr>';
    return;
  }

  encontrados.forEach((a, i) => {
    const podeMexer = a.status !== 'confirmado' && a.status !== 'cancelado';
    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td>' + a.numero_atendimento + '</td>' +
      '<td>' + escapar(a.nome_completo) + '</td>' +
      '<td>' + a.data_hora_entrada + '</td>' +
      '<td><span class="etiqueta status-' + a.status + '">' + a.status + '</span></td>' +
      '<td class="botoes">' +
        (podeMexer ? '<button class="botao" onclick="editar(' + i + ')">Alterar</button>' + '<button class="botao botao-secundario" onclick="cancelar(' + a.id_atendimento + ')">Cancelar</button>':'') +
      '</td>';
    tbody.appendChild(tr);
  });
}

document.getElementById('botaoBuscar').addEventListener('click', buscar);

function editar(i) {
  const a = encontrados[i];
  campos.forEach(campo => {
    document.getElementById(campo).value = a[campo] || '';
  });
  document.getElementById('idAtendimento').value = a.id_atendimento;
  document.getElementById('tituloForm').textContent = 'Alterar ' + a.numero_atendimento;
  document.getElementById('botaoSalvar').textContent = 'Salvar alteração';
  mostrarMensagem('', '');
}

async function cancelar(id) {
  if (!confirm('Cancelar este atendimento?')) {
    return;
  }

  const resposta = await fetch('/atendimentos/' + id + '/cancelar', { method: 'PATCH' });
  const dados = await resposta.json();

  if (!resposta.ok) {
    alert(dados.erro);
    return;
  }
  buscar();
}
