const express = require("express");
const crypto = require("crypto");
const path = require("path");
const { DatabaseSync } = require("node:sqlite"); // built into Node 22.13+

const DB_PATH = process.env.DB_PATH || (process.env.VERCEL ? "/tmp/pets.db" : "pets.db");
const db = new DatabaseSync(DB_PATH);
db.exec(`CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL, salt TEXT NOT NULL, hash TEXT NOT NULL,
  smiles INTEGER NOT NULL DEFAULT 0, streak REAL NOT NULL DEFAULT 0, xp REAL NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT 'mint', seen INTEGER)`);

const SECRET = process.env.SECRET || crypto.randomBytes(32).toString("hex"); // set SECRET in production
const sign = p => crypto.createHmac("sha256", SECRET).update(p).digest("hex");
const digest = s => crypto.createHash("sha256").update(s).digest();
const mint = id => { const p = id + "." + (Date.now() + 7 * 864e5); return p + "." + sign(p); };

const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "1kb" }));

// Rate limit: 60 requests/minute per IP
const hits = new Map();
app.use("/api", (req, res, next) => {
  const now = Date.now(), recent = (hits.get(req.ip) || []).filter(t => now - t < 60000);
  recent.push(now); hits.set(req.ip, recent);
  recent.length > 60 ? res.status(429).json({ error: "Too many requests" }) : next();
});

function auth(req, res, next) {
  const [id, exp, sig] = (req.get("authorization") || "").replace("Bearer ", "").split(".");
  const p = id + "." + exp;
  if (!sig || !crypto.timingSafeEqual(digest(sig), digest(sign(p))) || +exp < Date.now())
    return res.status(401).json({ error: "Please log in" });
  req.uid = +id; next();
}

const creds = req => [String(req.body.name || "").trim(), String(req.body.password || "")];

app.post("/api/register", (req, res) => {
  const [name, pw] = creds(req);
  if (!/^[\w.-]{2,16}$/.test(name) || pw.length < 6 || pw.length > 72)
    return res.status(400).json({ error: "Name: 2-16 letters/numbers. Password: 6+ characters." });
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(pw, salt, 64).toString("hex");
  try {
    const r = db.prepare("INSERT INTO users(name,salt,hash) VALUES(?,?,?)").run(name, salt, hash);
    res.json({ token: mint(Number(r.lastInsertRowid)), name });
  } catch { res.status(409).json({ error: "That name is taken" }); }
});

app.post("/api/login", (req, res) => {
  const [name, pw] = creds(req);
  const u = db.prepare("SELECT * FROM users WHERE name=?").get(name);
  const ok = u && crypto.timingSafeEqual(crypto.scryptSync(pw, u.salt, 64), Buffer.from(u.hash, "hex"));
  ok ? res.json({ token: mint(u.id), name: u.name }) : res.status(401).json({ error: "Wrong name or password" });
});

app.get("/api/me", auth, (req, res) => {
  const u = db.prepare("SELECT name,smiles,streak,xp,color FROM users WHERE id=?").get(req.uid);
  u ? res.json(u) : res.status(401).json({ error: "Please log in" });
});

// Anti-cheat: gains are capped by the time since the last save, so scores can't be faked instantly.
app.post("/api/progress", auth, (req, res) => {
  const u = db.prepare("SELECT * FROM users WHERE id=?").get(req.uid);
  if (!u) return res.status(401).json({ error: "Please log in" });
  const cap = Math.min(u.seen ? (Date.now() - u.seen) / 1000 : 60, 3600) + 10;
  const n = k => Math.max(0, Number(req.body[k]) || 0);
  const smiles = Math.min(Math.floor(n("smiles")), u.smiles + Math.ceil(cap));
  const streak = Math.min(n("streak"), u.streak + cap);
  const xp = Math.min(n("xp"), u.xp + cap * 2);
  const color = ["mint", "peach", "lilac"].includes(req.body.color) ? req.body.color : u.color;
  db.prepare("UPDATE users SET smiles=MAX(smiles,?),streak=MAX(streak,?),xp=MAX(xp,?),color=?,seen=? WHERE id=?")
    .run(smiles, streak, xp, color, Date.now(), u.id);
  res.json({ ok: true });
});

app.get("/api/leaderboard", (_req, res) => {
  res.json(db.prepare(
    "SELECT name,smiles,streak,xp FROM users WHERE xp>0 ORDER BY streak DESC, xp DESC LIMIT 10").all());
});

app.use(express.static(path.join(__dirname, "public")));

if (require.main === module) {
  app.listen(process.env.PORT || 3000, () =>
    console.log("Pet Mirror running on http://localhost:" + (process.env.PORT || 3000)));
}

module.exports = app;
