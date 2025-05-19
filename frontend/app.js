let sessionId = localStorage.getItem('session_id') || ('session-' + Date.now());
localStorage.setItem('session_id', sessionId);

// 檢查後端服務器是否在運行
async function checkServer() {
    try {
        const response = await fetch('http://localhost:5000/test');
        const data = await response.json();
        return data.status === 'success';
    } catch (error) {
        return false;
    }
}

// 定期檢查服務器狀態
async function checkServerStatus() {
    const isRunning = await checkServer();
    const errorContainer = document.getElementById('errorContainer');
    errorContainer.innerHTML = isRunning ? '' : '<div class="error">後端服務器未運行或無法訪問</div>';
}

// 初始檢查
checkServerStatus();
setInterval(checkServerStatus, 30000);

// 添加這個函數來安全地獲取元素
function safeGetElement(id) {
    const element = document.getElementById(id);
    if (!element) {
        console.error(`元素 ID "${id}" 不存在於頁面中`);
    }
    return element;
}

// 在提交表單時
document.addEventListener('DOMContentLoaded', function() {
    
    const formElement = safeGetElement('questionForm');
    
    if (!formElement) {
        console.error('無法找到表單元素 #questionForm，表單提交功能將無法使用');
        return;
    }
    
    formElement.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const questionInput = safeGetElement('questionInput');
        const citySelect = safeGetElement('citySelect');
        const tripTypeSelect = safeGetElement('tripTypeSelect');
        const loadingEl = safeGetElement('loading');
        const resultsDiv = safeGetElement('results');
        
        // 檢查必要元素是否存在
        if (!questionInput || !citySelect || !tripTypeSelect || !loadingEl || !resultsDiv) {
            console.error('表單元素缺失，無法處理請求');
            return;
        }
        
        const sessionId = 'session-' + Date.now();
        
        // 獲取城市名稱
        const city = citySelect.value;

        // 允許用戶自定義問題
        let question;
        if (questionInput.value.trim() === "") {
            question = `請幫我規劃${city}${tripTypeSelect.value}行程`;
        } else {
            question = questionInput.value.trim().includes(city) ? 
                questionInput.value.trim() : 
                `${city}的${questionInput.value.trim()}`;
        }
        
        // 顯示載入指示器
        loadingEl.style.display = 'block';
        resultsDiv.innerHTML = '';
        
        // 記錄請求細節
        console.log("正在發送請求:", {
            url: 'http://localhost:5000/ask',
            method: 'POST',
            data: {
                session_id: sessionId,
                question: question,
                city_name: city,
                get_both_responses: true
            }
        });
        
        // 設置超時控制
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('請求超時，請檢查後端服務器')), 60000); // 60秒超時
        });

        try {
            const fetchPromise = fetch('http://localhost:5000/ask', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    session_id: sessionId,
                    question: question,
                    city_name: city,
                    get_both_responses: true
                })
            });
            
            // 使用 Promise.race 來實現超時功能
            const response = await Promise.race([fetchPromise, timeoutPromise]);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('伺服器回應錯誤:', response.status, errorText);
                throw new Error(`HTTP 錯誤: ${response.status} - ${errorText || '未知錯誤'}`);
            }
            
            const responseData = await response.json();
            
            // 隱藏載入指示器
            loadingEl.style.display = 'none';
            
            if (responseData.status === 'success') {
                if (!responseData.data) {
                    throw new Error("回應中沒有資料");
                }
                
                // 創建容器以顯示回答
                if (responseData.pure_llm_response) {
                    // 顯示兩種回答
                    resultsDiv.innerHTML = `
                        <div class="response-container">
                            <div class="response-wrapper">
                                <h3 class="response-title">純AI回答</h3>
                                <div id="pure-llm-response" class="response-content"></div>
                            </div>
                            <div class="response-wrapper">
                                <h3 class="response-title">加強版回答（包含天氣、評分等資訊）</h3>
                                <div id="enhanced-response" class="response-content"></div>
                            </div>
                        </div>
                    `;
                    
                    renderPureLLMAnswer(document.getElementById('pure-llm-response'), responseData.pure_llm_response);
                    renderAnswer(document.getElementById('enhanced-response'), responseData.data);
                } else {
                    // 只顯示一種回答
                    renderAnswer(resultsDiv, responseData.data);
                }
                
                // 如果有警告，顯示它
                if (responseData.warning) {
                    const warningEl = document.createElement('div');
                    warningEl.className = 'warning';
                    warningEl.textContent = responseData.warning;
                    resultsDiv.prepend(warningEl);
                }
            } else {
                resultsDiv.innerHTML = `<div class="error">錯誤: ${responseData.message || '未知錯誤'}</div>`;
            }
        } catch (error) {
            console.error('請求處理錯誤:', error);
            loadingEl.style.display = 'none';
            resultsDiv.innerHTML = `<div class="error">請求失敗: ${error.message}</div>`;
            
            // 添加簡單的重試按鈕
            const retryButton = document.createElement('button');
            retryButton.className = 'btn-secondary';
            retryButton.textContent = '重試';
            retryButton.style.marginTop = '10px';
            retryButton.onclick = () => formElement.dispatchEvent(new Event('submit'));
            resultsDiv.appendChild(retryButton);
        }
    });
});

