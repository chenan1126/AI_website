import React from 'react';

function WeatherCard({ weatherData, startDate, dayIndex = 0 }) {
  if (!weatherData || weatherData.length === 0) return null;

  // 根據選擇的天數顯示對應的天氣
  const selectedDay = weatherData[dayIndex] || weatherData[0];
  // Extract the actual weather data from the nested "weather" object
  const selectedDayWeather = selectedDay.weather || selectedDay;
  
  // 調試用：顯示天氣資料
  console.log('WeatherCard - dayIndex:', dayIndex);
  console.log('WeatherCard - weatherData:', weatherData);
  console.log('WeatherCard - selectedDay:', selectedDay);
  console.log('WeatherCard - selectedDayWeather:', selectedDayWeather);
  console.log('WeatherCard - startDate 原始值:', startDate);

  // 生成日期標題 - 修正時區問題
  let targetDate;
  if (startDate) {
    // 將 "YYYY-MM-DD" 格式解析為本地時區日期
    const [year, month, day] = startDate.split('-').map(Number);
    targetDate = new Date(year, month - 1, day);
    console.log('WeatherCard - 解析後的 targetDate:', targetDate);
    console.log('WeatherCard - 年月日:', year, month, day);
  } else {
    targetDate = new Date();
    console.log('WeatherCard - 沒有 startDate，使用當前日期:', targetDate);
  }
  targetDate.setDate(targetDate.getDate() + dayIndex);
  const dateString = `${targetDate.getMonth() + 1}/${targetDate.getDate()}`;
  console.log('WeatherCard - 最終顯示日期:', dateString, '計算後的 targetDate:', targetDate);

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
        {dateString} 天氣
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
              color: selectedDayWeather.uv_index >= 8 ? '#dc2626' : 
                     selectedDayWeather.uv_index >= 6 ? '#f59e0b' : 
                     selectedDayWeather.uv_index >= 3 ? '#eab308' : '#059669'
            }}>
              {selectedDayWeather.uv_index && selectedDayWeather.uv_index !== '無資料' ? selectedDayWeather.uv_index : '無資料'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WeatherCard;
