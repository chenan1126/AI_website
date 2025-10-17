import { useState } from 'react'
import { supabase } from '../supabaseClient'
import './AuthForm.css'

function AuthForm({ onClose, onSuccess }) {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    try {
      if (isLogin) {
        // 登入
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) throw error

        console.log('✅ 登入成功:', data)
        setMessage('登入成功！')
        setTimeout(() => {
          onSuccess && onSuccess(data)
          onClose && onClose()
        }, 1000)
      } else {
        // 註冊
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              display_name: displayName, // 必填，不再使用預設值
            }
          }
        })

        if (error) throw error

        console.log('✅ 註冊成功:', data)
        setMessage('註冊成功！請檢查您的電子郵件以確認帳號。')
        setTimeout(() => {
          setIsLogin(true)
          setMessage('')
          setDisplayName('')
          setEmail('')
          setPassword('')
        }, 3000)
      }
    } catch (error) {
      console.error('❌ 認證錯誤:', error)
      setError(error.message || '操作失敗，請重試')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    try {
      setLoading(true)
      setError('')
      
      console.log('🔑 開始 Google 登入...')
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          }
        }
      })
      
      if (error) {
        console.error('❌ Google 登入錯誤:', error)
        throw error
      }
      
      console.log('✅ OAuth 請求成功:', data)
      // OAuth 會自動重定向，不需要手動關閉
    } catch (error) {
      console.error('❌ Google 登入失敗:', error)
      setError(error.message || 'Google 登入失敗，請重試')
      setLoading(false)
    }
  }

  return (
    <div className="auth-overlay" onClick={onClose}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <button className="auth-close" onClick={onClose}>
          <i className="fas fa-times"></i>
        </button>

        <div className="auth-header">
          <i className="fas fa-user-circle"></i>
          <h2>{isLogin ? '登入' : '註冊'}</h2>
        </div>

        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <div className="auth-field">
              <label>
                <i className="fas fa-user"></i>
                顯示名稱 <span className="required">*</span>
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="請輸入您的名字"
                required
                disabled={loading}
              />
              <small className="field-hint">此名字將顯示在您的個人資料中</small>
            </div>
          )}

          <div className="auth-field">
            <label>
              <i className="fas fa-envelope"></i>
              電子郵件 <span className="required">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              disabled={loading}
            />
          </div>

          <div className="auth-field">
            <label>
              <i className="fas fa-lock"></i>
              密碼 <span className="required">*</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少 6 個字元"
              minLength={6}
              required
              disabled={loading}
            />
          </div>

          {error && (
            <div className="auth-error">
              <i className="fas fa-exclamation-circle"></i>
              <span>{error}</span>
            </div>
          )}

          {message && (
            <div className="auth-success">
              <i className="fas fa-check-circle"></i>
              <span>{message}</span>
            </div>
          )}

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? (
              <>
                <i className="fas fa-spinner fa-spin"></i>
                處理中...
              </>
            ) : (
              <>
                <i className={`fas fa-${isLogin ? 'sign-in-alt' : 'user-plus'}`}></i>
                {isLogin ? '登入' : '註冊'}
              </>
            )}
          </button>
        </form>

        <div className="auth-divider">
          <span>或</span>
        </div>

        <button 
          onClick={handleGoogleLogin}
          disabled={loading}
          className="google-login-btn"
          type="button"
        >
          <svg className="google-icon" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          使用 Google 登入
        </button>

        <div className="auth-switch">
          {isLogin ? '還沒有帳號？' : '已經有帳號了？'}
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin)
              setError('')
              setMessage('')
              setDisplayName('')
            }}
            disabled={loading}
          >
            {isLogin ? '立即註冊' : '前往登入'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default AuthForm
