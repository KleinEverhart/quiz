require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const os = require('os');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;
const TIME_PER_QUESTION = 15; // giây/câu – do server quyết định, client không tự đổi được

if (!process.env.DATABASE_URL) {
    console.error('Thiếu DATABASE_URL. Hãy tạo file .env (xem .env.example).');
    process.exit(1);
}
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined, // bật khi dùng DB cloud
});
pool.on('error', (e) => console.error('Lỗi kết nối PostgreSQL:', e.message));

app.use(cors());
app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, 'public'), { index: 'quiz.html' }));

/* ---------- Dữ liệu câu hỏi ---------- */
const RAW_QUESTIONS = [
    { question: "1.", answers: ["A.", "B.", "C.", "D."], correct: 0 },
    { question: "2.", answers: ["A.", "B.", "C.", "D."], correct: 0 },
    { question: "3.", answers: ["A.", "B.", "C.", "D."], correct: 0 },
    { question: "4.", answers: ["A.", "B.", "C.", "D."], correct: 0 },
    { question: "5.", answers: ["A.", "B.", "C.", "D."], correct: 0 },
    { question: "6.", answers: ["A.", "B.", "C.", "D."], correct: 0 },
    { question: "7.", answers: ["A.", "B.", "C.", "D."], correct: 0 },
    { question: "8.", answers: ["A.", "B.", "C.", "D."], correct: 0 },
    { question: "9.", answers: ["A.", "B.", "C.", "D."], correct: 0 },
    { question: "10.", answers: ["A.", "B.", "C.", "D."], correct: 0 },
    { question: "11.", answers: ["A.", "B.", "C.", "D."], correct: 0 },
    { question: "12.", answers: ["A.", "B.", "C.", "D."], correct: 0 },
    { question: "13.", answers: ["A.", "B.", "C.", "D."], correct: 0 },
    { question: "14.", answers: ["A.", "B.", "C.", "D."], correct: 0 },
    { question: "15.", answers: ["A.", "B.", "C.", "D."], correct: 0 },
    { question: "16.", answers: ["A.", "B.", "C.", "D."], correct: 0 },
    { question: "17.", answers: ["A.", "B.", "C.", "D."], correct: 0 },
    { question: "18.", answers: ["A.", "B.", "C.", "D."], correct: 0 },
    { question: "19.", answers: ["A.", "B.", "C.", "D."], correct: 0 },
    { question: "20.", answers: ["A.", "B.", "C.", "D."], correct: 0 },
    { question: "21.", answers: ["A.", "B.", "C.", "D."], correct: 0 },
    { question: "22.", answers: ["A.", "B.", "C.", "D."], correct: 0 },
    { question: "23.", answers: ["A.", "B.", "C.", "D."], correct: 0 },
    { question: "24.", answers: ["A.", "B.", "C.", "D."], correct: 0 },
    { question: "25.", answers: ["A.", "B.", "C.", "D."], correct: 0 },
    { question: "26.", answers: ["A.", "B.", "C.", "D."], correct: 0 },
    { question: "27.", answers: ["A.", "B.", "C.", "D."], correct: 0 },
    { question: "28.", answers: ["A.", "B.", "C.", "D."], correct: 0 },
    { question: "29.", answers: ["A.", "B.", "C.", "D."], correct: 0 },
    { question: "30.", answers: ["A.", "B.", "C.", "D."], correct: 0 }
    
];

