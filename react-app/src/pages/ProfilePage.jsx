import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

function ProfilePage({ session, onShowAuth }) {
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [activeSection, setActiveSection] = useState('profile')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [savedTrips, setSavedTrips] = useState([])
  const [loadingTrips, setLoadingTrips] = useState(false)

  // 獲取用戶保存的行程
  const loadSavedTrips = useCallback(async () => {
    if (!session?.user?.id) return;

    setLoadingTrips(true);
    try {
      const { data, error } = await supabase
        .from('user_trips')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSavedTrips(data || []);
    } catch (error) {
      console.error('載入行程失敗:', error);
      setError('載入行程失敗，請稍後再試');
    } finally {
      setLoadingTrips(false);
    }
  }, [session?.user?.id]);

  // 表單數據
  const [profileData, setProfileData] = useState({
    displayName: '',
    email: '',
    phone: '',
    location: ''
  })

  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: ''
  })

  // 偏好設定數據
  const [preferencesData, setPreferencesData] = useState({
    dietaryRestrictions: [],
    activityPreferences: []
  })

  // 載入用戶數據
  useEffect(() => {
    if (session?.user) {
      // 載入個人資料
      setProfileData({
        displayName: session.user.user_metadata?.display_name || '',
        email: session.user.email || '',
        phone: session.user.user_metadata?.phone || '',
        location: session.user.user_metadata?.location || ''
      })

      // 載入偏好設定
      if (session.user.user_metadata?.preferences) {
        setPreferencesData({
          dietaryRestrictions: session.user.user_metadata.preferences.dietaryRestrictions || [],
          activityPreferences: session.user.user_metadata.preferences.activityPreferences || []
        })
      }
    }
  }, [session])

  // 當切換到歷史行程時載入數據
  useEffect(() => {
    if (activeSection === 'trip-history' && session?.user?.id) {
      loadSavedTrips();
    }
  }, [activeSection, session?.user?.id, loadSavedTrips]);

  // 保存個人資料
  const handleSaveProfile = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setSaving(true)

    try {
      const { data: _, error } = await supabase.auth.updateUser({
        data: {
          display_name: profileData.displayName,
          phone: profileData.phone,
          location: profileData.location
        }
      })

      if (error) throw error

      setMessage('個人資料已更新！')
      setTimeout(() => setMessage(''), 3000)
    } catch (error) {
      console.error('❌ 更新失敗:', error)
      setError(error.message || '更新失敗，請重試')
    } finally {
      setSaving(false)
    }
  }

  // 保存偏好設定
  const handleSavePreferences = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setSaving(true)

    try {
      const { data: _, error } = await supabase.auth.updateUser({
        data: {
          preferences: preferencesData
        }
      })

      if (error) throw error

      setMessage('偏好設定已更新！')
      setTimeout(() => setMessage(''), 3000)
    } catch (error) {
      console.error('❌ 偏好設定更新失敗:', error)
      setError(error.message || '偏好設定更新失敗，請重試')
    } finally {
      setSaving(false)
    }
  }

  // 修改密碼
  const handleChangePassword = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('新密碼與確認密碼不一致')
      return
    }

    if (passwordData.newPassword.length < 6) {
      setError('新密碼至少需要6個字符')
      return
    }

    setChangingPassword(true)

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      })

      if (error) throw error

      setMessage('密碼已更新！')
      setPasswordData({
        newPassword: '',
        confirmPassword: ''
      })
      setTimeout(() => setMessage(''), 3000)
    } catch (error) {
      console.error('❌ 密碼更新失敗:', error)
      setError(error.message || '密碼更新失敗，請重試')
    } finally {
      setChangingPassword(false)
    }
  }

  // 刪除行程
  const deleteTrip = async (tripId) => {
    if (!confirm('確定要刪除這個行程嗎？此操作無法復原。')) return;

    try {
      const { error } = await supabase
        .from('user_trips')
        .delete()
        .eq('id', tripId);

      if (error) throw error;

      // 重新載入行程列表
      await loadSavedTrips();
      setMessage('行程已刪除');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('刪除行程失敗:', error);
      setError('刪除行程失敗，請稍後再試');
    }
  };

  // 查看行程詳情
  const viewTrip = (trip) => {
    // 使用 navigate 跳轉到行程詳情頁面，直接傳遞數據
    navigate('/trip-detail', {
      state: {
        tripData: trip.trip_data,
        isSavedTrip: true,
        savedTripId: trip.id
      }
    });
  };

  // 獲取用戶顯示名稱
  const getUserDisplayName = () => {
    if (!session?.user) return '使用者'

    if (session.user.user_metadata?.display_name) {
      return session.user.user_metadata.display_name
    }

    if (session.user.user_metadata?.full_name) {
      return session.user.user_metadata.full_name
    }

    if (session.user.email) {
      return session.user.email.split('@')[0]
    }

    return '使用者'
  }

  // 獲取用戶頭像
  const getUserAvatar = () => {
    return session?.user?.user_metadata?.avatar_url ||
           session?.user?.user_metadata?.picture ||
           `https://ui-avatars.com/api/?name=${encodeURIComponent(getUserDisplayName())}&background=13a4ec&color=fff`
  }

  // 獲取加入時間
  const getJoinDate = () => {
    if (!session?.user?.created_at) return '未知'

    const date = new Date(session.user.created_at)
    return `加入於 ${date.getFullYear()}`
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">需要登入</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-6">請先登入才能查看個人資料</p>
          <button
            onClick={onShowAuth}
            className="px-6 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            立即登入
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark pt-24">
      <main className="flex flex-1 container mx-auto px-4 py-8">
        <aside className="w-80 flex-shrink-0 pr-8 space-y-6">
          {/* 用戶信息卡片 */}
          <div className="flex flex-col items-center p-4 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900/50">
            <div className="bg-center bg-no-repeat aspect-square bg-cover rounded-full w-32 h-32 mb-4" style={{backgroundImage: `url("${getUserAvatar()}")`}}></div>
            <p className="text-xl font-bold text-zinc-900 dark:text-white">{getUserDisplayName()}</p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{getJoinDate()}</p>
          </div>

          {/* 導航菜單 */}
          <nav className="space-y-1">
            <button
              onClick={() => setActiveSection('profile')}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg w-full text-left transition-colors ${
                activeSection === 'profile'
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'hover:bg-primary/10 hover:text-primary'
              }`}
            >
              <span className="material-symbols-outlined">person</span>
              <span>個人資料</span>
            </button>
            <button
              onClick={() => setActiveSection('trip-history')}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg w-full text-left transition-colors ${
                activeSection === 'trip-history'
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'hover:bg-primary/10 hover:text-primary'
              }`}
            >
              <span className="material-symbols-outlined">history</span>
              <span>歷史行程</span>
            </button>
            <button
              onClick={() => setActiveSection('preferences')}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg w-full text-left transition-colors ${
                activeSection === 'preferences'
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'hover:bg-primary/10 hover:text-primary'
              }`}
            >
              <span className="material-symbols-outlined">settings</span>
              <span>偏好設定</span>
            </button>
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors w-full text-left"
            >
              <span className="material-symbols-outlined">logout</span>
              <span>登出</span>
            </button>
          </nav>
        </aside>

        <div className="flex-1 space-y-8">
          {/* 個人資料區塊 */}
          {activeSection === 'profile' && (
            <>
              {/* 個人信息表單 */}
              <div className="p-6 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900/50">
                <h2 className="text-2xl font-bold mb-6 text-zinc-900 dark:text-white">個人資訊</h2>

                {message && (
                  <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <div className="flex items-center gap-2 text-green-800 dark:text-green-200">
                      <i className="fas fa-check-circle"></i>
                      <span>{message}</span>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
                      <i className="fas fa-exclamation-circle"></i>
                      <span>{error}</span>
                    </div>
                  </div>
                )}

                <form onSubmit={handleSaveProfile}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1" htmlFor="full-name">
                        全名
                      </label>
                      <input
                        className="form-input w-full rounded-lg border-zinc-300 dark:border-zinc-700 bg-background-light dark:bg-background-dark focus:ring-primary focus:border-primary"
                        id="full-name"
                        type="text"
                        value={profileData.displayName}
                        onChange={(e) => setProfileData({...profileData, displayName: e.target.value})}
                        required
                        disabled={saving}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1" htmlFor="email">
                        電子郵件地址
                      </label>
                      <input
                        className="form-input w-full rounded-lg border-zinc-300 dark:border-zinc-700 bg-background-light dark:bg-background-dark focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
                        id="email"
                        type="email"
                        value={profileData.email}
                        disabled
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1" htmlFor="phone">
                        手機號碼
                      </label>
                      <input
                        className="form-input w-full rounded-lg border-zinc-300 dark:border-zinc-700 bg-background-light dark:bg-background-dark focus:ring-primary focus:border-primary"
                        id="phone"
                        type="tel"
                        value={profileData.phone}
                        onChange={(e) => setProfileData({...profileData, phone: e.target.value})}
                        disabled={saving}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1" htmlFor="location">
                        位置
                      </label>
                      <input
                        className="form-input w-full rounded-lg border-zinc-300 dark:border-zinc-700 bg-background-light dark:bg-background-dark focus:ring-primary focus:border-primary"
                        id="location"
                        type="text"
                        value={profileData.location}
                        onChange={(e) => setProfileData({...profileData, location: e.target.value})}
                        disabled={saving}
                      />
                    </div>
                  </div>
                  <div className="mt-6 flex justify-end">
                    <button
                      type="submit"
                      disabled={saving}
                      className="flex items-center justify-center rounded-lg h-10 px-5 bg-primary text-white text-sm font-bold tracking-wide hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {saving ? (
                        <>
                          <i className="fas fa-spinner fa-spin mr-2"></i>
                          儲存中...
                        </>
                      ) : (
                        '儲存變更'
                      )}
                    </button>
                  </div>
                </form>
              </div>

              {/* 密碼修改表單 */}
              <div className="p-6 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900/50">
                <h2 className="text-2xl font-bold mb-6 text-zinc-900 dark:text-white">密碼</h2>
                <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="flex items-start gap-2 text-blue-800 dark:text-blue-200">
                    <i className="fas fa-info-circle mt-0.5"></i>
                    <div className="text-sm">
                      <p className="font-medium mb-1">安全性說明</p>
                      <p>密碼變更基於您當前的登入狀態進行。只有在您成功登入後才能修改密碼。</p>
                    </div>
                  </div>
                </div>
                <form onSubmit={handleChangePassword}>
                  <div className="space-y-6 max-w-md">
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1" htmlFor="new-password">
                        新密碼
                      </label>
                      <input
                        className="form-input w-full rounded-lg border-zinc-300 dark:border-zinc-700 bg-background-light dark:bg-background-dark focus:ring-primary focus:border-primary"
                        id="new-password"
                        placeholder="輸入新密碼"
                        type="password"
                        value={passwordData.newPassword}
                        onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                        disabled={changingPassword}
                        minLength={6}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1" htmlFor="confirm-password">
                        確認新密碼
                      </label>
                      <input
                        className="form-input w-full rounded-lg border-zinc-300 dark:border-zinc-700 bg-background-light dark:bg-background-dark focus:ring-primary focus:border-primary"
                        id="confirm-password"
                        placeholder="確認新密碼"
                        type="password"
                        value={passwordData.confirmPassword}
                        onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                        disabled={changingPassword}
                        minLength={6}
                      />
                    </div>
                  </div>
                  <div className="mt-6 flex justify-end">
                    <button
                      type="submit"
                      disabled={changingPassword}
                      className="flex items-center justify-center rounded-lg h-10 px-5 bg-primary text-white text-sm font-bold tracking-wide hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {changingPassword ? (
                        <>
                          <i className="fas fa-spinner fa-spin mr-2"></i>
                          變更中...
                        </>
                      ) : (
                        '變更密碼'
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </>
          )}

          {/* 偏好設定區塊 */}
          {activeSection === 'preferences' && (
            <div className="p-6 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900/50">
              <h2 className="text-2xl font-bold mb-6 text-zinc-900 dark:text-white">偏好設定</h2>

                  {/* 智慧規劃提示 */}
                  <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <div className="flex items-start gap-2 text-green-800 dark:text-green-200">
                      <i className="fas fa-lightbulb mt-0.5"></i>
                      <div className="text-sm">
                        <p className="font-medium mb-1">智慧規劃</p>
                        <p>您的偏好設定將自動應用於行程規劃，讓AI根據您的飲食習慣、活動偏好等因素，提供更符合您需求的個人化行程建議。您只需要設定一次，之後每次規劃都會自動應用這些偏好。</p>
                      </div>
                    </div>
                  </div>              {message && (
                <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <div className="flex items-center gap-2 text-green-800 dark:text-green-200">
                    <i className="fas fa-check-circle"></i>
                    <span>{message}</span>
                  </div>
                </div>
              )}

              {error && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
                    <i className="fas fa-exclamation-circle"></i>
                    <span>{error}</span>
                  </div>
                </div>
              )}

              <form onSubmit={handleSavePreferences}>
                <div className="space-y-8">
                  {/* 飲食偏好 */}
                  <div>
                    <label className="block text-lg font-medium text-zinc-700 dark:text-zinc-300 mb-3">
                      飲食偏好
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {[
                        { id: 'vegetarian', label: '素食', icon: '🌱' },
                        { id: 'vegan', label: '純素', icon: '🥬' },
                        { id: 'halal', label: '清真', icon: '☪️' },
                        { id: 'no_beef', label: '不吃牛肉', icon: '🐄' },
                        { id: 'no_pork', label: '不吃豬肉', icon: '🐖' },
                        { id: 'no_seafood', label: '不吃海鮮', icon: '🐟' },
                        { id: 'gluten_free', label: '無麩質', icon: '🌾' },
                        { id: 'dairy_free', label: '無乳製品', icon: '🥛' },
                        { id: 'nut_free', label: '不吃堅果', icon: '🥜' }
                      ].map((option) => (
                        <label key={option.id} className="flex items-center gap-2 p-3 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer transition-colors">
                          <input
                            type="checkbox"
                            checked={preferencesData.dietaryRestrictions.includes(option.id)}
                            onChange={(e) => {
                              const updated = e.target.checked
                                ? [...preferencesData.dietaryRestrictions, option.id]
                                : preferencesData.dietaryRestrictions.filter(id => id !== option.id)
                              setPreferencesData({...preferencesData, dietaryRestrictions: updated})
                            }}
                            className="rounded border-zinc-300 dark:border-zinc-600 text-primary focus:ring-primary"
                          />
                          <span className="text-sm">{option.icon} {option.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* 活動偏好 */}
                  <div>
                    <label className="block text-lg font-medium text-zinc-700 dark:text-zinc-300 mb-3">
                      活動偏好
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {[
                        { id: 'outdoor', label: '戶外活動', icon: '🏞️' },
                        { id: 'indoor', label: '室內活動', icon: '🏛️' },
                        { id: 'museum', label: '博物館', icon: '🎨' },
                        { id: 'shopping', label: '購物', icon: '🛍️' },
                        { id: 'food_tour', label: '美食之旅', icon: '🍽️' },
                        { id: 'adventure', label: '冒險活動', icon: '🏔️' },
                        { id: 'relaxation', label: '放鬆休閒', icon: '🧘' },
                        { id: 'cultural', label: '文化體驗', icon: '🎭' },
                        { id: 'nightlife', label: '夜生活', icon: '🌃' }
                      ].map((option) => (
                        <label key={option.id} className="flex items-center gap-2 p-3 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer transition-colors">
                          <input
                            type="checkbox"
                            checked={preferencesData.activityPreferences.includes(option.id)}
                            onChange={(e) => {
                              const updated = e.target.checked
                                ? [...preferencesData.activityPreferences, option.id]
                                : preferencesData.activityPreferences.filter(id => id !== option.id)
                              setPreferencesData({...preferencesData, activityPreferences: updated})
                            }}
                            className="rounded border-zinc-300 dark:border-zinc-600 text-primary focus:ring-primary"
                          />
                          <span className="text-sm">{option.icon} {option.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mt-8 flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center justify-center rounded-lg h-10 px-5 bg-primary text-white text-sm font-bold tracking-wide hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? (
                      <>
                        <i className="fas fa-spinner fa-spin mr-2"></i>
                        儲存中...
                      </>
                    ) : (
                      '儲存偏好設定'
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* 歷史行程區塊 */}
          {activeSection === 'trip-history' && (
            <div className="p-6 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900/50">
              <h2 className="text-2xl font-bold mb-6 text-zinc-900 dark:text-white">歷史行程</h2>

              {error && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
                    <i className="fas fa-exclamation-circle"></i>
                    <span>{error}</span>
                  </div>
                </div>
              )}

              {loadingTrips ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-zinc-600 dark:text-zinc-400">載入行程中...</p>
                </div>
              ) : savedTrips.length === 0 ? (
                <div className="text-center py-12">
                  <i className="fas fa-history text-4xl text-zinc-400 dark:text-zinc-600 mb-4"></i>
                  <p className="text-zinc-600 dark:text-zinc-400 mb-4">您還沒有保存任何行程</p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-500">在行程詳情頁面點擊"保存行程"按鈕來保存您的行程</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {savedTrips.map((trip) => (
                    <div key={trip.id} className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">
                            {trip.title}
                          </h3>
                          <div className="flex items-center gap-4 text-sm text-zinc-600 dark:text-zinc-400 mb-3">
                            {trip.location && (
                              <div className="flex items-center gap-1">
                                <i className="fas fa-map-marker-alt"></i>
                                <span>{trip.location}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-1">
                              <i className="fas fa-calendar-alt"></i>
                              <span>{new Date(trip.created_at).toLocaleDateString('zh-TW')}</span>
                            </div>
                            {trip.trip_data?.itineraries && (
                              <div className="flex items-center gap-1">
                                <i className="fas fa-route"></i>
                                <span>{trip.trip_data.itineraries.length} 個方案</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 ml-4">
                          <button
                            onClick={() => viewTrip(trip)}
                            className="px-3 py-1.5 bg-primary text-white text-sm rounded hover:bg-primary/90 transition-colors"
                          >
                            <i className="fas fa-eye mr-1"></i>
                            查看
                          </button>
                          <button
                            onClick={() => deleteTrip(trip.id)}
                            className="px-3 py-1.5 bg-red-500 text-white text-sm rounded hover:bg-red-600 transition-colors"
                          >
                            <i className="fas fa-trash mr-1"></i>
                            刪除
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* 登出確認 Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6 relative">
            <button
              onClick={() => setShowLogoutConfirm(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
            >
              <i className="fas fa-times text-xl"></i>
            </button>

            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-sign-out-alt text-red-500 text-2xl"></i>
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                確定要登出嗎？
              </h3>
              <p className="text-slate-600 dark:text-slate-400">
                登出後您將無法查看個人資料頁面和保存的行程資訊。
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 px-4 py-3 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
              >
                取消
              </button>
              <button
                onClick={async () => {
                  setShowLogoutConfirm(false)
                  await supabase.auth.signOut()
                  window.location.reload()
                }}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
              >
                確定登出
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProfilePage