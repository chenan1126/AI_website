import { useState, useEffect } from 'react'
import './App.css'
import TripResults from './components/TripResults'

// API URL - 使用相對路徑連接到 Vercel Serverless Functions
const API_URL = '/api';

function App() {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  const [serverRunning, setServerRunning] = useState(true);
  const [streamingStatus, setStreamingStatus] = useState('');

  // 檢查後端服務器狀態
  useEffect(() => {
    const checkServer = async () => {
      try {
        const response = await fetch(`${API_URL}/`);
        setServerRunning(response.ok);
      } catch (error) {
        setServerRunning(false);
        console.error('後端連接失敗:', error);
      }
    };

    checkServer();
    const interval = setInterval(checkServer, 30000);
    return () => clearInterval(interval);
  }, []);

  // 處理串流請求
  const handleStreamRequest = async (sessionId, question) => {
    return new Promise((resolve, reject) => {
      let weatherData = null;
      let startDate = null;
      let location = '';
      let days = 1;

      fetch(`${API_URL}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, question: question }),
      })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n\n');

            for (const line of lines) {
              if (!line.trim()) continue;

              const eventMatch = line.match(/^event: (.+)$/m);
              const dataMatch = line.match(/^data: (.+)$/m);

              if (eventMatch && dataMatch) {
                const eventType = eventMatch[1];
                const eventData = JSON.parse(dataMatch[1]);

                console.log(`[SSE Event] type: ${eventType}, data:`, eventData);

                if (eventType === 'debug_prompt') {
                  console.log("--- AI Prompt ---");
                  console.log(eventData.prompt);
                  console.log("-----------------");
                }
                else if (eventType === 'parsing_result') {
                  console.log("--- PARSING RESULT ---");
                  console.log(eventData.result);
                  console.log("----------------------");
                }
                else if (eventType === 'parsing' && eventData.data) {
                  location = eventData.data.location;
                  days = eventData.data.days;
                  startDate = eventData.data.dates[0];
                  setStreamingStatus(`正在規劃 ${location} ${days}天行程...`);
                }
                else if (eventType === 'weather') {
                  if (eventData.status === 'fetching') {
                    setStreamingStatus('正在獲取天氣資訊...');
                  } else if (eventData.data) {
                    weatherData = eventData.data;
                    setStreamingStatus('天氣資訊已獲取，正在生成行程...');
                  }
                }
                else if (eventType === 'generation') {
                  setStreamingStatus('AI 正在生成行程...');
                }
                else if (eventType === 'parsing_response') {
                  setStreamingStatus('正在解析 AI 回應...');
                }
                else if (eventType === 'maps') {
                  if (eventData.status === 'fetching') {
                    setStreamingStatus('正在查詢 Google Maps 資料...');
                  }
                }
                else if (eventType === 'result') {
                  setStreamingStatus('行程規劃完成！');
                  resolve({
                    ...eventData.data,
                    weather_data: weatherData,
                    start_date: startDate
                  });
                }
                else if (eventType === 'done') {
                  setStreamingStatus('處理完成！');
                  // 不再在這裡解析數據，因為 result 事件已經處理了
                }
                else if (eventType === 'error') {
                  console.error('串流錯誤:', eventData.message);
                  reject(new Error(eventData.message));
                }
              }
            }
          }
        })
        .catch((error) => {
          console.error('串流請求失敗:', error);
          setStreamingStatus('');
          reject(error);
        });
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (question.trim() === '') {
      setError('請輸入您的旅遊需求。');
      return;
    }

    setLoading(true);
    setError('');
    setResults(null);
    setStreamingStatus('正在處理您的請求...');

    const sessionId = 'session-' + Date.now();

    try {
      // 並行請求兩個行程版本（使用相同 sessionId）
      const streamPromises = [
        handleStreamRequest(sessionId, question),
        handleStreamRequest(sessionId, question),
      ];

      const apiResults = await Promise.all(streamPromises);

      console.log('API Results:', apiResults);

      // 過濾有效的結果
      const validResults = apiResults.filter(r => r !== null);

      if (validResults.length === 0) {
        setError('無法生成行程，請重試');
        setLoading(false);
        setStreamingStatus('');
        return;
      }

      const combinedResults = {
        itineraries: validResults,
        weather_data: validResults[0]?.weather_data || {},
        start_date: validResults[0]?.start_date || null,
      };

      console.log('Combined Results:', combinedResults);
      setResults(combinedResults);
      setStreamingStatus('');
    } catch (err) {
      console.error('請求失敗:', err);
      setError(`生成行程失敗：${err.message || '請稍後再試'}`);
      setStreamingStatus('');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setResults(null);
    setError('');
    setQuestion('');
    setStreamingStatus('');
  };

  return (
    <div className="container">
      <header>
        <div className="logo">
          <i className="fas fa-plane-departure"></i>
          <h1>AI 旅遊規劃助手</h1>
        </div>
      </header>

      {!serverRunning && (
        <div className="error">
          <i className="fas fa-exclamation-triangle"></i>
          <span>後端服務器未運行或無法訪問，請檢查連接。</span>
        </div>
      )}

      <div className="feature-card">
        <h2>
          <i className="fas fa-map-marked-alt"></i>
          規劃您的旅程
        </h2>
        <form onSubmit={handleSubmit}>
          <label>
            <i className="fas fa-question-circle"></i>
            您想去哪裡玩？
          </label>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="例如：明天去嘉義玩兩天，想吃美食和看風景"
            disabled={loading}
          />
          <div className="input-hint">
            <i className="fas fa-lightbulb"></i>
            <span>請描述您的旅遊需求，包括目的地、天數、興趣等</span>
          </div>

          <div style={{ marginTop: '24px' }}>
            <button type="submit" className="btn-primary" disabled={loading || !serverRunning}>
              <i className="fas fa-search"></i>
              {loading ? '規劃中...' : '開始規劃'}
            </button>
            {results && (
              <button type="button" className="btn-secondary" onClick={handleClear}>
                <i className="fas fa-redo"></i>
                重新規劃
              </button>
            )}
          </div>
        </form>

        {streamingStatus && (
          <div className="loading">
            <div className="loading-spinner"></div>
            <p>{streamingStatus}</p>
          </div>
        )}

        {error && (
          <div className="error">
            <i className="fas fa-exclamation-circle"></i>
            <span>{error}</span>
          </div>
        )}
      </div>

      {loading && !streamingStatus && (
        <div className="loading">
          <div className="loading-spinner"></div>
          <p>AI 正在為您規劃行程，請稍候...</p>
        </div>
      )}

      {results && !loading && <TripResults data={results} />}
    </div>
  );
}

export default App;
