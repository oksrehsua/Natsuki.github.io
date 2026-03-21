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

    // CSVファイル選択時にタグのプルダウンを更新する
    const csvFileInput = document.getElementById('csv-file');
    if (csvFileInput) {
        csvFileInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(evt) {
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
                    const sortedLevels = Array.from(levelSet).sort((a,b) => {
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
                exp: r[6],
                tags: r[8] || ""
            });
        }

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
    } else if (q.format === "穴埋め" || q.format === "英単語") {
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
    } else if (q.format === "穴埋め" || q.format === "英単語") {
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
    if (!isCorrect && (q.format === "穴埋め" || q.format === "英単語") && cleanUser.includes(cleanCorrect) && cleanUser.length > cleanCorrect.length) {
        // ユーザーの入力内容の中に、正解の単語が含まれていればOKとする
        isCorrect = true; 
    }

    // --- 表示・音声用の正解テキスト作成 ---
    // ( A / B ) のような選択形式のカッコも正解で置換できるように正規表現を強化
    // 日本語を含まない「スラッシュ入りのカッコ」を対象にする
    const choiceRegex = /\([^)ぁ-んァ-ン一-龥]*?\/[^)ぁ-んァ-ン一-龥]*?\)/g;

    // 複数の穴埋め枠がある場合、正解を単語ごとに分割して各枠に割り当てる
    const blankCount = (q.text.match(/\(\s*\)/g) || []).length;
    const answerWords = q.answer.split(/\s+/);

    // 穴埋め枠を1つずつ置換するヘルパー関数
    function replaceBlanksByWord(text, replaceFn) {
        if (blankCount <= 1) {
            return text.replace(/\(\s*\)/g, replaceFn(q.answer));
        }
        let wordIdx = 0;
        return text.replace(/\(\s*\)/g, () => {
            const word = wordIdx < answerWords.length ? answerWords[wordIdx] : '';
            wordIdx++;
            return replaceFn(word);
        });
    }

    // 音声読み上げ用（タグなし純粋なテキスト）
    let englishText = q.text.replace(choiceRegex, q.answer);
    englishText = replaceBlanksByWord(englishText, w => w);
    englishText = englishText.replace(/\[\s*.*?\s*\]/g, q.answer);
    englishText = englishText.replace(/\([^)]*[ぁ-んァ-ン一-龥]+[^)]*\)/g, '').trim();
    if (!englishText || englishText.length < 2) englishText = q.answer;

    // 画面表示用（正解部分を赤字にしたHTML）
    let answerSentenceHtml = q.text.replace(choiceRegex, `<span class="highlight-answer">${q.answer}</span>`);
    answerSentenceHtml = replaceBlanksByWord(answerSentenceHtml, w => `<span class="highlight-answer">${w}</span>`);
    answerSentenceHtml = answerSentenceHtml.replace(/\[\s*.*?\s*\]/g, `<span class="highlight-answer">${q.answer}</span>`);
    answerSentenceHtml = answerSentenceHtml.replace(/\([^)]*[ぁ-んァ-ン一-龥]+[^)]*\)/g, '').trim();
    if (!answerSentenceHtml || answerSentenceHtml.length < 2) {
        answerSentenceHtml = `<span class="highlight-answer">${q.answer}</span>`;
    }

    const resultMsg = document.getElementById('result-message');
    
    if (isCorrect) {
        correctCount++;
        resultMsg.innerHTML = `<div class="result-correct">⭕ 正解！</div>`;
        
        // 正解した場合はミスリストから除外して保存
        mistakes = mistakes.filter(m => m.id !== q.id);
        localStorage.setItem('english_quiz_mistakes', JSON.stringify(mistakes));
    } else {
        resultMsg.innerHTML = `
            <div class="result-incorrect">❌ 不正解</div>
            <div class="result-sentence">正解: ${answerSentenceHtml}</div>
        `;
        
        // 不正解の場合はミスリストに追加（重複しないように）
        if (!mistakes.some(m => m.id === q.id)) {
            mistakes.push(q);
            localStorage.setItem('english_quiz_mistakes', JSON.stringify(mistakes));
        }
    }

    const expArea = document.getElementById('explanation-area');
    
    // シングルクォートなどがJS文字列内でエラーにならないようにエスケープ
    const escapedText = englishText.replace(/'/g, "\\'");
    
    const playBtnsHtml = `
        <div style="display: flex; gap: 10px; margin-top: 5px; flex-wrap: wrap;">
            <button onclick="playAudio('${escapedText}', 1.0)" class="play-audio-btn">🔊 普通 (1.0x)</button>
            <button onclick="playAudio('${escapedText}', 0.75)" class="play-audio-btn play-audio-btn-mid">🐢 ちょっとゆっくり (0.75x)</button>
            <button onclick="playAudio('${escapedText}', 0.5)" class="play-audio-btn play-audio-btn-slow">🐢 すごくゆっくり (0.5x)</button>
        </div>
    `;

    expArea.innerHTML = `<strong style="font-size: 1.1em; color: #ffeb3b;">解説:</strong><br><div style="margin-top: 5px; margin-bottom: 5px;">${q.exp}</div>${playBtnsHtml}`;
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