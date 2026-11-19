// conexão com o banco MySQL, usada por todas as rotas
const mysql = require('mysql2/promise'); // conversa com o MySQL (versão com promise, pra usar await)
const path = require('path');

// lê o arquivo .env (usuário e senha do banco ficam fora do código e do github)
process.loadEnvFile(path.join(__dirname, '.env'));

// o pool deixa algumas conexões prontas pras rotas usarem
const banco = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  dateStrings: true // datas vêm como texto ('2026-10-28 14:30:00'), sem confusão de fuso
});

module.exports = banco;
