// quem fez login (o login.js guardou no sessionStorage)
const usuario = JSON.parse(sessionStorage.getItem('usuario'));

// sem login ou com outro perfil, volta pro login
// (isso só esconde a tela, quem protege de verdade é o servidor)
if (!usuario || (usuario.perfil !== 'recepcao' && usuario.perfil !== 'admin')) {
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

// admin só olha: some o formulário de abrir atendimento e os botões Alterar e Cancelar.
// (o servidor também não deixa: as rotas que gravam só aceitam a recepção)
const somenteVer = usuario.perfil === 'admin';
if (somenteVer) {
  document.getElementById('caixaBuscarPaciente').hidden = true;
  document.getElementById('formPaciente').hidden = true;
}

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

// caixinha "não identificado" marcada: nome e data de nascimento deixam de ser obrigatórios na tela
// (o servidor confere a mesma regra no validarPaciente)
function ajustarNaoIdentificado() {
  const marcado = document.getElementById('nao_identificado').checked;
  document.getElementById('nome_completo').required = !marcado;
  document.getElementById('data_nascimento').required = !marcado;
}
document.getElementById('nao_identificado').addEventListener('change', ajustarNaoIdentificado);

// volta o formulário pro modo "novo atendimento"
function limparFormulario() {
  document.getElementById('formPaciente').reset(); // apaga o que foi digitado
  ajustarNaoIdentificado(); // o reset desmarca a caixinha, então nome e data voltam a ser obrigatórios
  document.getElementById('alerta').disabled = false; // o Alterar de um triado deixa a caixinha travada
  document.getElementById('idAtendimento').value = '';
  document.getElementById('id_paciente').value = ''; // esquece o paciente escolhido na busca
  document.getElementById('avisoCadastro').hidden = true;
  document.getElementById('tituloForm').textContent = 'Novo atendimento';
  document.getElementById('botaoSalvar').textContent = 'Abrir atendimento';
}

// pacientes achados na última busca (o botão "Usar este paciente" pega os dados daqui)
let pacientesAchados = [];

// data do banco (1991-03-14) no jeito da tela (14/03/1991)
function dataBr(data) {
  if (!data) return '';
  const [ano, mes, dia] = String(data).slice(0, 10).split('-');
  return dia + '/' + mes + '/' + ano;
}

// Buscar paciente: procura pelo que foi escolhido no "Buscar por" (CPF, RG ou nome)
// e mostra a lista pra recepcionista escolher
async function buscarPaciente() {
  const tbody = document.getElementById('pacientes');
  let resposta, dados;
  try {
    resposta = await pedir('/pacientes?tipo=' + campo('tipoBuscaPaciente') +
                           '&busca=' + encodeURIComponent(campo('buscaPaciente')));
    dados = await resposta.json();
  } catch (erro) {
    mostrarMensagem('Sem conexão com o servidor. Tente de novo.', 'erro');
    return;
  }

  tbody.innerHTML = '';
  document.getElementById('tabelaPacientes').hidden = false;

  // o servidor recusou (ex: menos de 3 letras): mostra o motivo dentro da tabela
  if (!resposta.ok) {
    pacientesAchados = [];
    const tr = document.createElement('tr');
    celula(tr, dados.erro).colSpan = 6;
    tbody.appendChild(tr);
    return;
  }
  pacientesAchados = dados;

  if (dados.length === 0) {
    const tr = document.createElement('tr');
    celula(tr, 'Nenhum paciente encontrado. Se for a primeira vez dele aqui, preencha o formulário abaixo.').colSpan = 6;
    tbody.appendChild(tr);
    return;
  }

  // uma linha por paciente: nascimento e mãe ajudam a confirmar quem é (dois nomes iguais acontecem)
  dados.forEach((p, i) => {
    const tr = document.createElement('tr');
    celula(tr, p.nome_completo);
    celula(tr, dataBr(p.data_nascimento));
    celula(tr, p.nome_mae || '');
    celula(tr, p.cpf || '');
    celula(tr, p.rg || '');
    const acao = celula(tr, '');
    acao.className = 'botoes';
    const botao = document.createElement('button');
    botao.className = 'botao';
    botao.textContent = 'Usar este paciente';
    botao.addEventListener('click', () => usarPaciente(i));
    acao.appendChild(botao);
    tbody.appendChild(tr);
  });
}

// Usar este paciente: preenche o formulário com o cadastro e guarda o id dele.
// ao abrir o atendimento, o que a recepção mudar (telefone, endereço...) atualiza o cadastro
function usarPaciente(i) {
  const p = pacientesAchados[i];
  limparFormulario();
  campos.forEach(nome => {
    document.getElementById(nome).value = p[nome] || ''; // null vira campo vazio
  });
  document.getElementById('nao_identificado').checked = Boolean(p.nao_identificado);
  ajustarNaoIdentificado();
  document.getElementById('id_paciente').value = p.id_paciente;
  document.getElementById('tituloForm').textContent = 'Novo atendimento para ' + p.nome_completo;
  document.getElementById('avisoCadastro').hidden = false;
  mostrarMensagem('', '');
}

document.getElementById('botaoBuscarPaciente').addEventListener('click', buscarPaciente);

// enviar o formulário: abre atendimento novo, ou salva alteração se veio do Alterar
document.getElementById('formPaciente').addEventListener('submit', async (evento) => {
  evento.preventDefault(); // não deixa a página recarregar

  // monta o objeto com todos os campos: { nome_completo: '...', cpf: '...', ... }
  const paciente = {};
  campos.forEach(nome => {
    paciente[nome] = campo(nome);
  });
  paciente.nao_identificado = document.getElementById('nao_identificado').checked;
  // paciente escolhido no "Usar este paciente" (vazio = paciente novo)
  paciente.id_paciente = document.getElementById('id_paciente').value;
  // caixinha marcada = true. não é dado do paciente, é do atendimento: fura a fila da triagem
  paciente.alerta = document.getElementById('alerta').checked;

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

// true quando a tabela está mostrando o "Ver todos".
// assim, depois de alterar ou cancelar, a tabela atualiza do mesmo jeito que estava
let mostrandoTodos = false;

// busca pelo que foi escolhido no "Buscar por" (número ou CPF) e monta a tabela.
// no modo "Ver todos" manda a busca vazia, e o servidor devolve os em andamento
async function buscar() {
  const busca = mostrandoTodos ? '' : campo('busca');
  if (!busca && !mostrandoTodos) {
    return; // campo vazio, não busca nada
  }

  // desliga o Buscar enquanto espera, pra não buscar duas vezes
  const botaoBuscar = document.getElementById('botaoBuscar');
  botaoBuscar.disabled = true;
  let resposta, dados;
  try {
    // encodeURIComponent protege caracteres especiais no endereço
    resposta = await pedir('/atendimentos?tipo=' + campo('tipoBusca') + '&busca=' + encodeURIComponent(busca));
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

  // o servidor recusou (ex: número digitado errado): mostra o motivo dentro da tabela,
  // que some sozinho quando a busca é corrigida
  if (!resposta.ok) {
    encontrados = [];
    const tr = document.createElement('tr');
    celula(tr, dados.erro).colSpan = 5;
    tbody.appendChild(tr);
    return;
  }
  encontrados = dados;

  if (encontrados.length === 0) {
    const tr = document.createElement('tr');
    const aviso = mostrandoTodos ? 'Nenhum atendimento em andamento.' : 'Nenhum atendimento encontrado.';
    celula(tr, aviso).colSpan = 5; // ocupa as 5 colunas
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

    // só dá pra mexer enquanto o médico não atendeu (e o admin nunca mexe)
    if (!somenteVer && a.status !== 'atendido' && a.status !== 'cancelado') {
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

// Buscar: procura pelo que foi digitado
document.getElementById('botaoBuscar').addEventListener('click', () => {
  mostrandoTodos = false;
  buscar();
});

// Ver todos: mostra todos os atendimentos em andamento (aberto e triado)
document.getElementById('botaoTodos').addEventListener('click', () => {
  mostrandoTodos = true;
  buscar();
});

// joga os dados do atendimento escolhido no formulário pra editar
function editar(i) {
  const a = encontrados[i];
  campos.forEach(nome => {
    document.getElementById(nome).value = a[nome] || ''; // null vira campo vazio
  });
  document.getElementById('nao_identificado').checked = Boolean(a.nao_identificado);
  ajustarNaoIdentificado();
  // alerta só pode mudar enquanto espera a triagem. depois de triado, a caixinha fica travada
  const alerta = document.getElementById('alerta');
  alerta.checked = Boolean(a.alerta);
  alerta.disabled = a.status !== 'aberto';
  // guarda o id no campo escondido: é isso que faz o envio virar PUT
  document.getElementById('idAtendimento').value = a.id_atendimento;
  document.getElementById('tituloForm').textContent = 'Alterar ' + a.numero_atendimento;
  document.getElementById('botaoSalvar').textContent = 'Salvar alteração';
  // no Alterar quem manda é o atendimento, não um paciente escolhido na busca
  document.getElementById('id_paciente').value = '';
  document.getElementById('avisoCadastro').hidden = true;
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