// 渲染加強版回答
function renderAnswer(container, data) {
    container.innerHTML = '';

    try {
        if (!data || !data.title || !Array.isArray(data.sections)) {
            throw new Error("回應格式不正確");
        }

        // 創建行程卡片容器
        const tripCard = document.createElement('div');
        tripCard.className = 'trip-card';
        
        // 添加標題區塊
        const titleSection = document.createElement('div');
        titleSection.className = 'trip-title-section';
        titleSection.innerHTML = `
            <h2>${data.title}</h2>
            ${data.total_distance && data.total_duration ? 
                `<div class="trip-summary">
                    <div class="summary-item"><i class="fas fa-road"></i> 總距離：${data.total_distance}</div>
                    <div class="summary-item"><i class="fas fa-clock"></i> 總行駛時間：${data.total_duration}</div>
                </div>` : ''}
        `;
        tripCard.appendChild(titleSection);
        
        // 添加天氣卡片
        if (data.weather_data && data.weather_data.length > 0) {
            try {
                const weatherData = data.weather_data[0];
                const weather = weatherData.weather || {};
                const cityName = weatherData.city_name || '所選城市';
                
                const simpleWeather = document.createElement('div');
                simpleWeather.setAttribute('id', 'weather-info-card');
                simpleWeather.setAttribute('style', 'border:2px solid #4a90e2; padding:15px; margin:15px 0; background-color:#f0f8ff; border-radius:5px;');
                
                simpleWeather.innerHTML = `
                    <div style="margin-bottom:10px; font-weight:bold; font-size:18px; color:#2c3e50;">
                        ☁️ ${cityName} 今日天氣
                    </div>
                    <div style="display:flex; flex-wrap:wrap;">
                        <div style="flex:1; min-width:120px; margin-bottom:10px;">
                            <div style="font-size:24px; font-weight:bold; color:#1a5276;">
                                ${weather.temperature}°C
                            </div>
                            <div>${weather.condition || '未知'}</div>
                        </div>
                        <div style="flex:2; display:flex; flex-wrap:wrap;">
                            <div style="flex:1; min-width:100px; background:#e8f4f8; padding:8px; margin:3px; border-radius:3px;">
                                <div style="font-size:13px; color:#7f8c8d;">最高溫</div>
                                <div style="font-weight:bold;">${weather.max_temp || '-'}°C</div>
                            </div>
                            <div style="flex:1; min-width:100px; background:#e8f4f8; padding:8px; margin:3px; border-radius:3px;">
                                <div style="font-size:13px; color:#7f8c8d;">最低溫</div>
                                <div style="font-weight:bold;">${weather.min_temp || '-'}°C</div>
                            </div>
                            <div style="flex:1; min-width:100px; background:#e8f4f8; padding:8px; margin:3px; border-radius:3px;">
                                <div style="font-size:13px; color:#7f8c8d;">降雨機率</div>
                                <div style="font-weight:bold;">${weather.rain_probability || '-'}%</div>
                            </div>
                        </div>
                    </div>
                `;
                tripCard.appendChild(simpleWeather);
                
            } catch (weatherError) {
                const errorDiv = document.createElement('div');
                errorDiv.style.padding = '10px';
                errorDiv.style.margin = '10px 0';
                errorDiv.style.backgroundColor = '#ffdddd';
                errorDiv.style.color = '#d8000c';
                errorDiv.style.borderRadius = '4px';
                errorDiv.textContent = '無法顯示天氣資訊';
                tripCard.appendChild(errorDiv);
            }
        }
        
        // 如果有天氣調整建議，顯示在天氣卡片下方
        if (data.weather_adjustments && data.weather_adjustments.length > 0) {
            const adjustmentsCard = document.createElement('div');
            adjustmentsCard.className = 'weather-adjustments-card';
            
            let adjustmentsHTML = `
                <h3><i class="fas fa-exclamation-circle"></i> 天氣提示</h3>
                <ul class="weather-adjustments-list">
            `;
            
            data.weather_adjustments.forEach(adjustment => {
                adjustmentsHTML += `<li>${adjustment}</li>`;
            });
            
            adjustmentsHTML += `</ul>`;
            adjustmentsCard.innerHTML = adjustmentsHTML;
            tripCard.appendChild(adjustmentsCard);
        }
        
        // 創建行程時間軸
        const timeline = document.createElement('div');
        timeline.className = 'timeline';
        
        // 添加每個段落到時間軸
        data.sections.forEach((section, index) => {
            renderTimelineItem(section, index, data.sections.length, timeline);
        });
        
        tripCard.appendChild(timeline);
        container.appendChild(tripCard);

    } catch (error) {
        container.innerHTML = `<div class="error-card">渲染出錯: ${error.message}</div>`;
    }
}

