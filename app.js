let allQuestions = [];
let currentQuestions = [];
let currentIndex = 0;
let correctCount = 0;
let mistakes = [];
let isReviewMode = false;
let loadedFileName = '';

// app-areaの初期HTMLを保持（結果画面で上書きされるため復元用）
const appAreaOriginalHTML = `
    <div id="progress" style="margin-bottom: 10px; color: #666;"></div>
    <span id="format-badge" class="badge format-badge"></span>
    <span id="level-badge" class="badge level-badge"></span>
    <h3 id="question-text" style="margin-top: 10px;"></h3>
    <div id="input-area"></div>
    <button id="check-btn" onclick="checkAnswer()">解答する</button>
    <div id="result-message" class="result-message"></div>
    <div id="explanation-area" class="explanation"></div>
    <button id="next-btn" onclick="nextQuestion()" style="display: none;">次の問題へ</button>
    <div style="margin-top: 30px; border-top: 1px solid #ddd; padding-top: 15px;">
        <button onclick="resetToSetup()" class="secondary-btn">ファイル選択に戻る</button>
    </div>
`;

window.addEventListener('DOMContentLoaded', () => {
    const savedMistakes = localStorage.getItem('english_quiz_mistakes');
    if (savedMistakes) {
        mistakes = JSON.parse(savedMistakes);
        if (mistakes.length > 0) {
            document.getElementById('review-area').style.display = 'block';
            document.getElementById('review-btn').textContent = `間違えた問題に再挑戦する (${mistakes.length}問)`;
        }
    }

    // CSVファイル選択時にタグのプルダウンを更新する
    const csvFileInput = document.getElementById('csv-file');
    if (csvFileInput) {
        csvFileInput.addEventListener('change', function (e) {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function (evt) {
                const text = evt.target.result;
                const rows = parseCSV(text);
                const tagsSet = new Set();
                const levelSet = new Set();
                const formatSet = new Set();

                for (let i = 1; i < rows.length; i++) {
                    const r = rows[i];
                    if (r.length < 7) continue;

                    // レベルの収集
                    const level = r[2] ? r[2].trim() : "";
                    if (level) levelSet.add(level);

                    // 形式の収集
                    const format = r[3] ? r[3].trim() : "";
                    if (format) formatSet.add(format);

                    // タグの収集
                    const tagStr = r[8] || "";
                    if (tagStr) {
                        const tags = tagStr.split(',').map(t => t.trim()).filter(t => t);
                        tags.forEach(t => tagsSet.add(t));
                    }
                }

                // レベルのプルダウン更新
                const levelSelect = document.getElementById('level-select');
                if (levelSelect) {
                    levelSelect.innerHTML = '<option value="all">すべてのレベル</option>';
                    const sortedLevels = Array.from(levelSet).sort((a, b) => {
                        const numA = Number(a); const numB = Number(b);
                        return (!isNaN(numA) && !isNaN(numB)) ? numA - numB : a.localeCompare(b);
                    });
                    sortedLevels.forEach(lvl => {
                        const option = document.createElement('option');
                        option.value = lvl;
                        option.textContent = !isNaN(Number(lvl)) ? `レベル ${lvl}` : lvl;
                        levelSelect.appendChild(option);
                    });
                }

                // 形式のプルダウン更新
                const formatSelect = document.getElementById('format-select');
                if (formatSelect) {
                    formatSelect.innerHTML = '<option value="all">すべての形式</option>';
                    const sortedFormats = Array.from(formatSet).sort();
                    sortedFormats.forEach(fmt => {
                        const option = document.createElement('option');
                        option.value = fmt;
                        option.textContent = fmt;
                        formatSelect.appendChild(option);
                    });
                }

                // タグのプルダウン更新
                const tagSelect = document.getElementById('tag-select');
                if (tagSelect) {
                    tagSelect.innerHTML = '<option value="">すべてのタグ</option>';
                    const sortedTags = Array.from(tagsSet).sort();
                    sortedTags.forEach(tag => {
                        const option = document.createElement('option');
                        option.value = tag;
                        option.textContent = tag;
                        tagSelect.appendChild(option);
                    });
                }
            };
            reader.readAsText(file);
        });
    }
});

