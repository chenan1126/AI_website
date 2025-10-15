import React, { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// 修復 Leaflet 預設圖標問題
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const MapView = ({ itineraries }) => {
  // 從行程中提取所有地點
  const locations = useMemo(() => {
    if (!itineraries || itineraries.length === 0) return [];
    
    const allLocations = [];
    itineraries.forEach((itinerary, dayIndex) => {
      // 支援兩種數據格式：activities 或 sections
      const items = itinerary.activities || itinerary.sections || [];
      items.forEach((item, actIndex) => {
        if (item.location && item.coordinates) {
          allLocations.push({
            ...item,
            dayIndex,
            actIndex,
            position: [item.coordinates.lat, item.coordinates.lng]
          });
        }
      });
    });
    return allLocations;
  }, [itineraries]);

  // 計算地圖中心點
  const center = useMemo(() => {
    if (locations.length === 0) {
      return [25.0330, 121.5654]; // 台北 101 預設
    }
    
    const avgLat = locations.reduce((sum, loc) => sum + loc.position[0], 0) / locations.length;
    const avgLng = locations.reduce((sum, loc) => sum + loc.position[1], 0) / locations.length;
    
    return [avgLat, avgLng];
  }, [locations]);

  // 提取每一天的路線（用於繪製連接線）
  const dayRoutes = useMemo(() => {
    const routes = [];
    itineraries.forEach((itinerary, dayIndex) => {
      // 支援兩種數據格式：activities 或 sections
      const items = itinerary.activities || itinerary.sections || [];
      const dayLocations = items
        .filter(item => item.coordinates)
        .map(item => [item.coordinates.lat, item.coordinates.lng]);
      if (dayLocations.length > 1) {
        routes.push({ dayIndex, positions: dayLocations });
      }
    });
    return routes;
  }, [itineraries]);

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

  // 創建自定義圖標
  const createCustomIcon = (color, number) => {
    return L.divIcon({
      className: 'custom-marker',
      html: `
        <div style="
          background: ${color};
          width: 36px;
          height: 36px;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <span style="
            transform: rotate(45deg);
            color: white;
            font-weight: bold;
            font-size: 14px;
          ">${number}</span>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 36],
      popupAnchor: [0, -36]
    });
  };

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
    <div style={{ height: '100%', width: '100%', borderRadius: '12px', overflow: 'hidden', position: 'relative' }}>
      <MapContainer
        center={center}
        zoom={12}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* 繪製每一天的路線 */}
        {dayRoutes.map((route, index) => (
          <Polyline
            key={`route-${index}`}
            positions={route.positions}
            color={dayColors[route.dayIndex % dayColors.length]}
            weight={3}
            opacity={0.6}
            dashArray="10, 10"
          />
        ))}

        {/* 渲染所有標記 */}
        {locations.map((location) => {
          const color = dayColors[location.dayIndex % dayColors.length];
          
          return (
            <Marker
              key={`${location.dayIndex}-${location.actIndex}`}
              position={location.position}
              icon={createCustomIcon(color, location.actIndex + 1)}
            >
              <Popup>
                <div style={{ padding: '5px', minWidth: '200px' }}>
                  <h3 style={{ 
                    margin: '0 0 8px 0', 
                    fontSize: '16px',
                    color: '#1f2937',
                    fontWeight: '600'
                  }}>
                    {location.location}
                  </h3>
                  <div style={{ 
                    fontSize: '13px', 
                    color: '#6b7280',
                    marginBottom: '8px'
                  }}>
                    <strong>時間：</strong>{location.time || '未指定'}
                  </div>
                  {location.description && (
                    <div style={{ 
                      fontSize: '13px', 
                      color: '#4b5563',
                      lineHeight: '1.5',
                      marginBottom: '8px'
                    }}>
                      {location.description}
                    </div>
                  )}
                  {location.maps_data?.rating && (
                    <div style={{ 
                      padding: '6px 10px',
                      background: '#fef3c7',
                      borderRadius: '6px',
                      fontSize: '12px',
                      color: '#92400e',
                      textAlign: 'center'
                    }}>
                      ⭐ {location.maps_data.rating.toFixed(1)} / 5.0
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

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
