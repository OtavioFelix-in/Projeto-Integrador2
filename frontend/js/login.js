// qual tela cada perfil abre (o perfil vem do banco, na resposta do servidor)
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

  // manda pro servidor conferir. quem confere a senha (bcrypt) é o servidor, não a tela
  const resposta = await fetch('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cpf: cpf, senha: senha })
  });

  // transforma a resposta em objeto: { id_usuario, nome, perfil } ou { erro }
  const dados = await resposta.json();

  // deu erro (401): mostra a mensagem e para aqui
  if (!resposta.ok) {
    document.getElementById('mensagem').textContent = dados.erro;
    return;
  }

  // deu certo: guarda quem entrou (as outras telas leem daqui) e vai pra tela do perfil
  sessionStorage.setItem('usuario', JSON.stringify(dados));
  window.location.href = telas[dados.perfil];
});
