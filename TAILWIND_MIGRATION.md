# Tailwind CSS 遷移說明

**日期**: 2025-10-19  
**變更**: 從 Tailwind CDN 遷移到 Tailwind CSS v4 編譯版本

---

## 變更摘要

我們已將 Tailwind CSS 從 CDN 版本遷移到編譯版本，以獲得更好的效能和更完整的功能支援。

## 變更內容

### 1. 移除 CDN 引用

**檔案**: `react-app/index.html`

**移除**:
```html
<!-- Tailwind CSS CDN -->
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<script>
  tailwind.config = { ... }
</script>
```

### 2. 建立 Tailwind 配置檔

**新增檔案**: `react-app/tailwind.config.js`

```javascript
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#13a4ec',
        'background-light': '#ffffff',
        'background-dark': '#0f172a',
        'text-light': '#0f172a',
        'text-dark': '#f8fafc',
      },
      fontFamily: {
        sans: ['Poppins', 'sans-serif'],
        serif: ['Playfair Display', 'serif'],
      },
      borderRadius: {
        DEFAULT: '0.5rem',
        lg: '1rem',
        xl: '1.5rem',
        '2xl': '2rem',
        full: '9999px',
      },
      keyframes: {
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.8s ease-out forwards',
      },
    },
  },
  plugins: [],
}
```

### 3. 更新 CSS 入口檔

**檔案**: `react-app/src/index.css`

**更新為**:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* 自訂動畫、樣式等... */
```

### 4. PostCSS 配置

**檔案**: `react-app/postcss.config.js` (已存在，無需變更)

```javascript
export default {
  plugins: {
    '@tailwindcss/postcss': {},
    autoprefixer: {},
  },
}
```

## 優勢

### 效能提升
- ✅ **更小的檔案大小**: 只打包使用到的 CSS 類別
- ✅ **更快的載入速度**: 消除了 CDN 延遲和執行時編譯
- ✅ **更好的快取**: CSS 可以被瀏覽器有效快取

### 開發體驗
- ✅ **更好的 IDE 支援**: VSCode 可以提供完整的 IntelliSense
- ✅ **型別安全**: 可以使用 TypeScript 類型定義
- ✅ **自訂插件**: 可以添加 Tailwind 官方和社群插件

### 生產環境
- ✅ **PurgeCSS**: 自動移除未使用的樣式
- ✅ **最佳化**: 生產建置時自動壓縮和最佳化
- ✅ **一致性**: 開發和生產環境使用相同的配置

## 已安裝的套件

```json
{
  "devDependencies": {
    "@tailwindcss/postcss": "^4.1.14",
    "autoprefixer": "^10.4.21",
    "postcss": "^8.5.6",
    "tailwindcss": "^4.1.14"
  }
}
```

## 使用方式

### 開發模式
```bash
npm run dev
```

Vite 會自動透過 PostCSS 編譯 Tailwind CSS。

### 建置生產版本
```bash
npm run build
```

會產生最佳化的 CSS 檔案到 `dist/` 目錄。

## 配置說明

### 顏色
- `primary`: #13a4ec (天藍色)
- `background-light`: #ffffff (白色)
- `background-dark`: #0f172a (深藍色)
- `text-light`: #0f172a (深色文字)
- `text-dark`: #f8fafc (淺色文字)

### 字體
- `font-sans`: Poppins (預設無襯線字體)
- `font-serif`: Playfair Display (襯線字體，用於標題)

### 圓角
- `rounded`: 0.5rem
- `rounded-lg`: 1rem
- `rounded-xl`: 1.5rem
- `rounded-2xl`: 2rem
- `rounded-full`: 9999px

### 動畫
- `animate-fade-in-up`: 淡入向上動畫 (0.8s)
- 自訂 `fadeInUp` 關鍵幀已定義

## 遷移檢查清單

- [x] 移除 `index.html` 中的 Tailwind CDN script
- [x] 建立 `tailwind.config.js`
- [x] 更新 `index.css` 加入 `@tailwind` 指令
- [x] 驗證 PostCSS 配置
- [x] 更新專案文檔
- [x] 測試開發模式
- [ ] 測試生產建置
- [ ] 驗證所有頁面樣式正常

## 注意事項

1. **CSS 載入順序**: 確保 `index.css` 在 `main.jsx` 中正確導入
2. **動態類別**: 如果使用動態生成的類別名稱，確保它們在 `content` 配置中被包含
3. **JIT 模式**: Tailwind v4 預設使用 JIT (Just-In-Time) 模式，提供更快的編譯速度

## 故障排除

### 樣式沒有生效
1. 檢查 `tailwind.config.js` 中的 `content` 路徑是否正確
2. 確認 `postcss.config.js` 存在且配置正確
3. 重啟開發伺服器 (`npm run dev`)

### 自訂樣式遺失
1. 檢查 `index.css` 中是否正確使用 `@layer` 指令
2. 確認自訂類別在 `tailwind.config.js` 的 `extend` 中定義

### 建置失敗
1. 確認所有相依套件都已安裝: `npm install`
2. 清除快取: `rm -rf node_modules/.vite`
3. 重新建置: `npm run build`

---

**維護者**: 專題團隊  
**參考文件**: 
- [Tailwind CSS v4 官方文檔](https://tailwindcss.com/docs)
- [Vite 配置指南](https://vitejs.dev/config/)
