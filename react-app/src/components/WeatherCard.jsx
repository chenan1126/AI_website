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
    
    if (candidateWeather && candidateWeather.condition) {
      selectedDay = candidate;
      console.log('✅ 找到有效天氣數據（當前索引）');
    } else {
      console.log('❌ 當前索引天氣數據無效:', candidateWeather === null ? 'weather 是 null' : '沒有 condition');
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
      if (candidateWeather && candidateWeather.condition) {
        selectedDay = candidate;
        actualDayIndex = i;
        console.log(`✅ 找到有效天氣數據（索引 ${i}）`);
        break;
      }
    }
  }
  
  // 如果還是沒有數據，返回 null
  if (!selectedDay) {
    console.log('❌ 天氣卡片未顯示，原因：所有日期的 weather 都是 null 或沒有 condition');
    console.log('💡 提示：請檢查後端日誌，查看天氣 API 調用和解析過程');
    return null;
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
    <div style={{
      background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
      borderRadius: '16px',
      padding: '24px',
      marginBottom: '20px',
      border: '1px solid #e2e8f0',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
    }}>
      <h3 style={{
        color: '#1e293b',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        fontSize: '20px',
        fontWeight: '600'
      }}>
        <i className="fas fa-sun" style={{ color: '#f59e0b' }}></i>
        {location && `${location} `}{dateString} 天氣
      </h3>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '20px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '15px'
        }}>
          <div style={{
            fontSize: '48px',
            textShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            {selectedDayWeather.icon || '☀️'}
          </div>
          <div>
            <div style={{
              fontSize: '28px',
              fontWeight: 'bold',
              marginBottom: '5px',
              color: '#1e293b',
              textShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}>
              {selectedDayWeather.temp && selectedDayWeather.temp !== '無資料' ? `${selectedDayWeather.temp}°C` : '無資料'}
            </div>
            <div style={{
              fontSize: '16px',
              color: '#64748b',
              textShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}>
              {selectedDayWeather.condition || '晴天'}
            </div>
          </div>
        </div>
        <div style={{
          display: 'flex',
          gap: '20px',
          flexWrap: 'wrap'
        }}>
          <div style={{
            textAlign: 'center',
            padding: '12px 16px',
            background: 'rgba(255,255,255,0.8)',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
          }}>
            <div style={{
              fontSize: '12px',
              color: '#64748b',
              marginBottom: '4px'
            }}>最高溫</div>
            <div style={{
              fontSize: '18px',
              fontWeight: 'bold',
              color: '#dc2626'
            }}>
              {selectedDayWeather.max_temp && selectedDayWeather.max_temp !== '無資料' ? `${selectedDayWeather.max_temp}°C` : '無資料'}
            </div>
          </div>
          <div style={{
            textAlign: 'center',
            padding: '12px 16px',
            background: 'rgba(255,255,255,0.8)',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
          }}>
            <div style={{
              fontSize: '12px',
              color: '#64748b',
              marginBottom: '4px'
            }}>最低溫</div>
            <div style={{
              fontSize: '18px',
              fontWeight: 'bold',
              color: '#2563eb'
            }}>
              {selectedDayWeather.min_temp && selectedDayWeather.min_temp !== '無資料' ? `${selectedDayWeather.min_temp}°C` : '無資料'}
            </div>
          </div>
          <div style={{
            textAlign: 'center',
            padding: '12px 16px',
            background: 'rgba(255,255,255,0.8)',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
          }}>
            <div style={{
              fontSize: '12px',
              color: '#64748b',
              marginBottom: '4px'
            }}>降雨機率</div>
            <div style={{
              fontSize: '18px',
              fontWeight: 'bold',
              color: '#059669'
            }}>
              {selectedDayWeather.rain_chance && selectedDayWeather.rain_chance !== '無資料' ? `${selectedDayWeather.rain_chance}%` : '無資料'}
            </div>
          </div>
          <div style={{
            textAlign: 'center',
            padding: '12px 16px',
            background: 'rgba(255,255,255,0.8)',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
          }}>
            <div style={{
              fontSize: '12px',
              color: '#64748b',
              marginBottom: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px'
            }}>
              <i className="fas fa-sun" style={{ fontSize: '11px' }}></i>
              紫外線指數
            </div>
            <div style={{
              fontSize: '18px',
              fontWeight: 'bold',
              color: selectedDayWeather.uvi >= 8 ? '#dc2626' : 
                     selectedDayWeather.uvi >= 6 ? '#f59e0b' : 
                     selectedDayWeather.uvi >= 3 ? '#eab308' : '#059669'
            }}>
              {selectedDayWeather.uvi && selectedDayWeather.uvi !== '無資料' ? `${selectedDayWeather.uvi}%` : '無資料'}
            </div>
          </div>
        </div>
      </div>
      {selectedDayWeather.description && selectedDayWeather.description !== '無特別天氣提醒。' && (
        <div style={{
          marginTop: '20px',
          padding: '15px',
          background: 'linear-gradient(135deg, #fff7e0 0%, #fff0e3 100%)',
          borderRadius: '12px',
      border: '1px solid #ffe0b2',
          borderLeft: '5px solid #ff9800',
          color: '#5d4037',
          fontSize: '15px',
          lineHeight: '1.6'
        }}>
          <h4 style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: '#e65100',
            marginBottom: '8px',
            fontWeight: '600'
          }}>
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
