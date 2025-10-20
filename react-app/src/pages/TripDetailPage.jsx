import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import WeatherCard from '../components/WeatherCard';
import MapView from '../components/MapView';
import { supabase } from '../supabaseClient';

// API URL - 根據環境自動選擇
const API_URL = import.meta.env.DEV ? 'http://localhost:3000/api' : '/api';

function TripDetailPage({ session, onShowAuth }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [selectedDay, setSelectedDay] = useState(1);
  const [selectedItineraryIndex, setSelectedItineraryIndex] = useState(0);
  const [isScrolled, setIsScrolled] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [streamingStatus, setStreamingStatus] = useState('');
  const [tripData, setTripData] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);

  // 保存行程函數
  const handleSaveTrip = async () => {
    if (!session) {
      setShowLoginPrompt(true);
      return;
    }

    try {
      // 生成行程標題
      const tripTitle = `${tripData.location || '未知目的地'} ${tripData.itineraries?.length || 1}個方案`;

      // 保存到 Supabase
      const { error } = await supabase
        .from('user_trips')
        .insert({
          user_id: session.user.id,
          trip_data: tripData,
          title: tripTitle,
          location: tripData.location
        })
        .select()
        .single();

      if (error) throw error;

      // 顯示成功訊息
      alert('行程已成功保存到您的個人收藏！');

    } catch (error) {
      console.error('保存行程失敗:', error);
      alert('保存行程失敗，請稍後再試。');
    }
  };

  // 回報行程問題函數 - 直接使用Supabase
  const handleReportTrip = async (reportData) => {
    if (!session) {
      setShowLoginPrompt(true);
      return;
    }

    if (!reportData.reportReason || !reportData.reportDetails) {
      alert('請填寫完整的回報信息');
      return;
    }

    setReportLoading(true);
    try {
      const selectedItinerary = tripData?.itineraries?.[selectedItineraryIndex] || null;
      const promptCandidates = [
        selectedItinerary?.prompt,
        selectedItinerary?.debug_prompt,
        tripData?.prompt,
        tripData?.debug_prompt,
        tripData?.question,
        tripData?.user_query,
        location.state?.prompt,
        location.state?.debugPrompt,
        location.state?.question
      ].filter(Boolean);

      const promptSource = promptCandidates[0] || '行程數據';

      const reportPayload = {
        ...tripData,
        prompt: tripData?.prompt || promptSource,
        question: tripData?.question || location.state?.question || promptSource,
        selectedItineraryIndex,
        selectedItinerary
      };

      // 直接使用Supabase保存回報數據，並附上生成 prompt
      const { data, error } = await supabase
        .from('trip_reports')
        .insert({
          user_id: session.user.id,
          user_query: location.state?.question || tripData?.location || '未知問題',
          prompt: promptSource,
          generated_result: JSON.stringify(reportPayload || {}),
          report_reason: reportData.reportReason,
          report_details: reportData.reportDetails.trim(),
          status: 'pending'
        })
        .select()
        .single();

      if (error) {
        console.error('保存回報失敗:', error);
        throw new Error('保存失敗');
      }

      console.log('回報成功:', data);
      alert('感謝您的回報！我們會盡快處理這個問題。');
      setShowReportModal(false);

    } catch (error) {
      console.error('回報行程失敗:', error);
      alert(`回報失敗：${error.message || '請稍後再試'}`);
    } finally {
      setReportLoading(false);
    }
  };

  // 處理串流請求
  const handleStreamRequest = async (sessionId, question, useRAG = true) => {
    return new Promise((resolve, reject) => {
      let weatherData = null;
      let startDate = null;
      let location = '';
      let days = 1;
      let capturedPrompt = null;

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

                if (eventType === 'parsing' && eventData.data) {
                  location = eventData.data.location;
                  days = eventData.data.days;
                  startDate = eventData.data.dates[0];
                  setStreamingStatus(`正在規劃 ${location} ${days}天行程...`);
                }
                else if (eventType === 'debug_prompt' && eventData.prompt) {
                  capturedPrompt = eventData.prompt;
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
                else if (eventType === 'result') {
                  setStreamingStatus('行程規劃完成！');
                  const finalData = {
                    ...eventData.data,
                    weather_data: weatherData,
                    start_date: startDate,
                    location: location,
                    prompt: capturedPrompt // 添加prompt數據
                  };
                  resolve(finalData);
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

  // 監聽滾動事件
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      setIsScrolled(scrollTop > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 開始生成行程
  const startGeneration = useCallback(async (sessionId, question) => {
    try {
      const streamPromises = [
        handleStreamRequest(sessionId, question, false),
        handleStreamRequest(sessionId, question, true),
      ];

      const apiResults = await Promise.all(streamPromises);
      const validResults = apiResults.filter(r => r !== null);

      if (validResults.length === 0) {
        setStreamingStatus('無法生成行程，請重試');
        setGenerating(false);
        return;
      }

      const debugPrompts = validResults
        .map((result, index) => {
          if (!result?.prompt) return null;
          return {
            index,
            useRAG: result?.useRAG ?? undefined,
            prompt: result.prompt
          };
        })
        .filter(Boolean);

      const primaryPrompt = debugPrompts[0]?.prompt || question;

      const combinedResults = {
        itineraries: validResults,
        weather_data: validResults[0]?.weather_data || {},
        start_date: validResults[0]?.start_date || null,
        location: validResults[0]?.location || '',
        question,
        user_query: question,
        prompt: primaryPrompt,
        debug_prompts: debugPrompts
      };

      setTripData(combinedResults);
      setStreamingStatus('');
      setGenerating(false);
    } catch (err) {
      console.error('請求失敗:', err);
      setStreamingStatus(`生成行程失敗：${err.message || '請稍後再試'}`);
      setGenerating(false);
    }
  }, []);

  // 從路由狀態獲取數據
  const initialTripData = location.state?.tripData;
  const isGenerating = location.state?.generating;
  const sessionId = location.state?.sessionId;
  const question = location.state?.question;
  const isSavedTrip = location.state?.isSavedTrip;
  const savedTripId = location.state?.savedTripId;

  useEffect(() => {
    if (isSavedTrip && savedTripId && session?.user?.id) {
      // 從 Supabase 載入保存的行程
      const loadSavedTrip = async () => {
        try {
          const { data, error } = await supabase
            .from('user_trips')
            .select('*')
            .eq('id', savedTripId)
            .eq('user_id', session.user.id)
            .single();

          if (error) throw error;
          if (data) {
            const loadedTrip = data.trip_data || {};
            const promptFallback =
              loadedTrip.prompt ||
              loadedTrip.debug_prompt ||
              loadedTrip.question ||
              loadedTrip.user_query ||
              location.state?.question ||
              '';

            setTripData({
              ...loadedTrip,
              question: loadedTrip.question || location.state?.question || promptFallback,
              user_query: loadedTrip.user_query || loadedTrip.question || location.state?.question || promptFallback,
              prompt: promptFallback || loadedTrip.prompt
            });

            if (typeof loadedTrip.selectedItineraryIndex === 'number') {
              setSelectedItineraryIndex(loadedTrip.selectedItineraryIndex);
            }
          }
        } catch (error) {
          console.error('載入保存的行程失敗:', error);
          navigate('/profile');
        }
      };
      loadSavedTrip();
    } else if (isGenerating && sessionId && question) {
      // 如果正在生成，開始生成行程
      setGenerating(true);
      setStreamingStatus('正在處理您的請求...');
      startGeneration(sessionId, question);
    } else if (initialTripData) {
      // 如果有現成的數據，直接設置
      const promptFallback =
        initialTripData.prompt ||
        initialTripData.debug_prompt ||
        initialTripData.question ||
        initialTripData.user_query ||
        location.state?.prompt ||
        location.state?.debugPrompt ||
        location.state?.question ||
        '';

      setTripData({
        ...initialTripData,
        question: initialTripData.question || location.state?.question || promptFallback,
        user_query: initialTripData.user_query || initialTripData.question || location.state?.question || promptFallback,
        prompt: promptFallback || initialTripData.prompt
      });

      if (typeof initialTripData.selectedItineraryIndex === 'number') {
        setSelectedItineraryIndex(initialTripData.selectedItineraryIndex);
      }
    } else {
      // 如果沒有數據，返回規劃頁面
      navigate('/plan');
    }
  }, [isGenerating, sessionId, question, initialTripData, navigate, startGeneration, isSavedTrip, savedTripId, session, location]);

  if (generating) {
    return (
      <div className={`min-h-screen bg-background-light dark:bg-background-dark transition-all duration-300 ${isScrolled ? 'pt-50' : 'pt-24'}`}>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
                AI 正在為您規劃行程
              </h1>
              <p className="mt-2 text-lg text-gray-600 dark:text-gray-400">
                預計需要約 1 分鐘，請稍候...
              </p>
            </div>

            {/* 生成進度指示器 */}
            <div className="flex items-center justify-center gap-3 p-8 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
              <div className="text-center">
                <p className="text-xl font-semibold text-blue-700 dark:text-blue-300">{streamingStatus}</p>
                <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                  我們正在分析您的需求、獲取天氣資訊並生成最佳行程建議
                </p>
              </div>
            </div>

            {/* 提示信息 */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white dark:bg-gray-800/50 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3 mb-3">
                  <i className="fas fa-search text-primary text-xl"></i>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">分析需求</h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  解析您的旅遊偏好和特殊要求
                </p>
              </div>

              <div className="bg-white dark:bg-gray-800/50 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3 mb-3">
                  <i className="fas fa-cloud-sun text-primary text-xl"></i>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">獲取天氣</h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  查詢目的地天氣預報資訊
                </p>
              </div>

              <div className="bg-white dark:bg-gray-800/50 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3 mb-3">
                  <i className="fas fa-magic text-primary text-xl"></i>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">生成行程</h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  AI 智慧規劃最適合的行程
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!tripData || !tripData.itineraries || tripData.itineraries.length === 0) {
    return null;
  }

  // 使用選擇的行程
  const itinerary = tripData.itineraries[selectedItineraryIndex];
  const sections = itinerary.sections || [];

  // 按日期分組行程段落
  const groupSectionsByDate = (sections) => {
    const groups = {};
    sections.forEach((section) => {
      const day = section.day || 1;
      if (!groups[day]) groups[day] = [];
      groups[day].push(section);
    });
    return groups;
  };

  const sectionsByDate = groupSectionsByDate(sections);
  const days = Object.keys(sectionsByDate).sort((a, b) => parseInt(a) - parseInt(b));
  const currentDaySections = sectionsByDate[selectedDay] || [];

  // 獲取當天的住宿和餐廳資訊
  const getDayAccommodation = (daySections) => {
    return daySections.find(section => section.type === 'accommodation' || section.category === '住宿');
  };

  const getDayRestaurants = (daySections) => {
    return daySections.filter(section => section.type === 'restaurant' || section.category === '餐廳');
  };

  const accommodation = getDayAccommodation(currentDaySections);
  const restaurants = getDayRestaurants(currentDaySections);

  // 渲染單個景點
  const renderLocation = (section, index) => {
    if (!section || !section.location) return null;
    return (
      <div key={index} className="mb-6">
        <div className="flex gap-4">
          <div className="min-w-20 text-center">
            <div className="bg-primary text-white px-3 py-2 rounded-full text-sm font-medium mb-2.5 shadow-lg shadow-primary/20">
              {section.time || '時間未定'}
            </div>
            <div className="w-3 h-3 bg-primary rounded-full mx-auto border-2 border-white shadow-sm"></div>
            {index < currentDaySections.length - 1 && (
              <div className="w-0.5 h-full min-h-12 bg-slate-200 dark:bg-slate-700 mx-auto mt-1.5 rounded-sm"></div>
            )}
          </div>
          <div className="activity-card flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm min-h-48 flex flex-col justify-between transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 relative overflow-hidden">
            {/* 威爾遜綜合評分 - 右上角 */}
            {section.maps_data?.wilson_score !== undefined && section.maps_data?.wilson_score !== null && (
              <div className="absolute top-4 right-4 px-3 py-1.5 bg-gradient-to-r from-green-500 to-green-600 text-white text-xs font-semibold rounded-full flex items-center gap-1.5 shadow-lg shadow-green-500/30 z-10">
                <i className="fas fa-award"></i>
                <span>綜合評分: {section.maps_data.wilson_score.toFixed(1)}/5.0</span>
              </div>
            )}

            <h3 className="text-slate-900 dark:text-white mb-2.5 flex items-center gap-2 font-semibold">
              <i className="fas fa-map-marker-alt text-primary"></i>
              {section.location}
              {section.warning && (
                <span className={`text-xs font-normal px-2 py-0.5 rounded border ${
                  section.closure_type === 'permanent'
                    ? 'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-900/20 dark:border-red-800'
                    : 'text-orange-600 bg-orange-50 border-orange-200 dark:text-orange-400 dark:bg-orange-900/20 dark:border-orange-800'
                }`}>
                  <i className="fas fa-exclamation-triangle"></i> {section.warning}
                </span>
              )}
            </h3>

            {(section.address || (section.maps_data && section.maps_data.address)) && (
              <div className="text-slate-600 dark:text-slate-400 text-sm mb-0.5 flex items-start gap-1.5">
                <i className="fas fa-location-arrow mt-0.5 text-slate-400"></i>
                <span>{section.maps_data && section.maps_data.address ? section.maps_data.address : section.address}</span>
              </div>
            )}

            {/* Google 評分資訊與威爾遜綜合評分 */}
            {section.maps_data && (section.maps_data.rating || section.rating) && (
              <div className="mb-4 flex items-start gap-5 flex-wrap">
                {/* Google 星級評分與評論數（垂直排列） */}
                <div className="flex flex-col gap-1">
                  {/* 星星評分 */}
                  <div className="flex items-center gap-2">
                    <span className="text-yellow-400 text-xl leading-none tracking-wider">
                      {'★'.repeat(Math.floor(section.maps_data?.rating || section.rating || 0))}
                      {'☆'.repeat(5 - Math.floor(section.maps_data?.rating || section.rating || 0))}
                    </span>
                    <span className="text-orange-600 text-lg font-bold">
                      {(section.maps_data?.rating || section.rating || 0).toFixed(1)}
                    </span>
                  </div>

                  {/* 評論數（在星星下方） */}
                  {section.maps_data?.user_ratings_total && (
                    <div className="text-slate-500 text-xs flex items-center gap-1 pl-0.5">
                      <i className="fas fa-comment-dots text-slate-400 text-xs"></i>
                      <span>Google 地圖上有：{section.maps_data.user_ratings_total.toLocaleString()} 則評論</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {section.details && section.details.length > 0 && (
              <div>
                <h4 className="text-slate-800 dark:text-slate-200 text-base mb-2.5 flex items-center gap-2">
                  <i className="fas fa-info-circle text-primary"></i> 活動詳情
                </h4>
                <ul className="pl-5 text-slate-600 dark:text-slate-400">
                  {section.details.map((detail, i) => (
                    <li key={i} className="mb-1">{detail}</li>
                  ))}
                </ul>
              </div>
            )}
            {section.travel_info && (
              <div className="mt-4 p-2.5 bg-gradient-to-r from-blue-50 to-green-50 dark:from-blue-900/20 dark:to-green-900/20 border-l-4 border-blue-500 rounded">
                <div className="font-bold text-blue-800 dark:text-blue-300 mb-1">
                  <i className="fas fa-route"></i> {section.travel_info.from} → {section.travel_info.to}
                </div>
                <div className="flex gap-4 mt-2 text-xs">
                  <span className="flex items-center gap-1">
                    <i className="fas fa-road text-orange-500"></i>
                    <strong className="text-gray-900 dark:text-white">距離: {section.travel_info.distance}</strong>
                  </span>
                  <span className="flex items-center gap-1">
                    <i className="fas fa-clock text-purple-500"></i>
                    <strong className="text-gray-900 dark:text-white">時間: {section.travel_info.duration}</strong>
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`min-h-screen bg-background-light dark:bg-background-dark transition-all duration-300 ${isScrolled ? 'pt-50' : 'pt-24'}`}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-4xl mx-auto">
          {/* 行程標題區域 */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
              {tripData.location ? `${tripData.location} 行程` : '行程詳情'}
            </h1>
          </div>

          {/* 行程選擇 */}
          {tripData.itineraries.length > 1 && (
            <div className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">選擇您的行程方案</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {tripData.itineraries.map((itinerary, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setSelectedItineraryIndex(index);
                      setSelectedDay(1); // 重置到第一天
                    }}
                    className={`p-6 rounded-xl border-2 transition-all text-left ${
                      selectedItineraryIndex === index
                        ? 'border-primary bg-primary/5 dark:bg-primary/10'
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                        {itinerary.title || `方案 ${index + 1}`}
                      </h3>
                      {selectedItineraryIndex === index && (
                        <i className="fas fa-check-circle text-primary text-xl"></i>
                      )}
                    </div>
                    <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                      {itinerary.generationMethod && (
                        <div className="flex items-center gap-2">
                          <i className={`fas ${itinerary.useRAG ? 'fa-check-circle text-green-500' : 'fa-info-circle text-purple-500'}`}></i>
                          <span>{itinerary.useRAG ? '真實景點資料' : 'AI 創意推薦'}</span>
                        </div>
                      )}
                      {itinerary.recommendation_score && (
                        <div className="flex items-center gap-2">
                          <i className="fas fa-star text-yellow-500"></i>
                          <span>推薦指數: {itinerary.recommendation_score}/5</span>
                        </div>
                      )}
                      {itinerary.playing_time_display && (
                        <div className="flex items-center gap-2">
                          <i className="fas fa-clock text-blue-500"></i>
                          <span>遊玩時間: {itinerary.playing_time_display}</span>
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 地圖 - 移到最上面 */}
          <div className="mb-8">
            <div className="aspect-video w-full rounded-lg overflow-hidden shadow-sm relative z-20">
              <MapView itineraries={[{ sections: currentDaySections }]} />
            </div>
          </div>

          {/* 天數分頁導航 */}
          <div className="overflow-x-auto pb-4 mb-8">
            <div className="flex border-b border-gray-200 dark:border-gray-700 whitespace-nowrap">
              {days.map((day) => (
                <button
                  key={day}
                  onClick={() => setSelectedDay(parseInt(day))}
                  className={`flex flex-col items-center justify-center border-b-2 px-4 py-3 transition-colors ${
                    selectedDay === parseInt(day)
                      ? 'border-primary text-primary'
                      : 'border-transparent text-gray-500 hover:text-primary hover:border-primary/50 dark:text-gray-400 dark:hover:text-primary'
                  }`}
                >
                  <p className="text-sm font-bold">第 {day} 天</p>
                </button>
              ))}
            </div>
          </div>

          {/* 天氣資訊 */}
          {tripData.weather_data && tripData.weather_data.length > 0 && (
            <div className="mb-8">
              <WeatherCard
                weatherData={tripData.weather_data}
                startDate={tripData.start_date}
                location={tripData.location}
                dayIndex={selectedDay - 1}
              />
            </div>
          )}

          {/* 行程內容 */}
          <div className="space-y-12">
            <section>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                第 {selectedDay} 天行程
              </h2>
              <div className="timeline">
                {currentDaySections.map((section, i) => renderLocation(section, i))}
              </div>
            </section>

            {/* 住宿和餐廳資訊 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* 住宿 */}
              {accommodation && (
                <section>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">住宿</h3>
                  <div className="bg-white dark:bg-gray-800/50 rounded-lg overflow-hidden shadow-sm">
                    <div className="p-6">
                      <p className="text-sm text-primary font-semibold">飯店</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">
                        {accommodation.location || '住宿地點'}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
                        {accommodation.description || '舒適的住宿環境，提供完善的服務設施。'}
                      </p>
                    </div>
                    {accommodation.maps_data?.photo_url && (
                      <div className="w-full bg-center bg-no-repeat aspect-video bg-cover"
                           style={{ backgroundImage: `url(${accommodation.maps_data.photo_url})` }}>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* 餐廳 */}
              {restaurants.length > 0 && (
                <section>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">餐廳</h3>
                  {restaurants.map((restaurant, index) => (
                    <div key={index} className="bg-white dark:bg-gray-800/50 rounded-lg overflow-hidden shadow-sm mb-4">
                      <div className="p-6">
                        <p className="text-sm text-primary font-semibold">餐廳</p>
                        <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">
                          {restaurant.location || '餐廳名稱'}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
                          {restaurant.description || '提供美味的餐點和優質的服務體驗。'}
                        </p>
                      </div>
                      {restaurant.maps_data?.photo_url && (
                        <div className="w-full bg-center bg-no-repeat aspect-video bg-cover"
                             style={{ backgroundImage: `url(${restaurant.maps_data.photo_url})` }}>
                        </div>
                      )}
                    </div>
                  ))}
                </section>
              )}
            </div>
          </div>

          {/* 操作按鈕 */}
          <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row gap-4">
            <button
              onClick={handleSaveTrip}
              className="flex-1 flex items-center justify-center gap-2 h-12 px-6 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors"
            >
              <i className="fas fa-save"></i>
              保存行程
            </button>
            <button
              onClick={() => setShowReportModal(true)}
              className="flex-1 flex items-center justify-center gap-2 h-12 px-6 bg-red-500 text-white rounded-lg text-sm font-bold hover:bg-red-600 transition-colors"
            >
              <i className="fas fa-flag"></i>
              回報問題
            </button>
            <button className="flex-1 flex items-center justify-center gap-2 h-12 px-6 bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-lg text-sm font-bold hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors">
              <i className="fas fa-share"></i>
              分享行程
            </button>
          </div>

          {/* 登入提示 Modal */}
          {showLoginPrompt && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6 relative">
                <button
                  onClick={() => setShowLoginPrompt(false)}
                  className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
                >
                  <i className="fas fa-times text-xl"></i>
                </button>

                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i className="fas fa-exclamation-triangle text-yellow-500 text-2xl"></i>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                    需要登入才能保存行程
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400">
                    請先登入您的帳號，才能將行程保存到個人收藏中。
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowLoginPrompt(false)}
                    className="flex-1 px-4 py-3 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                  >
                    稍後再說
                  </button>
                  <button
                    onClick={() => {
                      setShowLoginPrompt(false);
                      onShowAuth();
                    }}
                    className="flex-1 px-4 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors"
                  >
                    立即登入
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 回報模態框 */}
          {showReportModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6 relative max-h-[90vh] overflow-y-auto">
                <button
                  onClick={() => setShowReportModal(false)}
                  className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
                >
                  <i className="fas fa-times text-xl"></i>
                </button>

                <div className="mb-6">
                  <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i className="fas fa-flag text-red-500 text-2xl"></i>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 text-center">
                    回報行程問題
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400 text-center">
                    發現行程有問題嗎？請告訴我們詳細情況，幫助我們改進服務。
                  </p>
                </div>

                <form onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.target);
                  handleReportTrip({
                    reportReason: formData.get('reportReason'),
                    reportDetails: formData.get('reportDetails')
                  });
                }} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      問題類型 <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="reportReason"
                      required
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    >
                      <option value="">請選擇問題類型</option>
                      <option value="inaccurate_info">資訊不準確</option>
                      <option value="missing_attractions">缺少重要景點</option>
                      <option value="wrong_schedule">時間安排不合理</option>
                      <option value="transport_issues">交通安排問題</option>
                      <option value="weather_issues">天氣資訊錯誤</option>
                      <option value="closed_attractions">景點已歇業</option>
                      <option value="other">其他問題</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      詳細描述 <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      name="reportDetails"
                      required
                      placeholder="請詳細描述您發現的問題..."
                      rows={4}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowReportModal(false)}
                      className="flex-1 px-4 py-3 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                    >
                      取消
                    </button>
                    <button
                      type="submit"
                      disabled={reportLoading}
                      className="flex-1 px-4 py-3 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {reportLoading ? (
                        <>
                          <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                          提交中...
                        </>
                      ) : (
                        <>
                          <i className="fas fa-paper-plane"></i>
                          提交回報
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default TripDetailPage;