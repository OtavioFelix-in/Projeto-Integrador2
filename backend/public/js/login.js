const telas = {
  recepcao: 'recepcao.html',
  enfermagem: 'triagem.html',
  medico: 'medico.html'
};

document.getElementById('formLogin').addEventListener('submit', async (evento) => {
  evento.preventDefault();

  const resposta = await fetch('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      usuario: document.getElementById('usuario').value,
      senha: document.getElementById('senha').value
    })
  });
  const dados = await resposta.json();

  if (!resposta.ok) {
    document.getElementById('mensagem').textContent = dados.erro;
    return;
  }

  sessionStorage.setItem('usuario', JSON.stringify(dados));
  window.location.href = telas[dados.perfil];
});
