let allQuestions = [];
let currentQuestions = [];
let currentIndex = 0;

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
            return;
        }

        // ランダムに並べ替え
        shuffleArray(currentQuestions);

        document.getElementById('setup-area').style.display = 'none';
        document.getElementById('app-area').style.display = 'block';
        
        currentIndex = 0;
        displayQuestion();
    };

    reader.onerror = function() {
        errorMsg.textContent = "ファイルの読み込みに失敗しました。";
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
        resultMsg.textContent = "⭕ 正解！";
        resultMsg.style.color = "#28a745";
    } else {
        resultMsg.textContent = `❌ 不正解... (正解: ${q.answer})`;
        resultMsg.style.color = "#dc3545";
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
        document.getElementById('app-area').innerHTML = "<h3>全ての問題が終了しました！お疲れ様でした。</h3><button onclick='location.reload()' class='secondary-btn' style='margin-top: 20px;'>ファイル選択に戻る</button>";
    }
}