import { useState, useEffect } from 'react';
import './index.css';

type Question = {
    id: string;
    text: string;
    options: {
        A: string;
        B: string;
        C: string;
        D: string;
    }
};

function App() {
    const [step, setStep] = useState<'login' | 'loading' | 'playing' | 'submitting' | 'result'>('login');
    const [userId, setUserId] = useState('');
    const [questions, setQuestions] = useState<Question[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [result, setResult] = useState<{ score: number; passed: boolean } | null>(null);

    // Environment Variables
    const GAS_URL = import.meta.env.VITE_GOOGLE_APP_SCRIPT_URL || '';
    const PASS_THRESHOLD = parseInt(import.meta.env.VITE_PASS_THRESHOLD || '3', 10);
    const QUESTION_COUNT = parseInt(import.meta.env.VITE_QUESTION_COUNT || '5', 10);

    // Preload Boss Images
    const [bossSeeds, setBossSeeds] = useState<string[]>([]);
    useEffect(() => {
        // 預先產生 100 個不同的素材 seed
        const seeds = Array.from({ length: 100 }, (_, i) => `boss_v2_${Math.random().toString(36).substring(2, 9)}_${i}`);
        setBossSeeds(seeds);

        // 預載入前幾關的圖片
        seeds.slice(0, QUESTION_COUNT).forEach(seed => {
            const img = new Image();
            img.src = `https://api.dicebear.com/8.x/pixel-art/svg?seed=${seed}`;
        });
    }, [QUESTION_COUNT]);

    const handleStart = async () => {
        if (!userId.trim()) return;
        if (!GAS_URL || GAS_URL === 'YOUR_GAS_URL_HERE' || !GAS_URL.startsWith('http')) {
            alert('請先在 .env 中設定有效的 VITE_GOOGLE_APP_SCRIPT_URL 環境變數！');
            return;
        }
        setStep('loading');

        try {
            // Fetch random N questions from GAS
            const resp = await fetch(`${GAS_URL}?count=${QUESTION_COUNT}`, { method: 'GET' });
            const data = await resp.json();
            setQuestions(data);
            setStep('playing');
        } catch (e) {
            console.error(e);
            alert('讀取題目失敗，請確認開發環境的 GAS 連結與網路狀態');
            setStep('login');
        }
    };

    const handleAnswer = (opt: string) => {
        const q = questions[currentIndex];
        const newAnswers = { ...answers, [q.id]: opt };
        setAnswers(newAnswers);

        if (currentIndex < questions.length - 1) {
            // 加一點延遲讓玩家看到自己點擊的選項
            setTimeout(() => setCurrentIndex(prev => prev + 1), 300);
        } else {
            // 答完最後一題直接送出
            handleSubmit(newAnswers);
        }
    };

    const handleSubmit = async (submitAnswers: Record<string, string>) => {
        setStep('submitting');
        try {
            const payload = {
                id: userId,
                answers: submitAnswers,
                passThreshold: PASS_THRESHOLD
            };

            // 使用 text/plain 避免 CORS Preflight issues (GAS 限制)
            const resp = await fetch(GAS_URL, {
                method: 'POST',
                body: JSON.stringify(payload),
                headers: { 'Content-Type': 'text/plain;charset=utf-8' }
            });
            const data = await resp.json();
            setResult(data);
            setStep('result');
        } catch (e) {
            console.error(e);
            alert('提交失敗，請再試一次');
            // 可以提供重新提交的機會
            setStep('playing');
        }
    };

    if (step === 'login') {
        return (
            <div className="panel">
                <h1>Pixel Quest</h1>
                <div className="boss-container">
                    <img className="boss-img" src={`https://api.dicebear.com/8.x/pixel-art/svg?seed=hero_start`} alt="Hero" />
                </div>
                <div className="input-container">
                    <input
                        type="text"
                        placeholder="請輸入您的 ID"
                        value={userId}
                        onChange={(e) => setUserId(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleStart()}
                    />
                    <button onClick={handleStart} disabled={!userId.trim()}>
                        Start Game
                    </button>
                </div>
            </div>
        );
    }

    if (step === 'loading' || step === 'submitting') {
        return (
            <div className="panel loader">
                <div className="boss-container">
                    <img className="boss-img blink" src={`https://api.dicebear.com/8.x/pixel-art/svg?seed=loading_wizard`} alt="Loading" />
                </div>
                <h2 className="blink">{step === 'loading' ? 'Loading Quest...' : 'Calculating Score...'}</h2>
            </div>
        );
    }

    if (step === 'playing') {
        const q = questions[currentIndex];
        const bossSeed = bossSeeds[currentIndex] || `fallback_${currentIndex}`;
        const bossImg = `https://api.dicebear.com/8.x/pixel-art/svg?seed=${bossSeed}`;

        return (
            <div className="panel">
                <h3>Stage {currentIndex + 1} / {questions.length}</h3>
                <div className="boss-container">
                    <img src={bossImg} alt="Boss" className="boss-img" />
                </div>
                <h2>{q.text}</h2>
                <div className="options-grid">
                    {Object.entries(q.options).map(([key, val]) => (
                        <button
                            key={key}
                            className={`option-btn ${answers[q.id] === key ? 'selected' : ''}`}
                            onClick={() => handleAnswer(key)}
                        >
                            {key}. {val}
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    if (step === 'result' && result) {
        return (
            <div className="panel">
                <h1>Quest Complete!</h1>
                <div className="boss-container">
                    {/* 勝負決定不同圖片 */}
                    <img
                        className="boss-img"
                        src={`https://api.dicebear.com/8.x/pixel-art/svg?seed=${result.passed ? 'win_king' : 'lose_skull'}`}
                        alt="Result Boss"
                    />
                </div>
                <h2 className={`status-text ${result.passed ? 'passed-text' : 'failed-text'}`}>
                    {result.passed ? 'MISSION CLEARED' : 'MISSION FAILED'}
                </h2>
                <h3>Your Score</h3>
                <div className="score-display">{result.score}</div>
                <div className="input-container">
                    <button onClick={() => {
                        setStep('login');
                        setAnswers({});
                        setCurrentIndex(0);
                        setResult(null);
                    }}>
                        Play Again
                    </button>
                </div>
            </div>
        );
    }

    return null;
}

export default App;
