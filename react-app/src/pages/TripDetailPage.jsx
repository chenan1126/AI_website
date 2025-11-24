import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import WeatherCard from '../components/WeatherCard';
import MapView from '../components/MapView';
import { supabase } from '../supabaseClient';

// API URL - 根據環境自動選擇
const API_URL = '/api';

function TripDetailPage({ session, onShowAuth }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [selectedDay, setSelectedDay] = useState(1);
  const [selectedItineraryIndex, setSelectedItineraryIndex] = useState(0);
  const [isScrolled] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [streamingStatus, setStreamingStatus] = useState('');
  const [tripData, setTripData] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [loadingTrip, setLoadingTrip] = useState(false); // 新增載入狀態
  const [isEditMode, setIsEditMode] = useState(false); // 拖曳編輯模式
  const [calculatingTraffic, setCalculatingTraffic] = useState(false); // 計算交通時間狀態
  const [showRagSource, setShowRagSource] = useState(false);

  // 新增：單一景點回報視窗狀態
  const [attractionReportModalOpen, setAttractionReportModalOpen] = useState(false);
  const [reportingLocation, setReportingLocation] = useState(null);
  const [attractionReportReason, setAttractionReportReason] = useState('closed');
  const [attractionReportDescription, setAttractionReportDescription] = useState('');
  const [isSubmittingAttractionReport, setIsSubmittingAttractionReport] = useState(false);

  // 新增：單一景點詳情視窗狀態
  const [attractionDetailModalOpen, setAttractionDetailModalOpen] = useState(false);
  const [selectedAttraction, setSelectedAttraction] = useState(null);

  // 用於追蹤正在獲取詳情的景點，避免重複請求
  const fetchingRef = React.useRef(new Set());

  // 客戶端補充景點詳情 (Client-side Enrichment)
  useEffect(() => {
    if (!tripData || !tripData.itineraries) return;

    const currentItinerary = tripData.itineraries[selectedItineraryIndex];
    if (!currentItinerary || !currentItinerary.sections) return;

    // 找出需要補充資料的景點
    const sectionsToEnrich = currentItinerary.sections.map((section, index) => ({
      section,
      index
    })).filter(({ section, index }) => {
      const key = `${selectedItineraryIndex}-${index}-${section.location}`;
      // 條件：不是交通時間、沒有詳細地圖資料、有地點名稱、且目前沒有正在獲取
      return !section.is_travel_time && 
             (!section.maps_data || !section.maps_data.google_maps_name) && 
             section.location &&
             !fetchingRef.current.has(key);
    });

    if (sectionsToEnrich.length === 0) return;

    // 標記為正在獲取
    sectionsToEnrich.forEach(({ section, index }) => {
      const key = `${selectedItineraryIndex}-${index}-${section.location}`;
      fetchingRef.current.add(key);
    });

    const enrichSection = async (item) => {
      try {
        const response = await fetch(`${API_URL}/get-place-details`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            placeName: item.section.location,
            location: tripData.location
          })
        });
        
        if (!response.ok) return null;
        const data = await response.json();
        return { index: item.index, data };
      } catch (e) {
        console.error('Enrichment error:', e);
        return null;
      }
    };

    // 分批處理，每次 3 個請求
    const processBatch = async () => {
      const batchSize = 3;
      for (let i = 0; i < sectionsToEnrich.length; i += batchSize) {
        const batch = sectionsToEnrich.slice(i, i + batchSize);
        const results = await Promise.all(batch.map(enrichSection));
        
        // 更新狀態
        setTripData(prev => {
          if (!prev) return prev;
          const newItineraries = [...prev.itineraries];
          // 確保 itinerary 存在
          if (!newItineraries[selectedItineraryIndex]) return prev;

          const newSections = [...newItineraries[selectedItineraryIndex].sections];
          
          let hasChanges = false;
          results.forEach(result => {
            if (result && result.data) {
              const section = newSections[result.index];
              // 合併 maps_data
              newSections[result.index] = {
                ...section,
                maps_data: result.data.maps_data,
                coordinates: result.data.coordinates,
                // 處理歇業警告
                warning: result.data.is_closed ? `注意：此地點可能已歇業` : section.warning,
                closure_type: result.data.is_closed ? 'permanent' : section.closure_type
              };
              hasChanges = true;
            }
          });
          
          if (!hasChanges) return prev;
          
          newItineraries[selectedItineraryIndex] = {
            ...newItineraries[selectedItineraryIndex],
            sections: newSections
          };
          
          return { ...prev, itineraries: newItineraries };
        });
        
        // 稍微延遲一下，避免請求過於密集
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    };

    processBatch();

  }, [tripData, selectedItineraryIndex]);

  // 檢查地點是否在 RAG 來源中
  const isVerifiedLocation = useCallback((locationName) => {
    if (!tripData?.rag_raw_data) return false;
    const { attractions = [], restaurants = [] } = tripData.rag_raw_data;
    const allSpots = [...attractions, ...restaurants];
    // 簡單的模糊匹配
    return allSpots.some(spot => 
      spot.name && locationName && (spot.name.includes(locationName) || locationName.includes(spot.name))
    );
  }, [tripData]); // 顯示 RAG 來源 Modal

  // 更新行程段落時間的函數 - 現在時間是建議停留時間，不需要重新分配
  const updateSectionTimes = useCallback((sections) => {
    // 由於現在LLM回應的是建議停留時間和交通時間，不需要重新計算具體時間
    // 只需要確保交通時間項目和景點項目保持正確的順序
    return sections;
  }, []);

  // 計算交通時間
  const handleCalculateTraffic = async () => {
    if (!tripData || !tripData.itineraries) return;
    
    setCalculatingTraffic(true);
    try {
      const currentItinerary = tripData.itineraries[selectedItineraryIndex];
      // 過濾掉現有的交通時間項目，只保留景點
      const cleanSections = currentItinerary.sections.filter(s => !s.is_travel_time);
      
      const response = await fetch(`${API_URL}/calculate-traffic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sections: cleanSections,
          location: tripData.location
        }),
      });

      if (!response.ok) {
        throw new Error('計算交通時間失敗');
      }

      const data = await response.json();
      
      // 更新行程數據
      const newTripData = { ...tripData };
      newTripData.itineraries[selectedItineraryIndex].sections = data.sections;
      setTripData(newTripData);
      
      alert('交通時間已更新！');
    } catch (error) {
      console.error('計算交通時間錯誤:', error);
      alert('計算交通時間失敗，請稍後再試');
    } finally {
      setCalculatingTraffic(false);
    }
  };

  // 處理拖曳結束事件
  const handleDragEnd = useCallback((result) => {
    if (!result.destination) return;

    const { source, destination } = result;
    const sourceDay = parseInt(source.droppableId.split('-')[1]);
    const destDay = parseInt(destination.droppableId.split('-')[1]);

    if (sourceDay === destDay && source.index === destination.index) return;

    // 複製行程數據
    const newTripData = JSON.parse(JSON.stringify(tripData));
    // 獲取所有行程，並過濾掉交通時間項目 (確保拖曳時不會有交通時間卡片干擾)
    let allSections = newTripData.itineraries[selectedItineraryIndex].sections.filter(s => !s.is_travel_time);

    if (sourceDay === destDay) {
      // 同一天內拖曳
      const daySections = allSections.filter(s => s.day === sourceDay);

      // 移動項目
      const [movedItem] = daySections.splice(source.index, 1);
      daySections.splice(destination.index, 0, movedItem);

      // 更新當天所有項目的時間
      updateSectionTimes(daySections);

      // 重組所有行程 (保持其他天不變)
      allSections = allSections
        .filter(s => s.day !== sourceDay)
        .concat(daySections);
    } else {
      // 跨天拖曳
      const sourceSections = allSections.filter(s => s.day === sourceDay);
      const destSections = allSections.filter(s => s.day === destDay);

      // 移動項目
      const [movedItem] = sourceSections.splice(source.index, 1);
      movedItem.day = destDay; // 更新天數
      destSections.splice(destination.index, 0, movedItem);

      // 更新兩個天的時間
      updateSectionTimes(sourceSections);
      updateSectionTimes(destSections);

      // 重組所有行程
      allSections = allSections
        .filter(s => s.day !== sourceDay && s.day !== destDay)
        .concat(sourceSections, destSections);
    }

    // 更新行程數據
    newTripData.itineraries[selectedItineraryIndex].sections = allSections;
    setTripData(newTripData);
  }, [tripData, selectedItineraryIndex, updateSectionTimes]);

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

  // 單一景點回報函數
  const openAttractionReportModal = (locationName) => {
    setReportingLocation(locationName);
    setAttractionReportModalOpen(true);
    setAttractionReportReason('closed');
    setAttractionReportDescription('');
  };

  const closeAttractionReportModal = () => {
    setAttractionReportModalOpen(false);
    setReportingLocation(null);
  };

  const submitAttractionReport = async () => {
    if (!reportingLocation) return;
    
    setIsSubmittingAttractionReport(true);
    try {
      const response = await fetch('/api/report-issue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          attractionName: reportingLocation,
          reportType: attractionReportReason,
          description: attractionReportDescription
        }),
      });
      
      if (response.ok) {
        alert('感謝您的回報！我們會盡快審核並更新資料庫。');
        closeAttractionReportModal();
      } else {
        alert('回報失敗，請稍後再試。');
      }
    } catch (error) {
      console.error('Error submitting report:', error);
      alert('發生錯誤，請稍後再試。');
    } finally {
      setIsSubmittingAttractionReport(false);
    }
  };

  // 開啟景點詳情
  const openAttractionDetail = (section) => {
    setSelectedAttraction(section);
    setAttractionDetailModalOpen(true);
  };

  const closeAttractionDetail = () => {
    setAttractionDetailModalOpen(false);
    setSelectedAttraction(null);
  };

  // 從詳情頁開啟回報
  const openReportFromDetail = () => {
    if (selectedAttraction) {
      openAttractionReportModal(selectedAttraction.location);
      // 選擇性關閉詳情頁，或者保持開啟
      // closeAttractionDetail(); 
    }
  };

  // 從路由狀態獲取數據
  const initialTripData = location.state?.tripData;
  const isGenerating = location.state?.generating;
  const sessionId = location.state?.sessionId;
  const question = location.state?.question;
  const isSavedTrip = location.state?.isSavedTrip;
  const savedTripId = location.state?.savedTripId;

  // 從 URL 參數獲取 tripId
  const urlParams = new URLSearchParams(window.location.search);
  const tripId = urlParams.get('tripId');

  // 開始生成行程
  const startGeneration = useCallback(async (sessionId, question) => {
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
          useRAG: true
        }),
      })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;
            
            // 使用雙換行符分割事件，確保處理完整的 SSE 訊息
            const parts = buffer.split('\n\n');
            // 保留最後一個可能不完整的部分
            buffer = parts.pop();

            for (const part of parts) {
              if (!part.trim()) continue;

              const lines = part.split('\n');
              let eventType = '';
              const dataLines = [];

              for (const line of lines) {
                if (line.startsWith('event: ')) {
                  eventType = line.substring(7).trim();
                } else if (line.startsWith('data: ')) {
                  dataLines.push(line.substring(6));
                }
              }

              if (eventType && dataLines.length > 0) {
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
                else if (eventType === 'rag') {
                  if (eventData.status === 'retrieving') {
                    setStreamingStatus('正在檢索真實景點資料庫...');
                  } else if (eventData.status === 'complete') {
                    setStreamingStatus('檢索完成，正在整合資料...');
                  }
                }
                else if (eventType === 'generation') {
                  setStreamingStatus('AI 正在生成行程...');
                }
                else if (eventType === 'result') {
                  // console.log('🎯 接收到 result 事件，開始處理最終數據');
                  setStreamingStatus('行程規劃完成！');
                  const finalData = {
                    ...eventData.data,
                    // 優先使用後端回傳的完整數據，如果沒有才使用串流過程中的數據
                    weather_data: eventData.data.weather_data || weatherData,
                    start_date: eventData.data.start_date || startDate,
                    location: eventData.data.location || location,
                    prompt: eventData.data.prompt || capturedPrompt // 添加prompt數據
                  };

                  /*
                  console.log('📦 最終行程數據結構:', {
                    hasItineraries: !!finalData.itineraries,
                    itinerariesCount: finalData.itineraries?.length || 0,
                    location: finalData.location,
                    weatherDataSize: JSON.stringify(finalData.weather_data).length,
                    allKeys: Object.keys(finalData)
                  });
                  */

                  // 檢查數據完整性
                  if (!finalData.itineraries || finalData.itineraries.length === 0) {
                    console.error('❌ 行程數據缺少 itineraries:', finalData);
                    reject(new Error('生成的行程數據無效'));
                    // 跳出流讀取迴圈
                    reader.cancel();
                    return;
                  }

                  // 將生成的行程數據插入到 Supabase temp_trips 表
                  try {
                    // console.log('🔄 開始插入行程數據到 Supabase...');
                    // console.log('📊 行程數據大小:', JSON.stringify(finalData).length, '字符');
                    // console.log('🆔 Session ID:', sessionId);

                    const { data: insertedData, error: insertError } = await supabase
                      .from('temp_trips')
                      .insert({
                        trip_data: finalData,
                        session_id: sessionId
                      })
                      .select('id')
                      .single();

                    if (insertError) {
                      console.error('❌ 插入臨時行程失敗:', insertError);
                      console.error('❌ 錯誤詳情:', JSON.stringify(insertError, null, 2));
                      reject(new Error('無法保存行程數據'));
                      // 跳出流讀取迴圈
                      reader.cancel();
                      return;
                    }

                    // console.log('✅ 行程數據已成功插入 Supabase，ID:', insertedData.id);

                    // 更新 URL 以包含新的 tripId
                    const newUrl = new URL(window.location);
                    newUrl.searchParams.set('tripId', insertedData.id);
                    newUrl.searchParams.delete('generating'); // 移除 generating 參數
                    // console.log('🔗 更新 URL 從:', window.location.href, '到:', newUrl.href);
                    window.history.replaceState({}, '', newUrl);

                  } catch (dbError) {
                    console.error('數據庫操作失敗:', dbError);
                    reject(new Error('數據庫操作失敗'));
                    // 跳出流讀取迴圈
                    reader.cancel();
                    return;
                  }

                  resolve(finalData);
                  // ✅ 重要：在成功 resolve 後立即結束流讀取
                  reader.cancel();
                  break;
                }
                else if (eventType === 'done') {
                  // ✅ 收到完成信號，結束流讀取
                  console.log('✅ 後端已完成所有處理');
                  // 結束流讀取迴圈
                  reader.cancel();
                  break;
                }
                else if (eventType === 'error') {
                  console.error('串流錯誤:', eventData.message);
                  reject(new Error(eventData.message));
                  // 結束流讀取迴圈
                  reader.cancel();
                  break;
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
  }, []);



  useEffect(() => {
    // 如果有 tripId，優先從 URL 加載臨時行程
    if (tripId) {
      const loadTempTrip = async () => {
        try {
          setLoadingTrip(true);
          setStreamingStatus('正在載入行程...');

          const { data, error } = await supabase
            .from('temp_trips')
            .select('*')
            .eq('id', tripId)
            .single();

          if (error) throw error;

          if (data) {
            // console.log('📥 從 Supabase 載入的數據:', data);
            // console.log('📊 trip_data 結構:', data.trip_data);

            if (data.trip_data && data.trip_data.itineraries && data.trip_data.itineraries.length > 0) {
              // 有數據，直接顯示
              const loadedTrip = data.trip_data;
              // console.log('✅ 數據有效，設置 tripData:', loadedTrip);

              const promptFallback =
                loadedTrip.prompt ||
                loadedTrip.debug_prompt ||
                loadedTrip.question ||
                loadedTrip.user_query ||
                '';

              const finalTripData = {
                ...loadedTrip,
                question: loadedTrip.question || promptFallback,
                user_query: loadedTrip.user_query || loadedTrip.question || promptFallback,
                prompt: promptFallback || loadedTrip.prompt
              };

              // console.log('🎯 最終設置的 tripData:', finalTripData);
              setTripData(finalTripData);

              if (typeof loadedTrip.selectedItineraryIndex === 'number') {
                setSelectedItineraryIndex(loadedTrip.selectedItineraryIndex);
              }

              setStreamingStatus('');
              setLoadingTrip(false);
            } else {
              console.warn('⚠️ 數據無效或沒有行程，重新導向到規劃頁面');
              setLoadingTrip(false);
              navigate('/plan');
            }
          } else {
            throw new Error('行程數據不存在');
          }
        } catch (error) {
          console.error('載入臨時行程失敗:', error);
          setStreamingStatus('載入行程失敗，請重新生成');
          setLoadingTrip(false);
          navigate('/plan');
        }
      };

      loadTempTrip();
      return;
    }

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
      startGeneration(sessionId, question)
        .then((generatedData) => {
          // console.log('✅ 行程生成完成，設置數據');
          setTripData(generatedData);
          setGenerating(false);
          setStreamingStatus('');
        })
        .catch((error) => {
          console.error('行程生成失敗:', error);
          setStreamingStatus('行程生成失敗，請重新嘗試');
          setGenerating(false);
          navigate('/plan');
        });
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
  }, [tripId, isSavedTrip, savedTripId, session?.user?.id, isGenerating, sessionId, question, initialTripData, navigate, startGeneration, location.state?.debugPrompt, location.state?.prompt, location.state?.question]);

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

  // 載入行程時顯示簡單的載入指示器
  if (loadingTrip) {
    return (
      <div className={`min-h-screen bg-background-light dark:bg-background-dark transition-all duration-300 ${isScrolled ? 'pt-50' : 'pt-24'}`}>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
                載入行程中
              </h1>
            </div>

            <div className="flex items-center justify-center gap-3 p-8 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
              <div className="text-center">
                <p className="text-xl font-semibold text-blue-700 dark:text-blue-300">{streamingStatus}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!tripData || !tripData.itineraries || tripData.itineraries.length === 0) {
    /*
    console.log('❌ 渲染檢查失敗:', {
      hasTripData: !!tripData,
      hasItineraries: !!(tripData && tripData.itineraries),
      itinerariesLength: tripData?.itineraries?.length || 0,
      tripDataKeys: tripData ? Object.keys(tripData) : []
    });
    */
    return null;
  }

  // console.log('✅ 通過渲染檢查，開始渲染行程');

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

  // 計算時間線時間（從早上9點開始）
  const calculateTimelineTimes = (sections) => {
    let currentTime = new Date();
    currentTime.setHours(9, 0, 0, 0); // 從早上9點開始

    return sections.map((section, index) => {
      if (section.is_travel_time) {
        // 交通時間項目：累加交通時間到當前時間，但顯示交通時間描述
        let minutes = 0;
        
        // 確保 section.time 是字串再進行 match
        if (typeof section.time === 'string') {
            const travelTimeMatch = section.time.match(/交通時間:\s*約\s*(\d+)\s*分鐘/);
            if (travelTimeMatch) {
                minutes = parseInt(travelTimeMatch[1]);
            }
        } else if (section.travel_info && section.travel_info.duration_value) {
            // 如果 time 不是字串，嘗試從 travel_info 獲取
            minutes = Math.round(section.travel_info.duration_value / 60);
        }

        if (minutes > 0) {
            currentTime.setTime(currentTime.getTime() + minutes * 60 * 1000);
        }

        return {
          ...section,
          displayTime: section.time || '交通時間',
          actualTime: currentTime.toTimeString().slice(0, 5)
        };
      } else {
        // 景點項目：顯示到達時間
        const startTime = currentTime.toTimeString().slice(0, 5);
        let durationMinutes = 60; // 默認停留 1 小時

        // 解析建議停留時間
        if (section.time) {
          const timeStr = String(section.time);
          // 優先匹配 "建議停留 X 小時"
          const suggestedMatch = timeStr.match(/建議停留\s*(\d+(?:\.\d+)?)\s*小時/);
          
          if (suggestedMatch) {
            const hours = parseFloat(suggestedMatch[1]);
            durationMinutes = Math.round(hours * 60);
          } else if (timeStr.includes("小時")) {
            const hours = parseFloat(timeStr.replace(/[^0-9.]/g, ''));
            if (!isNaN(hours)) durationMinutes = Math.round(hours * 60);
          } else if (timeStr.includes("分鐘")) {
            const mins = parseFloat(timeStr.replace(/[^0-9.]/g, ''));
            if (!isNaN(mins)) durationMinutes = Math.round(mins);
          } else {
            // 嘗試直接解析數字 (假設單位是小時)
            const val = parseFloat(timeStr);
            if (!isNaN(val)) {
                // 如果數值小於 12，假設是小時；如果大於 12，假設是分鐘 (簡單啟發式)
                durationMinutes = val <= 12 ? Math.round(val * 60) : Math.round(val);
            }
          }
        }

        // 計算結束時間
        const endTimeDate = new Date(currentTime.getTime() + durationMinutes * 60000);
        const endTime = endTimeDate.toTimeString().slice(0, 5);
        
        // 更新當前時間為結束時間
        currentTime.setTime(endTimeDate.getTime());

        // 檢查下一個 section 是否為交通時間
        //const nextSection = sections[index + 1];
        //const isNextTravel = nextSection && nextSection.is_travel_time;

        // 如果下一個不是交通時間，且不是最後一個，則加上 30 分鐘緩衝/交通時間
        //if (!isNextTravel && index < sections.length - 1) {
        //     currentTime.setTime(currentTime.getTime() + 30 * 60000);
        //}

        const displayTime = `${startTime} - ${endTime}`;

        // 格式化建議停留時間顯示
        let formattedDuration = section.time;
        if (typeof section.time === 'number' || (typeof section.time === 'string' && !isNaN(parseFloat(section.time)) && !section.time.includes('小時') && !section.time.includes('分鐘'))) {
            const val = parseFloat(section.time);
            if (val <= 12) {
                formattedDuration = `${val} 小時`;
            } else {
                formattedDuration = `${val} 分鐘`;
            }
        }

        return {
          ...section,
          displayTime,
          actualTime: startTime,
          suggested_duration: formattedDuration // 保存格式化後的建議停留時間
        };
      }
    });
  };

  // 應用時間計算到當前天數的行程
  const sectionsWithTimes = calculateTimelineTimes(currentDaySections);

  // 渲染單個景點
  const renderLocation = (section, index) => {
    if (!section || !section.location) return null;

    // 檢查是否為交通時間項目
    const isTravelTime = section.is_travel_time === true;

    if (isTravelTime) {
      // 交通時間項目的渲染
      return (
        <div key={index} className="mb-4">
          <div className="flex gap-4">
            <div className="min-w-20 text-center">
              <div className="bg-blue-500 text-white px-3 py-2 rounded-full text-sm font-medium mb-2.5 shadow-lg shadow-blue-500/20">
                <i className="fas fa-route"></i>
              </div>
              <div className="w-3 h-3 bg-blue-500 rounded-full mx-auto border-2 border-white shadow-sm"></div>
              {index < currentDaySections.length - 1 && (
                <div className="w-0.5 h-full min-h-8 bg-blue-200 dark:bg-blue-700 mx-auto mt-1.5 rounded-sm"></div>
              )}
            </div>
            <div className="activity-card flex-1 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-4 shadow-sm transition-all duration-200">
              <div className="flex items-center gap-3">
                <i className="fas fa-clock text-blue-600 text-lg"></i>
                <div>
                  <p className="text-blue-800 dark:text-blue-300 font-medium">
                    {section.time}
                  </p>
                  <p className="text-blue-600 dark:text-blue-400 text-sm">
                    {section.location}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // 普通景點項目的渲染
    return (
      <div key={index} className="mb-6">
        <div className="flex gap-4">
          <div className="min-w-20 text-center">
            <div className="bg-primary text-white px-3 py-2 rounded-full text-sm font-medium mb-2.5 shadow-lg shadow-primary/20 cursor-move">
              <i className="fas fa-grip-vertical mr-1"></i>
              {section.displayTime || section.time || '時間未定'}
            </div>
            <div className="w-3 h-3 bg-primary rounded-full mx-auto border-2 border-white shadow-sm"></div>
            {index < currentDaySections.length - 1 && (
              <div className="w-0.5 h-full min-h-12 bg-slate-200 dark:bg-slate-700 mx-auto mt-1.5 rounded-sm"></div>
            )}
          </div>
          <div className="activity-card flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm min-h-48 flex flex-col justify-between transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 relative overflow-hidden cursor-pointer group"
               onClick={() => openAttractionDetail(section)}>
            
            {/* 點擊提示 */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 dark:group-hover:bg-white/5 transition-colors z-0"></div>
            <div className="absolute top-2 right-2 text-slate-300 group-hover:text-slate-500 dark:text-slate-600 dark:group-hover:text-slate-400 transition-colors z-10">
              <i className="fas fa-chevron-right"></i>
            </div>
            
            {/* RAG 驗證標章 - 左上角 */}
            {isVerifiedLocation(section.location) && (
              <div className="absolute top-0 left-0 bg-blue-600 text-white text-[10px] px-2 py-1 rounded-br-lg z-10 shadow-sm flex items-center gap-1" title="此地點來自真實資料庫檢索">
                <i className="fas fa-check-circle"></i>
                <span>真實資料驗證</span>
              </div>
            )}

            {/* 威爾森綜合評分 - 右上角 */}
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
                  {section.suggested_duration && (
                    <li className="mb-1 flex items-center gap-2">
                      <i className="fas fa-clock text-green-600 text-xs"></i>
                      <span className="text-green-700 dark:text-green-300 font-medium">{section.suggested_duration}</span>
                    </li>
                  )}
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
            
            {/* RAG 資料來源按鈕 */}
            {tripData.rag_raw_data && (
              <div className="mt-4">
                <button
                  onClick={() => setShowRagSource(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium border border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800"
                >
                  <i className="fas fa-database"></i>
                  查看 AI 參考的真實資料來源
                  <span className="bg-blue-200 text-blue-800 text-xs px-2 py-0.5 rounded-full dark:bg-blue-800 dark:text-blue-200">
                    {(tripData.rag_raw_data.attractions?.length || 0) + (tripData.rag_raw_data.restaurants?.length || 0)} 筆
                  </span>
                </button>
              </div>
            )}
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
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  第 {selectedDay} 天行程
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={handleCalculateTraffic}
                    disabled={calculatingTraffic}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-purple-500 text-white hover:bg-purple-600 disabled:opacity-50 transition-colors"
                  >
                    {calculatingTraffic ? (
                      <>
                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                        計算中...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-route"></i>
                        計算交通
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setIsEditMode(!isEditMode)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isEditMode
                        ? 'bg-green-500 text-white hover:bg-green-600'
                        : 'bg-blue-500 text-white hover:bg-blue-600'
                    }`}
                  >
                    <i className={`fas ${isEditMode ? 'fa-check' : 'fa-edit'}`}></i>
                    {isEditMode ? '完成編輯' : '調整順序'}
                  </button>
                </div>
              </div>

              {isEditMode ? (
                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId={`day-${selectedDay}`}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`timeline space-y-6 p-4 rounded-lg border-2 border-dashed transition-colors ${
                          snapshot.isDraggingOver
                            ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-300 dark:border-gray-600'
                        }`}
                      >
                        {sectionsWithTimes
                          .filter(section => !section.is_travel_time)
                          .map((section, i) => {
                          // 普通景點項目的編輯模式渲染
                          return (
                            <Draggable key={`${section.day}-${i}`} draggableId={`${section.day}-${i}`} index={i}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={`mb-6 transition-transform ${
                                    snapshot.isDragging ? 'rotate-3 scale-105' : ''
                                  }`}
                                >
                                  <div className="flex gap-4">
                                    <div className="min-w-20 text-center">
                                      <div className="bg-primary text-white px-3 py-2 rounded-full text-sm font-medium mb-2.5 shadow-lg shadow-primary/20 cursor-move">
                                        <i className="fas fa-grip-vertical mr-1"></i>
                                        {section.displayTime || section.time || '時間未定'}
                                      </div>
                                      <div className="w-3 h-3 bg-primary rounded-full mx-auto border-2 border-white shadow-sm"></div>
                                      {i < currentDaySections.filter(s => !s.is_travel_time).length - 1 && (
                                        <div className="w-0.5 h-full min-h-12 bg-slate-200 dark:bg-slate-700 mx-auto mt-1.5 rounded-sm"></div>
                                      )}
                                    </div>
                                    <div className="activity-card flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm min-h-48 flex flex-col justify-between transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 relative overflow-hidden">
                                      {/* 編輯模式提示 */}
                                      <div className="absolute top-2 left-2 text-xs text-blue-600 dark:text-blue-400 font-medium">
                                        <i className="fas fa-arrows-alt mr-1"></i>
                                        可拖曳調整順序
                                      </div>

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
                                            {section.suggested_duration && (
                                              <li className="mb-1 flex items-center gap-2">
                                                <i className="fas fa-clock text-green-600 text-xs"></i>
                                                <span className="text-green-700 dark:text-green-300 font-medium">{section.suggested_duration}</span>
                                              </li>
                                            )}
                                            {section.details.map((detail, i) => (
                                              <li key={i} className="mb-1">{detail}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          );
                        })}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              ) : (
                <div className="timeline">
                  {sectionsWithTimes.map((section, i) => renderLocation(section, i))}
                </div>
              )}
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
              onClick={() => {
                const shareUrl = window.location.href;
                navigator.clipboard.writeText(shareUrl).then(() => {
                  alert('行程連結已複製到剪貼簿！');
                }).catch(() => {
                  alert(`分享連結：${shareUrl}`);
                });
              }}
              className="flex-1 flex items-center justify-center gap-2 h-12 px-6 bg-blue-500 text-white rounded-lg text-sm font-bold hover:bg-blue-600 transition-colors"
            >
              <i className="fas fa-share"></i>
              分享行程
            </button>
            <button
              onClick={() => setShowReportModal(true)}
              className="flex-1 flex items-center justify-center gap-2 h-12 px-6 bg-red-500 text-white rounded-lg text-sm font-bold hover:bg-red-600 transition-colors"
            >
              <i className="fas fa-flag"></i>
              回報問題
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

          {/* 單一景點詳情 Modal */}
          {attractionDetailModalOpen && selectedAttraction && (
            <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50 p-4 backdrop-blur-sm">
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-2xl w-full p-0 relative max-h-[90vh] overflow-y-auto flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-slate-100 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10 flex justify-between items-start">
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
                      {selectedAttraction.location}
                      {isVerifiedLocation(selectedAttraction.location) && (
                        <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full flex items-center gap-1">
                          <i className="fas fa-check-circle"></i> 已驗證
                        </span>
                      )}
                    </h3>
                    <div className="text-slate-500 dark:text-slate-400 text-sm flex items-center gap-2">
                      <i className="fas fa-map-marker-alt"></i>
                      {selectedAttraction.maps_data?.address || selectedAttraction.address || '無地址資訊'}
                    </div>
                  </div>
                  <button
                    onClick={closeAttractionDetail}
                    className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto">
                  {/* 圖片 (如果有) */}
                  {selectedAttraction.maps_data?.photo_url && (
                    <div className="w-full h-64 rounded-lg bg-cover bg-center mb-6 shadow-md"
                         style={{ backgroundImage: `url(${selectedAttraction.maps_data.photo_url})` }}>
                    </div>
                  )}

                  {/* 基本資訊 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div className="bg-slate-50 dark:bg-slate-700/30 p-4 rounded-lg">
                      <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
                        <i className="fas fa-info-circle text-primary"></i> 基本資訊
                      </h4>
                      <div className="space-y-2 text-sm">
                        {selectedAttraction.maps_data?.rating && (
                          <div className="flex justify-between">
                            <span className="text-slate-500 dark:text-slate-400">評分</span>
                            <span className="font-medium text-slate-900 dark:text-white flex items-center gap-1">
                              {selectedAttraction.maps_data.rating} <i className="fas fa-star text-yellow-400 text-xs"></i>
                              <span className="text-slate-400 text-xs">({selectedAttraction.maps_data.user_ratings_total} 則評論)</span>
                            </span>
                          </div>
                        )}
                        {selectedAttraction.time && (
                          <div className="flex justify-between">
                            <span className="text-slate-500 dark:text-slate-400">建議停留</span>
                            <span className="font-medium text-slate-900 dark:text-white">{selectedAttraction.time}</span>
                          </div>
                        )}
                        {selectedAttraction.maps_data?.phone && (
                          <div className="flex justify-between">
                            <span className="text-slate-500 dark:text-slate-400">電話</span>
                            <span className="font-medium text-slate-900 dark:text-white">{selectedAttraction.maps_data.phone}</span>
                          </div>
                        )}
                        {selectedAttraction.maps_data?.website && (
                          <div className="flex justify-between">
                            <span className="text-slate-500 dark:text-slate-400">網站</span>
                            <a href={selectedAttraction.maps_data.website} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 dark:text-blue-400 hover:underline truncate max-w-[200px]">
                              訪問網站
                            </a>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-700/30 p-4 rounded-lg">
                      <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
                        <i className="fas fa-clock text-green-500"></i> 營業時間
                      </h4>
                      <div className="text-sm text-slate-600 dark:text-slate-300">
                        {selectedAttraction.maps_data?.opening_hours ? (
                          Array.isArray(selectedAttraction.maps_data.opening_hours) ? (
                            <ul className="space-y-1">
                              {selectedAttraction.maps_data.opening_hours.map((hour, idx) => (
                                <li key={idx}>{hour}</li>
                              ))}
                            </ul>
                          ) : (
                            <p>{selectedAttraction.maps_data.opening_hours}</p>
                          )
                        ) : (
                          <div className="flex flex-col items-start gap-2">
                            <p className="text-slate-400 italic">無營業時間資訊</p>
                            <a 
                              href={`https://www.google.com/search?q=${encodeURIComponent(selectedAttraction.location + ' 營業時間')}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-500 hover:text-blue-600 text-xs flex items-center gap-1 px-2 py-1 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-100 dark:border-blue-800 transition-colors"
                            >
                              <i className="fas fa-search"></i> 
                              Google 搜尋
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 詳細描述 */}
                  {selectedAttraction.details && selectedAttraction.details.length > 0 && (
                    <div className="mb-6">
                      <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-3">活動詳情</h4>
                      <ul className="list-disc pl-5 space-y-1 text-slate-600 dark:text-slate-300">
                        {selectedAttraction.details.map((detail, i) => (
                          <li key={i}>{detail}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* 回報區域 */}
                  <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-700">
                    <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-lg p-4 flex items-center justify-between flex-wrap gap-4">
                      <div>
                        <h4 className="font-semibold text-red-700 dark:text-red-400 mb-1">發現資料錯誤？</h4>
                        <p className="text-sm text-red-600 dark:text-red-300">
                          如果您發現此景點已歇業、地址錯誤或其他問題，請告訴我們。
                        </p>
                      </div>
                      <button
                        onClick={openReportFromDetail}
                        className="px-4 py-2 bg-white dark:bg-slate-800 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors font-medium text-sm flex items-center gap-2 shadow-sm"
                      >
                        <i className="fas fa-flag"></i>
                        回報問題
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 單一景點回報模態框 */}
          {attractionReportModalOpen && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6 relative max-h-[90vh] overflow-y-auto">
                <button
                  onClick={() => setAttractionReportModalOpen(false)}
                  className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
                >
                  <i className="fas fa-times text-xl"></i>
                </button>

                <div className="mb-6">
                  <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i className="fas fa-flag text-red-500 text-2xl"></i>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 text-center">
                    回報景點問題
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400 text-center">
                    發現此景點有問題嗎？請告訴我們詳細情況，幫助我們改進資料庫。
                  </p>
                </div>

                <form onSubmit={(e) => {
                  e.preventDefault();
                  submitAttractionReport();
                }} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      問題類型 <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={attractionReportReason}
                      onChange={(e) => setAttractionReportReason(e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    >
                      <option value="closed">景點已關閉</option>
                      <option value="inaccurate_info">資訊不準確</option>
                      <option value="missing_attractions">缺少重要景點</option>
                      <option value="wrong_schedule">時間安排不合理</option>
                      <option value="transport_issues">交通安排問題</option>
                      <option value="weather_issues">天氣資訊錯誤</option>
                      <option value="other">其他問題</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      詳細描述 <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={attractionReportDescription}
                      onChange={(e) => setAttractionReportDescription(e.target.value)}
                      required
                      placeholder="請詳細描述您發現的問題..."
                      rows={4}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setAttractionReportModalOpen(false)}
                      className="flex-1 px-4 py-3 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                    >
                      取消
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingAttractionReport}
                      className="flex-1 px-4 py-3 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isSubmittingAttractionReport ? (
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

          {/* RAG 資料來源 Modal */}
          {showRagSource && tripData.rag_raw_data && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-4xl w-full p-6 relative max-h-[90vh] overflow-y-auto flex flex-col">
                <div className="flex items-center justify-between mb-6 sticky top-0 bg-white dark:bg-slate-800 z-10 pb-4 border-b border-slate-100 dark:border-slate-700">
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                      <i className="fas fa-database"></i>
                    </div>
                    AI 參考資料來源 (RAG)
                  </h3>
                  <button
                    onClick={() => setShowRagSource(false)}
                    className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto">
                  <div>
                    <h4 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2 sticky top-0 bg-white dark:bg-slate-800 py-2">
                      <i className="fas fa-map-marked-alt text-green-500"></i>
                      參考景點 ({tripData.rag_raw_data.attractions?.length || 0})
                    </h4>
                    <div className="space-y-3">
                      {tripData.rag_raw_data.attractions?.map((spot, idx) => (
                        <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-700/30 rounded-lg border border-slate-200 dark:border-slate-600 hover:border-green-400 dark:hover:border-green-500 transition-colors group">
                          <div className="flex justify-between items-start gap-2">
                            <div className="font-bold text-slate-900 dark:text-white group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">{spot.name}</div>
                            {spot.rating && (
                              <div className="flex items-center gap-1 bg-yellow-50 dark:bg-yellow-900/20 px-2 py-1 rounded text-xs font-bold text-yellow-600 dark:text-yellow-400 whitespace-nowrap">
                                <i className="fas fa-star"></i> {spot.rating}
                              </div>
                            )}
                          </div>
                          <div className="text-sm text-slate-500 dark:text-slate-400 mt-2 flex items-start gap-2">
                            <i className="fas fa-map-marker-alt mt-1 text-slate-400"></i>
                            <span>{spot.address || spot.vicinity || spot.formatted_address || '無地址資訊'}</span>
                          </div>
                          {spot.user_ratings_total && (
                            <div className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                              <i className="fas fa-comment-alt"></i>
                              {spot.user_ratings_total} 則評論
                            </div>
                          )}
                          {spot.description && (
                             <div className="text-xs text-slate-500 dark:text-slate-400 mt-2 line-clamp-2">
                               {spot.description}
                             </div>
                          )}
                        </div>
                      ))}
                      {(!tripData.rag_raw_data.attractions || tripData.rag_raw_data.attractions.length === 0) && (
                        <div className="text-center py-8 text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-dashed border-slate-300 dark:border-slate-700">
                          無參考景點資料
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2 sticky top-0 bg-white dark:bg-slate-800 py-2">
                      <i className="fas fa-utensils text-orange-500"></i>
                      參考餐廳 ({tripData.rag_raw_data.restaurants?.length || 0})
                    </h4>
                    <div className="space-y-3">
                      {tripData.rag_raw_data.restaurants?.map((spot, idx) => (
                        <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-700/30 rounded-lg border border-slate-200 dark:border-slate-600 hover:border-orange-400 dark:hover:border-orange-500 transition-colors group">
                          <div className="flex justify-between items-start gap-2">
                            <div className="font-bold text-slate-900 dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">{spot.name}</div>
                            {spot.rating && (
                              <div className="flex items-center gap-1 bg-yellow-50 dark:bg-yellow-900/20 px-2 py-1 rounded text-xs font-bold text-yellow-600 dark:text-yellow-400 whitespace-nowrap">
                                <i className="fas fa-star"></i> {spot.rating}
                              </div>
                            )}
                          </div>
                          <div className="text-sm text-slate-500 dark:text-slate-400 mt-2 flex items-start gap-2">
                            <i className="fas fa-map-marker-alt mt-1 text-slate-400"></i>
                            <span>{spot.address || spot.vicinity || spot.formatted_address || '無地址資訊'}</span>
                          </div>
                          {spot.user_ratings_total && (
                            <div className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                              <i className="fas fa-comment-alt"></i>
                              {spot.user_ratings_total} 則評論
                            </div>
                          )}
                          {spot.description && (
                             <div className="text-xs text-slate-500 dark:text-slate-400 mt-2 line-clamp-2">
                               {spot.description}
                             </div>
                          )}
                        </div>
                      ))}
                      {(!tripData.rag_raw_data.restaurants || tripData.rag_raw_data.restaurants.length === 0) && (
                        <div className="text-center py-8 text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-dashed border-slate-300 dark:border-slate-700">
                          無參考餐廳資料
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-700 text-center text-sm text-slate-500">
                  <p>這些是 AI 在生成行程前，從資料庫中檢索到的真實地點資料。AI 會根據這些資料進行篩選和安排。</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default TripDetailPage;