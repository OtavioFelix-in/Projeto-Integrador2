// qual tela cada perfil abre
const telas = {
  recepcao: 'recepcao.html',
  enfermagem: 'triagem.html',
  medico: 'medico.html'
};

// pega o formulário de login do html
const formLogin = document.getElementById('formLogin');

// roda quando clicar em Entrar
formLogin.addEventListener('submit', async (evento) => {
  evento.preventDefault(); // não deixa a página recarregar

  // o que foi digitado nos campos
  const cpf = document.getElementById('cpf').value;
  const senha = document.getElementById('senha').value;

  // manda pro servidor conferir
  const resposta = await fetch('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cpf: cpf, senha: senha })
  });

  const dados = await resposta.json();

  // deu erro: mostra a mensagem e para aqui
  if (!resposta.ok) {
    document.getElementById('mensagem').textContent = dados.erro;
    return;
  }

  // deu certo: guarda quem entrou e vai pra tela do perfil
  sessionStorage.setItem('usuario', JSON.stringify(dados));
  window.location.href = telas[dados.perfil];
});
