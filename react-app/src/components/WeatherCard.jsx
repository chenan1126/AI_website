import React from 'react';

function WeatherCard({ weatherData, startDate, location, dayIndex = 0 }) {
  console.log('🔍 WeatherCard 接收到的數據：', { 
    hasWeatherData: !!weatherData, 
    isArray: Array.isArray(weatherData),
    length: weatherData?.length,
    weatherData: JSON.stringify(weatherData, null, 2),
    startDate,
    location
  });

  if (!weatherData || weatherData.length === 0) {
    console.log('❌ 天氣卡片未顯示，原因：weatherData 為空或不存在');
    return null;
  }

  // 找到第一個有有效天氣數據的日期
  let selectedDay = null;
  let actualDayIndex = dayIndex;
  
  // 首先嘗試請求的日期
  if (weatherData[dayIndex]) {
    const candidate = weatherData[dayIndex];
    console.log(`🔍 檢查日期索引 ${dayIndex} 的天氣:`, JSON.stringify(candidate, null, 2));
    
    // 檢查是否有有效的天氣數據
    // 數據結構: { date: "2025-10-14", weather: { condition, temp, ... } }
    const candidateWeather = candidate.weather;
    console.log(`🔍 天氣對象詳細信息:`, { 
      candidateWeather: JSON.stringify(candidateWeather, null, 2),
      hasWeather: !!candidateWeather, 
      hasCondition: !!candidateWeather?.condition,
      condition: candidateWeather?.condition,
      allKeys: candidateWeather ? Object.keys(candidateWeather) : []
    });
    
    // 允許 "無資料" 作為有效的 condition，只要有 weather 對象就行
    if (candidateWeather && typeof candidateWeather.condition !== 'undefined') {
      selectedDay = candidate;
      console.log('✅ 找到有效天氣數據（當前索引）');
    } else {
      console.log('❌ 當前索引天氣數據無效:', candidateWeather === null ? 'weather 是 null' : '沒有 weather 對象');
    }
  }
  
  // 如果請求的日期沒有數據，找到第一個有數據的日期
  if (!selectedDay) {
    console.log('🔍 當前索引無數據，搜索其他日期...');
    for (let i = 0; i < weatherData.length; i++) {
      const candidate = weatherData[i];
      const candidateWeather = candidate.weather;
      console.log(`🔍 檢查日期索引 ${i}:`, { 
        date: candidate.date,
        hasWeather: !!candidateWeather, 
        hasCondition: !!candidateWeather?.condition 
      });
      
      // 檢查 candidateWeather 是否有有效的天氣數據
      if (candidateWeather && typeof candidateWeather.condition !== 'undefined') {
        selectedDay = candidate;
        actualDayIndex = i;
        console.log(`✅ 找到有效天氣數據（索引 ${i}）`);
        break;
      }
    }
  }
  
  // 如果還是沒有數據，顯示無法獲取天氣資訊的消息
  if (!selectedDay) {
    console.log('❌ 天氣卡片未顯示，原因：所有日期的 weather 都是 null 或沒有 condition');
    console.log('💡 提示：請檢查後端日誌，查看天氣 API 調用和解析過程');
    return (
      <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-gray-800 dark:to-gray-900 rounded-xl p-6 mb-5 border border-slate-200 dark:border-gray-700 shadow-sm">
        <h3 className="text-slate-900 dark:text-slate-100 mb-5 flex items-center gap-2.5 text-xl font-semibold">
          <i className="fas fa-cloud text-slate-500"></i>
          {location && `${location} `}天氣資訊
        </h3>
        <div className="text-center py-8">
          <div className="text-4xl mb-4 text-slate-400">
            <i className="fas fa-cloud-sun"></i>
          </div>
          <p className="text-slate-600 dark:text-slate-400 text-lg">
            天氣資訊暫時無法獲取
          </p>
          <p className="text-slate-500 dark:text-slate-500 text-sm mt-2">
            可能是天氣 API 數據更新中，或該地區暫無預報資料
          </p>
        </div>
      </div>
    );
  }
  
  console.log('✅ 天氣卡片將顯示，selectedDay:', selectedDay);
  
  // Extract the actual weather data from the nested "weather" object
  const selectedDayWeather = selectedDay.weather;

  // 生成日期標題 - 修正時區問題
  let targetDate;
  if (startDate) {
    // 將 "YYYY-MM-DD" 格式解析為本地時區日期
    const [year, month, day] = startDate.split('-').map(Number);
    targetDate = new Date(year, month - 1, day);
  } else {
    targetDate = new Date();
  }
  targetDate.setDate(targetDate.getDate() + actualDayIndex);
  const dateString = `${targetDate.getMonth() + 1}/${targetDate.getDate()}`;

  return (
    <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-gray-800 dark:to-gray-900 rounded-xl p-6 mb-5 border border-slate-200 dark:border-gray-700 shadow-sm">
      <h3 className="text-slate-900 dark:text-slate-100 mb-5 flex items-center gap-2.5 text-xl font-semibold">
        <i className="fas fa-sun text-amber-500"></i>
        {location && `${location} `}{dateString} 天氣
      </h3>
      <div className="flex items-center justify-between flex-wrap gap-5">
        <div className="flex items-center gap-4">
          <div className="text-5xl drop-shadow-sm">
            {selectedDayWeather.icon || '☀️'}
          </div>
          <div>
            <div className="text-3xl font-bold mb-1 text-slate-900 dark:text-slate-100 drop-shadow-sm">
              {selectedDayWeather.temp && selectedDayWeather.temp !== '無資料' ? `${selectedDayWeather.temp}°C` : '暫無資料'}
            </div>
            <div className="text-base text-slate-600 dark:text-slate-400 drop-shadow-sm">
              {selectedDayWeather.condition && selectedDayWeather.condition !== '無資料' ? selectedDayWeather.condition : '天氣資訊更新中'}
            </div>
          </div>
        </div>
        <div className="flex gap-5 flex-wrap">
          <div className="text-center p-3 bg-white/80 dark:bg-gray-700/80 rounded-xl border border-slate-200 dark:border-gray-600 shadow-sm">
            <div className="text-xs text-slate-600 dark:text-slate-400 mb-1">最高溫</div>
            <div className="text-lg font-bold text-red-600 dark:text-red-400">
              {selectedDayWeather.max_temp && selectedDayWeather.max_temp !== '無資料' ? `${selectedDayWeather.max_temp}°C` : '暫無資料'}
            </div>
          </div>
          <div className="text-center p-3 bg-white/80 dark:bg-gray-700/80 rounded-xl border border-slate-200 dark:border-gray-600 shadow-sm">
            <div className="text-xs text-slate-600 dark:text-slate-400 mb-1">最低溫</div>
            <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
              {selectedDayWeather.min_temp && selectedDayWeather.min_temp !== '無資料' ? `${selectedDayWeather.min_temp}°C` : '暫無資料'}
            </div>
          </div>
          <div className="text-center p-3 bg-white/80 dark:bg-gray-700/80 rounded-xl border border-slate-200 dark:border-gray-600 shadow-sm">
            <div className="text-xs text-slate-600 dark:text-slate-400 mb-1">降雨機率</div>
            <div className="text-lg font-bold text-green-600 dark:text-green-400">
              {selectedDayWeather.rain_chance && selectedDayWeather.rain_chance !== '無資料' ? `${selectedDayWeather.rain_chance}%` : '暫無資料'}
            </div>
          </div>
          <div className="text-center p-3 bg-white/80 dark:bg-gray-700/80 rounded-xl border border-slate-200 dark:border-gray-600 shadow-sm">
            <div className="text-xs text-slate-600 dark:text-slate-400 mb-1 flex items-center justify-center gap-1">
              <i className="fas fa-sun text-xs"></i>
              紫外線指數
            </div>
            <div className={`text-lg font-bold ${
              selectedDayWeather.uvi >= 8 ? 'text-red-600 dark:text-red-400' : 
              selectedDayWeather.uvi >= 6 ? 'text-amber-600 dark:text-amber-400' : 
              selectedDayWeather.uvi >= 3 ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'
            }`}>
              {selectedDayWeather.uvi && selectedDayWeather.uvi !== '無資料' ? `${selectedDayWeather.uvi}` : '暫無資料'}
            </div>
            {selectedDayWeather.uv_exposure_level && (
              <div className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                {selectedDayWeather.uv_exposure_level}
              </div>
            )}
          </div>
        </div>
      </div>
      {selectedDayWeather.description && selectedDayWeather.description !== '無特別天氣提醒。' && (
        <div className="mt-5 p-4 bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-900/30 dark:to-orange-800/30 rounded-xl border border-orange-200 dark:border-orange-700 border-l-4 border-l-orange-500 text-slate-800 dark:text-orange-100 text-sm leading-relaxed">
          <h4 className="flex items-center gap-2 text-orange-700 dark:text-orange-300 mb-2 font-semibold">
            <i className="fas fa-exclamation-triangle"></i>
            天氣提醒
          </h4>
          {selectedDayWeather.description}
        </div>
      )}
    </div>
  );
}

export default WeatherCard;
