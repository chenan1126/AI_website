import { useState, useEffect } from 'react'
import TripResults from './components/TripResults'
import AuthForm from './components/AuthForm'
import ProfileEditor from './components/ProfileEditor'
import { supabase } from './supabaseClient'

// API URL - 根據環境自動選擇
const API_URL = import.meta.env.DEV ? 'http://localhost:3000/api' : '/api';

// 範例提示語
const EXAMPLE_PROMPTS = [
  "我想去京都玩5天，喜歡歷史景點和當地美食，預算中等",
  "巴黎一週藝術博物館之旅和咖啡廳",
  "泰國家庭友善海灘度假",
  "一個月東南亞窮遊背包旅行"
];

function App() {
  const [session, setSession] = useState(null);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  const [serverRunning, setServerRunning] = useState(true);
  const [streamingStatus, setStreamingStatus] = useState('');
  const [showAuth, setShowAuth] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showHero, setShowHero] = useState(true);

  // 監聽認證狀態變化
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      console.log('✅ 當前 session:', session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('🔄 認證狀態變化:', _event, session);
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

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
  const handleStreamRequest = async (sessionId, question, useRAG = true) => {
    return new Promise((resolve, reject) => {
      let weatherData = null;
      let startDate = null;
      let location = '';
      let days = 1;

      fetch(`${API_URL}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          session_id: sessionId, 
          question: question,
          useRAG: useRAG 
        }),
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
              const dataLines = [];
              const dataMatches = line.matchAll(/^data: (.*)$/gm);
              for (const match of dataMatches) {
                dataLines.push(match[1]);
              }
              
              if (eventMatch && dataLines.length > 0) {
                const eventType = eventMatch[1];
                let eventData;
                
                try {
                  const jsonString = dataLines.join('\n');
                  eventData = JSON.parse(jsonString);
                } catch (parseError) {
                  console.error(`❌ JSON 解析失敗 (${eventType}):`, parseError.message);
                  continue;
                }

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
                    console.log('📊 App.jsx 接收到天氣數據:', JSON.stringify(weatherData, null, 2));
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
                  const finalData = {
                    ...eventData.data,
                    weather_data: weatherData,
                    start_date: startDate,
                    location: location
                  };
                  console.log('📦 App.jsx 最終數據傳遞給 TripResults:', JSON.stringify(finalData, null, 2));
                  resolve(finalData);
                }
                else if (eventType === 'done') {
                  setStreamingStatus('處理完成！');
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
    setShowHero(false); // 隱藏 Hero 區塊

    const sessionId = 'session-' + Date.now();

    try {
      const streamPromises = [
        handleStreamRequest(sessionId, question, false),
        handleStreamRequest(sessionId, question, true),
      ];

      const apiResults = await Promise.all(streamPromises);
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
    setShowHero(true); // 顯示 Hero 區塊
  };

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      console.log('✅ 登出成功');
    } catch (error) {
      console.error('❌ 登出失敗:', error);
    }
  };

  const getUserDisplayName = () => {
    if (!session?.user) return '';
    
    if (session.user.user_metadata?.display_name) {
      return session.user.user_metadata.display_name;
    }
    
    if (session.user.user_metadata?.full_name) {
      return session.user.user_metadata.full_name;
    }
    
    if (session.user.email) {
      return session.user.email.split('@')[0];
    }
    
    return '使用者';
  };

  const handleExampleClick = (example) => {
    setQuestion(example);
  };

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark">
      {/* Header */}
      <header className="fixed w-full z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <svg className="h-10 w-10 text-primary" fill="currentColor" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                <path d="M8.57829 8.57829C5.52816 11.6284 3.451 15.5145 2.60947 19.7452C1.76794 23.9758 2.19984 28.361 3.85056 32.3462C5.50128 36.3314 8.29667 39.7376 11.8832 42.134C15.4698 44.5305 19.6865 45.8096 24 45.8096C28.3135 45.8096 32.5302 44.5305 36.1168 42.134C39.7033 39.7375 42.4987 36.3314 44.1494 32.3462C45.8002 28.361 46.2321 23.9758 45.3905 19.7452C44.549 15.5145 42.4718 11.6284 39.4217 8.57829L24 24L8.57829 8.57829Z"/>
              </svg>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white font-serif">TravelAI</h1>
            </div>

            {/* Navigation */}
            <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
              <a href="#" className="text-gray-600 dark:text-gray-300 hover:text-primary transition-colors">探索</a>
              <a href="#" className="text-primary font-bold">規劃</a>
              <a href="#" className="text-gray-600 dark:text-gray-300 hover:text-primary transition-colors">行程</a>
            </nav>

            {/* User Section */}
            <div className="flex items-center gap-4">
              {session ? (
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setShowProfile(true)} 
                    className="flex items-center gap-2 px-4 py-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <i className="fas fa-user text-gray-600 dark:text-gray-400"></i>
                    <span className="text-gray-900 dark:text-white font-medium">{getUserDisplayName()}</span>
                  </button>
                  <button 
                    onClick={handleLogout} 
                    className="px-4 py-2 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <i className="fas fa-sign-out-alt"></i>
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => setShowAuth(true)} 
                  className="px-6 py-2.5 rounded-full bg-primary text-white hover:bg-opacity-90 transition-all font-medium"
                >
                  <i className="fas fa-user-circle mr-2"></i>
                  登入 / 註冊
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-20">
        {/* Hero Section - 只在沒有結果時顯示 */}
        {showHero && !results && (
          <section className="relative min-h-[60vh] flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-cyan-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl"></div>
              <div className="absolute bottom-20 right-10 w-96 h-96 bg-cyan-400/10 rounded-full blur-3xl"></div>
            </div>
            
            <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 text-center py-16">
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-gray-900 dark:text-white mb-6 font-serif">
                智慧規劃，探索世界
              </h1>
              <p className="text-xl lg:text-2xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto mb-8">
                讓 AI 為您打造專屬旅程。探索未知，發現驚喜，體驗前所未有的旅行。
              </p>
              <div className="flex justify-center">
                <a 
                  href="#planner" 
                  className="inline-flex items-center gap-2 px-10 py-4 rounded-full bg-primary text-white text-lg font-semibold hover:bg-opacity-90 transition-all transform hover:scale-105 shadow-lg"
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById('planner')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  <span className="material-symbols-outlined">auto_awesome</span>
                  開始規劃
                </a>
              </div>
            </div>
          </section>
        )}

        {/* Server Status Warning */}
        {!serverRunning && (
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3">
              <i className="fas fa-exclamation-triangle text-red-500"></i>
              <span className="text-red-700 dark:text-red-300">後端服務器未運行或無法訪問，請檢查連接。</span>
            </div>
          </div>
        )}

        {/* Planner Section */}
        <section id="planner" className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                  描述您的完美旅程
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  告訴我們您的旅行夢想，AI 將為您實現
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="relative">
                  <textarea
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="例如：明天去嘉義玩兩天，想吃美食和看風景"
                    disabled={loading}
                    className="w-full h-48 p-4 text-base bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition resize-none text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  />
                  <button
                    type="submit"
                    disabled={loading || !serverRunning}
                    className="absolute bottom-4 right-4 flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-white text-base font-bold hover:opacity-90 transition-opacity shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="material-symbols-outlined">auto_awesome</span>
                    <span>{loading ? '規劃中...' : '生成'}</span>
                  </button>
                </div>

                {/* Example Prompts */}
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-3">
                    或從範例中獲取靈感：
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {EXAMPLE_PROMPTS.map((example, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => handleExampleClick(example)}
                        className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors text-gray-700 dark:text-gray-300"
                      >
                        "{example}"
                      </button>
                    ))}
                  </div>
                </div>

                {/* Clear Button */}
                {results && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="w-full px-6 py-3 rounded-lg border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    <i className="fas fa-redo mr-2"></i>
                    重新規劃
                  </button>
                )}
              </form>

              {/* Loading Status */}
              {streamingStatus && (
                <div className="mt-6 flex items-center justify-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full"></div>
                  <p className="text-blue-700 dark:text-blue-300">{streamingStatus}</p>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="mt-6 flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <i className="fas fa-exclamation-circle text-red-500"></i>
                  <span className="text-red-700 dark:text-red-300">{error}</span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Results Section */}
        {results && !loading && (
          <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <TripResults data={results} />
          </section>
        )}

        {/* Features Section - 只在首頁顯示 */}
        {showHero && !results && (
          <section className="py-20 bg-gray-50 dark:bg-slate-800/50">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center mb-16">
                <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4 font-serif">
                  功能亮點
                </h2>
                <p className="text-lg text-gray-600 dark:text-gray-400">
                  我們如何讓您的旅行更輕鬆
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="bg-white dark:bg-slate-800 rounded-xl p-8 shadow-lg hover:shadow-2xl transition-shadow transform hover:-translate-y-2">
                  <div className="flex items-center justify-center h-16 w-16 rounded-full bg-primary/10 text-primary mx-auto mb-6">
                    <i className="fas fa-map-marked-alt text-3xl"></i>
                  </div>
                  <h3 className="text-2xl font-semibold mb-3 text-center text-gray-900 dark:text-white">
                    個人化行程
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-center">
                    根據您的興趣和預算，AI 為您量身打造獨一無二的旅遊路線。
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-xl p-8 shadow-lg hover:shadow-2xl transition-shadow transform hover:-translate-y-2">
                  <div className="flex items-center justify-center h-16 w-16 rounded-full bg-primary/10 text-primary mx-auto mb-6">
                    <i className="fas fa-lightbulb text-3xl"></i>
                  </div>
                  <h3 className="text-2xl font-semibold mb-3 text-center text-gray-900 dark:text-white">
                    智慧推薦
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-center">
                    發掘隱藏版景點和在地美食，讓您的旅程充滿驚喜。
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-xl p-8 shadow-lg hover:shadow-2xl transition-shadow transform hover:-translate-y-2">
                  <div className="flex items-center justify-center h-16 w-16 rounded-full bg-primary/10 text-primary mx-auto mb-6">
                    <i className="fas fa-clock text-3xl"></i>
                  </div>
                  <h3 className="text-2xl font-semibold mb-3 text-center text-gray-900 dark:text-white">
                    即時調整
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-center">
                    隨時隨地調整行程，應對突發狀況，讓旅行更靈活。
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-gray-100 dark:bg-slate-900 border-t border-gray-200 dark:border-gray-800">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex flex-wrap justify-center md:justify-start gap-x-6 gap-y-2">
              <a href="#" className="text-gray-600 dark:text-gray-400 hover:text-primary transition-colors">關於我們</a>
              <a href="#" className="text-gray-600 dark:text-gray-400 hover:text-primary transition-colors">聯絡我們</a>
              <a href="#" className="text-gray-600 dark:text-gray-400 hover:text-primary transition-colors">隱私政策</a>
              <a href="#" className="text-gray-600 dark:text-gray-400 hover:text-primary transition-colors">服務條款</a>
            </div>
            <div className="text-center text-gray-500 dark:text-gray-400">
              <p>© 2024 TravelAI. All rights reserved.</p>
            </div>
          </div>
        </div>
      </footer>

      {/* Modals */}
      {showAuth && (
        <AuthForm 
          onClose={() => setShowAuth(false)}
          onSuccess={() => {
            console.log('✅ 認證成功');
            setShowAuth(false);
          }}
        />
      )}

      {showProfile && session && (
        <ProfileEditor 
          session={session}
          onClose={() => setShowProfile(false)}
          onSuccess={() => {
            console.log('✅ 個人資料更新成功');
            supabase.auth.getSession().then(({ data: { session } }) => {
              setSession(session);
            });
            setShowProfile(false);
          }}
        />
      )}
    </div>
  );
}

export default App;
