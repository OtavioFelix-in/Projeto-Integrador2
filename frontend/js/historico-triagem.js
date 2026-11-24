// histórico da triagem: só consulta, sem botões de alterar

// quem fez login (o login.js guardou no sessionStorage)
const usuario = JSON.parse(sessionStorage.getItem('usuario'));

// sem login ou com outro perfil, volta pro login
// (isso só esconde a tela, quem protege de verdade é o servidor)
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

// o servidor manda no máximo 200 linhas (LIMIT 200 na rota)
const LIMITE = 200;

// classificação de Manchester: número -> cor (a cor da etiqueta vem do style.css, classe prioridade-N)
const cores = {
  1: 'vermelho',
  2: 'laranja',
  3: 'amarelo',
  4: 'verde',
  5: 'azul'
};

// pega o valor de um campo pelo id, sem espaços nas pontas
function campo(id) {
  return document.getElementById(id).value.trim();
}

// escreve uma mensagem de erro embaixo dos filtros
function mostrarMensagem(texto, tipo) {
  const p = document.getElementById('mensagem');
  p.textContent = texto;
  p.className = tipo; // 'erro' (vermelho), cores no style.css
}

// cria uma célula de tabela com texto.
// textContent mostra como texto puro, então se alguém digitar código ele não roda
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

// data de hoje no formato do campo de data (2026-11-23)
function hoje() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// manda os filtros pro servidor e monta a tabela
async function carregar() {
  // monta o endereço: /triagem/historico?de=...&ate=...&numero=...&status=...&classificacao=...
  // o URLSearchParams já protege os caracteres especiais
  const filtros = new URLSearchParams({
    de: campo('de'),
    ate: campo('ate'),
    numero: campo('numero'),
    status: campo('status'),
    classificacao: campo('classificacao')
  });

  let resposta, dados;
  try {
    resposta = await pedir('/triagem/historico?' + filtros);
    dados = await resposta.json();
  } catch (erro) {
    mostrarMensagem('Sem conexão com o servidor. Tente de novo.', 'erro');
    return;
  }

  // limpa a tabela antes de montar de novo
  const tbody = document.getElementById('historico');
  tbody.innerHTML = '';
  mostrarMensagem('', '');

  // o servidor deu erro: avisa em vez de quebrar a tabela
  if (!resposta.ok) {
    document.getElementById('total').textContent = '';
    mostrarMensagem(dados.erro, 'erro');
    return;
  }

  // quantas vieram. se bateu no limite, pode ter mais: pede pra filtrar melhor
  let total = dados.length + (dados.length === 1 ? ' triagem encontrada.' : ' triagens encontradas.');
  if (dados.length === LIMITE) {
    total = 'Mostrando as ' + LIMITE + ' mais recentes. Use os filtros para achar as outras.';
  }
  document.getElementById('total').textContent = total;

  if (dados.length === 0) {
    const tr = document.createElement('tr');
    celula(tr, 'Nenhuma triagem encontrada.').colSpan = 11; // ocupa as 11 colunas
    tbody.appendChild(tr);
    return;
  }

  // uma linha por triagem
  dados.forEach(a => {
    const tr = document.createElement('tr');
    celula(tr, a.numero_atendimento);
    celula(tr, a.nome_completo);
    celula(tr, a.idade);
    celula(tr, a.triagem_em).className = 'sem-quebra';
    celula(tr, a.pressao_arterial);
    celula(tr, a.temperatura);
    celula(tr, a.batimentos_cardiacos);
    celula(tr, a.queixas);
    celula(tr, a.triado);
    etiqueta(celula(tr, ''), cores[a.classificacao], 'prioridade-' + a.classificacao);
    etiqueta(celula(tr, ''), a.status, 'status-' + a.status);
    tbody.appendChild(tr);
  });
}

// Limpar: volta os filtros pro padrão (dia de hoje) e busca de novo
function limpar() {
  document.getElementById('de').value = hoje();
  document.getElementById('ate').value = hoje();
  document.getElementById('numero').value = '';
  document.getElementById('status').value = '';
  document.getElementById('classificacao').value = '';
  carregar();
}

document.getElementById('filtrar').addEventListener('click', carregar);
document.getElementById('limpar').addEventListener('click', limpar);

// ao abrir a tela, já mostra as triagens de hoje
limpar();
