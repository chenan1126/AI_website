/**
 * 地理位置優化模組
 * 根據地理位置聚類和排序景點，避免行程路線混亂
 */

/**
 * 計算兩點之間的距離（Haversine 公式）
 * @param {number} lat1 - 點1緯度
 * @param {number} lng1 - 點1經度
 * @param {number} lat2 - 點2緯度
 * @param {number} lng2 - 點2經度
 * @returns {number} 距離（公里）
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // 地球半徑（公里）
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees) {
  return degrees * (Math.PI / 180);
}

/**
 * 計算一組景點的中心點
 * @param {Array} locations - 景點陣列 [{lat, lng, ...}]
 * @returns {Object} {lat, lng}
 */
function calculateCentroid(locations) {
  if (!locations || locations.length === 0) {
    return null;
  }
  
  const sum = locations.reduce((acc, loc) => {
    return {
      lat: acc.lat + (loc.lat || loc.latitude || 0),
      lng: acc.lng + (loc.lng || loc.longitude || 0)
    };
  }, { lat: 0, lng: 0 });
  
  return {
    lat: sum.lat / locations.length,
    lng: sum.lng / locations.length
  };
}

/**
 * K-Means 聚類演算法（簡化版）
 * @param {Array} locations - 景點陣列
 * @param {number} k - 聚類數量（天數）
 * @returns {Array} 聚類結果 [{cluster: 0, locations: [...]}]
 */
function kMeansClustering(locations, k) {
  if (!locations || locations.length === 0) {
    return [];
  }
  
  if (k >= locations.length) {
    // 如果聚類數量大於或等於景點數量，每個景點一組
    return locations.map((loc, index) => ({
      cluster: index,
      centroid: { lat: loc.lat || loc.latitude, lng: loc.lng || loc.longitude },
      locations: [loc]
    }));
  }
  
  // 初始化：隨機選擇 k 個中心點
  let centroids = [];
  const usedIndices = new Set();
  
  // 均勻分布選擇初始中心點
  for (let i = 0; i < k; i++) {
    const index = Math.floor(i * locations.length / k);
    centroids.push({
      lat: locations[index].lat || locations[index].latitude,
      lng: locations[index].lng || locations[index].longitude
    });
  }
  
  let clusters = [];
  let iterations = 0;
  const maxIterations = 10;
  
  while (iterations < maxIterations) {
    // 初始化聚類
    clusters = Array.from({ length: k }, (_, i) => ({
      cluster: i,
      centroid: centroids[i],
      locations: []
    }));
    
    // 分配每個景點到最近的聚類
    for (const location of locations) {
      const lat = location.lat || location.latitude;
      const lng = location.lng || location.longitude;
      
      let minDistance = Infinity;
      let closestCluster = 0;
      
      for (let i = 0; i < k; i++) {
        const distance = calculateDistance(
          lat, lng,
          centroids[i].lat, centroids[i].lng
        );
        
        if (distance < minDistance) {
          minDistance = distance;
          closestCluster = i;
        }
      }
      
      clusters[closestCluster].locations.push(location);
    }
    
    // 更新中心點
    let converged = true;
    for (let i = 0; i < k; i++) {
      if (clusters[i].locations.length > 0) {
        const newCentroid = calculateCentroid(clusters[i].locations);
        
        const shift = calculateDistance(
          centroids[i].lat, centroids[i].lng,
          newCentroid.lat, newCentroid.lng
        );
        
        if (shift > 0.1) { // 如果移動超過 100 公尺
          converged = false;
        }
        
        centroids[i] = newCentroid;
        clusters[i].centroid = newCentroid;
      }
    }
    
    if (converged) {
      break;
    }
    
    iterations++;
  }
  
  // 移除空聚類並重新編號
  clusters = clusters.filter(c => c.locations.length > 0);
  clusters.forEach((c, index) => {
    c.cluster = index;
  });
  
  return clusters;
}

/**
 * 貪婪最近鄰演算法 - 排序景點以最小化總距離
 * @param {Array} locations - 景點陣列
 * @returns {Array} 排序後的景點陣列
 */
function sortByNearestNeighbor(locations) {
  if (!locations || locations.length <= 1) {
    return locations;
  }
  
  const sorted = [];
  const remaining = [...locations];
  
  // 從第一個景點開始（可以選擇最靠近中心的）
  let current = remaining.shift();
  sorted.push(current);
  
  while (remaining.length > 0) {
    const currentLat = current.lat || current.latitude;
    const currentLng = current.lng || current.longitude;
    
    // 找最近的下一個景點
    let minDistance = Infinity;
    let nearestIndex = 0;
    
    for (let i = 0; i < remaining.length; i++) {
      const nextLat = remaining[i].lat || remaining[i].latitude;
      const nextLng = remaining[i].lng || remaining[i].longitude;
      
      const distance = calculateDistance(
        currentLat, currentLng,
        nextLat, nextLng
      );
      
      if (distance < minDistance) {
        minDistance = distance;
        nearestIndex = i;
      }
    }
    
    current = remaining.splice(nearestIndex, 1)[0];
    sorted.push(current);
  }
  
  return sorted;
}

