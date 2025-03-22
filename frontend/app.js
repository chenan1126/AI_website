// 檢查後端服務器是否在運行
async function checkServer() {
    try {
        const response = await fetch('http://localhost:5000/test');
        const data = await response.json();
        return data.status === 'success';
    } catch (error) {
        console.error('Server check failed:', error);
        return false;
    }
}

// 定期檢查服務器狀態
async function checkServerStatus() {
    const isRunning = await checkServer();
    const errorContainer = document.getElementById('errorContainer');
    
    if (!isRunning) {
        errorContainer.innerHTML = `
            <div class="error">
                後端服務器未運行或無法訪問
            </div>
        `;
    } else {
        errorContainer.innerHTML = '';
    }
}

// 每 30 秒檢查一次服務器狀態
setInterval(checkServerStatus, 30000);
// 初始檢查
checkServerStatus();

document.getElementById('questionForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const questionInput = document.getElementById('questionInput');
    const submitButton = document.getElementById('submitButton');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const errorContainer = document.getElementById('errorContainer');
    const answersContainer = document.getElementById('answersContainer');

    // 重置顯示
    errorContainer.innerHTML = '';
    answersContainer.innerHTML = '';
    submitButton.disabled = true;
    loadingSpinner.style.display = 'block';
    submitButton.textContent = '處理中...';

    try {
        // 檢查服務器連接
        const serverRunning = await checkServer();
        if (!serverRunning) {
            throw new Error('無法連接到後端服務器，請確保服務器正在運行');
        }

        const response = await fetch('http://localhost:5000/ask', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ question: questionInput.value }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.status === 'error') {
            throw new Error(data.message);
        }

        // 顯示答案
        Object.entries(data.data).forEach(([model, answer]) => {
            const card = document.createElement('div');
            card.className = 'answer-card';
            card.innerHTML = `
                <h2>${model}</h2>
                <div>${marked.parse(answer)}</div>
            `;
            answersContainer.appendChild(card);
        });

    } catch (error) {
        console.error('Error:', error);
        errorContainer.innerHTML = `
            <div class="error">
                ${error.message || '發生錯誤，請稍後再試'}
            </div>
        `;
    } finally {
        submitButton.disabled = false;
        loadingSpinner.style.display = 'none';
        submitButton.textContent = '提交';
    }
});