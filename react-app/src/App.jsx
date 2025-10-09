import { useState, useEffect } from 'react'
import './App.css'
import TripResults from './components/TripResults'

// API URL - 從環境變量獲取，如果沒有則使用本地開發地址
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function App() {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  const [serverRunning, setServerRunning] = useState(true);

  const testData = {
    start_date: '2025-10-10',
    weather_data: [
      { temp: '25', condition: '晴天', icon: '☀️', max_temp: '28', min_temp: '22', rain_chance: '10%' },
      { temp: '26', condition: '多雲', icon: '☁️', max_temp: '29', min_temp: '23', rain_chance: '20%' }
    ],
    itineraries: [
      {
        title: '台北一日遊',
        recommendation_score: 4.5,
        playing_time_display: '8小時',
        travel_ratio_display: '20%',
        sections: [
          { location: '台北101', time: '09:00', day: 1, details: ['參觀觀景台', '拍照留念'], address: '信義區', rating: 4.5, user_ratings_total: 1234 },
          { location: '士林夜市', time: '18:00', day: 1, details: ['品嚐小吃', '逛街購物'], address: '士林區', rating: 4.2, user_ratings_total: 5678, route_to_next: { to: '士林夜市', distance: '5公里', duration: '15分鐘' } }
        ]
      },
      {
        title: '台中二日遊',
        recommendation_score: 4.2,
        playing_time_display: '12小時',
        travel_ratio_display: '15%',
        sections: [
          { location: '台中公園', time: '10:00', day: 1, details: ['散步', '賞花'], address: '西區', rating: 4.0, user_ratings_total: 890 },
          { location: '逢甲夜市', time: '19:00', day: 1, details: ['購物', '吃美食'], address: '西屯區', rating: 4.3, user_ratings_total: 3456, route_to_next: { to: '逢甲夜市', distance: '3公里', duration: '10分鐘' } },
          { location: '高美濕地', time: '09:00', day: 2, details: ['賞鳥', '生態導覽'], address: '清水區', rating: 4.6, user_ratings_total: 2345 }
        ]
      }
    ]
  };

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

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (question.trim() === '') {
      setError('請輸入您的旅遊需求。');
      return;
    }

    setLoading(true);
    setError('');
    setResults(null);

    const sessionId = 'session-' + Date.now();

    try {
      // 並行請求兩個行程
      const fetchPromises = [
        fetch(`${API_URL}/ask`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId + '-1',
            question: question,
          }),
        }).then((res) => res.json()),
        fetch(`${API_URL}/ask`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId + '-2',
            question: question,
          }),
        }).then((res) => res.json()),
      ];

      const apiResults = await Promise.all(fetchPromises);
      
      console.log('API Results:', apiResults);
      
      // 合併兩個行程到一個結果中
      const combinedResults = {
        itineraries: apiResults
          .filter(r => r.status === 'success' && r.data)
          .map((r, i) => {
            // 從 r.data 中提取行程數據
            const itinerary = r.data.itineraries?.[0] || r.data.itinerary || r.data;
            return {
              ...itinerary,
              title: itinerary.title || `行程方案 ${i + 1}`,
            };
          }),
        weather_data: apiResults[0]?.data?.weather_data || [],
        start_date: apiResults[0]?.data?.start_date || null, // 添加 start_date
      };

      console.log('Combined Results:', combinedResults);
      setResults(combinedResults);
    } catch (err) {
      setError('生成行程時發生錯誤，請稍後再試。');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <header>
        <div className="logo">
          <i className="fas fa-route"></i>
          <h1>AI旅遊行程規劃</h1>
        </div>
      </header>

      {!serverRunning && (
        <div className="error">後端服務器未運行或無法訪問</div>
      )}

      <div className="features-section">
        <div className="feature-card">
          <h2>
            <i className="fas fa-map-marked-alt"></i> 行程規劃
          </h2>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="naturalQueryInput">
                <i className="fas fa-edit"></i>
                請描述您的旅遊需求：
              </label>
              <div className="input-container">
                <textarea
                  id="naturalQueryInput"
                  rows="4"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder={`例如：這個週末想帶家人去阿里山看日出，大概玩三天\n\n您可以描述：\n• 目的地和景點偏好\n• 旅遊天數\n• 同行人數和特殊需求\n• 預算和交通方式`}
                />
                <div className="input-hint">
                  <i className="fas fa-lightbulb"></i>
                  <span>提示：越詳細的描述，AI 規劃的行程越精準！</span>
                </div>
              </div>
            </div>

            <button type="submit" className="btn-primary" disabled={loading}>
              <i className="fas fa-magic"></i>
              生成行程
            </button>

            <button type="button" className="btn-secondary" onClick={() => setResults(testData)}>
              <i className="fas fa-eye"></i>
              預覽模板
            </button>
          </form>

          {loading && (
            <div className="loading">
              <div className="loading-spinner"></div>
              <div className="loading-text">生成中，請稍候...</div>
            </div>
          )}

          {error && <div className="error">{error}</div>}

          {results && <TripResults data={results} />}
        </div>
      </div>
    </div>
  );
}

export default App
