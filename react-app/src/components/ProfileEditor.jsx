import { useState } from 'react'
import { supabase } from '../supabaseClient'
import './ProfileEditor.css'

function ProfileEditor({ session, onClose, onSuccess }) {
  const [displayName, setDisplayName] = useState(
    session?.user?.user_metadata?.display_name || 
    session?.user?.user_metadata?.full_name || 
    session?.user?.email?.split('@')[0] || 
    ''
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const handleSave = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    try {
      const { data, error } = await supabase.auth.updateUser({
        data: {
          display_name: displayName
        }
      })

      if (error) throw error

      console.log('✅ 個人資料更新成功:', data)
      setMessage('個人資料已更新！')
      
      setTimeout(() => {
        onSuccess && onSuccess(data)
        onClose && onClose()
      }, 1000)
    } catch (error) {
      console.error('❌ 更新失敗:', error)
      setError(error.message || '更新失敗，請重試')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="profile-overlay" onClick={onClose}>
      <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
        <button className="profile-close" onClick={onClose}>
          <i className="fas fa-times"></i>
        </button>

        <div className="profile-header">
          <i className="fas fa-user-edit"></i>
          <h2>編輯個人資料</h2>
        </div>

        <form onSubmit={handleSave}>
          <div className="profile-field">
            <label>
              <i className="fas fa-user"></i>
              顯示名稱
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="輸入您的名字"
              required
              disabled={loading}
            />
          </div>

          <div className="profile-field">
            <label>
              <i className="fas fa-envelope"></i>
              電子郵件
            </label>
            <input
              type="email"
              value={session?.user?.email || ''}
              disabled
              className="disabled-field"
            />
            <small className="field-hint">電子郵件無法修改</small>
          </div>

          {error && (
            <div className="profile-error">
              <i className="fas fa-exclamation-circle"></i>
              <span>{error}</span>
            </div>
          )}

          {message && (
            <div className="profile-success">
              <i className="fas fa-check-circle"></i>
              <span>{message}</span>
            </div>
          )}

          <button type="submit" className="profile-submit" disabled={loading}>
            {loading ? (
              <>
                <i className="fas fa-spinner fa-spin"></i>
                儲存中...
              </>
            ) : (
              <>
                <i className="fas fa-save"></i>
                儲存變更
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}

export default ProfileEditor
