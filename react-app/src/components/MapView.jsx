import React, { useMemo } from 'react';
import { APIProvider, Map, AdvancedMarker, Pin, InfoWindow } from '@vis.gl/react-google-maps';

const MapView = ({ itineraries }) => {
  const [selectedMarker, setSelectedMarker] = React.useState(null);
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  // 從行程中提取所有地點
  const locations = useMemo(() => {
    if (!itineraries || itineraries.length === 0) return [];
    
    const allLocations = [];
    itineraries.forEach((itinerary, dayIndex) => {
      if (itinerary.activities) {
        itinerary.activities.forEach((activity, actIndex) => {
          if (activity.location && activity.coordinates) {
            allLocations.push({
              ...activity,
              dayIndex,
              actIndex,
              position: {
                lat: activity.coordinates.lat,
                lng: activity.coordinates.lng
              }
            });
          }
        });
      }
    });
    return allLocations;
  }, [itineraries]);

  // 計算地圖中心點（所有地點的平均位置）
  const center = useMemo(() => {
    if (locations.length === 0) {
      return { lat: 25.0330, lng: 121.5654 }; // 台北 101 預設
    }
    
    const avgLat = locations.reduce((sum, loc) => sum + loc.position.lat, 0) / locations.length;
    const avgLng = locations.reduce((sum, loc) => sum + loc.position.lng, 0) / locations.length;
    
    return { lat: avgLat, lng: avgLng };
  }, [locations]);

  // 顏色對應每一天
  const dayColors = [
    '#6366f1', // 紫藍
    '#ec4899', // 粉紅
    '#f59e0b', // 橘色
    '#10b981', // 綠色
    '#8b5cf6', // 紫色
    '#06b6d4', // 青色
    '#ef4444', // 紅色
  ];

  if (!apiKey) {
    return (
      <div style={{ 
        height: '100%', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#f3f4f6',
        borderRadius: '12px'
      }}>
        <p style={{ color: '#6b7280' }}>❌ Google Maps API Key 未設定</p>
      </div>
    );
  }

  if (locations.length === 0) {
    return (
      <div style={{ 
        height: '100%', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#f3f4f6',
        borderRadius: '12px'
      }}>
        <p style={{ color: '#6b7280' }}>🗺️ 沒有可顯示的地點</p>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', width: '100%', borderRadius: '12px', overflow: 'hidden' }}>
      <APIProvider apiKey={apiKey}>
        <Map
          defaultCenter={center}
          defaultZoom={12}
          mapId="trip-planner-map"
          gestureHandling="greedy"
          disableDefaultUI={false}
          style={{ width: '100%', height: '100%' }}
        >
          {/* 渲染所有標記 */}
          {locations.map((location, index) => {
            const color = dayColors[location.dayIndex % dayColors.length];
            
            return (
              <AdvancedMarker
                key={`${location.dayIndex}-${location.actIndex}`}
                position={location.position}
                onClick={() => setSelectedMarker(index)}
              >
                <Pin
                  background={color}
                  borderColor="#fff"
                  glyphColor="#fff"
                >
                  <div style={{ 
                    fontSize: '14px', 
                    fontWeight: 'bold',
                    color: '#fff'
                  }}>
                    {location.actIndex + 1}
                  </div>
                </Pin>
              </AdvancedMarker>
            );
          })}

          {/* InfoWindow - 點擊標記時顯示詳細資訊 */}
          {selectedMarker !== null && (
            <InfoWindow
              position={locations[selectedMarker].position}
              onCloseClick={() => setSelectedMarker(null)}
            >
              <div style={{ padding: '10px', maxWidth: '250px' }}>
                <h3 style={{ 
                  margin: '0 0 8px 0', 
                  fontSize: '16px',
                  color: '#1f2937',
                  fontWeight: '600'
                }}>
                  {locations[selectedMarker].location}
                </h3>
                <div style={{ 
                  fontSize: '13px', 
                  color: '#6b7280',
                  marginBottom: '8px'
                }}>
                  <strong>時間：</strong>{locations[selectedMarker].time || '未指定'}
                </div>
                {locations[selectedMarker].description && (
                  <div style={{ 
                    fontSize: '13px', 
                    color: '#4b5563',
                    lineHeight: '1.5'
                  }}>
                    {locations[selectedMarker].description}
                  </div>
                )}
                {locations[selectedMarker].maps_data?.rating && (
                  <div style={{ 
                    marginTop: '8px',
                    padding: '6px 10px',
                    background: '#fef3c7',
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: '#92400e'
                  }}>
                    ⭐ {locations[selectedMarker].maps_data.rating.toFixed(1)} / 5.0
                  </div>
                )}
              </div>
            </InfoWindow>
          )}
        </Map>
      </APIProvider>

      {/* 圖例 */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: '20px',
        background: 'white',
        padding: '12px 16px',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        zIndex: 1000
      }}>
        <div style={{ 
          fontSize: '13px', 
          fontWeight: '600', 
          marginBottom: '8px',
          color: '#1f2937'
        }}>
          行程天數
        </div>
        {itineraries.map((itinerary, index) => (
          <div key={index} style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px',
            marginBottom: '4px'
          }}>
            <div style={{
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              background: dayColors[index % dayColors.length],
              border: '2px solid white',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
            }}></div>
            <span style={{ fontSize: '12px', color: '#4b5563' }}>
              {itinerary.day || `第 ${index + 1} 天`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MapView;
