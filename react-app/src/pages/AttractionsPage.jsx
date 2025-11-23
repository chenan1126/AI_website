import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import TaiwanMapSelector from '../components/TaiwanMapSelector';

const TAIWAN_CITIES = [
  "台北市", "新北市", "基隆市", "桃園市", "新竹市", "新竹縣", "苗栗縣",
  "台中市", "彰化縣", "南投縣", "雲林縣", "嘉義市", "嘉義縣",
  "台南市", "高雄市", "屏東縣",
  "宜蘭縣", "花蓮縣", "台東縣",
  "澎湖縣", "金門縣", "連江縣"
];

export default function AttractionsPage({ session, onShowAuth }) {
  const [viewMode, setViewMode] = useState('cities'); // 'cities' | 'attractions'
  const [attractions, setAttractions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    city: '',
    district: '',
    address: '',
    description: '',
    features: '', // comma separated
    phone: '',
    website: '',
    opening_hours: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchAttractions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page,
        limit: 15,
        search,
        city: cityFilter,
        category: categoryFilter
      });
      
      // Use the API endpoint we created
      const response = await fetch(`/api/attractions?${params}`);
      const result = await response.json();
      
      if (response.ok) {
        setAttractions(result.data);
        setTotalPages(result.totalPages);
      } else {
        console.error('Error fetching attractions:', result.error);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }, [page, search, cityFilter, categoryFilter]);

  useEffect(() => {
    if (viewMode === 'attractions') {
      fetchAttractions();
    }
  }, [fetchAttractions, viewMode]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      // Process features from string to array
      const featuresArray = formData.features.split(',').map(f => f.trim()).filter(f => f);
      
      const payload = {
        ...formData,
        features: featuresArray
      };

      const response = await fetch('/api/add-attraction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (response.ok) {
        setShowAddModal(false);
        setFormData({
          name: '',
          category: '',
          city: '',
          district: '',
          address: '',
          description: '',
          features: '',
          phone: '',
          website: '',
          opening_hours: ''
        });
        if (viewMode === 'attractions') {
          fetchAttractions(); // Refresh list if in attraction view
        }
        alert('景點新增成功！');
      } else {
        alert(`新增失敗: ${result.error}`);
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      alert('發生錯誤，請稍後再試');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCityClick = (city) => {
    setCityFilter(city);
    setViewMode('attractions');
    setPage(1);
    setSearch('');
    setCategoryFilter('');
  };

  const handleBackToCities = () => {
    setViewMode('cities');
    setCityFilter('');
    setSearch('');
    setCategoryFilter('');
    setAttractions([]); // Clear attractions to avoid flash of old content
  };

  const getDisplayCity = (attraction) => {
    if (attraction.address) {
      if (attraction.address.includes('嘉義縣')) return '嘉義縣';
      if (attraction.address.includes('新竹縣')) return '新竹縣';
    }
    return attraction.city;
  };

  return (
    <div className="container mx-auto px-4 py-24 min-h-screen">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
          {viewMode === 'cities' ? '景點資料庫 - 選擇縣市' : `${cityFilter || '所有'} 景點`}
        </h1>
        <div className="flex gap-2">
          {viewMode === 'attractions' && (
            <button 
              onClick={handleBackToCities}
              className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors flex items-center"
            >
              <i className="fas fa-map mr-2"></i>返回地圖
            </button>
          )}
          <button 
            onClick={() => {
              if (!session || !session.user) {
                alert('請先登入會員才能新增景點！');
                onShowAuth();
              } else {
                setShowAddModal(true);
              }
            }}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-opacity-90 transition-colors"
          >
            <i className="fas fa-plus mr-2"></i>新增景點
          </button>
        </div>
      </div>

      {viewMode === 'cities' ? (
        <div className="flex flex-col items-center">
          <p className="text-slate-600 dark:text-slate-400 mb-8 text-lg">
            請點選地圖上的縣市以查看景點
          </p>
          <TaiwanMapSelector 
            onSelectCity={handleCityClick} 
            selectedCity={cityFilter}
          />
        </div>
      ) : (
        <>
          {/* Filters */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm mb-8 flex flex-wrap gap-4">
            <input
              type="text"
              placeholder="搜尋景點名稱..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 min-w-[200px] px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-transparent dark:text-white"
            />
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-transparent dark:text-white"
            >
              <option value="">所有城市</option>
              {TAIWAN_CITIES.map(city => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-transparent dark:text-white"
            >
              <option value="">所有類別</option>
              <option value="自然景觀">自然景觀</option>
              <option value="文化古蹟">文化古蹟</option>
              <option value="博物館展覽">博物館展覽</option>
              <option value="休閒娛樂">休閒娛樂</option>
              <option value="美食餐廳">美食餐廳</option>
              <option value="觀光工廠">觀光工廠</option>
              <option value="購物商圈">購物商圈</option>
            </select>
          </div>

          {/* Grid */}
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : (
            <>
              {attractions.length === 0 ? (
                <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                  <i className="fas fa-search text-4xl mb-4 opacity-50"></i>
                  <p className="text-lg">沒有找到相關景點</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {attractions.map(attraction => (
                    <div key={attraction.id} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                      <div className="p-6">
                        <div className="flex justify-between items-start mb-2">
                          <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full">
                            {attraction.category}
                          </span>
                          <span className="text-sm text-slate-500 dark:text-slate-400">
                            {getDisplayCity(attraction)}
                          </span>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{attraction.name}</h3>
                        <p className="text-slate-600 dark:text-slate-300 text-sm mb-4 line-clamp-3">
                          {attraction.description}
                        </p>
                        <div className="flex flex-wrap gap-2 mb-4">
                          {attraction.features && attraction.features.slice(0, 3).map((feature, idx) => (
                            <span key={idx} className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-1 rounded">
                              {feature}
                            </span>
                          ))}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
                          {attraction.address && <p><i className="fas fa-map-marker-alt w-4"></i> {attraction.address}</p>}
                          {attraction.phone && <p><i className="fas fa-phone w-4"></i> {attraction.phone}</p>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="flex justify-center mt-8 gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-50 dark:text-white"
              >
                上一頁
              </button>
              <span className="px-4 py-2 dark:text-white">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-50 dark:text-white"
              >
                下一頁
              </button>
            </div>
          )}
        </>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-2xl w-full p-6 relative my-8">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
            >
              <i className="fas fa-times text-xl"></i>
            </button>
            
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">新增景點</h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">名稱 *</label>
                  <input
                    type="text"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">類別</label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 dark:text-white"
                  >
                    <option value="">選擇類別</option>
                    <option value="自然景觀">自然景觀</option>
                    <option value="文化古蹟">文化古蹟</option>
                    <option value="博物館展覽">博物館展覽</option>
                    <option value="休閒娛樂">休閒娛樂</option>
                    <option value="美食餐廳">美食餐廳</option>
                    <option value="觀光工廠">觀光工廠</option>
                    <option value="購物商圈">購物商圈</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">城市 *</label>
                  <select
                    name="city"
                    required
                    value={formData.city}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 dark:text-white"
                  >
                    <option value="">選擇城市</option>
                    {TAIWAN_CITIES.map(city => (
                      <option key={city} value={city}>{city}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">區域 (選填)</label>
                  <input
                    type="text"
                    name="district"
                    value={formData.district}
                    onChange={handleInputChange}
                    placeholder="例如：信義區"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">地址</label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">描述 *</label>
                <textarea
                  name="description"
                  required
                  rows="4"
                  value={formData.description}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 dark:text-white"
                  placeholder="請詳細描述景點特色..."
                ></textarea>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">特色標籤 (用逗號分隔)</label>
                <input
                  type="text"
                  name="features"
                  value={formData.features}
                  onChange={handleInputChange}
                  placeholder="例如：夜景, 親子, 步道"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">電話</label>
                  <input
                    type="text"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">網站</label>
                  <input
                    type="text"
                    name="website"
                    value={formData.website}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">營業時間</label>
                <input
                  type="text"
                  name="opening_hours"
                  value={formData.opening_hours}
                  onChange={handleInputChange}
                  placeholder="例如：09:00-18:00"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-opacity-90 transition-colors disabled:opacity-50 flex items-center"
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      處理中...
                    </>
                  ) : (
                    '確認新增'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