function startReviewMode() {
    if (mistakes.length === 0) return;
    isReviewMode = true;
    currentQuestions = [...mistakes];
    shuffleArray(currentQuestions);

    document.getElementById('setup-area').style.display = 'none';
    document.getElementById('app-area').style.display = 'block';

    currentIndex = 0;
    correctCount = 0;
    displayQuestion();
}

function resetMistakes() {
    if (confirm("間違えた問題の記録をすべて削除しますか？")) {
        mistakes = [];
        localStorage.removeItem('english_quiz_mistakes');
        document.getElementById('review-area').style.display = 'none';
    }
}

function resetToSetup() {
    // app-areaのHTMLを復元（結果画面で上書きされている可能性がある）
    const appArea = document.getElementById('app-area');
    appArea.innerHTML = appAreaOriginalHTML;
    appArea.style.display = 'none';
    document.getElementById('setup-area').style.display = 'block';

    // 読み込み済みファイル名を表示
    if (loadedFileName) {
        const indicator = document.getElementById('loaded-file-indicator');
        if (indicator) {
            indicator.textContent = `✅ 読み込み済み: ${loadedFileName}（${allQuestions.length}問）`;
            indicator.style.display = 'block';
        }
    }

    // 間違えた問題の表示を更新
    if (mistakes.length > 0) {
        document.getElementById('review-area').style.display = 'block';
        document.getElementById('review-btn').textContent = `間違えた問題に再挑戦する (${mistakes.length}問)`;
    }
}

// CSVのパース処理（ダブルクォーテーション内のカンマ対応）
function parseCSV(text) {
    const rows = [];
    let curRow = [];
    let curCell = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        const nextC = text[i + 1];
        if (c === '"' && inQuotes && nextC === '"') {
            curCell += '"'; i++;
        } else if (c === '"') {
            inQuotes = !inQuotes;
        } else if (c === ',' && !inQuotes) {
            curRow.push(curCell);
            curCell = '';
        } else if ((c === '\n' || c === '\r') && !inQuotes) {
            if (c === '\r' && nextC === '\n') i++;
            curRow.push(curCell);
            if (curRow.length > 1) rows.push(curRow);
            curRow = [];
            curCell = '';
        } else {
            curCell += c;
        }
    }
    if (curCell !== '' || curRow.length > 0) {
        curRow.push(curCell);
        rows.push(curRow);
    }
    return rows;
}

