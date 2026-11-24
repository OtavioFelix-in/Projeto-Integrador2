// porteiro das rotas: só deixa passar quem está logado, ainda está ativo e tem um dos perfis
// ex: exigir('medico') na rota do painel
const banco = require('./banco');
const { erroServidor } = require('./apoio');

function exigir(...perfis) {
  return async (req, res, next) => {
    try {
      const usuario = req.session.usuario;
      // 401 = não está logado
      if (!usuario) {
        return res.status(401).json({ erro: 'Faça login de novo.' });
      }

      // confere no banco se ainda está ativo. assim, se o admin desativar alguém
      // que está no meio do plantão, o próximo clique dessa pessoa já é barrado
      const [linhas] = await banco.query('SELECT ativo FROM usuario WHERE id_usuario = ?', [usuario.id_usuario]);
      if (linhas.length === 0 || !linhas[0].ativo) {
        req.session.destroy(() => {}); // apaga a sessão: vai ter que fazer login (e o login não deixa inativo entrar)
        return res.status(401).json({ erro: 'Seu acesso foi desativado.' });
      }

      // 403 = está logado, mas o perfil não pode usar essa rota
      if (perfis.length > 0 && !perfis.includes(usuario.perfil)) {
        return res.status(403).json({ erro: 'Seu perfil não tem acesso a isso.' });
      }
      next(); // tudo certo, segue pra rota
    } catch (error) {
      erroServidor(res, error);
    }
  };
}

module.exports = exigir;