// 渲染純LLM回答
function renderPureLLMAnswer(container, data) {
    container.innerHTML = '';
    
    try {
        if (!data || !data.title || !Array.isArray(data.sections)) {
            throw new Error("回應格式不正確");
        }

        // 創建行程卡片容器
        const tripCard = document.createElement('div');
        tripCard.className = 'trip-card';
        
        // 添加標題區塊
        const titleSection = document.createElement('div');
        titleSection.className = 'trip-title-section';
        titleSection.innerHTML = `<h2>${data.title}</h2>`;
        tripCard.appendChild(titleSection);
        
        // 創建行程時間軸
        const timeline = document.createElement('div');
        timeline.className = 'timeline';
        
        // 添加每個段落到時間軸
        data.sections.forEach((section, index) => {
            if (!section.time || !section.location || !Array.isArray(section.details)) {
                return; // 跳過這個段落
            }

            const timelineItem = document.createElement('div');
            timelineItem.className = 'timeline-item';
            
            // 時間指示器
            const timeIndicator = document.createElement('div');
            timeIndicator.className = 'time-indicator';
            timeIndicator.innerHTML = `
                <span class="time-badge">${section.time}</span>
                <span class="timeline-dot"></span>
                ${index < data.sections.length - 1 ? '<span class="timeline-line"></span>' : ''}
            `;
            
            // 活動卡片
            const activityCard = document.createElement('div');
            activityCard.className = 'activity-card';
            
            // 地點標題
            const locationTitle = document.createElement('h3');
            locationTitle.innerHTML = `<i class="fas fa-map-marker-alt"></i> ${section.location}`;
            activityCard.appendChild(locationTitle);
            
            // 活動詳情
            const detailsSection = document.createElement('div');
            detailsSection.className = 'details-section';
            
            // 添加標題
            const detailsTitle = document.createElement('h4');
            detailsTitle.innerHTML = '<i class="fas fa-info-circle"></i> 活動詳情';
            detailsSection.appendChild(detailsTitle);
            
            // 添加詳情列表
            const detailsList = document.createElement('ul');
            section.details.forEach(detail => {
                const detailItem = document.createElement('li');
                detailItem.textContent = detail;
                detailsList.appendChild(detailItem);
            });
            detailsSection.appendChild(detailsList);
            
            activityCard.appendChild(detailsSection);
            
            // 組裝時間軸項目
            timelineItem.appendChild(timeIndicator);
            timelineItem.appendChild(activityCard);
            timeline.appendChild(timelineItem);
        });
        
        tripCard.appendChild(timeline);
        container.appendChild(tripCard);
    } catch (error) {
        container.innerHTML = `<div class="error-card">渲染出錯: ${error.message}</div>`;
    }
}

