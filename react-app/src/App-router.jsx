import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Header from './components/Header'
import Footer from './components/Footer'
import HomePage from './pages/HomePage'
import PlannerPage from './pages/PlannerPage'
import AuthForm from './components/AuthForm'
import ProfileEditor from './components/ProfileEditor'
import { supabase } from './supabaseClient'
import './App.css'

function App() {
  const [session, setSession] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

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

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      console.log('✅ 登出成功');
    } catch (error) {
      console.error('❌ 登出失敗:', error);
    }
  };

  return (
    <Router>
      <div className="min-h-screen flex flex-col bg-background-light dark:bg-background-dark">
        <Header 
          session={session}
          onShowAuth={() => setShowAuth(true)}
          onShowProfile={() => setShowProfile(true)}
          onLogout={handleLogout}
        />
        
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/plan" element={<PlannerPage />} />
          </Routes>
        </main>

        <Footer />

        {/* Modals */}
        {showAuth && (
          <AuthForm 
            onClose={() => setShowAuth(false)}
            onSuccess={() => {
              console.log('✅ 認證成功');
              setShowAuth(false);
            }}
          />
        )}

        {showProfile && session && (
          <ProfileEditor 
            session={session}
            onClose={() => setShowProfile(false)}
            onSuccess={() => {
              console.log('✅ 個人資料更新成功');
              supabase.auth.getSession().then(({ data: { session } }) => {
                setSession(session);
              });
              setShowProfile(false);
            }}
          />
        )}
      </div>
    </Router>
  );
}

export default App;
