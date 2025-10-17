import { useState, useEffect } from 'react'
import './App.css'
import TripResults from './components/TripResults'
<<<<<<< Updated upstream
import { supabase } from './supabaseClient'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
=======
import AuthForm from './components/AuthForm'
import ProfileEditor from './components/ProfileEditor'
import { supabase } from './supabaseClient'
>>>>>>> Stashed changes

// API URL - 根據環境自動選擇
// 開發環境: http://localhost:3000/api
// 生產環境: /api (相對路徑)
const API_URL = import.meta.env.DEV ? 'http://localhost:3000/api' : '/api';

function App() {
  const [session, setSession] = useState(null);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  const [serverRunning, setServerRunning] = useState(true);
  const [streamingStatus, setStreamingStatus] = useState('');
  const [session, setSession] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  // 監聽認證狀態變化
  useEffect(() => {
    // 獲取當前 session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      console.log('✅ 當前 session:', session);
    });

    // 監聽認證狀態變化
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('🔄 認證狀態變化:', _event, session);
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 監聽認證狀態
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 開發時方便測試：若在 dev 模式且 session 尚未建立，注入一個假 session 以顯示介面
  useEffect(() => {
    if (import.meta.env.DEV && !session) {
      // 這個假 session 只在開發模式使用，生產不會被執行
      const fakeSession = {
        user: {
          id: 'dev-user',
          email: 'dev@example.com',
        },
        access_token: 'dev-token'
      };
      setSession(fakeSession);
    }
  }, [session]);

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
              
              // 收集所有 data: 行
              const dataLines = [];
              const dataMatches = line.matchAll(/^data: (.*)$/gm);
              for (const match of dataMatches) {
                dataLines.push(match[1]);
              }
              
              if (eventMatch && dataLines.length > 0) {
                const eventType = eventMatch[1];
                let eventData;
                
                try {
                  // 合併多行 data 並解析 JSON
                  const jsonString = dataLines.join('\n');
                  eventData = JSON.parse(jsonString);
                } catch (parseError) {
                  console.error(`❌ JSON 解析失敗 (${eventType}):`, parseError.message);
                  console.error('原始數據行數:', dataLines.length);
                  console.error('第一行數據:', dataLines[0]?.substring(0, 100) + '...');
                  continue; // 跳過這個事件，繼續處理下一個
                }

                console.log(`[SSE Event] type: ${eventType}, data:`, eventData);

                // 處理不同類型的事件
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
      // 並行請求兩個行程版本
      // 第一個：純 AI 生成（不使用 RAG）
      // 第二個：RAG 增強（使用真實景點資料庫）
      const streamPromises = [
        handleStreamRequest(sessionId, question, false), // useRAG = false
        handleStreamRequest(sessionId, question, true),  // useRAG = true
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

<<<<<<< Updated upstream
  // 登出功能
  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  // 如果未登入，顯示登入頁面
  if (!session) {
    return (
      <div className="container">
        <header>
          <div className="logo">
            <i className="fas fa-plane-departure"></i>
            <h1>AI 旅遊規劃助手</h1>
          </div>
        </header>

        <div className="auth-container" style={{
          maxWidth: '500px',
          margin: '40px auto',
          padding: '30px',
          background: 'white',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ 
            textAlign: 'center', 
            marginBottom: '24px',
            color: '#1e293b',
            fontSize: '24px'
          }}>
            <i className="fas fa-user-circle" style={{ marginRight: '8px' }}></i>
            登入或註冊
          </h2>
          <p style={{
            textAlign: 'center',
            color: '#64748b',
            marginBottom: '24px',
            fontSize: '14px'
          }}>
            登入以儲存您的行程記錄和偏好設定
          </p>
          <Auth
            supabaseClient={supabase}
            appearance={{ theme: ThemeSupa }}
            providers={[]}
            localization={{
              variables: {
                sign_in: {
                  email_label: '電子郵件',
                  password_label: '密碼',
                  email_input_placeholder: '您的電子郵件',
                  password_input_placeholder: '您的密碼',
                  button_label: '登入',
                  loading_button_label: '登入中...',
                  social_provider_text: '使用 {{provider}} 登入',
                  link_text: '已經有帳號？登入',
                },
                sign_up: {
                  email_label: '電子郵件',
                  password_label: '密碼',
                  email_input_placeholder: '您的電子郵件',
                  password_input_placeholder: '您的密碼',
                  button_label: '註冊',
                  loading_button_label: '註冊中...',
                  social_provider_text: '使用 {{provider}} 註冊',
                  link_text: '還沒有帳號？註冊',
                },
                forgotten_password: {
                  link_text: '忘記密碼？',
                  button_label: '發送重設密碼郵件',
                  loading_button_label: '發送中...',
                },
              },
            }}
          />
        </div>
      </div>
    );
  }

  // 已登入，顯示主應用
=======
  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      console.log('✅ 登出成功');
    } catch (error) {
      console.error('❌ 登出失敗:', error);
    }
  };

  // 取得使用者顯示名稱
  const getUserDisplayName = () => {
    if (!session?.user) return '';
    
    // 優先使用 user_metadata 中的 display_name
    if (session.user.user_metadata?.display_name) {
      return session.user.user_metadata.display_name;
    }
    
    // 如果是 Google 登入，使用 full_name
    if (session.user.user_metadata?.full_name) {
      return session.user.user_metadata.full_name;
    }
    
    // 如果都沒有，使用 email 前綴
    if (session.user.email) {
      return session.user.email.split('@')[0];
    }
    
    return '使用者';
  };

>>>>>>> Stashed changes
  return (
    <div className="container">
      <header>
        <div className="logo">
          <i className="fas fa-plane-departure"></i>
          <h1>AI 旅遊規劃助手</h1>
        </div>
<<<<<<< Updated upstream
        {/* 使用者資訊與登出按鈕 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontSize: '14px',
          color: '#64748b'
        }}>
          <i className="fas fa-user" style={{ fontSize: '16px' }}></i>
          <span>{session.user.email}</span>
          <button
            onClick={handleSignOut}
            style={{
              background: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 16px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'background 0.2s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#dc2626'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#ef4444'}
          >
            <i className="fas fa-sign-out-alt" style={{ marginRight: '6px' }}></i>
            登出
          </button>
=======
        <div className="auth-section">
          {session ? (
            <div className="user-info">
              <button 
                onClick={() => setShowProfile(true)} 
                className="user-name"
                title="點擊編輯個人資料"
              >
                <i className="fas fa-user"></i>
                {getUserDisplayName()}
              </button>
              <button onClick={handleLogout} className="btn-logout">
                <i className="fas fa-sign-out-alt"></i>
                登出
              </button>
            </div>
          ) : (
            <button onClick={() => setShowAuth(true)} className="btn-login">
              <i className="fas fa-user-circle"></i>
              登入 / 註冊
            </button>
          )}
>>>>>>> Stashed changes
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

      {showAuth && (
        <AuthForm 
          onClose={() => setShowAuth(false)}
          onSuccess={() => {
            console.log('✅ 認證成功');
          }}
        />
      )}

      {showProfile && session && (
        <ProfileEditor 
          session={session}
          onClose={() => setShowProfile(false)}
          onSuccess={() => {
            console.log('✅ 個人資料更新成功');
            // 重新獲取 session 以更新顯示
            supabase.auth.getSession().then(({ data: { session } }) => {
              setSession(session);
            });
          }}
        />
      )}
    </div>
  );
}

export default App;