// 渲染時間軸項目
function renderTimelineItem(section, index, total, timeline) {
    if (!section.time || !section.location || !Array.isArray(section.details)) {
        return; // 跳過無效段落
    }

    const timelineItem = document.createElement('div');
    timelineItem.className = 'timeline-item';
    
    // 時間指示器
    const timeIndicator = document.createElement('div');
    timeIndicator.className = 'time-indicator';
    timeIndicator.innerHTML = `
        <span class="time-badge">${section.time}</span>
        <span class="timeline-dot"></span>
        ${index < total - 1 ? '<span class="timeline-line"></span>' : ''}
    `;
    
    // 活動卡片
    const activityCard = document.createElement('div');
    activityCard.className = 'activity-card';
    
    // 地點標題與圖標
    const locationTitle = document.createElement('h3');
    if (section.is_weather_adjusted) {
        locationTitle.innerHTML = `<i class="fas fa-map-marker-alt"></i> ${section.location} 
            <span class="weather-adjusted-badge">已根據天氣調整</span>`;
        
        if (section.original_location) {
            const originalInfo = document.createElement('div');
            originalInfo.className = 'original-location';
            originalInfo.innerHTML = `<i class="fas fa-exchange-alt"></i> 原計劃地點: ${section.original_location}`;
            activityCard.appendChild(originalInfo);
        }
    } else if (section.is_rescheduled) {
        locationTitle.innerHTML = `<i class="fas fa-map-marker-alt"></i> ${section.location} 
            <span class="time-adjusted-badge">時間已調整</span>`;
        
        if (section.original_time) {
            const originalInfo = document.createElement('div');
            originalInfo.className = 'original-time';
            originalInfo.innerHTML = `<i class="fas fa-clock"></i> 原計劃時間: ${section.original_time}`;
            activityCard.appendChild(originalInfo);
        }
    } else {
        locationTitle.innerHTML = `<i class="fas fa-map-marker-alt"></i> ${section.location}`;
    }
    
    activityCard.appendChild(locationTitle);
    
    // 評分星級
    if (section.rating !== undefined) {
        const ratingDisplay = document.createElement('div');
        ratingDisplay.className = 'rating-display';
        
        // 創建星級評分
        const rating = parseFloat(section.rating) || 0;
        const ratingStars = document.createElement('div');
        ratingStars.className = 'rating-stars';
        
        // 生成星星
        for (let i = 1; i <= 5; i++) {
            const star = document.createElement('i');
            if (i <= rating) {
                star.className = 'fas fa-star';
            } else if (i - 0.5 <= rating) {
                star.className = 'fas fa-star-half-alt';
            } else {
                star.className = 'far fa-star';
            }
            ratingStars.appendChild(star);
        }
        
        ratingDisplay.appendChild(ratingStars);
        ratingDisplay.innerHTML += `<span class="rating-value">${section.rating}</span>`;
        
        if (section.user_ratings_total !== undefined) {
            ratingDisplay.innerHTML += `<span class="rating-count">(${section.user_ratings_total})</span>`;
        }
        
        activityCard.appendChild(ratingDisplay);
    }
    
    // 地址信息
    if (section.address) {
        const addressInfo = document.createElement('div');
        addressInfo.className = 'address-info';
        addressInfo.innerHTML = `<i class="fas fa-location-arrow"></i> ${section.address}`;
        activityCard.appendChild(addressInfo);
    }
    
    // 活動詳情
    const detailsSection = document.createElement('div');
    detailsSection.className = 'details-section';
    
    // 添加標題
    const detailsTitle = document.createElement('h4');
    detailsTitle.innerHTML = '<i class="fas fa-info-circle"></i> 活動詳情';
    detailsSection.appendChild(detailsTitle);
    
    // 添加詳情列表
    const detailsList = document.createElement('ul');
    section.details.forEach(detail => {
        const detailItem = document.createElement('li');
        detailItem.textContent = detail;
        detailsList.appendChild(detailItem);
    });
    detailsSection.appendChild(detailsList);
    
    activityCard.appendChild(detailsSection);
    
    // 組裝時間軸項目
    timelineItem.appendChild(timeIndicator);
    timelineItem.appendChild(activityCard);
    timeline.appendChild(timelineItem);
}