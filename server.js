// server.js
import express from "express";
import fs from "fs";
import cors from "cors";
import path from "path";

const app = express();
app.use(cors());
app.use(express.json());

const DB_FILE = path.join(process.cwd(), "database.json");

// CONFIGURAÇÃO econômica
const TOTAL_STR_SUPPLY = 21_000_000;   // 21 milhões
const DIFFICULTY_START_THRESHOLD = 500_000; // quando começa a ficar mais difícil
const DIFFICULTY_STEP_STR = 100_000;  // a cada 100k distribuídas
const DIFFICULTY_STEP_RATE = 0.05;    // 5% por step
const BASE_POINTS_PER_STR = 100;      // base: 100 pontos = 1 STR

// helpers DB (arquivo JSON simples)
function loadDB() {
  if (!fs.existsSync(DB_FILE)) {
    const init = { totalDistributed: 0, players: {} };
    fs.writeFileSync(DB_FILE, JSON.stringify(init, null, 2));
  }
  const raw = fs.readFileSync(DB_FILE, "utf8");
  return JSON.parse(raw);
}
function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// calcula multiplicador de dificuldade com base no total distribuído
function getDifficultyMultiplier(totalDistributed) {
  if (totalDistributed <= DIFFICULTY_START_THRESHOLD) return 1;
  const extra = Math.floor((totalDistributed - DIFFICULTY_START_THRESHOLD) / DIFFICULTY_STEP_STR);
  return 1 + extra * DIFFICULTY_STEP_RATE;
}

// converte pontos em STR aplicando dificuldade e respeitando supply
function pointsToSTR(points, totalDistributed) {
  const multiplier = getDifficultyMultiplier(totalDistributed);
  const requiredPoints = Math.ceil(BASE_POINTS_PER_STR * multiplier); // pontos necessários para 1 STR
  const possible = Math.floor(points / requiredPoints); // quantos STR poderia ganhar com esses pontos
  const allowed = Math.max(0, Math.min(possible, TOTAL_STR_SUPPLY - totalDistributed));
  return { earned: allowed, requiredPoints, multiplier };
}

/* ===== Endpoints ===== */

// status supply
app.get("/supply", (req, res) => {
  const db = loadDB();
  const multiplier = getDifficultyMultiplier(db.totalDistributed);
  res.json({
    totalSupply: TOTAL_STR_SUPPLY,
    totalDistributed: db.totalDistributed,
    remaining: TOTAL_STR_SUPPLY - db.totalDistributed,
    difficultyMultiplier: multiplier,
    pointsPerSTRNow: Math.ceil(BASE_POINTS_PER_STR * multiplier)
  });
});

// claim: jogador envia pontos ao final da partida
app.post("/claim", (req, res) => {
  try {
    const { playerId, points } = req.body;
    if (!playerId) return res.status(400).json({ error: "playerId obrigatório" });
    const pts = Number(points || 0);
    if (isNaN(pts) || pts < 0) return res.status(400).json({ error: "points inválido" });

    const db = loadDB();
    const conv = pointsToSTR(pts, db.totalDistributed);

    if (conv.earned <= 0) {
      // devolve info de dificuldade e quantos pontos são necessários
      return res.json({
        success: false,
        message: `Pontuação insuficiente. Precisa de ${conv.requiredPoints} pontos para ganhar 1 STR.`,
        requiredPoints: conv.requiredPoints,
        difficultyMultiplier: conv.multiplier,
        totalDistributed: db.totalDistributed,
        remaining: TOTAL_STR_SUPPLY - db.totalDistributed
      });
    }

    // aplica recompensa
    if (!db.players[playerId]) db.players[playerId] = { balance: 0 };
    db.players[playerId].balance += conv.earned;
    db.totalDistributed += conv.earned;
    saveDB(db);

    return res.json({
      success: true,
      earned: conv.earned,
      newBalance: db.players[playerId].balance,
      requiredPoints: conv.requiredPoints,
      difficultyMultiplier: conv.multiplier,
      totalDistributed: db.totalDistributed,
      remaining: TOTAL_STR_SUPPLY - db.totalDistributed
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "erro interno" });
  }
});

// consultar saldo
app.get("/balance/:playerId", (req, res) => {
  const { playerId } = req.params;
  const db = loadDB();
  const balance = db.players[playerId]?.balance || 0;
  res.json({ playerId, balance });
});

/* opcional: saque para carteira on-chain (não implementado aqui) */
app.post("/withdraw", (req, res) => {
  // placeholder — implementar quando integrar contrato com ethers.js
  return res.status(501).json({ error: "withdraw ainda não implementado on-chain" });
});

// Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Backend rodando na porta ${PORT}`));
