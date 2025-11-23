import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Header from './components/Header'
import HomePage from './pages/HomePage'
import PlannerPage from './pages/PlannerPage'
import TripDetailPage from './pages/TripDetailPage'
import ProfilePage from './pages/ProfilePage'
import AttractionsPage from './pages/AttractionsPage'
import AuthForm from './components/AuthForm'
import { supabase } from './supabaseClient'
import './App.css'

function App() {
  const [session, setSession] = useState(null);
  const [showAuth, setShowAuth] = useState(false);

  // 監聽認證狀態變化
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      console.log('✅ 當前 session:', session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('🔄 認證狀態變化:', _event, session);
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleShowAuth = () => {
    setShowAuth(true);
  };

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      console.log('✅ 登出成功');
      // 登出後重載頁面以清除所有狀態
      window.location.reload();
    } catch (error) {
      console.error('❌ 登出失敗:', error);
    }
  };

  return (
    <Router>
      <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark antialiased">
        <Header 
          session={session}
          onShowAuth={() => setShowAuth(true)}
          onLogout={handleLogout}
        />
        
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/plan" element={<PlannerPage />} />
            <Route path="/trip-detail" element={<TripDetailPage session={session} onShowAuth={handleShowAuth} />} />
            <Route path="/profile" element={<ProfilePage session={session} onShowAuth={handleShowAuth} />} />
            <Route path="/attractions" element={<AttractionsPage session={session} onShowAuth={handleShowAuth} />} />
          </Routes>
        </main>

        {/* Modals */}
        {showAuth && (
          <AuthForm 
            onClose={() => setShowAuth(false)}
            onSuccess={() => {
              console.log('✅ 認證成功');
              setShowAuth(false);
              // 登入後重載頁面以更新所有狀態
              window.location.reload();
            }}
          />
        )}
      </div>
    </Router>
  );
}

export default App;
