const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');
const TIME_PER_QUESTION = 15; // giây/câu – do server quyết định, client không tự đổi được

app.use(cors());
app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, 'public'), { index: 'quiz.html' }));

/* ---------- Dữ liệu câu hỏi ---------- */
const RAW_QUESTIONS = [
    { question: "ai đẹp trai nhất", answers: ["A. tao", "B. tao", "C. tao", "D. tao"], correct: 0 },
    { question: "ai thông minh nhất", answers: ["A. tao", "B. tao", "C. tao", "D. tao"], correct: 0 },
    { question: "ai giàu nhất", answers: ["A. tao", "B. tao", "C. tao", "D. tao"], correct: 0 }
];

/* ---------- Lưu lượt làm bài (file JSON, còn nguyên sau khi restart) ---------- */
// attempts[tên_viết_thường] = { name, finished, startedAt, finishedAt, score, correct, total, accuracy }
const attempts = (() => {
    let saved = {};
    try { saved = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch { /* chưa có file */ }
    return Object.assign(Object.create(null), saved); // không có prototype: an toàn với tên 'constructor', '__proto__'
})();
const save = () => {
    try { fs.writeFileSync(DATA_FILE, JSON.stringify(attempts, null, 2)); } catch (e) { console.error(e); }
};

const cleanName = (v) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '');
const keyOf = (name) => name.toLowerCase();
const isInt = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;

function getBoard(name) {
    const ranked = Object.values(attempts)
        .filter((a) => a.finished)
        .sort((a, b) => b.score - a.score || a.finishedAt.localeCompare(b.finishedAt));
    const idx = name ? ranked.findIndex((a) => keyOf(a.name) === keyOf(name)) : -1;
    return {
        leaderboard: ranked.slice(0, 10).map(({ name, score, accuracy }) => ({ name, score, accuracy })),
        rank: idx >= 0 ? idx + 1 : null,
        total: ranked.length,
    };
}

/* ---------- API ---------- */
app.get('/api/questions', (req, res) =>
    res.json({ timePerQuestion: TIME_PER_QUESTION, questions: RAW_QUESTIONS }));

// Đăng ký lượt làm bài: mỗi tên chỉ được một lần (không phân biệt hoa thường)
app.post('/api/start', (req, res) => {
    const name = cleanName(req.body.name);
    if (!name || name.length > 30) return res.status(400).json({ message: 'Tên không hợp lệ' });
    if (attempts[keyOf(name)]) return res.status(409).json({ message: 'Tên này đã làm bài' });
    attempts[keyOf(name)] = { name, finished: false, startedAt: new Date().toISOString() };
    save();
    res.status(201).json({ message: 'OK' });
});

app.post('/api/score', (req, res) => {
    const name = cleanName(req.body.name);
    const { score, correct, total } = req.body;
    const attempt = attempts[keyOf(name)];

    if (!attempt) return res.status(400).json({ message: 'Chưa bắt đầu bài thi' });
    if (attempt.finished) return res.status(409).json({ message: 'Điểm đã được ghi nhận' });
    if (!isInt(total, 1, RAW_QUESTIONS.length) || !isInt(correct, 0, total) ||
        !isInt(score, 0, correct * TIME_PER_QUESTION)) { // mỗi câu đúng tối đa TIME_PER_QUESTION điểm
        return res.status(400).json({ message: 'Dữ liệu không hợp lệ' });
    }

    Object.assign(attempt, {
        finished: true, finishedAt: new Date().toISOString(),
        score, correct, total, accuracy: Math.round((correct / total) * 100),
    });
    save();
    res.json(getBoard(name));
});

app.get('/api/leaderboard', (req, res) => res.json(getBoard(cleanName(req.query.name))));

app.use((err, req, res, next) => res.status(400).json({ message: 'Dữ liệu không hợp lệ' }));

app.listen(PORT, () => console.log(`Server chạy tại http://localhost:${PORT}`));