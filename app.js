let sessionId = localStorage.getItem('session_id') || ('session-' + Date.now());
localStorage.setItem('session_id', sessionId);

// 檢查後端服務器是否在運行
async function checkServer() {
    // 在GitHub Pages上，始終返回false，因為沒有後端服務器
    const isGitHubPages = window.location.hostname.includes('github.io');
    if (isGitHubPages) {
        return false;
    }

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

// 格式化日期標籤的函數
function formatDateLabel(dateStr) {
    try {
        // 如果是YYYY-MM-DD格式，轉換為MM/DD格式
        if (dateStr.includes('-')) {
            const parts = dateStr.split('-');
            if (parts.length === 3) {
                const month = parseInt(parts[1]);
                const day = parseInt(parts[2]);
                return `${month}/${day}`;
            }
        }
        // 如果已經是MM/DD格式，直接返回
        return dateStr;
    } catch (error) {
        console.error('日期格式化錯誤:', error);
        return dateStr;
    }
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
        
        const naturalQueryInput = safeGetElement('naturalQueryInput');
        const loadingEl = safeGetElement('loading');
        const resultsDiv = safeGetElement('results');
        
        // 檢查必要元素是否存在
        if (!naturalQueryInput || !loadingEl || !resultsDiv) {
            console.error('表單元素缺失，無法處理請求');
            return;
        }
        
        const question = naturalQueryInput.value.trim();

        if (question === "") {
            resultsDiv.innerHTML = '<div class="error">請輸入您的旅遊需求。</div>';
            return;
        }
        
        // 檢查是否在GitHub Pages上運行
        const isGitHubPages = window.location.hostname.includes('github.io');
        
        if (isGitHubPages) {
            // GitHub Pages演示版本
            loadingEl.style.display = 'block';
            resultsDiv.innerHTML = '';
            
            setTimeout(() => {
                loadingEl.style.display = 'none';
                resultsDiv.innerHTML = `
                    <div class="demo-notice" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 15px; text-align: center; margin: 20px 0; box-shadow: 0 8px 25px rgba(0,0,0,0.15);">
                        <i class="fas fa-info-circle" style="font-size: 48px; margin-bottom: 20px; opacity: 0.9;"></i>
                        <h2 style="margin-bottom: 15px; font-size: 24px;">🌟 AI旅遊行程規劃演示版本</h2>
                        <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                            這是部署在GitHub Pages上的演示版本，無法運行完整的AI行程規劃功能。
                        </p>
                        <div style="background: rgba(255,255,255,0.1); padding: 20px; border-radius: 10px; margin: 20px 0;">
                            <h3 style="margin-bottom: 10px;">您的輸入：</h3>
                            <p style="font-style: italic; background: rgba(255,255,255,0.2); padding: 10px; border-radius: 5px;">"${question}"</p>
                        </div>
                        <div style="background: rgba(255,255,255,0.1); padding: 20px; border-radius: 10px; margin: 20px 0;">
                            <h3 style="margin-bottom: 15px;">🚀 完整功能體驗</h3>
                            <p style="margin-bottom: 15px;">要體驗完整的AI行程規劃功能，請：</p>
                            <div style="text-align: left; display: inline-block;">
                                <p>1. 📥 下載完整項目代碼</p>
                                <p>2. 🔧 安裝Python和依賴包</p>
                                <p>3. ⚙️ 設置API密鑰（Gemini, Google Maps, OpenWeather）</p>
                                <p>4. ▶️ 運行後端服務器</p>
                                <p>5. 🌐 在瀏覽器中訪問 http://localhost:5000</p>
                            </div>
                        </div>
                        <a href="https://github.com/chenan1126/AI_website" target="_blank" style="display: inline-block; background: white; color: #667eea; padding: 12px 24px; border-radius: 25px; text-decoration: none; font-weight: bold; margin-top: 10px; transition: all 0.3s;">
                            <i class="fab fa-github"></i> 查看GitHub倉庫
                        </a>
                    </div>
                `;
            }, 1500);
            return;
        }
        
        // 記錄請求細節
        console.log("正在發送請求:", {
            url: 'http://localhost:5000/ask',
            method: 'POST',
            data: {
                session_id: sessionId,
                question: question
            }
        });
        
        // 設置超時控制
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('請求超時，請檢查後端服務器')), 60000); // 60秒超時
        });

        try {
            // 並行請求兩個行程
            const fetchPromises = [
                fetch('http://localhost:5000/ask', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        session_id: sessionId + '-1',
                        question: question
                    })
                }),
                fetch('http://localhost:5000/ask', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        session_id: sessionId + '-2',
                        question: question
                    })
                })
            ];
            
            // 使用 Promise.race 來實現超時功能（對兩個請求都應用）
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('請求超時，請檢查後端服務器')), 60000);
            });

            const responses = await Promise.race([
                Promise.all(fetchPromises), 
                timeoutPromise.then(() => { throw new Error('請求超時'); })
            ]);
            
            // 檢查兩個響應是否都成功
            const failedResponses = responses.filter(r => !r.ok);
            if (failedResponses.length > 0) {
                const errorText = await failedResponses[0].text();
                console.error('伺服器回應錯誤:', failedResponses[0].status, errorText);
                throw new Error(`HTTP 錯誤: ${failedResponses[0].status} - ${errorText || '未知錯誤'}`);
            }
            
            // 解析兩個響應
            const responseData1 = await responses[0].json();
            const responseData2 = await responses[1].json();
            
            // 隱藏載入指示器
            loadingEl.style.display = 'none';
            
            // 合併兩個行程的數據
            if (responseData1.status === 'success' && responseData2.status === 'success') {
                const itinerary1 = responseData1.data.itineraries || [responseData1.data];
                const itinerary2 = responseData2.data.itineraries || [responseData2.data];
                
                // 優先使用有天氣數據的響應
                let weatherData = responseData1.data.weather_data;
                if (!weatherData || weatherData.length === 0) {
                    weatherData = responseData2.data.weather_data;
                }
                
                const combinedData = {
                    itineraries: [...itinerary1, ...itinerary2].slice(0, 2), // 確保最多兩個行程
                    weather_data: weatherData
                };
                
                renderAnswer(resultsDiv, combinedData);
                
                // 如果有警告，顯示它們
                const warnings = [];
                if (responseData1.warning) warnings.push(responseData1.warning);
                if (responseData2.warning) warnings.push(responseData2.warning);
                
                if (warnings.length > 0) {
                    const warningEl = document.createElement('div');
                    warningEl.className = 'warning';
                    warningEl.textContent = warnings.join('; ');
                    resultsDiv.prepend(warningEl);
                }
            } else {
                const errorMsg1 = responseData1.status !== 'success' ? responseData1.message : null;
                const errorMsg2 = responseData2.status !== 'success' ? responseData2.message : null;
                const errorMsg = errorMsg1 || errorMsg2 || '未知錯誤';
                resultsDiv.innerHTML = `<div class="error">錯誤: ${errorMsg}</div>`;
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
        // 檢查是否有多個行程
        if (data.itineraries && Array.isArray(data.itineraries)) {
            // 創建並排顯示的容器
            const itinerariesContainer = document.createElement('div');
            itinerariesContainer.className = 'itineraries-container';

            // 渲染多個行程
            const totalItineraries = data.itineraries.length;
            data.itineraries.forEach((itinerary, itineraryIndex) => {
                renderSingleItinerary(itinerariesContainer, itinerary, itineraryIndex, totalItineraries, data.weather_data);
            });

            container.appendChild(itinerariesContainer);
        } else {
            // 渲染單個行程（向後兼容）
            renderSingleItinerary(container, data, 0, 1, data.weather_data);
        }

    } catch (error) {
        container.innerHTML = `<div class="error-card">渲染出錯: ${error.message}</div>`;
    }
}

