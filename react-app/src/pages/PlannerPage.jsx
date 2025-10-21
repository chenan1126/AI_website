import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import TripResults from '../components/TripResults'
import { supabase } from '../supabaseClient'

// API URL - 根據環境自動選擇
const API_URL = '/api';

// 範例提示語
const EXAMPLE_PROMPTS = [
  "我想要去台南三天兩夜，喜歡古蹟和美食。",
  "10/23 我想要去花蓮看海，帶著家裡的老人家。",
  "明天我想要去一趟嘉義，體驗當地文化和美食。"
];

function PlannerPage() {
  const [question, setQuestion] = useState('');
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  const [serverRunning, setServerRunning] = useState(true);
  const [streamingStatus, setStreamingStatus] = useState('');
  const [isScrolled, setIsScrolled] = useState(false);
  const [userPreferences, setUserPreferences] = useState(null);
  const navigate = useNavigate();

  // 監聽滾動事件
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      setIsScrolled(scrollTop > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 獲取用戶偏好設定
  useEffect(() => {
    const getUserPreferences = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.user_metadata?.preferences) {
          setUserPreferences(session.user.user_metadata.preferences);
        }
      } catch (error) {
        console.error('獲取用戶偏好設定失敗:', error);
      }
    };

    getUserPreferences();
  }, []);

  // 將偏好設定整合到prompt中
  const integratePreferencesIntoPrompt = (originalQuestion) => {
    if (!userPreferences) return originalQuestion;

    let enhancedPrompt = originalQuestion;
    const preferences = [];

    // 飲食偏好
    if (userPreferences.dietaryRestrictions && userPreferences.dietaryRestrictions.length > 0) {
      const dietaryLabels = {
        vegetarian: '素食',
        vegan: '純素',
        halal: '清真',
        no_beef: '不吃牛肉',
        no_pork: '不吃豬肉',
        no_seafood: '不吃海鮮',
        gluten_free: '無麩質',
        dairy_free: '無乳製品',
        nut_free: '不吃堅果'
      };

      const dietaryPrefs = userPreferences.dietaryRestrictions
        .map(id => dietaryLabels[id])
        .filter(Boolean);

      if (dietaryPrefs.length > 0) {
        preferences.push(`飲食偏好：${dietaryPrefs.join('、')}`);
      }
    }

    // 活動偏好
    if (userPreferences.activityPreferences && userPreferences.activityPreferences.length > 0) {
      const activityLabels = {
        outdoor: '戶外活動',
        indoor: '室內活動',
        museum: '博物館',
        shopping: '購物',
        food_tour: '美食之旅',
        adventure: '冒險活動',
        relaxation: '放鬆休閒',
        cultural: '文化體驗',
        nightlife: '夜生活'
      };

      const activityPrefs = userPreferences.activityPreferences
        .map(id => activityLabels[id])
        .filter(Boolean);

      if (activityPrefs.length > 0) {
        preferences.push(`活動偏好：${activityPrefs.join('、')}`);
      }
    }

    // 預算範圍
    if (userPreferences.budgetRange) {
      const budgetLabels = {
        budget: '經濟型',
        medium: '中等',
        luxury: '豪華型'
      };

      const budgetLabel = budgetLabels[userPreferences.budgetRange];
      if (budgetLabel) {
        preferences.push(`預算範圍：${budgetLabel}`);
      }
    }

    // 如果有偏好設定，整合到原始問題中
    if (preferences.length > 0) {
      enhancedPrompt = `${originalQuestion}\n\n個人偏好設定：\n${preferences.join('\n')}`;
    }

    return enhancedPrompt;
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

    // 整合用戶偏好設定到問題中
    const enhancedQuestion = integratePreferencesIntoPrompt(question.trim());
    const sessionId = 'session-' + Date.now();

    // 直接跳轉到生成頁面，傳遞生成參數
    const tripUrl = `/trip-detail?generating=true&sessionId=${sessionId}`;
    navigate(tripUrl, {
      state: {
        generating: true,
        sessionId: sessionId,
        question: enhancedQuestion,
        userPreferences: userPreferences
      }
    });
  };

  const handleClear = () => {
    setResults(null);
    setError('');
    setQuestion('');
    setStreamingStatus('');
  };

  const handleExampleClick = (example) => {
    setQuestion(example);
  };

  return (
    <div className={`min-h-screen bg-background-light dark:bg-background-dark transition-all duration-300 ${isScrolled ? 'pt-50' : 'pt-24'}`}>
      <div className="container mx-auto px-6 py-8 md:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
          {/* Left Column - Form */}
          <div className="lg:col-span-2 flex flex-col justify-center">
            <div className="space-y-8 max-w-2xl mx-auto">
              <div className="text-center">
                <h1 className="text-4xl font-bold text-slate-900 dark:text-white">開啟您的旅程</h1>
                <p className="mt-2 text-slate-600 dark:text-slate-400">告訴我們您的旅遊夢想，AI 將為您安排計畫。</p>
              </div>

              <div className="relative">
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="我明天想要去嘉義玩5天，我喜歡自然風光和在地美食。"
                  className="w-full h-48 p-4 text-base bg-white dark:bg-background-dark border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition resize-none text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400"
                />
                <button
                  type="submit"
                  disabled={!serverRunning}
                  onClick={handleSubmit}
                  className="absolute bottom-4 right-4 flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-white text-base font-bold hover:opacity-90 transition-opacity shadow-lg shadow-primary/30 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined">auto_awesome</span>
                  <span>生成</span>
                </button>
              </div>

              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-3">或從以下範例開始：</p>
                <div className="flex flex-wrap gap-3">
                  {EXAMPLE_PROMPTS.map((example, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => handleExampleClick(example)}
                      disabled={!serverRunning}
                      className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-200/60 dark:bg-slate-800/60 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed"
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
                  className="w-full px-6 py-4 rounded-lg border-2 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-lg font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <i className="fas fa-redo mr-2"></i>
                  計畫其他行程
                </button>
              )}

              {/* Loading Status */}
              {streamingStatus && (
                <div className="mt-8 flex items-center justify-center gap-3 p-5 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
                  <p className="text-blue-700 dark:text-blue-300 text-lg">{streamingStatus}</p>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="mt-8 flex items-center gap-3 p-5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <i className="fas fa-exclamation-circle text-red-500 text-xl"></i>
                  <span className="text-red-700 dark:text-red-300 text-lg">{error}</span>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Prompt Tips */}
          <div className="hidden lg:block bg-white dark:bg-background-dark border border-slate-200 dark:border-slate-800 rounded-xl p-6">
            <div className="flex flex-col h-full">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <i className="fas fa-lightbulb text-amber-500"></i>
                提示詞小技巧
              </h3>
              <div className="flex-grow space-y-4">
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                  <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-2">
                    <i className="fas fa-target text-primary"></i>
                    具體描述您的需求
                  </h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    包含目的地、天數、人數、預算和興趣，讓 AI 更準確規劃
                  </p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                  <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-2">
                    <i className="fas fa-calendar-alt text-primary"></i>
                    提供行程細節
                  </h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    說明出發日期、停留時間、特殊節慶或季節偏好
                  </p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                  <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-2">
                    <i className="fas fa-users text-primary"></i>
                    考慮團體需求
                  </h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    家庭出遊？情侶約會？背包客？不同團體有不同考量
                  </p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                  <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-2">
                    <i className="fas fa-dollar-sign text-primary"></i>
                    設定預算範圍
                  </h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    經濟型、中等預算還是豪華行程？幫助篩選適合的景點和住宿
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Results Section */}
        {results && (
          <div className="mt-16 max-w-7xl mx-auto">
            <TripResults data={results} />
          </div>
        )}
      </div>
    </div>
  )
}

export default PlannerPage
