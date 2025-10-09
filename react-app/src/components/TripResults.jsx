import React from 'react';
import WeatherCard from './WeatherCard';

function TripResults({ data }) {
  const [dayIndices, setDayIndices] = React.useState({});

  if (!data || !data.itineraries) {
    return null;
  }

  // 渲染單個景點（統一高度）
  const renderLocation = (section, index, totalSections) => {
    if (!section || !section.location) return null;
    return (
      <div key={index} style={{ marginBottom: '25px' }}>
        <div style={{ display: 'flex', gap: '15px' }}>
          <div style={{ minWidth: '80px', textAlign: 'center' }}>
            <div style={{
              background: '#6366f1',
              color: 'white',
              padding: '8px 12px',
              borderRadius: '20px',
              fontSize: '14px',
              fontWeight: '500',
              marginBottom: '10px',
              boxShadow: '0 2px 8px rgba(99, 102, 241, 0.2)'
            }}>{section.time || '時間未定'}</div>
            <div style={{
              width: '12px',
              height: '12px',
              background: '#6366f1',
              borderRadius: '50%',
              margin: '0 auto',
              border: '3px solid #fff',
              boxShadow: '0 0 0 4px rgba(99, 102, 241, 0.1)'
            }}></div>
            {index < totalSections - 1 && (
              <div style={{
                width: '2px',
                height: '100%',
                minHeight: '50px',
                background: '#e2e8f0',
                margin: '5px auto',
                borderRadius: '1px'
              }}></div>
            )}
          </div>
          <div className="activity-card" style={{
            flex: 1,
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '25px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            minHeight: '200px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            transition: 'all 0.2s ease',
            position: 'relative',
            overflow: 'hidden'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
            e.currentTarget.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}>
            <h3 style={{ color: '#1e293b', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600' }}>
              <i className="fas fa-map-marker-alt"></i>
              {section.location}
            </h3>
            {section.rating && (
              <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ color: '#ff9800', fontSize: '18px' }}>
                  {'★'.repeat(Math.floor(section.rating))}
                  {'☆'.repeat(5 - Math.floor(section.rating))}
                </div>
                <span style={{ color: '#666', fontSize: '14px' }}>{section.rating}/5</span>
                {section.maps_data && section.maps_data.user_ratings_total && (
                  <span style={{ color: '#999', fontSize: '13px' }}>({section.maps_data.user_ratings_total} 則評論)</span>
                )}
              </div>
            )}
            {(section.address || (section.maps_data && section.maps_data.address)) && (
              <div style={{ color: '#666', fontSize: '14px', marginBottom: '15px', display: 'flex', alignItems: 'start', gap: '6px' }}>
                <i className="fas fa-location-arrow" style={{ marginTop: '3px' }}></i>
                <span>{section.maps_data && section.maps_data.address ? section.maps_data.address : section.address}</span>
              </div>
            )}
            {section.details && section.details.length > 0 && (
              <div>
                <h4 style={{ color: '#333', fontSize: '16px', marginBottom: '10px' }}>
                  <i className="fas fa-info-circle"></i> 活動詳情
                </h4>
                <ul style={{ paddingLeft: '20px', color: '#555' }}>
                  {section.details.map((detail, i) => (
                    <li key={i} style={{ marginBottom: '5px' }}>{detail}</li>
                  ))}
                </ul>
              </div>
            )}
            {section.travel_info && (
              <div style={{
                marginTop: '15px',
                padding: '10px',
                background: 'linear-gradient(135deg, #e3f2fd 0%, #f1f8e9 100%)',
                borderLeft: '4px solid #2196f3',
                borderRadius: '4px'
              }}>
                <div style={{ fontWeight: 'bold', color: '#1565c0', marginBottom: '5px' }}>
                  <i className="fas fa-route"></i> 前往下一個地點
                </div>
                <div style={{ fontSize: '14px', color: '#424242' }}>
                  <i className="fas fa-arrow-right" style={{ marginRight: '5px', color: '#4caf50' }}></i>
                  <strong>{section.travel_info.from} → {section.travel_info.to}</strong>
                </div>
                <div style={{ display: 'flex', gap: '15px', marginTop: '8px', fontSize: '13px' }}>
                  <span><i className="fas fa-road" style={{ color: '#ff9800', marginRight: '5px' }}></i>距離: <strong>{section.travel_info.distance}</strong></span>
                  <span><i className="fas fa-clock" style={{ color: '#9c27b0', marginRight: '5px' }}></i>時間: <strong>{section.travel_info.duration}</strong></span>
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

  const renderItinerary = (itinerary, index) => {
    // 判斷是否多天行程
    const sectionsByDate = groupSectionsByDate(itinerary.sections || []);
    const days = Object.keys(sectionsByDate);
    const isMultiDay = days.length > 1;
    const currentDayIndex = dayIndices[index] || 0;
    const currentDay = days[currentDayIndex] || days[0];
    return (
      <div key={index} className="trip-card" style={{
        background: '#fff',
        borderRadius: '12px',
        padding: '30px',
        marginBottom: '25px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        border: '1px solid #e2e8f0',
        minHeight: '600px',
        display: 'flex',
        flexDirection: 'column',
        transition: 'all 0.2s ease',
        cursor: 'pointer',
        animation: `fadeInUp 0.6s ease-out ${index * 0.1}s forwards`,
        opacity: 0,
        transform: 'translateY(20px)'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}>
        <div className="trip-title-section" style={{ marginBottom: '20px' }}>
          <h2 style={{ color: '#1e293b', marginBottom: '15px', fontWeight: '600' }}>{itinerary.title || `行程方案 ${index + 1}`}</h2>
          
          {/* 顯示天氣卡片 */}
          {data.weather_data && data.weather_data.length > 0 && (
            <WeatherCard 
              weatherData={data.weather_data} 
              startDate={data.start_date} 
              dayIndex={currentDayIndex} 
            />
          )}
          
          {itinerary.recommendation_score && (
            <div style={{
              background: itinerary.recommendation_score >= 4.5 ? '#4caf50' : 
                         itinerary.recommendation_score >= 4.0 ? '#8bc34a' : '#ff9800',
              color: 'white',
              padding: '8px 12px',
              borderRadius: '20px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 'bold',
              marginBottom: '10px'
            }}>
              <i className="fas fa-star"></i>
              推薦指數: {itinerary.recommendation_score}/5
            </div>
          )}
          {(itinerary.playing_time_display || itinerary.travel_ratio_display) && (
            <div style={{ marginTop: '10px', display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
              {itinerary.playing_time_display && (
                <div style={{
                  background: '#e3f2fd',
                  color: '#1976d2',
                  padding: '6px 10px',
                  borderRadius: '15px',
                  fontSize: '0.9rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <i className="fas fa-clock"></i>
                  遊玩時間: {itinerary.playing_time_display}
                </div>
              )}
              {itinerary.travel_ratio_display && (
                <div style={{
                  background: '#fff3e0',
                  color: '#f57c00',
                  padding: '6px 10px',
                  borderRadius: '15px',
                  fontSize: '0.9rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <i className="fas fa-route"></i>
                  交通時間佔比: {itinerary.travel_ratio_display}
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* 天氣卡片 - 每個行程方案都有獨立的天氣顯示 */}
        {data.weather_data && data.weather_data.length > 0 && (
          <WeatherCard 
            weatherData={data.weather_data} 
            startDate={data.start_date}
            dayIndex={currentDayIndex}
          />
        )}
        
        {isMultiDay && (
          <div style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px' }}>
            <button
              className="nav-btn"
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                background: '#fff',
                color: '#6366f1',
                cursor: 'pointer',
                fontWeight: '500',
                fontSize: '14px',
                transition: 'all 0.2s ease',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#6366f1';
                e.currentTarget.style.color = '#fff';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(99, 102, 241, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#fff';
                e.currentTarget.style.color = '#6366f1';
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
              }}
              onClick={() => setDayIndices(prev => ({...prev, [index]: Math.max((prev[index] || 0) - 1, 0)}))}
              disabled={(dayIndices[index] || 0) === 0}
            >上一天</button>
            <span style={{
              fontWeight: '500',
              color: '#1e293b',
              fontSize: '16px',
              padding: '8px 16px',
              background: '#f8fafc',
              borderRadius: '8px',
              border: '1px solid #e2e8f0'
            }}>第 {parseInt(currentDay)} 天 / 共 {days.length} 天</span>
            <button
              className="nav-btn"
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                background: '#fff',
                color: '#6366f1',
                cursor: 'pointer',
                fontWeight: '500',
                fontSize: '14px',
                transition: 'all 0.2s ease',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#6366f1';
                e.currentTarget.style.color = '#fff';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(99, 102, 241, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#fff';
                e.currentTarget.style.color = '#6366f1';
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
              }}
              onClick={() => setDayIndices(prev => ({...prev, [index]: Math.min((prev[index] || 0) + 1, days.length - 1)}))}
              disabled={(dayIndices[index] || 0) === days.length - 1}
            >下一天</button>
          </div>
        )}
        <div className="timeline" style={{ marginTop: '20px' }}>
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
      <div className="itineraries-container" style={{
        display: 'grid',
        gridTemplateColumns: data.itineraries.length > 1 ? 'repeat(2, 1fr)' : '1fr',
        gap: '20px'
      }}>
        {data.itineraries.map((itinerary, index) => renderItinerary(itinerary, index))}
      </div>
    </div>
  );
}

export default TripResults;