// 渲染單個行程
function renderSingleItinerary(container, itinerary, itineraryIndex, totalItineraries, weatherData) {
    // 創建行程卡片容器
    const tripCard = document.createElement('div');
    tripCard.className = 'trip-card';

    // 添加標題區塊
    const titleSection = document.createElement('div');
    titleSection.className = 'trip-title-section';

    let titleHTML = `<h2>${itinerary.title}</h2>`;

    // 添加推薦指數（如果有的話）
    if (itinerary.recommendation_score !== undefined && itinerary.recommendation_score !== null) {
        const score = itinerary.recommendation_score;
        let scoreColor = '#4caf50'; // 綠色
        let scoreIcon = 'fas fa-star';

        if (score >= 4.5) {
            scoreColor = '#4caf50'; // 優秀
            scoreIcon = 'fas fa-star';
        } else if (score >= 4.0) {
            scoreColor = '#8bc34a'; // 良好
            scoreIcon = 'fas fa-star-half-alt';
        } else if (score >= 3.5) {
            scoreColor = '#ff9800'; // 普通
            scoreIcon = 'fas fa-star-half-alt';
        } else {
            scoreColor = '#f44336'; // 較差
            scoreIcon = 'far fa-star';
        }

        titleHTML += `
            <div class="recommendation-score" style="background: ${scoreColor}; color: white; padding: 8px 12px; border-radius: 20px; display: inline-flex; align-items: center; gap: 6px; font-weight: bold; margin-top: 10px;">
                <i class="${scoreIcon}"></i>
                推薦指數: ${score}/5
            </div>
        `;
    }

    // 添加行程摘要
    // 移除距離和時間顯示，保持介面簡潔

    titleSection.innerHTML = titleHTML;
    tripCard.appendChild(titleSection);

    // 按日期分組行程段落
    console.log('行程段落:', itinerary.sections);
    const sectionsByDate = groupSectionsByDate(itinerary.sections);
    console.log('按日期分組的結果:', sectionsByDate);
    console.log('分組數量:', Object.keys(sectionsByDate).length);

    // 添加天氣卡片 - 只在單日行程中顯示
    if (weatherData && weatherData.length > 0 && Object.keys(sectionsByDate).length <= 1) {
        console.log('單日行程，顯示天氣數據:', weatherData);
        try {
            // 按日期分組天氣數據
            const weatherByDate = {};
            weatherData.forEach(item => {
                const date = item.date;
                console.log('處理天氣項目:', item, '日期:', date);
                if (date) {
                    weatherByDate[date] = item;
                } else {
                    weatherByDate['today'] = item;
                }
            });

            console.log('按日期分組的天氣數據:', weatherByDate);

            // 為每個日期創建天氣卡片
            Object.keys(weatherByDate).forEach(dateKey => {
                const weatherItem = weatherByDate[dateKey];
                const weather = weatherItem.weather || {};
                const cityName = weatherItem.city_name || '所選城市';
                const dateLabel = dateKey === 'today' ? '今日' : formatDateLabel(dateKey);

                const simpleWeather = document.createElement('div');
                simpleWeather.setAttribute('class', 'weather-card');
                simpleWeather.setAttribute('style', 'border:2px solid #4a90e2; padding:15px; margin:15px 0; background-color:#f0f8ff; border-radius:5px;');

                simpleWeather.innerHTML = `
                    <div style="margin-bottom:10px; font-weight:bold; font-size:18px; color:#2c3e50;">
                        ☁️ ${cityName} ${dateLabel}天氣
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
                                <div style="font-size:13px; color:#7f8c8d;">濕度</div>
                                <div style="font-weight:bold;">${weather.humidity || '-'}%</div>
                            </div>
                            <div style="flex:1; min-width:100px; background:#e8f4f8; padding:8px; margin:3px; border-radius:3px;">
                                <div style="font-size:13px; color:#7f8c8d;">降雨機率</div>
                                <div style="font-weight:bold;">${weather.rain_probability || '-'}%</div>
                            </div>
                        </div>
                    </div>
                `;

                tripCard.appendChild(simpleWeather);
            });

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

    // 如果有多個日期，創建分頁
    if (Object.keys(sectionsByDate).length > 1) {
        console.log('使用多天行程渲染');
        renderMultiDayItinerary(tripCard, sectionsByDate, itinerary, weatherData);
    } else {
        console.log('使用單日行程渲染');
        // 單日行程，使用原有邏輯
        const timeline = document.createElement('div');
        timeline.className = 'timeline';

        // 添加每個段落到時間軸
        itinerary.sections.forEach((section, index) => {
            renderTimelineItem(section, index, itinerary.sections.length, timeline);
        });

        tripCard.appendChild(timeline);
    }

    container.appendChild(tripCard);

    // 移除分隔線邏輯，因為現在是並排顯示
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

        // 顯示威爾遜分數
        if (section.wilson_score !== null && section.wilson_score !== undefined) {
            const wilsonScoreEl = document.createElement('span');
            wilsonScoreEl.className = 'wilson-score';
            wilsonScoreEl.innerHTML = ` <i class="fas fa-medal"></i> 綜合評分: ${section.wilson_score}`;
            ratingDisplay.appendChild(wilsonScoreEl);
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

// 按日期分組行程段落
function groupSectionsByDate(sections) {
    const groups = {};
    let currentDay = null;
    let currentGroup = [];

    console.log('開始分組行程段落，總數:', sections.length);
    sections.forEach((section, index) => {
        const day = section.day || 1; // 如果沒有day欄位，預設為第1天
        console.log(`段落 ${index}: day=${day}, location=${section.location}`);

        if (day !== currentDay) {
            // 保存之前的組
            if (currentDay && currentGroup.length > 0) {
                groups[`第${currentDay}天`] = currentGroup;
                console.log(`保存第${currentDay}天組，有 ${currentGroup.length} 個段落`);
            }

            // 開始新組
            currentDay = day;
            currentGroup = [];
            console.log(`開始新組: 第${currentDay}天`);
        }

        currentGroup.push(section);
    });

    // 保存最後一組
    if (currentDay && currentGroup.length > 0) {
        groups[`第${currentDay}天`] = currentGroup;
        console.log(`保存最後一組第${currentDay}天，有 ${currentGroup.length} 個段落`);
    }

    // 如果沒有分組，創建默認分組
    if (Object.keys(groups).length === 0 && sections.length > 0) {
        groups["第1天"] = sections;
        console.log('沒有分組，創建默認第1天組');
    }

    console.log('分組完成:', groups);
    return groups;
}

// 渲染多天行程
function renderMultiDayItinerary(container, sectionsByDate, itinerary, weatherData) {
    console.log('renderMultiDayItinerary 調用，weatherData:', weatherData);
    const dates = Object.keys(sectionsByDate);
    let currentDayIndex = 0;

    // 按天分組里程數據
    const daySummaries = {};
    if (itinerary.day_summaries && itinerary.day_summaries.length > 0) {
        itinerary.day_summaries.forEach(daySummary => {
            daySummaries[daySummary.day] = daySummary;
        });
    }

    // 創建日期導航
    const navContainer = document.createElement('div');
    navContainer.className = 'day-navigation';
    navContainer.innerHTML = `
        <div class="day-nav-buttons">
            <button id="prevDay" class="nav-btn" ${currentDayIndex === 0 ? 'disabled' : ''}>
                <i class="fas fa-chevron-left"></i> 上一天
            </button>
            <span class="day-indicator">第 ${currentDayIndex + 1} 天 / 共 ${dates.length} 天</span>
            <button id="nextDay" class="nav-btn" ${currentDayIndex === dates.length - 1 ? 'disabled' : ''}>
                下一天 <i class="fas fa-chevron-right"></i>
            </button>
        </div>
    `;

    // 創建行程內容容器
    const contentContainer = document.createElement('div');
    contentContainer.className = 'day-content';

    // 顯示當前日期的行程
    function showDay(dayIndex) {
        contentContainer.innerHTML = '';

        const currentDate = dates[dayIndex];
        const daySections = sectionsByDate[currentDate];

        // 解析天數 (從"第1天"提取1)
        const dayMatch = currentDate.match(/第(\d+)天/);
        const dayNumber = dayMatch ? parseInt(dayMatch[1]) : 1;

        // 添加日期標題
        const dateTitle = document.createElement('h3');
        dateTitle.className = 'day-title';
        dateTitle.innerHTML = `<i class="fas fa-calendar-day"></i> ${currentDate}`;
        contentContainer.appendChild(dateTitle);

        // 添加該天的里程信息
        const daySummary = daySummaries[dayNumber];
        if (daySummary) {
            const distanceDiv = document.createElement('div');
            distanceDiv.className = 'day-distance';
            distanceDiv.innerHTML = `
                <div style="background: #f8f9fa; padding: 10px; border-radius: 5px; margin: 10px 0; display: flex; gap: 20px;">
                    <div><i class="fas fa-road"></i> <strong>距離：</strong>${daySummary.distance}</div>
                    <div><i class="fas fa-clock"></i> <strong>行駛時間：</strong>${daySummary.duration}</div>
                </div>
            `;
            contentContainer.appendChild(distanceDiv);
        }

        // 添加該天的天氣信息
        console.log('顯示第', dayIndex + 1, '天的天氣，weatherData:', weatherData);
        if (weatherData && weatherData.length > 0 && weatherData[dayIndex]) {
            console.log('找到第', dayIndex + 1, '天的天氣數據:', weatherData[dayIndex]);
            const weatherItem = weatherData[dayIndex];
            const weather = weatherItem.weather || {};
            const cityName = weatherItem.city_name || '所選城市';
            const dateLabel = weatherItem.date ? formatDateLabel(weatherItem.date) : currentDate;

            const weatherDiv = document.createElement('div');
            weatherDiv.className = 'weather-card';
            weatherDiv.setAttribute('style', 'border:2px solid #4a90e2; padding:15px; margin:15px 0; background-color:#f0f8ff; border-radius:5px;');

            weatherDiv.innerHTML = `
                <div style="margin-bottom:10px; font-weight:bold; font-size:18px; color:#2c3e50;">
                    ☁️ ${cityName} ${dateLabel}天氣
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
                            <div style="font-size:13px; color:#7f8c8d;">濕度</div>
                            <div style="font-weight:bold;">${weather.humidity || '-'}%</div>
                        </div>
                        <div style="flex:1; min-width:100px; background:#e8f4f8; padding:8px; margin:3px; border-radius:3px;">
                            <div style="font-size:13px; color:#7f8c8d;">降雨機率</div>
                            <div style="font-weight:bold;">${weather.rain_probability || '-'}%</div>
                        </div>
                    </div>
                </div>
            `;

            contentContainer.appendChild(weatherDiv);
        } else {
            console.log('沒有找到第', dayIndex + 1, '天的天氣數據');
        }

        // 創建時間軸
        const timeline = document.createElement('div');
        timeline.className = 'timeline';

        // 添加該天的段落
        daySections.forEach((section, index) => {
            renderTimelineItem(section, index, daySections.length, timeline);
        });

        contentContainer.appendChild(timeline);

        // 更新導航按鈕狀態
        const prevBtn = navContainer.querySelector('#prevDay');
        const nextBtn = navContainer.querySelector('#nextDay');
        const indicator = navContainer.querySelector('.day-indicator');

        prevBtn.disabled = dayIndex === 0;
        nextBtn.disabled = dayIndex === dates.length - 1;
        indicator.textContent = `第 ${dayIndex + 1} 天 / 共 ${dates.length} 天`;
    }

    // 初始顯示第一天
    showDay(currentDayIndex);

    // 添加事件監聽器
    navContainer.querySelector('#prevDay').addEventListener('click', () => {
        if (currentDayIndex > 0) {
            currentDayIndex--;
            showDay(currentDayIndex);
        }
    });

    navContainer.querySelector('#nextDay').addEventListener('click', () => {
        if (currentDayIndex < dates.length - 1) {
            currentDayIndex++;
            showDay(currentDayIndex);
        }
    });

    container.appendChild(navContainer);
    container.appendChild(contentContainer);
}