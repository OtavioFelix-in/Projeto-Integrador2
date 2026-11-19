// quem fez login (o login.js guardou no sessionStorage)
const usuario = JSON.parse(sessionStorage.getItem('usuario'));

// sem login ou com outro perfil, volta pro login
// (isso só esconde a tela, quem protege de verdade é o servidor)
if (!usuario || usuario.perfil !== 'recepcao') {
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

// ids dos campos do formulário. são iguais às colunas da tabela paciente,
// assim o servidor recebe cada dado já com o nome da coluna
const campos = ['nome_completo', 'cpf', 'rg', 'data_nascimento', 'sexo',
                'telefone', 'nome_pai', 'nome_mae', 'endereco'];

// resultado da última busca (o botão Alterar pega os dados daqui)
let encontrados = [];

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

// volta o formulário pro modo "novo atendimento"
function limparFormulario() {
  document.getElementById('formPaciente').reset(); // apaga o que foi digitado
  document.getElementById('idAtendimento').value = '';
  document.getElementById('tituloForm').textContent = 'Novo atendimento';
  document.getElementById('botaoSalvar').textContent = 'Abrir atendimento';
}

// enviar o formulário: abre atendimento novo, ou salva alteração se veio do Alterar
document.getElementById('formPaciente').addEventListener('submit', async (evento) => {
  evento.preventDefault(); // não deixa a página recarregar

  // monta o objeto com todos os campos: { nome_completo: '...', cpf: '...', ... }
  const paciente = {};
  campos.forEach(nome => {
    paciente[nome] = campo(nome);
  });

  // o campo escondido idAtendimento só tem valor quando clicou em Alterar.
  // com id é alteração (PUT), sem id é atendimento novo (POST)
  const id = document.getElementById('idAtendimento').value;

  // desliga o botão enquanto o servidor responde, pra não abrir o atendimento duas vezes
  const botaoSalvar = evento.submitter;
  botaoSalvar.disabled = true;

  try {
    const resposta = await pedir(id ? '/atendimentos/' + id : '/atendimentos', {
      method: id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(paciente)
    });
    const dados = await resposta.json();

    // o servidor recusou (regra de CPF/RG, menor de idade, atendimento em andamento...): mostra o motivo
    if (!resposta.ok) {
      mostrarMensagem(dados.erro, 'erro');
      return;
    }

    if (id) {
      mostrarMensagem('Dados alterados.', 'sucesso');
      buscar(); // atualiza a tabela com os dados novos
    } else {
      mostrarMensagem('Atendimento aberto: ' + dados.numero_atendimento, 'sucesso');
    }
    limparFormulario();
  } catch (erro) {
    // servidor desligado ou sem rede
    mostrarMensagem('Sem conexão com o servidor. Tente de novo.', 'erro');
  } finally {
    botaoSalvar.disabled = false; // liga o botão de novo
  }
});

// botão Limpar
document.getElementById('limpar').addEventListener('click', () => {
  limparFormulario();
  mostrarMensagem('', '');
});

// cria uma célula de tabela com texto.
// textContent mostra como texto puro, então se alguém digitar código no nome ele não roda
function celula(tr, texto) {
  const td = document.createElement('td');
  td.textContent = texto;
  tr.appendChild(td);
  return td;
}

// coloca uma etiqueta colorida dentro da célula (cores no style.css)
function etiqueta(td, texto, classe) {
  const span = document.createElement('span');
  span.className = 'etiqueta ' + classe;
  span.textContent = texto;
  td.appendChild(span);
}

// busca por número (AT0001) ou CPF e monta a tabela
async function buscar() {
  const busca = campo('busca');
  if (!busca) {
    return; // campo vazio, não busca nada
  }

  // desliga o Buscar enquanto espera, pra não buscar duas vezes
  const botaoBuscar = document.getElementById('botaoBuscar');
  botaoBuscar.disabled = true;
  let resposta, dados;
  try {
    // encodeURIComponent protege caracteres especiais no endereço
    resposta = await pedir('/atendimentos?busca=' + encodeURIComponent(busca));
    dados = await resposta.json();
  } catch (erro) {
    mostrarMensagem('Sem conexão com o servidor. Tente de novo.', 'erro');
    return;
  } finally {
    botaoBuscar.disabled = false;
  }

  // limpa a tabela antes de montar de novo
  const tbody = document.getElementById('resultado');
  tbody.innerHTML = '';

  // o servidor deu erro: avisa em vez de quebrar a tabela
  if (!resposta.ok) {
    encontrados = [];
    mostrarMensagem(dados.erro, 'erro');
    return;
  }
  encontrados = dados;

  if (encontrados.length === 0) {
    const tr = document.createElement('tr');
    celula(tr, 'Nenhum atendimento encontrado.').colSpan = 5; // ocupa as 5 colunas
    tbody.appendChild(tr);
    return;
  }

  // uma linha por atendimento encontrado
  encontrados.forEach((a, i) => {
    const tr = document.createElement('tr');
    celula(tr, a.numero_atendimento);
    celula(tr, a.nome_completo);
    celula(tr, a.data_hora_entrada);
    etiqueta(celula(tr, ''), a.status, 'status-' + a.status); // ex: classe status-aberto
    const acoes = celula(tr, '');
    acoes.className = 'botoes';

    // só dá pra mexer enquanto o médico não atendeu
    if (a.status !== 'atendido' && a.status !== 'cancelado') {
      const alterar = document.createElement('button');
      alterar.className = 'botao';
      alterar.textContent = 'Alterar';
      alterar.addEventListener('click', () => editar(i));
      acoes.appendChild(alterar);

      const cancelar = document.createElement('button');
      cancelar.className = 'botao botao-secundario';
      cancelar.textContent = 'Cancelar';
      cancelar.addEventListener('click', () => cancelarAtendimento(a.id_atendimento, cancelar));
      acoes.appendChild(cancelar);
    }

    tbody.appendChild(tr);
  });
}

document.getElementById('botaoBuscar').addEventListener('click', buscar);

// joga os dados do atendimento escolhido no formulário pra editar
function editar(i) {
  const a = encontrados[i];
  campos.forEach(nome => {
    document.getElementById(nome).value = a[nome] || ''; // null vira campo vazio
  });
  // guarda o id no campo escondido: é isso que faz o envio virar PUT
  document.getElementById('idAtendimento').value = a.id_atendimento;
  document.getElementById('tituloForm').textContent = 'Alterar ' + a.numero_atendimento;
  document.getElementById('botaoSalvar').textContent = 'Salvar alteração';
  mostrarMensagem('', '');
}

// cancela o atendimento (pede confirmação antes)
async function cancelarAtendimento(id, botao) {
  if (!confirm('Cancelar este atendimento?')) {
    return;
  }

  botao.disabled = true; // não deixa cancelar duas vezes
  try {
    const resposta = await pedir('/atendimentos/' + id + '/cancelar', { method: 'PATCH' });
    const dados = await resposta.json();

    if (!resposta.ok) {
      mostrarMensagem(dados.erro, 'erro');
      return;
    }
    mostrarMensagem('Atendimento cancelado.', 'sucesso');
    buscar(); // atualiza a tabela, o status muda pra cancelado
  } catch (erro) {
    mostrarMensagem('Sem conexão com o servidor. Tente de novo.', 'erro');
  } finally {
    botao.disabled = false;
  }
}
