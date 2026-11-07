(() => {
    'use strict';

    /* ================= CẤU HÌNH ================= */
    // timePerQuestion do server cấp (xem /api/questions). Tắt xáo trộn để debug: quiz.html?shuffle=0
    const CONFIG = {
        timePerQuestion: 15,   // giây cho mỗi câu
        warningAt: 5,          // cảnh báo khi còn <= số giây này
        feedbackDelay: 1500,   // ms chờ trước khi sang câu kế tiếp
        shuffleQuestions: true,
        shuffleAnswers: true,
    };

    /* ================= API & LƯU TRỮ ================= */
    // Mở trực tiếp file HTML (file://) vẫn gọi được server tại localhost:3000
    const API_BASE = location.protocol === 'file:' ? 'http://localhost:3000' : '';
    async function api(path, options = {}) {
        const res = await fetch(API_BASE + path, { headers: { 'Content-Type': 'application/json' }, ...options });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw Object.assign(new Error(data.message || 'Lỗi máy chủ'), { status: res.status });
        return data;
    }

    const ANSWER_COUNT = 4;
    const LETTERS = ['A', 'B', 'C', 'D'];

    /* ================= TIỆN ÍCH ================= */
    const $ = (id) => document.getElementById(id);

    function applyUrlOverrides() {
        const p = new URLSearchParams(location.search);
        if (p.get('shuffle') === '0') CONFIG.shuffleQuestions = CONFIG.shuffleAnswers = false;
    }

    function shuffle(arr) { // Fisher–Yates, không sửa mảng gốc
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    const stripLabel = (s) => s.replace(/^\s*[A-Da-d][.)]\s*/, '');

    /* ================= KIỂM TRA & CHUẨN BỊ DỮ LIỆU ================= */
    function isValidQuestion(q) {
        return q && typeof q.question === 'string' && q.question.trim() !== '' &&
            Array.isArray(q.answers) && q.answers.length === ANSWER_COUNT &&
            q.answers.every((a) => typeof a === 'string' && a.trim() !== '') &&
            Number.isInteger(q.correct) && q.correct >= 0 && q.correct < ANSWER_COUNT;
    }

    function getValidQuestions(list) {
        if (!Array.isArray(list)) return [];
        return list.filter((q, i) => {
            const ok = isValidQuestion(q);
            if (!ok) console.warn(`Câu hỏi #${i + 1} không hợp lệ, đã bỏ qua.`, q);
            return ok;
        });
    }

    // Tạo bộ câu cho một lượt chơi; nhãn A-D được gán lại theo vị trí sau khi xáo.
    function buildSession(valid) {
        const qs = CONFIG.shuffleQuestions ? shuffle(valid) : valid;
        return qs.map((q) => {
            let answers = q.answers.map((text, i) => ({ text: stripLabel(text), isCorrect: i === q.correct }));
            if (CONFIG.shuffleAnswers) answers = shuffle(answers);
            return {
                text: q.question,
                answers: answers.map((a, i) => ({ ...a, label: `${LETTERS[i]}. ${a.text}` })),
                correctIndex: answers.findIndex((a) => a.isCorrect),
            };
        });
    }

    /* ================= DOM ================= */
    const el = {
        startScreen: $('start-screen'), quizScreen: $('quiz-screen'), resultScreen: $('result-screen'),
        startInfo: $('start-info'), nameInput: $('player-name'), nameError: $('name-error'),
        btnStart: $('btn-start'),
        playerInfo: $('player-info'), scoreBoard: $('score-board'),
        displayName: $('display-name'), score: $('score'),
        questionText: $('question-text'), answerBtns: [...document.querySelectorAll('.answer-btn')],
        currentNumber: $('current-number'), totalQuestions: $('total-questions'),
        timer: $('timer'), timeLeft: $('time-left'),
        progress: $('progress'), progressBar: $('progress-bar'), feedback: $('feedback'),
        finalName: $('final-name'), finalScore: $('final-score'),
        statCorrect: $('stat-correct'), statWrong: $('stat-wrong'),
        statTimeout: $('stat-timeout'), statAccuracy: $('stat-accuracy'),
        rankText: $('rank-text'), saveNote: $('save-note'), leaderboard: $('leaderboard'),
    };

    function showScreen(screen) {
        [el.startScreen, el.quizScreen, el.resultScreen].forEach((s) => { s.hidden = s !== screen; });
    }

    /* ================= TRẠNG THÁI ================= */
    let validQuestions = [];
    const state = {
        playerName: '', attemptId: null, session: [], index: 0, score: 0,
        correct: 0, wrong: 0, timedOut: 0,
        locked: false, deadline: 0, timerId: null, nextId: null,
    };

    /* ================= ĐỒNG HỒ ================= */
    // Dựa trên mốc thời gian thực (deadline) nên không bị lệch khi tab bị trì hoãn.
    const remainingSeconds = () => Math.max(0, Math.ceil((state.deadline - Date.now()) / 1000));

    function stopTimer() {
        clearInterval(state.timerId);
        state.timerId = null;
    }

    function renderTimer(sec) {
        el.timeLeft.textContent = sec;
        el.timer.classList.toggle('warning', sec <= CONFIG.warningAt && sec > 0);
    }

    function startTimer() {
        stopTimer();
        state.deadline = Date.now() + CONFIG.timePerQuestion * 1000;
        renderTimer(CONFIG.timePerQuestion);
        state.timerId = setInterval(() => {
            const sec = remainingSeconds();
            renderTimer(sec);
            if (sec <= 0) handleTimeout();
        }, 200);
    }

    /* ================= LUỒNG CÂU HỎI ================= */
    function updateProgress(done) {
        const total = state.session.length;
        el.progressBar.style.width = `${(done / total) * 100}%`;
        el.progress.setAttribute('aria-valuenow', done);
    }

    function setFeedback(text, type) {
        el.feedback.textContent = text;
        el.feedback.className = 'feedback' + (type ? ` is-${type}` : '');
    }

    function loadQuestion() {
        const q = state.session[state.index];
        state.locked = false;
        el.currentNumber.textContent = state.index + 1;
        el.questionText.textContent = q.text;
        setFeedback('', '');
        el.answerBtns.forEach((btn, i) => {
            btn.textContent = q.answers[i].label;
            btn.className = 'btn answer-btn';
            btn.disabled = false;
        });
        updateProgress(state.index);
        startTimer();
    }

    function scheduleNext() {
        clearTimeout(state.nextId);
        state.nextId = setTimeout(() => {
            state.index++;
            state.index < state.session.length ? loadQuestion() : showResult();
        }, CONFIG.feedbackDelay);
    }

    // Khóa câu hỏi đúng một lần: chặn click kép, click trùng với hết giờ.
    function lockQuestion() {
        if (state.locked) return false;
        state.locked = true;
        stopTimer();
        renderTimer(remainingSeconds());
        el.timer.classList.remove('warning');
        el.answerBtns.forEach((b) => { b.disabled = true; });
        return true;
    }

    function handleAnswer(selectedIndex) {
        const sec = remainingSeconds();
        if (!lockQuestion()) return;
        const q = state.session[state.index];
        el.answerBtns[q.correctIndex].classList.add('correct');

        if (selectedIndex === q.correctIndex) {
            state.correct++;
            state.score += sec; // điểm = số giây còn lại
            el.score.textContent = state.score;
            el.score.classList.remove('score-bump');
            void el.score.offsetWidth; // khởi động lại animation
            el.score.classList.add('score-bump');
            setFeedback(`✔ Chính xác! +${sec} điểm`, 'correct');
        } else {
            state.wrong++;
            el.answerBtns[selectedIndex].classList.add('wrong');
            setFeedback('✘ Chưa đúng. Đáp án đúng đã được tô xanh.', 'wrong');
        }
        updateProgress(state.index + 1);
        scheduleNext();
    }

    function handleTimeout() {
        if (!lockQuestion()) return;
        state.timedOut++;
        el.answerBtns[state.session[state.index].correctIndex].classList.add('correct');
        setFeedback('⏰ Hết giờ!', 'wrong');
        updateProgress(state.index + 1);
        scheduleNext();
    }

    /* ================= BẮT ĐẦU / KẾT QUẢ / LÀM LẠI ================= */
    function resetState() {
        stopTimer();
        clearTimeout(state.nextId);
        Object.assign(state, {
            session: buildSession(validQuestions), index: 0, score: 0,
            correct: 0, wrong: 0, timedOut: 0, locked: false,
        });
        el.score.textContent = '0';
        el.totalQuestions.textContent = state.session.length;
        el.progress.setAttribute('aria-valuemax', state.session.length);
    }

    function startQuiz() {
        resetState();
        showScreen(el.quizScreen);
        loadQuestion();
    }

    function renderResult(r) {
        el.finalName.textContent = r.name;
        el.finalScore.textContent = r.score;
        el.statCorrect.textContent = `${r.correct}/${r.total}`;
        el.statWrong.textContent = r.wrong;
        el.statTimeout.textContent = r.timedOut;
        el.statAccuracy.textContent = `${r.accuracy}%`;
        showScreen(el.resultScreen);
    }

    function renderBoard(data) {
        el.rankText.textContent = data.rank
            ? `Xếp hạng của bạn: #${data.rank}/${data.total} (tính theo điểm cao nhất)` : '';
        el.leaderboard.replaceChildren(...data.leaderboard.map((row) => {
            const li = document.createElement('li');
            const name = document.createElement('span');
            const score = document.createElement('strong');
            name.textContent = row.name;
            score.textContent = row.score;
            li.append(name, score);
            if (row.name.toLowerCase() === state.playerName.toLowerCase()) li.className = 'me';
            return li;
        }));
    }

    async function loadBoard() {
        try {
            renderBoard(await api(`/api/leaderboard?name=${encodeURIComponent(state.playerName)}`));
        } catch { /* giữ nguyên thông báo lỗi lưu điểm */ }
    }

    async function submitResult(result) {
        el.rankText.textContent = '';
        el.saveNote.textContent = 'Đang lưu điểm...';
        try {
            const data = await api('/api/score', {
                method: 'POST',
                body: JSON.stringify({
                    attemptId: state.attemptId, score: result.score, correct: result.correct, total: result.total,
                }),
            });
            el.saveNote.textContent = '';
            renderBoard(data);
        } catch {
            el.saveNote.textContent = 'Chưa lưu được điểm lên máy chủ.';
            loadBoard();
        }
    }

    function showResult() {
        stopTimer();
        const total = state.session.length;
        const result = {
            name: state.playerName, score: state.score,
            correct: state.correct, wrong: state.wrong, timedOut: state.timedOut,
            total, accuracy: Math.round((state.correct / total) * 100),
        };
        renderResult(result);
        submitResult(result);
    }

    function showStartError(msg) {
        el.nameError.textContent = msg;
        el.nameError.hidden = false;
    }

    // Tạo lượt làm bài mới trên server rồi bắt đầu
    async function startAttempt(name) {
        const data = await api('/api/start', { method: 'POST', body: JSON.stringify({ name }) });
        state.attemptId = data.attemptId;
        state.playerName = name;
        el.displayName.textContent = name;
        el.playerInfo.hidden = false;
        el.scoreBoard.hidden = false;
        startQuiz();
    }

    async function handleStart() {
        if (el.btnStart.disabled) return;
        const name = el.nameInput.value.trim().replace(/\s+/g, ' ');
        if (!name) {
            showStartError('Vui lòng nhập tên của bạn để bắt đầu bài thi.');
            el.nameInput.setAttribute('aria-invalid', 'true');
            el.nameInput.focus();
            return;
        }
        el.btnStart.disabled = true;
        try {
            await startAttempt(name);
            el.nameError.hidden = true;
            el.nameInput.removeAttribute('aria-invalid');
        } catch {
            showStartError('Không kết nối được máy chủ. Vui lòng thử lại.');
        } finally {
            el.btnStart.disabled = false;
        }
    }

    /* ================= KHỞI TẠO ================= */
    async function init() {
        applyUrlOverrides();
        showScreen(el.startScreen);
        el.btnStart.disabled = true;
        el.startInfo.textContent = 'Đang tải câu hỏi...';
        try {
            const data = await api('/api/questions');
            if (Number.isInteger(data.timePerQuestion) && data.timePerQuestion > 0) CONFIG.timePerQuestion = data.timePerQuestion;
            validQuestions = getValidQuestions(data.questions);
        } catch { validQuestions = []; }

        if (validQuestions.length === 0) {
            el.startInfo.textContent = '';
            showStartError('Không tải được câu hỏi từ máy chủ. Hãy kiểm tra server rồi tải lại trang.');
            el.nameInput.disabled = true;
            return;
        }

        el.btnStart.disabled = false;
        el.startInfo.textContent =
            `${validQuestions.length} câu hỏi · ${CONFIG.timePerQuestion} giây mỗi câu · chơi ăn gian là tui biết đó nha =))`;

        el.btnStart.addEventListener('click', handleStart);
        el.nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleStart(); });
        el.answerBtns.forEach((btn) =>
            btn.addEventListener('click', () => handleAnswer(Number(btn.dataset.index))));

        // Phím tắt: 1-4 hoặc A-D để chọn đáp án
        document.addEventListener('keydown', (e) => {
            if (el.quizScreen.hidden || state.locked || e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
            const idx = '1234'.includes(e.key) ? '1234'.indexOf(e.key) : 'abcd'.indexOf(e.key.toLowerCase());
            if (idx >= 0) handleAnswer(idx);
        });
        el.nameInput.focus();
    }

    init();
})();