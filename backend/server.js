// arquivo principal: monta o servidor e liga as rotas de cada módulo.
// a conexão com o banco fica em banco.js, as regras em apoio.js,
// o porteiro de perfil em exigir.js e as rotas na pasta rotas/
const express = require('express');      // cria o servidor e as rotas
const path = require('path');            // monta caminho de pasta
const session = require('express-session'); // guarda quem está logado
const crypto = require('crypto');        // gera o segredo da sessão

const app = express();

// pasta das telas: sobe uma pasta a partir da backend e entra na frontend
const mapa = path.join(__dirname, '..', 'frontend');

app.use(express.static(mapa)); // serve o html, css e js do frontend
app.use(express.json());       // transforma o json que a tela manda em req.body

// sessão: depois do login o navegador recebe um cookie e o servidor sabe quem é em cada pedido.
// o segredo muda a cada vez que o servidor liga, então reiniciar desloga todo mundo
app.use(session({
  secret: crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'strict' } // o js da página não lê o cookie
}));

// rotas de cada módulo (os endereços continuam os mesmos: /login, /atendimentos, /painel...)
app.use(require('./rotas/login'));
app.use(require('./rotas/recepcao'));
app.use(require('./rotas/triagem'));
app.use(require('./rotas/medico'));
app.use(require('./rotas/admin'));

// liga o servidor. fica por último, depois de todas as rotas
app.listen(3000, () => {
  console.log('Servidor rodando em http://localhost:3000');
});
