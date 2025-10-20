import { Component } from 'react'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    console.error('❌ React Error Boundary caught an error:', error, errorInfo)
    this.setState({
      error: error,
      errorInfo: errorInfo
    })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '40px',
          maxWidth: '800px',
          margin: '0 auto',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          <h1 style={{ color: '#ef4444', marginBottom: '20px' }}>
            <i className="fas fa-exclamation-triangle"></i> 應用程式發生錯誤
          </h1>
          <div style={{
            background: '#fee',
            border: '1px solid #fcc',
            borderRadius: '8px',
            padding: '20px',
            marginBottom: '20px'
          }}>
            <h2 style={{ marginTop: 0 }}>錯誤訊息：</h2>
            <pre style={{
              background: '#fff',
              padding: '10px',
              borderRadius: '4px',
              overflow: 'auto'
            }}>
              {this.state.error && this.state.error.toString()}
            </pre>
            
            {this.state.errorInfo && (
              <>
                <h3>錯誤堆疊：</h3>
                <pre style={{
                  background: '#fff',
                  padding: '10px',
                  borderRadius: '4px',
                  overflow: 'auto',
                  fontSize: '12px'
                }}>
                  {this.state.errorInfo.componentStack}
                </pre>
              </>
            )}
          </div>
          
          <div style={{
            background: '#fef3c7',
            border: '1px solid #fbbf24',
            borderRadius: '8px',
            padding: '20px'
          }}>
            <h3 style={{ marginTop: 0 }}>💡 解決建議：</h3>
            <ul style={{ lineHeight: '1.8' }}>
              <li>檢查瀏覽器控制台是否有更多錯誤訊息</li>
              <li>確認 <code>react-app/.env</code> 文件存在且包含正確的環境變數</li>
              <li>嘗試重新啟動開發伺服器：<code>npm run dev</code></li>
              <li>清除瀏覽器快取並重新整理頁面</li>
            </ul>
          </div>
          
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '20px',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '12px 24px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: '500'
            }}
          >
            <i className="fas fa-redo"></i> 重新載入頁面
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
