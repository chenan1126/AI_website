import { Link, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'

function Header({ session, onShowAuth, onLogout }) {
  const location = useLocation();
  const isHomePage = location.pathname === '/';
  const [isScrolled, setIsScrolled] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // 初始化主題
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    } else {
      setIsDarkMode(false);
      document.documentElement.classList.remove('dark');
    }
  }, []);

  // 切換主題
  const toggleTheme = () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);

    if (newTheme) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  // 監聽滾動事件
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      setIsScrolled(scrollTop > 50); // 滾動超過 50px 就改變樣式
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const getUserDisplayName = () => {
    if (!session?.user) return '';

    if (session.user.user_metadata?.display_name) {
      return session.user.user_metadata.display_name;
    }

    if (session.user.user_metadata?.full_name) {
      return session.user.user_metadata.full_name;
    }

    if (session.user.email) {
      return session.user.email.split('@')[0];
    }

    return '使用者';
  };

  // 動態決定 header 樣式
  const getHeaderClasses = () => {
    const baseClasses = "w-full z-30 transition-all duration-300";

    if (isHomePage) {
      // 首頁：滾動前透明，滾動後半透明背景
      return isScrolled
        ? `${baseClasses} fixed ${isDarkMode ? 'bg-black/80' : 'bg-white/80'} backdrop-blur-md shadow-lg`
        : `${baseClasses} absolute`;
    } else {
      // 其他頁面：滾動前透明，滾動後背景色
      return isScrolled
        ? `${baseClasses} fixed ${isDarkMode ? 'bg-slate-900 shadow-lg border-b border-slate-700' : 'bg-white shadow-lg border-b border-gray-200'}`
        : `${baseClasses} absolute`;
    }
  };

  return (
    <>
      <header className={getHeaderClasses()}>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-24">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
              <svg className="text-primary h-10 w-10" fill="currentColor" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                <path d="M8.57829 8.57829C5.52816 11.6284 3.451 15.5145 2.60947 19.7452C1.76794 23.9758 2.19984 28.361 3.85056 32.3462C5.50128 36.3314 8.29667 39.7376 11.8832 42.134C15.4698 44.5305 19.6865 45.8096 24 45.8096C28.3135 45.8096 32.5302 44.5305 36.1168 42.134C39.7033 39.7375 42.4987 36.3314 44.1494 32.3462C45.8002 28.361 46.2321 23.9758 45.3905 19.7452C44.549 15.5145 42.4718 11.6284 39.4217 8.57829L24 24L8.57829 8.57829Z"/>
              </svg>
              <h1 className={`text-3xl font-bold transition-colors duration-300 ${
                isHomePage
                  ? (isScrolled ? (isDarkMode ? 'text-white' : 'text-gray-900') : 'text-white')
                  : (isScrolled ? (isDarkMode ? 'text-white' : 'text-gray-900') : (isDarkMode ? 'text-white' : 'text-gray-900'))
              }`}>
                TravelAI
              </h1>
            </Link>

            {/* Navigation */}
            <nav className="hidden md:flex items-center gap-10 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
              <Link
                to="/"
                className={`transition-colors text-lg ${
                  isHomePage
                    ? (isScrolled ? (isDarkMode ? 'text-white/90 hover:text-white' : 'text-gray-900 hover:text-gray-700') : 'text-white/80 hover:text-white')
                    : (isScrolled ? (isDarkMode ? 'text-white/90 hover:text-white' : 'text-gray-600 hover:text-gray-900') : (isDarkMode ? 'text-white/80 hover:text-white' : 'text-gray-600 hover:text-gray-900'))
                }`}
              >
                首頁
              </Link>
              <Link
                to="/plan"
                className={`transition-colors text-lg ${
                  isHomePage
                    ? (isScrolled ? (isDarkMode ? 'text-white/90 hover:text-white' : 'text-gray-900 hover:text-gray-700') : 'text-white/80 hover:text-white')
                    : (isScrolled ? (isDarkMode ? 'text-white/90 hover:text-white' : 'text-gray-600 hover:text-gray-900') : (isDarkMode ? 'text-white/80 hover:text-white' : 'text-gray-600 hover:text-gray-900'))
                }`}
              >
                規劃行程
              </Link>
              <Link
                to="/attractions"
                className={`transition-colors text-lg ${
                  isHomePage
                    ? (isScrolled ? (isDarkMode ? 'text-white/90 hover:text-white' : 'text-gray-900 hover:text-gray-700') : 'text-white/80 hover:text-white')
                    : (isScrolled ? (isDarkMode ? 'text-white/90 hover:text-white' : 'text-gray-600 hover:text-gray-900') : (isDarkMode ? 'text-white/80 hover:text-white' : 'text-gray-600 hover:text-gray-900'))
                }`}
              >
                景點資料庫
              </Link>
            </nav>

            {/* User Section */}
            <div className="hidden md:flex items-center gap-4 animate-fade-in-up" style={{ animationDelay: '0.6s' }}>
              {/* Theme Toggle Button */}
              <button
                onClick={toggleTheme}
                className={`p-2 rounded-full transition-all duration-300 ${
                  isHomePage
                    ? (isScrolled ? (isDarkMode ? 'text-white hover:bg-white/20' : 'text-gray-700 hover:bg-gray-100') : (isDarkMode ? 'text-white hover:bg-white/10' : 'text-gray-700 hover:bg-gray-100'))
                    : (isScrolled ? (isDarkMode ? 'text-white hover:bg-white/20' : 'text-gray-700 hover:bg-gray-100') : (isDarkMode ? 'text-white hover:bg-white/10' : 'text-gray-700 hover:bg-gray-100'))
                }`}
                aria-label="Toggle theme"
              >
                {isDarkMode ? (
                  <i className="fas fa-sun text-lg"></i>
                ) : (
                  <i className="fas fa-moon text-lg"></i>
                )}
              </button>

              {session ? (
                <>
                  <Link
                    to="/profile"
                    className={`px-6 py-2.5 text-lg font-medium rounded-full transition-all duration-300 flex items-center gap-2 ${
                      isHomePage
                        ? (isScrolled ? (isDarkMode ? 'text-white hover:bg-white/20' : 'text-gray-700 hover:bg-gray-100') : (isDarkMode ? 'text-white hover:bg-white/10' : 'text-gray-700 hover:bg-gray-100'))
                        : (isScrolled ? (isDarkMode ? 'text-white hover:bg-white/20' : 'text-gray-700 hover:bg-gray-100') : (isDarkMode ? 'text-white hover:bg-white/10' : 'text-gray-700 hover:bg-gray-100'))
                    }`}
                  >
                    <i className="fas fa-user"></i>
                    <span>{getUserDisplayName()}</span>
                  </Link>
                  <button
                    onClick={() => setShowLogoutConfirm(true)}
                    className={`px-6 py-2.5 text-lg font-medium rounded-full transition-all duration-300 ${
                      isHomePage
                        ? (isScrolled ? (isDarkMode ? 'text-white hover:bg-white/20' : 'text-gray-700 hover:bg-gray-100') : (isDarkMode ? 'text-white hover:bg-white/10' : 'text-gray-700 hover:bg-gray-100'))
                        : (isScrolled ? (isDarkMode ? 'text-white hover:bg-white/20' : 'text-gray-700 hover:bg-gray-100') : (isDarkMode ? 'text-white hover:bg-white/10' : 'text-gray-700 hover:bg-gray-100'))
                    }`}
                  >
                    <i className="fas fa-sign-out-alt"></i>
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={onShowAuth}
                    className={`px-6 py-2.5 text-lg font-medium rounded-full transition-all duration-300 ${
                      isHomePage
                        ? (isScrolled ? (isDarkMode ? 'text-white hover:bg-white/20' : 'text-gray-700 hover:bg-gray-100') : (isDarkMode ? 'text-white hover:bg-white/10' : 'text-gray-700 hover:bg-gray-100'))
                        : (isScrolled ? (isDarkMode ? 'text-white hover:bg-white/20' : 'text-gray-700 hover:bg-gray-100') : (isDarkMode ? 'text-white hover:bg-white/10' : 'text-gray-700 hover:bg-gray-100'))
                    }`}
                  >
                    登入
                  </button>
                  <button
                    onClick={onShowAuth}
                    className="px-6 py-2.5 text-lg font-medium rounded-full bg-primary text-white hover:bg-opacity-90 transition-all transform hover:scale-105"
                  >
                    註冊
                  </button>
                </>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              className={`md:hidden p-2 rounded-lg transition-colors ${
                isHomePage
                  ? (isScrolled ? (isDarkMode ? 'text-white hover:bg-white/20' : 'text-gray-900 hover:bg-gray-100') : 'text-white hover:bg-white/20')
                  : (isScrolled ? (isDarkMode ? 'text-white hover:bg-white/20' : 'text-gray-900 hover:bg-gray-100') : (isDarkMode ? 'text-white hover:bg-white/20' : 'text-gray-900 hover:bg-gray-100'))
              }`}
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              <i className={`fas ${isMobileMenuOpen ? 'fa-times' : 'fa-bars'} text-2xl`}></i>
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className={`md:hidden absolute top-full left-0 w-full shadow-lg transition-all duration-300 ${
            isDarkMode ? 'bg-slate-900 border-t border-slate-800' : 'bg-white border-t border-gray-100'
          }`}>
            <div className="flex flex-col p-4 space-y-4">
              <Link
                to="/"
                className={`px-4 py-2 rounded-lg text-lg font-medium ${
                  isDarkMode ? 'text-white hover:bg-slate-800' : 'text-gray-900 hover:bg-gray-50'
                }`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                首頁
              </Link>
              <Link
                to="/plan"
                className={`px-4 py-2 rounded-lg text-lg font-medium ${
                  isDarkMode ? 'text-white hover:bg-slate-800' : 'text-gray-900 hover:bg-gray-50'
                }`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                規劃行程
              </Link>
              <Link
                to="/attractions"
                className={`px-4 py-2 rounded-lg text-lg font-medium ${
                  isDarkMode ? 'text-white hover:bg-slate-800' : 'text-gray-900 hover:bg-gray-50'
                }`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                景點資料庫
              </Link>
              
              <div className="border-t border-gray-200 dark:border-gray-700 my-2"></div>
              
              <div className="flex items-center justify-between px-4">
                <span className={`text-lg font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  切換主題
                </span>
                <button
                  onClick={toggleTheme}
                  className={`p-2 rounded-full ${
                    isDarkMode ? 'text-white hover:bg-slate-800' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {isDarkMode ? <i className="fas fa-sun text-xl"></i> : <i className="fas fa-moon text-xl"></i>}
                </button>
              </div>

              {session ? (
                <>
                  <Link
                    to="/profile"
                    className={`px-4 py-2 rounded-lg text-lg font-medium flex items-center gap-2 ${
                      isDarkMode ? 'text-white hover:bg-slate-800' : 'text-gray-900 hover:bg-gray-50'
                    }`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <i className="fas fa-user"></i>
                    <span>{getUserDisplayName()}</span>
                  </Link>
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      setShowLogoutConfirm(true);
                    }}
                    className="w-full text-left px-4 py-2 rounded-lg text-lg font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <i className="fas fa-sign-out-alt mr-2"></i>
                    登出
                  </button>
                </>
              ) : (
                <div className="flex flex-col gap-3 mt-2">
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      onShowAuth();
                    }}
                    className={`w-full px-4 py-2.5 rounded-lg text-lg font-medium border ${
                      isDarkMode ? 'border-slate-600 text-white hover:bg-slate-800' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    登入
                  </button>
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      onShowAuth();
                    }}
                    className="w-full px-4 py-2.5 rounded-lg text-lg font-medium bg-primary text-white hover:bg-opacity-90"
                  >
                    註冊
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

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
                onClick={() => {
                  setShowLogoutConfirm(false);
                  onLogout();
                }}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
              >
                確定登出
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default Header
