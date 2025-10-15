import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// 修復 Leaflet 預設圖標問題
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// 自定義不同顏色的標記圖標
const createColoredIcon = (color) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      background-color: ${color};
      width: 25px;
      height: 25px;
      border-radius: 50% 50% 50% 0;
      border: 3px solid white;
      box-shadow: 0 2px 5px rgba(0,0,0,0.3);
      transform: rotate(-45deg);
      position: relative;
    ">
      <div style="
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) rotate(45deg);
        color: white;
        font-weight: bold;
        font-size: 12px;
      "></div>
    </div>`,
    iconSize: [25, 25],
    iconAnchor: [12, 24],
    popupAnchor: [0, -24],
  });
};

// 每日不同顏色
const dayColors = [
  '#FF6B6B', // 紅色 - Day 1
  '#4ECDC4', // 青綠色 - Day 2
  '#45B7D1', // 藍色 - Day 3
  '#FFA07A', // 橙色 - Day 4
  '#98D8C8', // 薄荷綠 - Day 5
  '#F7DC6F', // 黃色 - Day 6
  '#BB8FCE', // 紫色 - Day 7
];

// 地圖適應邊界的組件
function MapBounds({ locations }) {
  const map = useMap();

  useEffect(() => {
    if (locations && locations.length > 0) {
      const validLocations = locations.filter(loc => 
        loc.coordinates && 
        typeof loc.coordinates.lat === 'number' && 
        typeof loc.coordinates.lng === 'number' &&
        !isNaN(loc.coordinates.lat) &&
        !isNaN(loc.coordinates.lng)
      );

      if (validLocations.length > 0) {
        const bounds = L.latLngBounds(
          validLocations.map(loc => [loc.coordinates.lat, loc.coordinates.lng])
        );
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [locations, map]);

  return null;
}

export default function MapView({ itinerary, hoveredLocation, onLocationHover }) {
  // 從行程中提取所有有效的地點和坐標
  const getAllLocations = () => {
    if (!itinerary || !Array.isArray(itinerary)) return [];

    const locations = [];
    itinerary.forEach((day, dayIndex) => {
      if (day.activities && Array.isArray(day.activities)) {
        day.activities.forEach((activity) => {
          if (activity.location && activity.location.coordinates) {
            const coords = activity.location.coordinates;
            if (coords.lat && coords.lng && 
                !isNaN(coords.lat) && !isNaN(coords.lng)) {
              locations.push({
                ...activity.location,
                dayIndex,
                activityName: activity.name || activity.location.name,
                time: activity.time,
              });
            }
          }
        });
      }
    });
    return locations;
  };

  // 獲取每日的路線（用於繪製折線）
  const getDayRoutes = () => {
    if (!itinerary || !Array.isArray(itinerary)) return [];

    return itinerary.map((day, dayIndex) => {
      if (!day.activities || !Array.isArray(day.activities)) return [];

      const route = day.activities
        .filter(activity => 
          activity.location && 
          activity.location.coordinates &&
          activity.location.coordinates.lat &&
          activity.location.coordinates.lng &&
          !isNaN(activity.location.coordinates.lat) &&
          !isNaN(activity.location.coordinates.lng)
        )
        .map(activity => [
          activity.location.coordinates.lat,
          activity.location.coordinates.lng
        ]);

      return {
        dayIndex,
        route,
        color: dayColors[dayIndex % dayColors.length]
      };
    }).filter(day => day.route && day.route.length > 0);
  };

  const locations = getAllLocations();
  const dayRoutes = getDayRoutes();

  // 如果沒有有效地點，顯示提示
  if (locations.length === 0) {
    return (
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f0f0f0',
        color: '#666',
        fontSize: '16px',
      }}>
        🗺️ 等待行程生成中...
      </div>
    );
  }

  // 計算地圖中心點（所有地點的平均位置）
  const center = [
    locations.reduce((sum, loc) => sum + loc.coordinates.lat, 0) / locations.length,
    locations.reduce((sum, loc) => sum + loc.coordinates.lng, 0) / locations.length,
  ];

  return (
    <MapContainer
      center={center}
      zoom={13}
      style={{ width: '100%', height: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* 自動調整地圖邊界 */}
      <MapBounds locations={locations} />

      {/* 繪製每日路線 */}
      {dayRoutes.map((dayRoute, index) => (
        <Polyline
          key={`route-${index}`}
          positions={dayRoute.route}
          color={dayRoute.color}
          weight={3}
          opacity={0.6}
        />
      ))}

      {/* 顯示所有地點標記 */}
      {locations.map((location, index) => {
        const isHovered = hoveredLocation && 
          hoveredLocation.name === location.name &&
          hoveredLocation.dayIndex === location.dayIndex;
        
        return (
          <Marker
            key={`marker-${index}`}
            position={[location.coordinates.lat, location.coordinates.lng]}
            icon={createColoredIcon(dayColors[location.dayIndex % dayColors.length])}
            eventHandlers={{
              mouseover: () => {
                if (onLocationHover) {
                  onLocationHover(location);
                }
              },
              mouseout: () => {
                if (onLocationHover) {
                  onLocationHover(null);
                }
              },
            }}
            opacity={isHovered ? 1 : 0.8}
            zIndexOffset={isHovered ? 1000 : 0}
          >
            <Popup>
              <div style={{ minWidth: '200px' }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', color: dayColors[location.dayIndex % dayColors.length] }}>
                  📍 {location.name}
                </h3>
                {location.activityName && location.activityName !== location.name && (
                  <p style={{ margin: '4px 0', fontSize: '14px' }}>
                    <strong>{location.activityName}</strong>
                  </p>
                )}
                {location.time && (
                  <p style={{ margin: '4px 0', fontSize: '13px', color: '#666' }}>
                    ⏰ {location.time}
                  </p>
                )}
                <p style={{ margin: '4px 0', fontSize: '13px', color: '#888' }}>
                  🗓️ Day {location.dayIndex + 1}
                </p>
                {location.address && (
                  <p style={{ margin: '4px 0', fontSize: '12px', color: '#999' }}>
                    📮 {location.address}
                  </p>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
