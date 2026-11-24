// barra lateral do administrador: ele vê todas as telas, então ganha um menu com todas elas.
// os outros perfis continuam com o menu que está escrito no html de cada tela.
// esse arquivo entra em todas as telas, antes do js da própria tela
function montarMenuAdmin() {
  const logado = JSON.parse(sessionStorage.getItem('usuario'));
  if (!logado || logado.perfil !== 'admin') {
    return; // não é admin: deixa o menu do html
  }

  // [página, texto do link]
  const telas = [
    ['profissionais.html', 'Profissionais'],
    ['recepcao.html', 'Recepção'],
    ['historico-recepcao.html', 'Histórico da recepção'],
    ['triagem.html', 'Triagem'],
    ['historico-triagem.html', 'Histórico da triagem'],
    ['medico.html', 'Painel do médico'],
    ['historico-medico.html', 'Histórico do médico']
  ];

  const nav = document.querySelector('.sidebar nav');
  nav.innerHTML = ''; // apaga os links do html
  const atual = location.pathname.split('/').pop(); // página aberta agora, ex: 'triagem.html'

  telas.forEach(([pagina, texto]) => {
    const link = document.createElement('a');
    link.href = pagina;
    link.textContent = texto;
    if (pagina === atual) {
      link.className = 'ativo'; // pinta de azul o link da tela aberta
    }
    nav.appendChild(link);
  });
}

montarMenuAdmin();
