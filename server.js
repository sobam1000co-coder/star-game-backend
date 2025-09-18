import express from "express";
import cors from "cors";
import fs from "fs-extra";

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = "./database.json";

app.use(cors());
app.use(express.json());

// carregar database
async function loadDB() {
  try {
    const data = await fs.readFile(DB_FILE, "utf8");
    return JSON.parse(data);
  } catch {
    return { totalSupply: 21000000, distributed: 0, users: {} };
  }
}

// salvar database
async function saveDB(db) {
  await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2));
}

// rota para ganhar STR
app.post("/earn", async (req, res) => {
  const { username, amount } = req.body;
  let db = await loadDB();

  if (db.distributed + amount > db.totalSupply) {
    return res.status(400).json({ error: "Total supply atingido!" });
  }

  if (!db.users[username]) db.users[username] = { balance: 0 };

  db.users[username].balance += amount;
  db.distributed += amount;

  await saveDB(db);
  res.json({ balance: db.users[username].balance, distributed: db.distributed });
});

// rota para checar saldo
app.get("/balance/:username", async (req, res) => {
  const db = await loadDB();
  const { username } = req.params;
  const balance = db.users[username]?.balance || 0;
  res.json({ balance });
});

app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
