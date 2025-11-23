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

// 自定義CSS來控制Leaflet z-index
const customCSS = `
  .leaflet-popup-content-wrapper {
    z-index: 35 !important;
  }
  .leaflet-popup-tip {
    z-index: 35 !important;
  }
  .leaflet-popup {
    z-index: 35 !important;
  }
`;

const MapView = ({ itineraries }) => {
  // 從行程中提取所有地點（過濾掉交通時間項目）
  const locations = useMemo(() => {
    if (!itineraries || itineraries.length === 0) return [];
    
    const allLocations = [];
    itineraries.forEach((itinerary, dayIndex) => {
      // 支援兩種數據格式：activities 或 sections
      const items = itinerary.activities || itinerary.sections || [];
      
      // 先過濾出有效的景點項目
      const validItems = items.filter(item => item.location && item.coordinates && !item.is_travel_time);
      
      // 為每個有效項目分配連續的編號
      validItems.forEach((item, validIndex) => {
        allLocations.push({
          ...item,
          dayIndex,
          actIndex: validIndex, // 使用過濾後的連續索引
          position: [item.coordinates.lat, item.coordinates.lng]
        });
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
      <div className="h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-xl">
        <p className="text-gray-500 dark:text-gray-400">🗺️ 沒有可顯示的地點</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full rounded-xl overflow-hidden relative">
      <style dangerouslySetInnerHTML={{ __html: customCSS }} />
      <MapContainer
        center={center}
        zoom={14}
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
                <div className="p-2 min-w-[200px]">
                  <h3 className="m-0 mb-2 text-base text-gray-900 dark:text-gray-100 font-semibold">
                    {location.location}
                  </h3>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    <strong>時間：</strong>{location.time || '未指定'}
                  </div>
                  {location.description && (
                    <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-2">
                      {location.description}
                    </div>
                  )}
                  {location.maps_data?.rating && (
                    <div className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 rounded text-xs text-yellow-800 dark:text-yellow-200 text-center">
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
      <div className="absolute bottom-5 left-5 bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg z-40">
        <div className="text-sm font-semibold mb-2 text-gray-900 dark:text-gray-100">
          行程天數
        </div>
        {itineraries.map((itinerary, index) => (
          <div key={index} className="flex items-center gap-2 mb-1">
            <div className="w-4 h-4 rounded-full border-2 border-white shadow-sm"
                 style={{ backgroundColor: dayColors[index % dayColors.length] }}></div>
            <span className="text-xs text-gray-700 dark:text-gray-300">
              {itinerary.day || `第 ${index + 1} 天`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MapView;