/**
 * 過濾掉距離聚類中心過遠的景點
 * @param {Array} locations - 景點陣列
 * @param {Object} centroid - 中心點 {lat, lng}
 * @param {number} maxDistance - 最大距離（公里）
 * @returns {Array} 過濾後的景點陣列
 */
function filterByDistance(locations, centroid, maxDistance = 30) {
  if (!centroid) {
    return locations;
  }
  
  return locations.filter(loc => {
    const lat = loc.lat || loc.latitude;
    const lng = loc.lng || loc.longitude;
    
    const distance = calculateDistance(
      lat, lng,
      centroid.lat, centroid.lng
    );
    
    return distance <= maxDistance;
  });
}

/**
 * 主要函數：將景點分組並優化為多日行程
 * @param {Array} attractions - 景點陣列
 * @param {number} days - 天數
 * @param {Object} options - 選項
 * @returns {Array} 每日景點陣列 [{day: 1, locations: [...]}]
 */
export function optimizeItinerary(attractions, days, options = {}) {
  const {
    maxDistanceFromCenter = 40, // 增加最大距離到 40 公里
    sortByProximity = true,     // 是否按鄰近排序
    minLocationsPerDay = 5      // 每天至少 5 個景點
  } = options;
  
  if (!attractions || attractions.length === 0) {
    return [];
  }
  
  // 確保景點有座標
  const validAttractions = attractions.filter(a => 
    (a.lat || a.latitude) && (a.lng || a.longitude)
  );
  
  if (validAttractions.length === 0) {
    console.warn('⚠️ 沒有有效座標的景點');
    return [];
  }
  
  console.log(`📍 地理優化: ${validAttractions.length} 個景點分配到 ${days} 天`);
  
  // 使用 K-Means 聚類
  const clusters = kMeansClustering(validAttractions, days);
  
  console.log(`✅ 聚類完成: ${clusters.length} 個群組`);
  
  // 處理每個聚類
  const dailyItinerary = clusters.map((cluster, index) => {
    let dayLocations = cluster.locations;
    
    // 過濾距離中心過遠的景點（但保證至少有 minLocationsPerDay 個）
    if (maxDistanceFromCenter && dayLocations.length > minLocationsPerDay) {
      const originalCount = dayLocations.length;
      
      // 按距離排序
      const locationsWithDistance = dayLocations.map(loc => {
        const distance = calculateDistance(
          loc.lat || loc.latitude,
          loc.lng || loc.longitude,
          cluster.centroid.lat,
          cluster.centroid.lng
        );
        return { ...loc, distanceFromCenter: distance };
      }).sort((a, b) => a.distanceFromCenter - b.distanceFromCenter);
      
      // 保留距離較近的景點，但至少保留 minLocationsPerDay 個
      dayLocations = locationsWithDistance
        .filter((loc, idx) => 
          loc.distanceFromCenter <= maxDistanceFromCenter || 
          idx < minLocationsPerDay
        )
        .map(({ distanceFromCenter, ...loc }) => loc); // 移除臨時欄位
      
      if (dayLocations.length < originalCount) {
        console.log(`📏 第 ${index + 1} 天: 過濾掉 ${originalCount - dayLocations.length} 個過遠景點（保留 ${dayLocations.length} 個）`);
      }
    }
    
    // 按鄰近順序排序
    if (sortByProximity && dayLocations.length > 1) {
      dayLocations = sortByNearestNeighbor(dayLocations);
      
      // 計算總距離
      let totalDistance = 0;
      for (let i = 0; i < dayLocations.length - 1; i++) {
        const d = calculateDistance(
          dayLocations[i].lat || dayLocations[i].latitude,
          dayLocations[i].lng || dayLocations[i].longitude,
          dayLocations[i + 1].lat || dayLocations[i + 1].latitude,
          dayLocations[i + 1].lng || dayLocations[i + 1].longitude
        );
        totalDistance += d;
      }
      
      console.log(`🚗 第 ${index + 1} 天: ${dayLocations.length} 個景點，總距離 ${totalDistance.toFixed(1)} km`);
    }
    
    return {
      day: index + 1,
      centroid: cluster.centroid,
      locations: dayLocations
    };
  });
  
  return dailyItinerary;
}

/**
 * 計算行程的總交通距離
 * @param {Array} dailyItinerary - optimizeItinerary 的輸出
 * @returns {Object} {totalDistance, dailyDistances: [...]}
 */
export function calculateItineraryDistance(dailyItinerary) {
  const dailyDistances = dailyItinerary.map(day => {
    let distance = 0;
    const locations = day.locations;
    
    for (let i = 0; i < locations.length - 1; i++) {
      distance += calculateDistance(
        locations[i].lat || locations[i].latitude,
        locations[i].lng || locations[i].longitude,
        locations[i + 1].lat || locations[i + 1].latitude,
        locations[i + 1].lng || locations[i + 1].longitude
      );
    }
    
    return {
      day: day.day,
      distance: distance,
      locationCount: locations.length
    };
  });
  
  const totalDistance = dailyDistances.reduce((sum, d) => sum + d.distance, 0);
  
  return {
    totalDistance,
    dailyDistances
  };
}

