// porteiro das rotas: só deixa passar quem está logado e tem um dos perfis
// ex: exigir('medico') na rota do painel
function exigir(...perfis) {
  return (req, res, next) => {
    const usuario = req.session.usuario;
    // 401 = não está logado
    if (!usuario) {
      return res.status(401).json({ erro: 'Faça login de novo.' });
    }
    // 403 = está logado, mas o perfil não pode usar essa rota
    if (perfis.length > 0 && !perfis.includes(usuario.perfil)) {
      return res.status(403).json({ erro: 'Seu perfil não tem acesso a isso.' });
    }
    next(); // tudo certo, segue pra rota
  };
}

module.exports = exigir;
