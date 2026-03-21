let allQuestions = [];
let currentQuestions = [];
let currentIndex = 0;
let correctCount = 0;
let mistakes = [];
let isReviewMode = false;

window.addEventListener('DOMContentLoaded', () => {
    const savedMistakes = localStorage.getItem('english_quiz_mistakes');
    if (savedMistakes) {
        mistakes = JSON.parse(savedMistakes);
        if (mistakes.length > 0) {
            document.getElementById('review-area').style.display = 'block';
            document.getElementById('review-btn').textContent = `間違えた問題に再挑戦する (${mistakes.length}問)`;
        }
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

    if (!fileInput.files.length) {
        errorMsg.textContent = "CSVファイルを選択してください。";
        errorMsg.style.display = 'inline-block';
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = function(e) {
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
                exp: r[6]
            });
        }

        // レベルと形式で絞り込み
        currentQuestions = allQuestions.filter(q => {
            const levelMatch = selectedLevel === "all" || q.level === selectedLevel;
            const formatMatch = selectedFormat === "all" || q.format === selectedFormat;
            return levelMatch && formatMatch;
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
    };

    reader.onerror = function() {
        errorMsg.textContent = "ファイルの読み込みに失敗しました。";
        errorMsg.style.display = 'inline-block';
    };

    reader.readAsText(file);
}

function displayQuestion() {
    const q = currentQuestions[currentIndex];
    
    document.getElementById('progress').textContent = `問題 ${currentIndex + 1} / ${currentQuestions.length}`;
    document.getElementById('format-badge').textContent = q.format;
    document.getElementById('level-badge').textContent = `レベル ${q.level}`;
    document.getElementById('result-message').textContent = '';
    document.getElementById('explanation-area').style.display = 'none';
    document.getElementById('check-btn').style.display = 'inline-block';
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
    } else if (q.format === "並べ替え") {
        qTextEl.textContent = "次の語句を正しい順序に並べてください。";
        const match = q.text.match(/\[\s*(.*?)\s*\]/);
        if (match) {
            const words = match[1].split('/').map(s => s.trim()).filter(s => s);
            
            const answerArea = document.createElement('div');
            answerArea.className = 'answer-area';
            answerArea.id = 'sort-answer-area';
            
            const wordBank = document.createElement('div');
            wordBank.id = 'sort-word-bank';
            
            words.forEach(word => {
                const chip = document.createElement('span');
                chip.className = 'word-chip';
                chip.textContent = word;
                chip.onclick = function() {
                    if (this.parentElement.id === 'sort-word-bank') {
                        answerArea.appendChild(this);
                    } else {
                        wordBank.appendChild(this);
                    }
                };
                wordBank.appendChild(chip);
            });
            
            inputArea.appendChild(answerArea);
            inputArea.appendChild(wordBank);
        }
    } else if (q.format === "穴埋め") {
        const parts = q.text.split('( )');
        // IDの重複バグを修正（classで指定するように変更）
        qTextEl.innerHTML = parts.join('<input type="text" class="text-answer inline-input" autocomplete="off">');
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
    return str.replace(/[Ａ-Ｚａ-ｚ０-９]/g, function(s) {
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
    } else if (q.format === "並べ替え") {
        const chips = document.getElementById('sort-answer-area').children;
        userAnswer = Array.from(chips).map(c => c.textContent).join(' ');
    } else if (q.format === "穴埋め") {
        // 複数の穴埋め枠があるバグを修正（すべての枠の文字を結合して比較）
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

    const cleanUser = sanitize(userAnswer);
    const cleanCorrect = sanitize(q.answer);
    
    // 穴埋め問題で「文全体」を入力してしまった場合も正解扱いにする救済処理
    let isCorrect = (cleanUser === cleanCorrect);
    if (!isCorrect && q.format === "穴埋め" && cleanUser.includes(cleanCorrect) && cleanUser.length > cleanCorrect.length) {
        // ユーザーの入力内容の中に、正解の単語が含まれていればOKとする
        isCorrect = true; 
    }

    const resultMsg = document.getElementById('result-message');
    
    if (isCorrect) {
        correctCount++;
        resultMsg.textContent = "⭕ 正解！";
        resultMsg.style.color = "#00e5ff"; // ネオンシアン
        
        // 正解した場合はミスリストから除外して保存
        mistakes = mistakes.filter(m => m.id !== q.id);
        localStorage.setItem('english_quiz_mistakes', JSON.stringify(mistakes));
    } else {
        resultMsg.textContent = `❌ 不正解... (正解: ${q.answer})`;
        resultMsg.style.color = "#ff0055"; // ホットピンク
        
        // 不正解の場合はミスリストに追加（重複しないように）
        if (!mistakes.some(m => m.id === q.id)) {
            mistakes.push(q);
            localStorage.setItem('english_quiz_mistakes', JSON.stringify(mistakes));
        }
    }

    const expArea = document.getElementById('explanation-area');
    expArea.innerHTML = `<strong>解説:</strong><br>${q.exp}`;
    expArea.style.display = 'block';

    document.getElementById('check-btn').style.display = 'none';
    document.getElementById('next-btn').style.display = 'inline-block';
}

function nextQuestion() {
    currentIndex++;
    if (currentIndex < currentQuestions.length) {
        displayQuestion();
    } else {
        const accuracy = Math.round((correctCount / currentQuestions.length) * 100) || 0;
        let rank = 'C';
        let rankClass = 'rank-c';
        if (accuracy === 100) { rank = 'S'; rankClass = 'rank-s'; }
        else if (accuracy >= 80) { rank = 'A'; rankClass = 'rank-a'; }
        else if (accuracy >= 60) { rank = 'B'; rankClass = 'rank-b'; }

        const resultHtml = `
            <h3 style="text-align: center; font-size: 24px;">全ての問題が終了しました！</h3>
            <div style="text-align: center; margin: 30px 0;">
                <div style="font-size: 18px; color: #ddd;">あなたの正答率</div>
                <div style="font-size: 36px; font-weight: bold; color: #00e5ff; margin-bottom: 20px;">${accuracy}% <span style="font-size: 20px; color: #fff;">(${correctCount}/${currentQuestions.length}問)</span></div>
                
                <div style="font-size: 24px; color: #ddd; margin-bottom: 10px;">ランク</div>
                <div class="${rankClass}" style="font-size: 120px; font-weight: bold; line-height: 1; margin: 0 auto; display: inline-block; padding: 10px 40px; border: 4px solid currentColor; border-radius: 20px; text-shadow: none; box-shadow: 6px 6px 0px currentColor;">${rank}</div>
            </div>
            <div style="text-align: center; margin-top: 40px;">
                <button onclick='location.reload()' class='secondary-btn' style='font-size: 20px; padding: 15px 40px; box-shadow: 6px 6px 0px #ffeb3b;'>最初に戻る</button>
            </div>
        `;
        document.getElementById('app-area').innerHTML = resultHtml;
    }
}

// Enterキーで「解答する」および「次の問題へ」を実行するショートカット
document.addEventListener('keydown', function(event) {
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