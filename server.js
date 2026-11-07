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
    {
        question: "Theo triết học Mác – Lênin, yếu tố nào đóng vai trò là cơ sở, nền tảng cho sự tồn tại và phát triển của toàn bộ đời sống xã hội loài người?",
        answers: [
            "A.Sản xuất tinh thần.",
            "B.Sản xuất vật chất.",
            "C.Hoạt động chính trị - xã hội.",
            "D.Hoạt động khoa học - thực nghiệm"
        ],
        correct: 1
    },
    {
        question: "Vì sao triết học Mác - Lênin khẳng định sản xuất vật chất là cơ sở của sự tồn tại và phát triển xã hội?",
        answers: [
            "A.Vì sản xuất vật chất tạo ra của cải để nuôi sống con người và là nền tảng cho mọi hoạt động xã hội.",
            "B.Vì sản xuất vật chất chỉ phục vụ riêng cho nhu cầu kinh tế của các doanh nghiệp.",
            "C.Vì con người chỉ cần có đời sống tinh thần phong phú là xã hội sẽ tự phát triển.",
            "D.Vì nhà nước quyết định hoàn toàn mọi sản phẩm làm ra trong đời sống hằng ngày."
        ],
        correct: 0
    },
    {
        question: "Yếu tố nào đóng vai trò quyết định trong mối quan hệ biện chứng giữa lực lượng sản xuất và quan hệ sản xuất?",
        answers: [
            "A.Quan hệ sản xuất quyết định lực lượng sản xuất.",
            "B.Lực lượng sản xuất quyết định quan hệ sản xuất.",
            "C.Quan hệ sản xuất luôn luôn đi trước lực lượng sản xuất.",
            "D.Hai yếu tố này hoàn toàn độc lập với nhau."
        ],
        correct: 1
    },
    {
        question: "Lực lượng sản xuất và quan hệ sản xuất được xây dựng từ nền tảng lý luận nào?",
        answers: [
            "A.Lý luận hình thái kinh tế - xã hội",
            "B.Lý luận giá trị thặng dư",
            "C.Lý luận đấu tranh giai cấp",
            "D.Lý luận Nhà nước và cách mạng vô sản"
        ],
        correct: 0
    },
    {
        question: "Nhân tố giữ vai trò quyết định trong lực lượng sản xuất là gì?",
        answers: [
            "A.Đối tượng lao động",
            "B.Công cụ lao động ",
            "C.Người lao động",
            "D.Phương tiện giao thông"
        ],
        correct: 2
    },
    {
        question: "Trình độ phát triển của công cụ lao động là nhân tố quyết định tới yếu tố nào sau đây?",
        answers: [
            "A.Hiệu quả sản xuất",
            "B.Năng suất lao động",
            "C.Cường độ lao động",
            "D.Chất lượng sản phẩm"
        ],
        correct: 1
    },
    {
        question: "Trong kết cấu của quan hệ sản xuất, quan hệ nào đóng vai trò quyết định trực tiếp đến địa vị kinh tế - xã hội của các tập đoàn người?",
        answers: [
            "A.Quan hệ tổ chức và quản lý sản xuất",
            "B.Quan hệ sở hữu về tư liệu sản xuất",
            "C.Quan hệ phân phối sản phẩm lao động",
            "D.Quan hệ trao đổi và lưu thông hàng hóa"
        ],
        correct: 1
    },
    {
        question: "Theo Triết học Mác - Lênin, sự biến đổi của quan hệ sản xuất trước hết là do sự biến đổi của yếu tố nào quyết định?",
        answers: [
            "A.Ý thức xã hội",
            "B.Lực lượng sản xuất",
            "C.Kiến trúc thượng tầng",
            "D.Cơ sở hạ tầng"
        ],
        correct: 1
    },
    {
        question: "Theo triết học Mác - Lênin, Cơ sở hạ tầng là gì?",
        answers: [
            "A.Là toàn bộ những quan hệ sản xuất của một xã hội trong sự vận động hiện thực của chúng hợp thành cơ cấu kinh tế của xã hội đó.",
            "B.Là toàn bộ lực lượng sản xuất và kiến trúc thượng tầng của xã hội trong một giai đoạn lịch sử nhất định.",
            "C.Là toàn bộ cơ sở vật chất - kỹ thuật, nhà xưởng, đường xá và các công trình kiến trúc của xã hội.",
            "D.Là toàn bộ các quan hệ chính trị, pháp luật, đạo đức và tôn giáo của một hình thái kinh tế - xã hội. "
        ],
        correct: 0
    },
    {
        question: "Theo triết học Mác - Lênin, yếu tố nào dưới đây thuộc về Kiến trúc thượng tầng của một xã hội?",
        answers: [
            "A.Tòa tháp Bitexco, Landmark 81 và các chung cư cao tầng.",
            "B.Hệ thống đường cao tốc Bắc - Nam và các cầu vượt đô thị.",
            "C.Hệ thống luật pháp, nhà nước, các quan điểm chính trị và giáo lý tôn giáo.",
            "D.Toàn bộ máy móc, robot AI và công nghệ hiện đại trong các nhà máy."
        ],
        correct: 2
    },
    {
        question: "Học thuyết hình thái kinh tế – xã hội nghiên cứu điều gì?",
        answers: [
            "A.Các quy luật vận động, phát triển của xã hội.",
            "B.Các quy luật vận động của giới tự nhiên.",
            "C.Các quy luật của tư duy con người.",
            "D. Các hiện tượng tâm lý cá nhân."
        ],
        correct: 0
    },
    {
        question: "Hình thái kinh tế – xã hội bao gồm những yếu tố cơ bản nào?",
        answers: [
            "A.Kinh tế, chính trị và văn hóa.",
            "B.Lực lượng sản xuất, quan hệ sản xuất và kiến trúc thượng tầng.",
            "C.Cơ sở hạ tầng, dân số và lãnh thổ.",
            "D.Nhà nước, pháp luật và đạo đức."
        ],
        correct: 1
    },
    {
        question: "Trong mối quan hệ giữa lực lượng sản xuất và quan hệ sản xuất, yếu tố nào giữ vai trò quyết định?",
        answers: [
            "A.Quan hệ sản xuất.",
            "B.Kiến trúc thượng tầng.",
            "C.Lực lượng sản xuất.",
            "D.Ý thức xã hội."
        ],
        correct: 2
    },
    {
        question: "14.Theo quan điểm của chủ nghĩa Mác – Lênin, yếu tố giữ vai trò nền tảng đối với sự tồn tại và phát triển của xã hội là gì?",
        answers: [
            "A.Sản xuất vật chất.",
            "B.Tôn giáo",
            "C.Ý thức cá nhân.",
            "D.Hoạt động chính trị đơn thuần."
        ],
        correct: 0
    },
    {
        question: " Khi lực lượng sản xuất phát triển nhưng quan hệ sản xuất không còn phù hợp, quan hệ sản xuất có thể dẫn đến hậu quả nào?",
        answers: [
            "A.Luôn thúc đẩy lực lượng sản xuất phát triển.",
            "B.Kìm hãm sự phát triển của lực lượng sản xuất.",
            "C.Làm lực lượng sản xuất không bao giờ thay đổi.",
            "D.Không gây ra bất kỳ ảnh hưởng nào."
        ],
        correct: 0
    },
    {
        question: "Khi vận dụng học thuyết hình thái kinh tế – xã hội vào thực tiễn Việt Nam, cần chú ý điều gì?",
        answers: [
            "A.Sao chép nguyên vẹn mô hình phát triển của quốc gia khác",
            "B.Chỉ dựa vào mong muốn chủ quan",
            "C.Xuất phát từ điều kiện lịch sử cụ thể của đất nước và tôn trọng các quy luật khách quan.",
            "D.Không cần quan tâm đến trình độ phát triển của lực lượng sản xuất."
        ],
        correct: 2
    },
    {
        question: " Theo quan điểm của chủ nghĩa Mác – Lênin, yếu tố giữ vai trò nền tảng đối với sự tồn tại và phát triển của xã hội là gì?",
        answers: [
            "A.Sản xuất vật chất.",
            "B.Tôn giáo.",
            "C.Ý thức cá nhân.",
            "D.Hoạt động chính trị đơn thuần."
        ],
        correct: 0
    },
    {
        question: "Quan hệ sản xuất bao gồm những mặt cơ bản nào?",
        answers: [
            "A.Sở hữu tư liệu sản xuất, tổ chức và quản lý sản xuất, phân phối sản phẩm lao động.",
            "B.Sản xuất, trao đổi và tiêu dùng.",
            "C.Chính trị, pháp luật và đạo đức.",
            "D.Người lao động, công cụ lao động và đối tượng lao động."
        ],
        correct: 0
    },
    {
        question: "Học thuyết hình thái kinh tế – xã hội là học thuyết của ai?",
        answers: [
            "A.Hêghen.",
            "B.Mác và Ph. Ăngghen.",
            "C.Lênin và Hêghen.",
            "D.A. Smith."
        ],
        correct: 1
    },
    {
        question: "Vì sao không thể chỉ dựa vào ý muốn chủ quan để xây dựng và phát triển xã hội?",
        answers: [
            "A.Vì con người không có khả năng tác động đến xã hội.",
            "B.Vì sự phát triển xã hội chịu sự chi phối của những quy luật khách quan và các điều kiện lịch sử cụ thể thể.",
            "C.Vì mọi xã hội đều giống nhau.",
            "D.Vì kinh tế không ảnh hưởng đến sự phát triển xã hội."
        ],
        correct: 2
    }
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