/* ---------- Cơ sở dữ liệu ---------- */
// Mỗi lần bấm "Bắt đầu"/"Chơi lại" là một dòng mới (một lượt làm bài), có thể làm nhiều lần.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS quiz_attempts (
    id          SERIAL PRIMARY KEY,
    name_key    TEXT NOT NULL,
    name        TEXT NOT NULL,
    finished    BOOLEAN NOT NULL DEFAULT FALSE,
    started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at TIMESTAMPTZ,
    score       INTEGER,
    correct     INTEGER,
    total       INTEGER,
    accuracy    INTEGER
);
CREATE INDEX IF NOT EXISTS quiz_attempts_best_idx ON quiz_attempts (name_key, score DESC, finished_at) WHERE finished;`;

// Mỗi người (không phân biệt hoa thường) chỉ được tính điểm CAO NHẤT trên bảng xếp hạng
const BEST = `SELECT DISTINCT ON (name_key) name_key, name, score, accuracy, finished_at
              FROM quiz_attempts WHERE finished ORDER BY name_key, score DESC, finished_at ASC`;

const cleanName = (v) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '');
const keyOf = (name) => name.toLowerCase();
const isInt = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;
const wrap = (fn) => (req, res, next) => fn(req, res).catch(next); // chuyển lỗi async về error handler

async function getBoard(name) {
    const [top, total, me] = await Promise.all([
        pool.query(`WITH best AS (${BEST}) SELECT name, score, accuracy FROM best ORDER BY score DESC, finished_at ASC LIMIT 10`),
        pool.query(`WITH best AS (${BEST}) SELECT COUNT(*)::int AS n FROM best`),
        name
            ? pool.query(`WITH best AS (${BEST})
                          SELECT rank FROM (SELECT name_key, ROW_NUMBER() OVER (ORDER BY score DESC, finished_at ASC)::int AS rank FROM best) r
                          WHERE name_key = $1`, [keyOf(name)])
            : { rows: [] },
    ]);
    return { leaderboard: top.rows, rank: me.rows[0]?.rank ?? null, total: total.rows[0].n };
}

/* ---------- API ---------- */
app.get('/api/questions', (req, res) =>
    res.json({ timePerQuestion: TIME_PER_QUESTION, questions: RAW_QUESTIONS }));

// Bắt đầu một lượt làm bài mới, trả về attemptId để nộp điểm
app.post('/api/start', wrap(async (req, res) => {
    const name = cleanName(req.body.name);
    if (!name || name.length > 30) return res.status(400).json({ message: 'Tên không hợp lệ' });
    const r = await pool.query('INSERT INTO quiz_attempts (name_key, name) VALUES ($1, $2) RETURNING id', [keyOf(name), name]);
    res.status(201).json({ attemptId: r.rows[0].id });
}));

// Nộp điểm cho một lượt (mỗi attemptId chỉ nộp được một lần)
app.post('/api/score', wrap(async (req, res) => {
    const { attemptId, score, correct, total } = req.body;
    if (!isInt(attemptId, 1, 2147483647) || !isInt(total, 1, RAW_QUESTIONS.length) || !isInt(correct, 0, total) ||
        !isInt(score, 0, correct * TIME_PER_QUESTION)) { // mỗi câu đúng tối đa TIME_PER_QUESTION điểm
        return res.status(400).json({ message: 'Dữ liệu không hợp lệ' });
    }
    const r = await pool.query(
        `UPDATE quiz_attempts SET finished = TRUE, finished_at = now(), score = $2, correct = $3, total = $4, accuracy = $5
         WHERE id = $1 AND NOT finished RETURNING name`,
        [attemptId, score, correct, total, Math.round((correct / total) * 100)]);
    if (r.rowCount === 0) return res.status(409).json({ message: 'Lượt làm bài không hợp lệ hoặc đã được nộp' });
    res.json(await getBoard(r.rows[0].name));
}));

app.get('/api/leaderboard', wrap(async (req, res) => res.json(await getBoard(cleanName(req.query.name)))));

app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed' || err.type === 'entity.too.large') {
        return res.status(400).json({ message: 'Dữ liệu không hợp lệ' });
    }
    console.error(err);
    res.status(500).json({ message: 'Lỗi máy chủ' });
});

/* ---------- Khởi động ---------- */
pool.query(SCHEMA)
    .then(() => app.listen(PORT, '0.0.0.0', () => {
        console.log(`Máy này:      http://localhost:${PORT}`);
        for (const list of Object.values(os.networkInterfaces())) {
            for (const i of list) {
                if (i.family === 'IPv4' && !i.internal) console.log(`Máy khác (LAN): http://${i.address}:${PORT}`);
            }
        }
    }))
    .catch((e) => { console.error('Không kết nối được PostgreSQL:', e.message); process.exit(1); });