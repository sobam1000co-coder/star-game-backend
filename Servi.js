import express from "express";
import fs from "fs";
import cors from "cors";
import bodyParser from "body-parser";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

const DB_FILE = "./database.json";

// Inicializa banco
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(
    DB_FILE,
    JSON.stringify({ totalDistributed: 0, players: {} }, null, 2)
  );
}

function loadDB() {
  return JSON.parse(fs.readFileSync(DB_FILE));
}

function saveDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// Função para calcular dificuldade dinâmica
function calculateDifficulty(totalDistributed) {
  if (totalDistributed < 500000) return 100; // base
  let extra = Math.floor((totalDistributed - 500000) / 100000) * 5;
  return 100 + extra; // aumenta em 5% a cada 100k
}

// Endpoint: ganhar moeda
// Endpoint para ganhar moedas STR
app.post("/claim", (req, res) => {
  const { playerId, points } = req.body;
  const db = loadDB();

  // Dificuldade dinâmica
  const difficulty = calculateDifficulty(db.totalDistributed);

  if (points >= difficulty) {
    const reward = 1; // 1 STR por atingir pontos suficientes
    db.totalDistributed += reward;

    if (!db.players[playerId]) {
      db.players[playerId] = { balance: 0 };
    }
    db.players[playerId].balance += reward;

    saveDB(db);
    return res.json({
      success: true,
      reward,
      newBalance: db.players[playerId].balance,
      difficulty,
      totalDistributed: db.totalDistributed
    });
  }

  return res.json({
    success: false,
    message: "Pontuação insuficiente para ganhar STR",
    difficulty
  });
});

// Endpoint: ver saldo
app.get("/balance/:playerId", (req, res) => {
  const db = loadDB();
  const { playerId } = req.params;

  if (!db.players[playerId]) {
    return res.json({ balance: 0 });
  }

  res.json({ balance: db.players[playerId].balance });
});

// Inicia servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