/**
 * 優化指定路段的順序 (固定起點)
 * @param {Array} locations - 包含起點的景點列表
 * @returns {Array} 排序後的列表
 */
export function optimizeSegment(locations) {
  return sortByNearestNeighbor(locations);
}

/**
 * 優化單日行程，確保午餐在中間
 * @param {Array} locations - 當日所有景點 (需包含 lat, lng 或 coordinates)
 * @returns {Array} 排序後的景點
 */
export function optimizeDayWithLunch(locations) {
  // 1. 找出午餐地點
  // 判斷邏輯：
  // 1. type === 'lunch' (優先)
  // 2. location 名稱包含 "午餐"
  // 3. details 包含 "午餐"
  // 4. time 包含 "午餐"
  const lunchIndex = locations.findIndex(loc => 
    (loc.type === 'lunch') ||
    (loc.location && loc.location.includes('午餐')) || 
    (loc.details && Array.isArray(loc.details) && loc.details.some(d => d.includes('午餐'))) ||
    (loc.time && loc.time.includes('午餐'))
  );

  // 預處理：確保所有地點都有 lat/lng
  const mappedLocations = locations.map(loc => ({
    ...loc,
    lat: loc.coordinates?.lat || loc.lat || loc.latitude,
    lng: loc.coordinates?.lng || loc.lng || loc.longitude
  }));

  // 檢查是否有無效座標
  if (mappedLocations.some(l => !l.lat || !l.lng)) {
      console.warn('[GeoOptimizer] 部分地點缺少座標，無法進行午餐優化，使用原始順序或簡單排序');
      return sortByNearestNeighbor(locations);
  }

  if (lunchIndex === -1) {
    // 沒找到午餐，直接優化整天
    return sortByNearestNeighbor(mappedLocations);
  }

  const lunch = mappedLocations[lunchIndex];
  const others = mappedLocations.filter((_, i) => i !== lunchIndex);

  if (others.length === 0) return [lunch];
  
  // 如果只有一個其他地點，直接回傳 [other, lunch] (假設先玩再吃)
  if (others.length === 1) {
      return [others[0], lunch];
  }

  // 2. 將其餘地點分為兩群 (早上, 下午)
  // 使用 K-Means 分兩群
  const clusters = kMeansClustering(others, 2);
  
  let groupA = [];
  let groupB = [];

  if (clusters.length >= 2) {
      groupA = clusters[0].locations;
      groupB = clusters[1].locations;
  } else {
      // 如果只分出一群 (例如地點太近)，則使用 NearestNeighbor 排序後切半
      const sorted = sortByNearestNeighbor(others);
      const mid = Math.floor(sorted.length / 2);
      groupA = sorted.slice(0, mid);
      groupB = sorted.slice(mid);
  }

  // 3. 優化兩個群組的內部順序
  const pathA = sortByNearestNeighbor(groupA);
  const pathB = sortByNearestNeighbor(groupB);

  // 4. 比較兩種組合: A -> Lunch -> B  vs  B -> Lunch -> A
  const getDist = (p1, p2) => calculateDistance(
      p1.lat, p1.lng, p2.lat, p2.lng
  );

  // 計算路徑總距離 (包含群組內部距離 + 連接到午餐的距離)
  // 群組內部距離已經由 sortByNearestNeighbor 優化，我們只需要比較連接點
  
  // Path 1: A -> Lunch -> B
  // Cost = (A內部) + dist(A_last, Lunch) + dist(Lunch, B_first) + (B內部)
  // 由於 (A內部) 和 (B內部) 是固定的 (對於該群組)，我們主要比較連接成本
  // 但要注意，sortByNearestNeighbor 的起點是列表的第一個元素。
  // 我們可能需要嘗試反轉 pathA 或 pathB 來獲得更好的連接?
  // 簡單起見，我們先只比較 A->L->B 和 B->L->A
  
  const distA_L_B = (pathA.length ? getDist(pathA[pathA.length-1], lunch) : 0) + 
                    (pathB.length ? getDist(lunch, pathB[0]) : 0);
                    
  const distB_L_A = (pathB.length ? getDist(pathB[pathB.length-1], lunch) : 0) + 
                    (pathA.length ? getDist(lunch, pathA[0]) : 0);

  // 這裡有一個潛在問題：pathA 的起點是固定的。
  // 如果我們把 A 放在下午，可能應該反轉 A？
  // 暫時不考慮反轉，假設 K-Means 分群已經將地理位置分開了。

  if (distA_L_B <= distB_L_A) {
      return [...pathA, lunch, ...pathB];
  } else {
      return [...pathB, lunch, ...pathA];
  }
}

export default {
  optimizeItinerary,
  calculateItineraryDistance,
  calculateDistance,
  kMeansClustering,
  sortByNearestNeighbor,
  optimizeSegment,
  optimizeDayWithLunch
};
