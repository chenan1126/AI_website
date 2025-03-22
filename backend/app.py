from quart import Quart, request, jsonify
from quart_cors import cors
import os
import asyncio
import google.generativeai as genai
from google.genai import types
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
        chat = model.start_chat(history=[
            {
                "role": "system",
                "parts": [
                    "你是一位專業的旅遊規劃師，擅長為使用者規劃行程與推薦旅遊資訊。\n"
                    "請在回答中提供以下內容：\n"
                    "1. 景點介紹（包括特色、亮點、建議停留時間）\n"
                    "2. 店家與景點的營業時間、地址、Google 評價（如有）\n"
                    "3. 交通方式（大眾運輸、自駕、步行路線等）\n"
                    "4. 推薦的周邊景點與在地美食\n"
                    "5. 特殊活動、節慶提醒與注意事項（如季節限定花季、門票資訊）\n\n"
                    "回答時請使用親切、專業、貼心的語氣，像一位經驗豐富的旅遊達人。\n"
                    "若使用者的提問不夠具體（如沒說城市、日期、人數），請回問以取得更多資訊。"
                ]
            }
        ])
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
    app.run(debug=True, port=5000, host='localhost')
