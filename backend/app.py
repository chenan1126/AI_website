from quart import Quart, request, jsonify
from quart_cors import cors
import os
import asyncio
import google.generativeai as genai
from dotenv import load_dotenv
from functools import wraps

# 載入環境變量
load_dotenv()

app = Quart(__name__)
app = cors(app)  # 啟用 CORS

# 設置 Gemini API
api_key = os.getenv('GEMINI_API_KEY')
if api_key:
    genai.configure(api_key=api_key)

# 超時設置
MAX_RETRIES = 3

def retry_on_failure(max_retries=MAX_RETRIES):
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            for attempt in range(max_retries):
                try:
                    return await func(*args, **kwargs)
                except Exception as e:
                    if attempt == max_retries - 1:
                        return f"錯誤: {str(e)}"
                    await asyncio.sleep(1)
            return "服務暫時無法使用"
        return wrapper
    return decorator

# 請求 GEMINI API
@retry_on_failure()
async def ask_gemini(question):
    if not api_key:
        return "錯誤: 未設置 Gemini API Key"
    
    try:
        model = genai.GenerativeModel('gemini-2.0-flash')
        response = await asyncio.to_thread(model.generate_content, question)
        return response.text
    except Exception as e:
        print(f"Gemini API 請求異常: {str(e)}")
        raise

@app.route('/ask', methods=['POST'])
async def ask():
    try:
        data = await request.get_json()
        question = data.get("question")
        
        if not question:
            return {"status": "error", "message": "未提供問題"}, 400

        # 請求 Gemini API
        gemini_answer = await ask_gemini(question)

        return {
            "status": "success",
            "data": {
                "Gemini": gemini_answer
            }
        }

    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }, 500

@app.route('/test', methods=['GET'])
async def test():
    return {"status": "success", "message": "後端服務器正常運行"}

if __name__ == '__main__':
    app.run(debug=True, port=5000, host='0.0.0.0')
