(() => {
    'use strict';

    /* ================= CẤU HÌNH ================= */
    // Có thể ghi đè qua URL, ví dụ: quiz.html?time=20&shuffle=0
    const CONFIG = {
        timePerQuestion: 15,   // giây cho mỗi câu
        warningAt: 5,          // cảnh báo khi còn <= số giây này
        feedbackDelay: 1500,   // ms chờ trước khi sang câu kế tiếp
        shuffleQuestions: true,
        shuffleAnswers: true,
    };

    /* ================= DỮ LIỆU CÂU HỎI (giữ nguyên) ================= */
    const RAW_QUESTIONS = [
        {
            question: "ai đẹp trai nhất",
            answers: [
                "A. tao",
                "B. tao",
                "C. tao",
                "D. tao"
            ],
            correct: 0
        },
        {
            question: "ai đẹp trai nhất",
            answers: [
                "A. tao",
                "B. tao",
                "C. tao",
                "D. tao"
            ],
            correct: 0
        },
        {
            question: "ai đẹp trai nhất",
            answers: [
                "A. tao",
                "B. tao",
                "C. tao",
                "D. tao"
            ],
            correct: 0
        }
    ];

    const ANSWER_COUNT = 4;
    const LETTERS = ['A', 'B', 'C', 'D'];

    /* ================= TIỆN ÍCH ================= */
    const $ = (id) => document.getElementById(id);

    function applyUrlOverrides() {
        const p = new URLSearchParams(location.search);
        const time = Number(p.get('time'));
        if (Number.isInteger(time) && time >= 3 && time <= 300) CONFIG.timePerQuestion = time;
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
        btnStart: $('btn-start'), btnRestart: $('btn-restart'),
        playerInfo: $('player-info'), scoreBoard: $('score-board'),
        displayName: $('display-name'), score: $('score'),
        questionText: $('question-text'), answerBtns: [...document.querySelectorAll('.answer-btn')],
        currentNumber: $('current-number'), totalQuestions: $('total-questions'),
        timer: $('timer'), timeLeft: $('time-left'),
        progress: $('progress'), progressBar: $('progress-bar'), feedback: $('feedback'),
        finalName: $('final-name'), finalScore: $('final-score'),
        statCorrect: $('stat-correct'), statWrong: $('stat-wrong'),
        statTimeout: $('stat-timeout'), statAccuracy: $('stat-accuracy'),
    };

    function showScreen(screen) {
        [el.startScreen, el.quizScreen, el.resultScreen].forEach((s) => { s.hidden = s !== screen; });
    }

    /* ================= TRẠNG THÁI ================= */
    const validQuestions = getValidQuestions(RAW_QUESTIONS);
    const state = {
        playerName: '', session: [], index: 0, score: 0,
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

    function showResult() {
        stopTimer();
        const total = state.session.length;
        el.finalName.textContent = state.playerName;
        el.finalScore.textContent = state.score;
        el.statCorrect.textContent = `${state.correct}/${total}`;
        el.statWrong.textContent = state.wrong;
        el.statTimeout.textContent = state.timedOut;
        el.statAccuracy.textContent = `${Math.round((state.correct / total) * 100)}%`;
        showScreen(el.resultScreen);
        el.btnRestart.focus();
    }

    function handleStart() {
        const name = el.nameInput.value.trim();
        if (!name) {
            el.nameError.textContent = 'Vui lòng nhập tên của bạn để bắt đầu bài thi.';
            el.nameError.hidden = false;
            el.nameInput.setAttribute('aria-invalid', 'true');
            el.nameInput.focus();
            return;
        }
        el.nameError.hidden = true;
        el.nameInput.removeAttribute('aria-invalid');
        state.playerName = name;
        el.displayName.textContent = name;
        el.playerInfo.hidden = false;
        el.scoreBoard.hidden = false;
        startQuiz();
    }

    function handleRestart() {
        startQuiz();
    }

    /* ================= KHỞI TẠO ================= */
    function init() {
        applyUrlOverrides();

        if (validQuestions.length === 0) {
            el.nameError.textContent = 'Không có dữ liệu câu hỏi hợp lệ. Vui lòng kiểm tra quiz.js.';
            el.nameError.hidden = false;
            el.btnStart.disabled = true;
            el.nameInput.disabled = true;
            showScreen(el.startScreen);
            return;
        }

        el.startInfo.textContent =
            `${validQuestions.length} câu hỏi · ${CONFIG.timePerQuestion} giây mỗi câu · điểm = số giây còn lại khi trả lời đúng`;

        el.btnStart.addEventListener('click', handleStart);
        el.nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleStart(); });
        el.btnRestart.addEventListener('click', handleRestart);
        el.answerBtns.forEach((btn) =>
            btn.addEventListener('click', () => handleAnswer(Number(btn.dataset.index))));

        // Phím tắt: 1-4 hoặc A-D để chọn đáp án
        document.addEventListener('keydown', (e) => {
            if (el.quizScreen.hidden || state.locked || e.ctrlKey || e.metaKey || e.altKey) return;
            const idx = '1234'.indexOf(e.key) !== -1 && e.key !== '' ? '1234'.indexOf(e.key) : 'abcd'.indexOf(e.key.toLowerCase());
            if (idx >= 0 && e.key.length === 1) handleAnswer(idx);
        });

        showScreen(el.startScreen);
        el.nameInput.focus();
    }

    init();
})();