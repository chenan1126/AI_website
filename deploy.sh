#!/bin/bash

# AI 旅遊行程規劃系統 - 快速部署腳本
# 用法: ./deploy.sh [platform]
# platform: local, railway, render, heroku, docker

PLATFORM=${1:-local}

echo "🚀 開始部署 AI 旅遊行程規劃系統"
echo "目標平台: $PLATFORM"

case $PLATFORM in
    "local")
        echo "📦 本地部署模式"
        echo "請確保您已經："
        echo "1. 安裝了 Python 3.8+"
        echo "2. 設置了 .env 文件中的 API 金鑰"
        echo ""

        # 檢查 Python
        if ! command -v python &> /dev/null; then
            echo "❌ Python 未安裝，請前往 https://python.org 下載"
            exit 1
        fi

        # 創建虛擬環境
        echo "🔧 創建虛擬環境..."
        python -m venv venv

        # 啟動虛擬環境
        echo "⚡ 啟動虛擬環境..."
        source venv/bin/activate  # Linux/Mac
        # venv\Scripts\activate  # Windows (如果在 Windows 上運行，請手動執行)

        # 安裝依賴
        echo "📚 安裝依賴..."
        pip install -r requirements.txt

        # 檢查 .env 文件
        if [ ! -f "backend/.env" ]; then
            echo "⚠️  警告: 未找到 backend/.env 文件"
            echo "請創建 backend/.env 文件並添加您的 API 金鑰："
            echo "GEMINI_API_KEY=你的金鑰"
            echo "GOOGLE_MAPS_API_KEY=你的金鑰"
            echo "OPENWEATHERMAP_API_KEY=你的金鑰"
        fi

        # 運行應用
        echo "🎯 啟動應用..."
        echo "應用將在 http://localhost:5000 上運行"
        python backend/app.py
        ;;

    "docker")
        echo "🐳 Docker 部署模式"

        # 檢查 Docker
        if ! command -v docker &> /dev/null; then
            echo "❌ Docker 未安裝，請前往 https://docker.com 下載"
            exit 1
        fi

        # 檢查 .env 文件
        if [ ! -f "backend/.env" ]; then
            echo "❌ 未找到 backend/.env 文件，請先創建它"
            exit 1
        fi

        # 構建和運行
        echo "🏗️  構建 Docker 映像..."
        docker build -t ai-travel-planner .

        echo "🚀 啟動容器..."
        docker run -p 5000:5000 --env-file backend/.env ai-travel-planner
        ;;

    "railway")
        echo "🚂 Railway 部署模式"
        echo "請按照以下步驟："
        echo "1. 前往 https://railway.app 註冊/登入"
        echo "2. 點擊 'New Project' -> 'Deploy from GitHub repo'"
        echo "3. 選擇你的 AI_website 倉庫"
        echo "4. 在 Variables 設定中添加環境變數："
        echo "   - GEMINI_API_KEY"
        echo "   - GOOGLE_MAPS_API_KEY"
        echo "   - OPENWEATHERMAP_API_KEY"
        echo "5. Railway 會自動部署"
        ;;

    "render")
        echo "🎨 Render 部署模式"
        echo "請按照以下步驟："
        echo "1. 前往 https://render.com 註冊/登入"
        echo "2. 點擊 'New' -> 'Web Service'"
        echo "3. 連接你的 GitHub 倉庫"
        echo "4. 設定："
        echo "   - Build Command: pip install -r requirements.txt"
        echo "   - Start Command: python backend/app.py"
        echo "5. 添加環境變數"
        ;;

    "heroku")
        echo "🟣 Heroku 部署模式"
        echo "請按照以下步驟："
        echo "1. 安裝 Heroku CLI"
        echo "2. heroku login"
        echo "3. heroku create your-app-name"
        echo "4. heroku config:set GEMINI_API_KEY=你的金鑰 GOOGLE_MAPS_API_KEY=你的金鑰 OPENWEATHERMAP_API_KEY=你的金鑰"
        echo "5. git push heroku main"
        ;;

    *)
        echo "❌ 不支援的平台: $PLATFORM"
        echo "支援的平台: local, docker, railway, render, heroku"
        exit 1
        ;;
esac

echo "✅ 部署完成！"