// 配列をシャッフル（ランダム化）
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function startQuiz() {
    const fileInput = document.getElementById('csv-file');
    const errorMsg = document.getElementById('setup-error');
    const selectedLevel = document.getElementById('level-select').value;
    const selectedFormat = document.getElementById('format-select').value;
    const tagSelectVal = document.getElementById('tag-select').value.trim().toLowerCase();
    const filterTags = tagSelectVal ? [tagSelectVal] : [];

    // CSVが既に読み込まれていて、新しいファイルが選択されていない場合は再利用
    if (!fileInput.files.length && allQuestions.length === 0) {
        errorMsg.textContent = "CSVファイルを選択してください。";
        errorMsg.style.display = 'inline-block';
        return;
    }

    // 新しいファイルが選択されていない場合は既存データでクイズ開始
    if (!fileInput.files.length && allQuestions.length > 0) {
        startQuizWithQuestions(selectedLevel, selectedFormat, filterTags);
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = function (e) {
        const text = e.target.result;
        const rows = parseCSV(text);

        allQuestions = [];
        // 1行目はヘッダーとみなし、2行目から処理
        for (let i = 1; i < rows.length; i++) {
            const r = rows[i];
            // 列数が足りない行はスキップ
            if (r.length < 7) continue;
            allQuestions.push({
                id: r[0],
                category: r[1],
                level: r[2],
                format: r[3],
                text: r[4],
                answer: r[5],
                explanation: r[6],
                tags: r[8] || ""
            });
        }

        loadedFileName = file.name;
        startQuizWithQuestions(selectedLevel, selectedFormat, filterTags);
    };

    reader.onerror = function () {
        errorMsg.textContent = "ファイルの読み込みに失敗しました。";
        errorMsg.style.display = 'inline-block';
    };

    reader.readAsText(file);
}

function startQuizWithQuestions(selectedLevel, selectedFormat, filterTags) {
    const errorMsg = document.getElementById('setup-error');

    // レベルと形式で絞り込み
    currentQuestions = allQuestions.filter(q => {
        const levelMatch = selectedLevel === "all" || q.level === selectedLevel;
        const formatMatch = selectedFormat === "all" || q.format === selectedFormat;
        let tagMatch = true;
        if (filterTags.length > 0) {
            const lowerQTags = q.tags.toLowerCase();
            tagMatch = filterTags.every(t => lowerQTags.includes(t));
        }
        return levelMatch && formatMatch && tagMatch;
    });

    if (currentQuestions.length === 0) {
        errorMsg.textContent = "該当するレベルの問題がありません。";
        errorMsg.style.display = 'inline-block';
        return;
    }

    // ランダムに並べ替え
    shuffleArray(currentQuestions);

    // 出題数を絞る
    const countInputVal = document.getElementById('count-input').value;
    if (countInputVal.trim() !== "") {
        const count = parseInt(countInputVal, 10);
        if (!isNaN(count) && count > 0) {
            currentQuestions = currentQuestions.slice(0, count);
        }
    }

    document.getElementById('setup-area').style.display = 'none';
    document.getElementById('app-area').style.display = 'block';

    currentIndex = 0;
    correctCount = 0;
    isReviewMode = false;
    displayQuestion();
}

function displayQuestion() {
    const q = currentQuestions[currentIndex];

    document.getElementById('progress').textContent = `問題 ${currentIndex + 1} / ${currentQuestions.length}`;
    document.getElementById('format-badge').textContent = q.format;
    document.getElementById('level-badge').textContent = `レベル ${q.level}`;
    document.getElementById('result-message').textContent = '';
    document.getElementById('explanation-area').style.display = 'none';
    const checkBtn = document.getElementById('check-btn');
    checkBtn.textContent = "解答する";
    checkBtn.style.display = 'inline-block';
    document.getElementById('next-btn').style.display = 'none';

    const qTextEl = document.getElementById('question-text');
    const inputArea = document.getElementById('input-area');
    inputArea.innerHTML = '';

    if (q.format === "選択問題") {
        qTextEl.textContent = q.text;
        const match = q.text.match(/\(\s*(.*?)\s*\)/);
        if (match) {
            const options = match[1].split('/').map(s => s.trim());
            options.forEach(opt => {
                const label = document.createElement('label');
                label.className = 'option-label';
                label.innerHTML = `<input type="radio" name="answer" value="${opt}"> ${opt}`;
                inputArea.appendChild(label);
            });
        }
    } else if (q.format === "穴埋め" || q.format === "英単語") {
        const parts = q.text.split('( )');
        qTextEl.innerHTML = parts.join('<input type="text" class="text-answer inline-input" autocomplete="off">');
    } else if (q.format === "日本語訳") {
        qTextEl.textContent = q.text;
        document.getElementById('check-btn').textContent = "答えを見る";
        // 入力欄は不要
    } else {
        qTextEl.textContent = q.text;
        const input = document.createElement('input');
        input.type = 'text';
        input.id = 'text-answer';
        input.className = 'text-input';
        input.placeholder = 'ここに解答を入力...';
        input.autocomplete = 'off';
        inputArea.appendChild(input);
    }

    // 入力欄があれば自動でフォーカスを当てる
    setTimeout(() => {
        const firstInput = document.querySelector('input[type="text"]');
        if (firstInput) firstInput.focus();
    }, 10);
}

// 記号類をすべて無視し、全角半角の違いも吸収する強力なサニタイズ
function sanitize(str) {
    if (!str) return "";
    return str.replace(/[Ａ-Ｚａ-ｚ０-９]/g, function (s) {
        return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
    })
        .toLowerCase()
        // アポストロフィやあらゆる記号を削除して純粋な文字比較にする
        .replace(/[\.\?\,!！\-・‘’´`"“”]/g, '')
        .replace(/　/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function checkAnswer() {
    const q = currentQuestions[currentIndex];
    let userAnswer = "";

    if (q.format === "選択問題") {
        const selected = document.querySelector('input[name="answer"]:checked');
        userAnswer = selected ? selected.value : "";
    } else if (q.format === "穴埋め" || q.format === "英単語") {
        const inputs = document.querySelectorAll('.text-answer');
        let answers = [];
        inputs.forEach(input => {
            if (input.value.trim() !== "") answers.push(input.value.trim());
        });
        userAnswer = answers.join(' ');
    } else {
        const inputEl = document.getElementById('text-answer');
        userAnswer = inputEl ? inputEl.value : "";
    }

    // --- 正解判定 ---
    const cleanUser = sanitize(userAnswer);
    const cleanCorrect = sanitize(q.answer);
    const isCorrect = (cleanUser === cleanCorrect);

    // --- 表示・音声用の正解テキスト作成 ---
    const choiceRegex = /\([^)ぁ-んァ-ン一-龥]*?\/[^)ぁ-んァ-ン一-龥]*?\)/g;
    const blankCount = (q.text.match(/\(\s*\)/g) || []).length;
    const answerWords = q.answer.split(/\s+/);

    function replaceBlanksByWord(text, replaceFn) {
        if (blankCount <= 1) return text.replace(/\(\s*\)/g, replaceFn(q.answer));
        let wordIdx = 0;
        return text.replace(/\(\s*\)/g, () => {
            const word = wordIdx < answerWords.length ? answerWords[wordIdx] : '';
            wordIdx++;
            return replaceFn(word);
        });
    }

    let englishText = "";
    let answerSentenceHtml = "";

    // 正解表示を「書き換え・補完」ではなく「直接表示」にする形式の判定
    const usePlainAnswerDisplay = ["和文英訳", "誤文訂正", "書き換え", "Q&A作成"].includes(q.format);

    if (usePlainAnswerDisplay) {
        englishText = q.answer;
        answerSentenceHtml = `<span class="highlight-answer">${q.answer}</span>`;
    } else {
        englishText = q.text.replace(choiceRegex, q.answer);
        englishText = replaceBlanksByWord(englishText, w => w);
        englishText = englishText.replace(/\[\s*.*?\s*\]/g, q.answer);
        englishText = englishText.replace(/\([^)]*[ぁ-んァ-ン一-龥]+[^)]*\)/g, '').trim();
        if (!englishText || englishText.length < 2) englishText = q.answer;

        answerSentenceHtml = q.text.replace(choiceRegex, `<span class="highlight-answer">${q.answer}</span>`);
        answerSentenceHtml = replaceBlanksByWord(answerSentenceHtml, w => `<span class="highlight-answer">${w}</span>`);
        answerSentenceHtml = answerSentenceHtml.replace(/\[\s*.*?\s*\]/g, `<span class="highlight-answer">${q.answer}</span>`);
        answerSentenceHtml = answerSentenceHtml.replace(/\([^)]*[ぁ-んァ-ン一-龥]+[^)]*\)/g, '').trim();
        if (!answerSentenceHtml || answerSentenceHtml.length < 2) {
            answerSentenceHtml = `<span class="highlight-answer">${q.answer}</span>`;
        }
    }

    const resultMsg = document.getElementById('result-message');
    const expArea = document.getElementById('explanation-area');

    if (q.format === "日本語訳") {
        // 日本語訳モードの場合は、判定をスキップして答えを表示
        resultMsg.innerHTML = `<div class="result-sentence">正解: <span class="highlight-answer">${q.answer}</span></div>`;
        
        // 音声ボタンと「後で確認」チェックボックスを表示
        const escapedText = englishText.replace(/'/g, "\\'");
        const playBtnsHtml = `
            <div style="display: flex; gap: 10px; margin-top: 5px; flex-wrap: wrap;">
                <button onclick="playAudio('${escapedText}', 1.0)" class="play-audio-btn">🔊 普通 (1.0x)</button>
                <button onclick="playAudio('${escapedText}', 0.75)" class="play-audio-btn play-audio-btn-mid">🐢 ちょっとゆっくり (0.75x)</button>
                <button onclick="playAudio('${escapedText}', 0.5)" class="play-audio-btn play-audio-btn-slow">🐢 すごくゆっくり (0.5x)</button>
            </div>
        `;
        
        const reviewCheckHtml = `
            <div style="margin-top: 15px; padding: 10px; background: #222; border: 1px solid #444; border-radius: 8px; display: flex; align-items: center; gap: 10px;">
                <input type="checkbox" id="later-check" style="width: 20px; height: 20px; cursor: pointer;">
                <label for="later-check" style="cursor: pointer; font-weight: bold; color: #ffeb3b;">後で確認（チェックを入れると不正解扱い）</label>
            </div>
        `;

        expArea.innerHTML = `<strong style="font-size: 1.1em; color: #ffeb3b;">解説:</strong><br><div style="margin-top: 5px; margin-bottom: 5px;">${q.explanation || q.exp || "解説はありません。"}</div>${playBtnsHtml}${reviewCheckHtml}`;
        expArea.style.display = 'block';
        document.getElementById('check-btn').style.display = 'none';
        document.getElementById('next-btn').style.display = 'inline-block';
        return;
    }

    if (isCorrect) {
        correctCount++;
        resultMsg.innerHTML = `<div class="result-correct">⭕ 正解！</div>`;
        mistakes = mistakes.filter(m => m.id !== q.id);
    } else {
        resultMsg.innerHTML = `
            <div class="result-incorrect">❌ 不正解</div>
            <div class="result-sentence">正解: ${answerSentenceHtml}</div>
        `;
        if (!mistakes.some(m => m.id === q.id)) mistakes.push(q);
    }
    localStorage.setItem('english_quiz_mistakes', JSON.stringify(mistakes));
    document.getElementById('next-btn').style.display = 'inline-block';

    // 解説と音声ボタン
    const escapedText = englishText.replace(/'/g, "\\'");
    const playBtnsHtml = `
        <div style="display: flex; gap: 10px; margin-top: 5px; flex-wrap: wrap;">
            <button onclick="playAudio('${escapedText}', 1.0)" class="play-audio-btn">🔊 普通 (1.0x)</button>
            <button onclick="playAudio('${escapedText}', 0.75)" class="play-audio-btn play-audio-btn-mid">🐢 ちょっとゆっくり (0.75x)</button>
            <button onclick="playAudio('${escapedText}', 0.5)" class="play-audio-btn play-audio-btn-slow">🐢 すごくゆっくり (0.5x)</button>
        </div>
    `;

    expArea.innerHTML = `<strong style="font-size: 1.1em; color: #ffeb3b;">解説:</strong><br><div style="margin-top: 5px; margin-bottom: 5px;">${q.explanation || q.exp || "解説はありません。"}</div>${playBtnsHtml}`;
    expArea.style.display = 'block';
    document.getElementById('check-btn').style.display = 'none';
}

function getRankData(accuracy) {
    const ranks = {
        S: {
            rank: 'S', className: 'rank-s', emoji: '🏆', commentColor: '#ffd700',
            comments: [
                "Flawless! You're a genius!",
                "Perfect score! Absolutely incredible!",
                "100%! Nothing can stop you!"
            ]
        },
        A: {
            rank: 'A', className: 'rank-a', emoji: '💪', commentColor: '#00e5ff',
            comments: [
                "Awesome work! Keep it up!",
                "So close to perfection! Amazing!",
                "You're on fire! Great job!"
            ]
        },
        B: {
            rank: 'B', className: 'rank-b', emoji: '😊', commentColor: '#00e676',
            comments: [
                "Nice job! You're getting there!",
                "Good effort! Almost there!",
                "Well done! A little more practice!"
            ]
        },
        C: {
            rank: 'C', className: 'rank-c', emoji: '📚', commentColor: '#ffbb00',
            comments: [
                "Not bad! Keep studying!",
                "You can do better! Don't give up!",
                "Room to grow! Stay focused!"
            ]
        },
        D: {
            rank: 'D', className: 'rank-d', emoji: '🔥', commentColor: '#ff5577',
            comments: [
                "Review and try again! You got this!",
                "Don't worry, practice makes perfect!",
                "Every mistake is a lesson! Keep going!"
            ]
        },
        E: {
            rank: 'E', className: 'rank-e', emoji: '💡', commentColor: '#aaa',
            comments: [
                "This is where it all begins!",
                "The journey of a thousand miles starts here!",
                "Never give up! You'll get there!"
            ]
        }
    };

    if (accuracy === 100) return ranks.S;
    if (accuracy >= 80) return ranks.A;
    if (accuracy >= 60) return ranks.B;
    if (accuracy >= 40) return ranks.C;
    if (accuracy >= 20) return ranks.D;
    return ranks.E;
}

function nextQuestion() {
    // 現在の問題の評価を確定させる（日本語訳モードなどの後判定用）
    const q = currentQuestions[currentIndex];
    if (q.format === "日本語訳") {
        const laterCheck = document.getElementById('later-check');
        if (laterCheck && laterCheck.checked) {
            // チェックが入っていれば不正解扱い
            if (!mistakes.some(m => m.id === q.id)) mistakes.push(q);
        } else {
            // チェックがなければ正解扱い
            correctCount++;
            mistakes = mistakes.filter(m => m.id !== q.id);
        }
        localStorage.setItem('english_quiz_mistakes', JSON.stringify(mistakes));
    }

    currentIndex++;
    if (currentIndex < currentQuestions.length) {
        displayQuestion();
    } else {
        const accuracy = Math.round((correctCount / currentQuestions.length) * 100) || 0;

        // ランク判定（S～E）
        const rankData = getRankData(accuracy);
        const comment = rankData.comments[Math.floor(Math.random() * rankData.comments.length)];

        const resultHtml = `
            <h3 style="text-align: center; font-size: 24px;">全ての問題が終了しました！</h3>
            <div style="text-align: center; margin: 30px 0;">
                <div style="font-size: 18px; color: #ddd;">あなたの正答率</div>
                <div style="font-size: 36px; font-weight: bold; color: #00e5ff; margin-bottom: 20px;">${accuracy}% <span style="font-size: 20px; color: #fff;">(${correctCount}/${currentQuestions.length}問)</span></div>
                
                <div style="font-size: 24px; color: #ddd; margin-bottom: 10px;">ランク</div>
                <div class="rank-badge ${rankData.className}">${rankData.rank}</div>
                <div class="rank-comment" style="color: ${rankData.commentColor};">${rankData.emoji} ${comment}</div>
                <div style="margin-top: 20px; font-size: 16px; color: #aaa;">お疲れさまでした！🎉</div>
            </div>
            <div style="text-align: center; margin-top: 40px;">
                <button onclick='resetToSetup()' class='secondary-btn' style='font-size: 20px; padding: 15px 40px; box-shadow: 6px 6px 0px #ffeb3b;'>最初に戻る</button>
            </div>
        `;
        document.getElementById('app-area').innerHTML = resultHtml;
    }
}

// Enterキーで「解答する」および「次の問題へ」を実行するショートカット
document.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
        // ボタンにフォーカスがある場合は、ブラウザ標準のクリック動作と重複させない
        if (document.activeElement.tagName === 'BUTTON') return;

        const appArea = document.getElementById('app-area');
        if (appArea && appArea.style.display !== 'none') {
            const checkBtn = document.getElementById('check-btn');
            const nextBtn = document.getElementById('next-btn');

            if (checkBtn && checkBtn.style.display !== 'none') {
                checkAnswer();
            } else if (nextBtn && nextBtn.style.display !== 'none') {
                nextQuestion();
            }
        }
    }
});

// --- 音声読み上げ機能 (Web Speech API) ---
function playAudio(text, rate = 1.0) {
    if (!('speechSynthesis' in window)) {
        alert("お使いのブラウザは音声読み上げに対応していません。");
        return;
    }

    // 再生中の音声をキャンセル
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = rate;

    // 可能であればネイティブに近くて自然なオンライン音声を探す
    const voices = window.speechSynthesis.getVoices();
    const onlineVoice = voices.find(v => v.lang === 'en-US' && (v.name.includes('Online') || v.name.includes('Google')));
    if (onlineVoice) {
        utterance.voice = onlineVoice;
    }

    window.speechSynthesis.speak(utterance);
}

// 初回発音の遅延を防ぐために、あらかじめvoiceのリストを読み込んでおく
if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
    };
}
