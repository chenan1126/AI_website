import React, { useState, useMemo } from 'react';
import * as d3 from 'd3-geo';
import * as topojson from 'topojson-client';
import taiwanTopo from '../assets/taiwan-topo.json';

const TaiwanMapSelector = ({ onSelectCity, selectedCity }) => {
  const [hoveredCity, setHoveredCity] = useState(null);

  // Convert TopoJSON to GeoJSON
  const geoJson = useMemo(() => {
    if (!taiwanTopo) return null;
    return topojson.feature(taiwanTopo, taiwanTopo.objects.map);
  }, []);

  // Create projection and path generator
  const { paths, width, height } = useMemo(() => {
    if (!geoJson) return { paths: [], width: 0, height: 0 };

    const width = 1000;
    const height = 1200; // Taiwan is tall

    // Use fitSize to automatically scale and center the map
    const projection = d3.geoMercator().fitSize([width, height], geoJson);
    const pathGenerator = d3.geoPath().projection(projection);

    const paths = geoJson.features.map((feature) => {
      const name = feature.properties.name.replace('臺', '台');
      // Fix Chiayi naming if needed, though TopoJSON usually has them distinct.
      // Ensure IDs map correctly if we use them.
      return {
        d: pathGenerator(feature),
        name: name,
        id: feature.properties.id, 
        feature: feature,
        bounds: pathGenerator.bounds(feature)
      };
    });

    // Sort paths to ensure smaller regions (like Chiayi City) are drawn on top of larger ones (Chiayi County)
    // This fixes the issue where clicking Chiayi City might register as Chiayi County if they overlap
    paths.sort((a, b) => {
      // Simple heuristic: smaller path length usually means smaller area
      return b.d.length - a.d.length; 
    });

    return { paths, width, height };
  }, [geoJson]);

  if (!geoJson) return <div>Loading Map...</div>;

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 rounded-xl p-4 shadow-inner">
      <h3 className="text-2xl font-bold text-gray-700 mb-6">
        {hoveredCity || selectedCity || "請選擇縣市"}
      </h3>
      
      <div className="relative w-full max-w-[1000px] aspect-[3/4]">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full drop-shadow-xl"
          style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))' }}
        >
          <g>
            {paths.map((city) => {
              const isSelected = selectedCity === city.name;
              const isHovered = hoveredCity === city.name;
              const isOffshore = ['澎湖縣', '金門縣', '連江縣'].includes(city.name);
              
              // Calculate frame dimensions for offshore islands
              let frameProps = {};
              if (isOffshore && city.bounds) {
                const [[x0, y0], [x1, y1]] = city.bounds;
                const padding = 20;
                frameProps = {
                  x: x0 - padding,
                  y: y0 - padding,
                  width: x1 - x0 + (padding * 2),
                  height: y1 - y0 + (padding * 2)
                };
              }
              
              return (
                <g 
                  key={city.name}
                  onClick={() => onSelectCity(city.name)}
                  onMouseEnter={() => setHoveredCity(city.name)}
                  onMouseLeave={() => setHoveredCity(null)}
                  className="cursor-pointer"
                >
                  <path
                    d={city.d}
                    fill={isSelected ? "#3b82f6" : isHovered ? "#93c5fd" : "#ffffff"}
                    stroke="#333333"
                    strokeWidth={isSelected || isHovered ? "2" : "0.5"}
                    className="transition-all duration-200 ease-in-out hover:opacity-90"
                  />
                  
                  {isOffshore && (
                    <rect
                      {...frameProps}
                      fill="transparent"
                      stroke={isSelected || isHovered ? "#3b82f6" : "#94a3b8"}
                      strokeWidth="2"
                      strokeDasharray="8,4"
                      className="transition-colors duration-200"
                    />
                  )}
                  
                  <title>{city.name}</title>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
      
      <div className="mt-4 text-sm text-gray-500">
        點擊地圖區塊選擇縣市
      </div>
    </div>
  );
};

export default TaiwanMapSelector;
