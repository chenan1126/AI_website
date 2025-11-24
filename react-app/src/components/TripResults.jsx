import React from 'react';
import { useNavigate } from 'react-router-dom';
import WeatherCard from './WeatherCard';
import MapView from './MapView';

function TripResults({ data }) {
  const navigate = useNavigate();
  const [dayIndices, setDayIndices] = React.useState({});
  const [selectedItinerary, setSelectedItinerary] = React.useState(null);
  const [selectedDay, setSelectedDay] = React.useState(1); // 新增：當前選擇的天數
  
  // 新增：回報視窗狀態
  const [reportModalOpen, setReportModalOpen] = React.useState(false);
  const [reportingLocation, setReportingLocation] = React.useState(null);
  const [reportReason, setReportReason] = React.useState('closed'); // closed, wrong_info, other
  const [reportDescription, setReportDescription] = React.useState('');
  const [isSubmittingReport, setIsSubmittingReport] = React.useState(false);

  const openReportModal = (locationName) => {
    setReportingLocation(locationName);
    setReportModalOpen(true);
    setReportReason('closed');
    setReportDescription('');
  };

  const closeReportModal = () => {
    setReportModalOpen(false);
    setReportingLocation(null);
  };

  const submitReport = async () => {
    if (!reportingLocation) return;
    
    setIsSubmittingReport(true);
    try {
      const response = await fetch('/api/report-issue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          attractionName: reportingLocation,
          reportType: reportReason,
          description: reportDescription
        }),
      });
      
      if (response.ok) {
        alert('感謝您的回報！我們會盡快審核並更新資料庫。');
        closeReportModal();
      } else {
        alert('回報失敗，請稍後再試。');
      }
    } catch (error) {
      console.error('Error submitting report:', error);
      alert('發生錯誤，請稍後再試。');
    } finally {
      setIsSubmittingReport(false);
    }
  };

  if (!data || !data.itineraries) {
    return null;
  }

  const handleItinerarySelect = (index) => {
    // 跳轉到 TripDetailPage，並傳遞選擇的行程數據
    navigate('/trip-detail', {
      state: {
        tripData: {
          ...data,
          selectedItineraryIndex: index
        }
      }
    });
  };

  const handleResetSelection = () => {
    setSelectedItinerary(null);
    setSelectedDay(1);
  };

  // 渲染單個景點（統一高度）
  const renderLocation = (section, index, totalSections) => {
    if (!section || !section.location) return null;
    return (
      <div key={index} className="mb-6">
        <div className="flex gap-4">
          <div className="min-w-20 text-center">
            <div className="bg-primary text-white px-3 py-2 rounded-full text-sm font-medium mb-2.5 shadow-lg shadow-primary/20">
              {section.time ? (section.time.includes(':') || section.time.includes('建議停留') ? section.time : `建議停留 ${section.time}`) : '時間未定'}
            </div>
            <div className="w-3 h-3 bg-primary rounded-full mx-auto border-2 border-white shadow-sm"></div>
            {index < totalSections - 1 && (
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

            {/* 回報按鈕 */}
            <div className="mb-3">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  openReportModal(section.location);
                }}
                className="px-3 py-1.5 bg-slate-50 hover:bg-red-50 text-slate-500 hover:text-red-600 text-xs rounded-md border border-slate-200 hover:border-red-200 transition-all flex items-center gap-1.5"
                title="回報此地點已歇業或資訊錯誤"
              >
                <i className="fas fa-exclamation-circle"></i> 
                <span>回報問題 (歇業/錯誤)</span>
              </button>
            </div>

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
                    <strong>距離: {section.travel_info.distance}</strong>
                  </span>
                  <span className="flex items-center gap-1">
                    <i className="fas fa-clock text-purple-500"></i>
                    <strong>時間: {section.travel_info.duration}</strong>
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };


  // 分頁導航（多天行程）
  // 分組行程段落
  const groupSectionsByDate = (sections) => {
    const groups = {};
    sections.forEach((section) => {
      const day = section.day || 1;
      if (!groups[day]) groups[day] = [];
      groups[day].push(section);
    });
    return groups;
  };

  const renderItinerary = (itinerary, index, isSelectionMode = false) => {
    // 判斷是否多天行程
    const sectionsByDate = groupSectionsByDate(itinerary.sections || []);
    const days = Object.keys(sectionsByDate);
    const isMultiDay = days.length > 1;
    const currentDayIndex = dayIndices[index] || 0;
    const currentDay = days[currentDayIndex] || days[0];
    return (
      <div key={index} className={`trip-card bg-white dark:bg-slate-800 rounded-xl p-7.5 mb-6.25 shadow-sm border-2 dark:border-slate-700 min-h-[600px] flex flex-col transition-all duration-200 cursor-pointer relative ${
        isSelectionMode ? 'border-slate-200 dark:border-slate-600' : 'border-slate-200 dark:border-slate-700'
      }`}
        onClick={isSelectionMode ? () => handleItinerarySelect(index) : undefined}
        style={{
          animation: `fadeInUp 0.6s ease-out ${index * 0.1}s forwards`,
          opacity: 0,
          transform: 'translateY(20px)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = '0 16px 48px rgba(0,0,0,0.15)';
          e.currentTarget.style.transform = 'translateY(-2px)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
          e.currentTarget.style.transform = 'translateY(0)';
        }}>
        <div className="trip-title-section mb-5">
          <h2 className="text-slate-900 dark:text-white mb-4 font-semibold">
            {itinerary.title || `行程方案 ${index + 1}`}
            {isSelectionMode && (
              <span className="inline-block ml-2.5 bg-primary text-white px-2 py-0.5 rounded-full text-xs font-medium">
                可選擇
              </span>
            )}
          </h2>

          {/* 生成方式說明 */}
          {itinerary.generationMethod && (
            <div className={`rounded-lg p-3.5 mb-3 text-xs text-slate-600 dark:text-slate-400 flex items-start gap-2 ${
              itinerary.useRAG ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : 'bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800'
            }`}>
              <i className={`mt-0.5 ${itinerary.useRAG ? 'fas fa-check-circle text-green-500' : 'fas fa-info-circle text-purple-500'}`}></i>
              <div>
                <strong className="text-slate-800 dark:text-slate-200">
                  {itinerary.useRAG ? '真實景點資料' : 'AI 創意推薦'}:
                </strong>
                {' '}
                {itinerary.useRAG
                  ? '此行程基於我們的 11,078 筆真實景點和餐廳資料庫，所有地點都經過驗證，包含真實地址、電話和營業時間。'
                  : '此行程由 AI 根據您的需求創意生成，可能包含更多樣化的建議，但部分地點需要您自行驗證。'
                }
              </div>
            </div>
          )}

          {itinerary.recommendation_score && (
            <div className={`inline-flex items-center gap-1.5 font-bold mb-2.5 px-3 py-2 rounded-full text-white text-sm ${
              itinerary.recommendation_score >= 4.5 ? 'bg-green-500' :
              itinerary.recommendation_score >= 4.0 ? 'bg-green-400' : 'bg-orange-500'
            }`}>
              <i className="fas fa-star"></i>
              推薦指數: {itinerary.recommendation_score}/5
            </div>
          )}
          {(itinerary.playing_time_display || itinerary.travel_ratio_display) && (
            <div className="mt-2.5 flex gap-4 flex-wrap">
              {itinerary.playing_time_display && (
                <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 px-2.5 py-1.5 rounded-full text-sm inline-flex items-center gap-1">
                  <i className="fas fa-clock"></i>
                  遊玩時間: {itinerary.playing_time_display}
                </div>
              )}
              {itinerary.travel_ratio_display && (
                <div className="bg-orange-50 dark:bg-orange-900/20 text-orange-800 dark:text-orange-300 px-2.5 py-1.5 rounded-full text-sm inline-flex items-center gap-1">
                  <i className="fas fa-route"></i>
                  交通時間佔比: {itinerary.travel_ratio_display}
                </div>
              )}
            </div>
          )}
        </div>

        {isMultiDay && (
          <div className="mb-4 flex items-center justify-center gap-4">
            <button
              className="nav-btn px-5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-primary cursor-pointer font-medium text-sm transition-all duration-200 shadow-sm hover:shadow-lg hover:bg-primary hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => {
                const newDayIndex = Math.max((dayIndices[index] || 0) - 1, 0);
                setDayIndices(prev => ({...prev, [index]: newDayIndex}));
                setSelectedDay(parseInt(days[newDayIndex]) || 1);
              }}
              disabled={(dayIndices[index] || 0) === 0}
            >上一天</button>
            <span className="font-medium text-slate-900 dark:text-white text-base px-4 py-2 bg-slate-100 dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600">
              第 {parseInt(currentDay)} 天 / 共 {days.length} 天
            </span>
            <button
              className="nav-btn px-5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-primary cursor-pointer font-medium text-sm transition-all duration-200 shadow-sm hover:shadow-lg hover:bg-primary hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => {
                const newDayIndex = Math.min((dayIndices[index] || 0) + 1, days.length - 1);
                setDayIndices(prev => ({...prev, [index]: newDayIndex}));
                setSelectedDay(parseInt(days[newDayIndex]) || 1);
              }}
              disabled={(dayIndices[index] || 0) === days.length - 1}
            >下一天</button>
          </div>
        )}
        <div className="timeline mt-5">
          {(isMultiDay
            ? sectionsByDate[currentDay]
            : itinerary.sections
          )?.map((section, i) => renderLocation(section, i, (isMultiDay ? sectionsByDate[currentDay].length : itinerary.sections.length)))}
        </div>
      </div>
    );
  };

  return (
    <div className="response-wrapper">
      {/* 顯示天氣卡片 - 在最上方 */}
      {data.weather_data && data.weather_data.length > 0 && (
        <div className="mb-8">
          <WeatherCard
            weatherData={data.weather_data}
            startDate={data.start_date}
            location={data.location}
            dayIndex={0}
          />
        </div>
      )}

      {/* 地圖視圖 - 只在選擇了具體方案後才顯示 */}
      {selectedItinerary !== null && data.itineraries && data.itineraries.length > 0 && (() => {
        const selectedItineraryData = data.itineraries[selectedItinerary];
        const sections = selectedItineraryData.sections || [];

        // 計算總天數
        const totalDays = Math.max(...sections.map(s => s.day || 1));

        // 過濾出當前選擇天數的景點
        const dayData = {
          ...selectedItineraryData,
          sections: sections.filter(s => (s.day || 1) === selectedDay)
        };

        return (
          <div className="mb-8">
            {/* 地圖容器 */}
            <div className="h-[500px] rounded-xl overflow-hidden shadow-lg relative">
              <MapView itineraries={[dayData]} />

              {/* 顯示當前天數標籤 */}
              {totalDays > 1 && (
                <div className="absolute top-4 right-4 bg-primary/90 text-white px-4 py-2 rounded-lg font-semibold text-sm shadow-lg">
                  第 {selectedDay} 天行程
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {data.itineraries.length > 1 && selectedItinerary === null && (
        <div className="text-center mb-5 p-5 bg-slate-100 dark:bg-slate-800 rounded-lg">
          <h3 className="text-slate-900 dark:text-white mb-2.5">請選擇一個行程方案</h3>
          <p className="text-slate-600 dark:text-slate-400">我們為您生成了兩個不同的行程建議，請點擊選擇您喜歡的方案</p>
        </div>
      )}

      {selectedItinerary !== null && (
        <div className="text-center mb-5">
          <button
            onClick={handleResetSelection}
            className="bg-primary text-white border-none px-5 py-2.5 rounded-md cursor-pointer text-sm flex items-center gap-2 mx-auto"
          >
            <i className="fas fa-arrow-left"></i> 返回選擇其他方案
          </button>
        </div>
      )}

      <div className="itineraries-container grid gap-5" style={{
        gridTemplateColumns: selectedItinerary === null && data.itineraries.length > 1 ? 'repeat(2, 1fr)' : '1fr'
      }}>
        {data.itineraries
          .filter((_, index) => selectedItinerary === null || selectedItinerary === index)
          .map((itinerary, index) => renderItinerary(itinerary, selectedItinerary === null ? index : selectedItinerary, selectedItinerary === null))
        }
      </div>

      {/* 回報問題的 Modal */}
      {reportModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 max-w-md w-full">
            <h3 className="text-slate-900 dark:text-white text-lg font-semibold mb-4">
              回報問題
            </h3>
            <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">
              您可以幫助我們改善資料品質，感謝您的回報！
            </p>

            {/* 問題類型選擇 */}
            <div className="mb-4">
              <label className="block text-slate-700 dark:text-slate-300 text-sm font-medium mb-2">
                問題類型
              </label>
              <select
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                className="block w-full p-2.5 text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-700 rounded-md border border-slate-300 dark:border-slate-600 focus:ring-2 focus:ring-primary focus:outline-none"
              >
                <option value="closed">景點已關閉</option>
                <option value="wrong_info">資訊錯誤</option>
                <option value="other">其他問題</option>
              </select>
            </div>

            {/* 問題描述 */}
            <div className="mb-4">
              <label className="block text-slate-700 dark:text-slate-300 text-sm font-medium mb-2">
                問題描述
              </label>
              <textarea
                value={reportDescription}
                onChange={(e) => setReportDescription(e.target.value)}
                className="block w-full p-2.5 text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-700 rounded-md border border-slate-300 dark:border-slate-600 focus:ring-2 focus:ring-primary focus:outline-none"
                rows="3"
                placeholder="請簡要描述您發現的問題..."
              ></textarea>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={closeReportModal}
                className="px-4 py-2 text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-md shadow-sm hover:bg-slate-200 dark:hover:bg-slate-600 transition-all duration-200"
              >
                取消
              </button>
              <button
                onClick={submitReport}
                className="px-4 py-2 bg-primary text-white rounded-md shadow-md flex items-center gap-2 transition-all duration-200 hover:bg-primary/90 disabled:opacity-50"
                disabled={isSubmittingReport}
              >
                {isSubmittingReport && <i className="fas fa-spinner fa-spin"></i>}
                回報問題
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TripResults;
