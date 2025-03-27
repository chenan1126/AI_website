from quart import Quart, request, jsonify
from quart_cors import cors
import os
import asyncio
from google import genai
from google.genai import types
from dotenv import load_dotenv
from functools import wraps
from google.genai.types import GenerateContentConfig, HttpOptions

# 載入環境變量
load_dotenv()

app = Quart(__name__)
app = cors(app)  # 啟用 CORS

# 聊天會話記錄
chat_sessions = {}

# 設置 Gemini API
api_key = os.getenv('GEMINI_API_KEY')
if api_key:
    api_key=api_key

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
async def ask_gemini(question, session_id):
    if not api_key:
        return "錯誤: 未設置 Gemini API Key"

    try:
        client = genai.Client(api_key=api_key)

        if session_id not in chat_sessions:
            chat = client.chats.create(
                model="gemini-2.0-flash",
                config=types.GenerateContentConfig(
                    system_instruction=
                    "你是一位台灣的專業旅遊行程設計師，擅長針對台灣各地設計詳細、真實、實用的行程規劃。\n\n"
                    "請依照使用者提供的資訊，產出格式清晰、具備實用細節的旅遊建議。\n"
                    "你必須遵守以下規則：\n"
                    "1. 不使用網路查詢、不幻想不存在的景點。\n"
                    "2. 完全根據使用者提供的資訊回答，不補充未提及的虛構細節。\n"
                    "3. 使用繁體中文回答。\n"
                    "4. 每一日的行程都要有醒目的標題，例如：📍 第一天：探索台南古蹟\n"
                    "5. 每一個活動或景點都必須標註詳細的**時間段（如 09:00–10:30）**，格式如下：\n"
                    "   - 09:00–10:30 赤崁樓\n"
                    "   - 包含：歷史背景（1–2 行）、文化現況（1–2 行）、天氣建議（1–2 行）、交通方式、地址、建議停留時間、開放時間與票價\n"
                    "6. 行程中請安插在地美食（可安排在上午/中午/下午等合適時段），也要有時間段，例如：\n"
                    "   - 12:00–13:00 永樂市場午餐：蝦仁飯、小卷米粉\n"
                    "7. 行程順序需有邏輯，避免不合理來回移動\n"
                    "8. 每日請安排**至少五個主要景點/活動**，從早到晚安排完整\n"
                    "9. 行程結尾請附上：\n"
                    "   - 小提醒（天氣、交通工具、預約建議等）\n"
                    "   - 至少兩個使用者未提及但可能感興趣的活動（如隱藏景點、當地體驗）\n\n"
                    "請以條列清晰的格式作答，語氣親切專業，內容應符合旅行社的標準行程單排法。"),
            )
            chat_sessions[session_id] = chat
        else:
            chat = chat_sessions[session_id]

        # 發送使用者的問題
        response = chat.send_message(question)
        return response.text

    except Exception as e:
        print(f"Gemini API 請求異常: {str(e)}")
        return f"錯誤：{str(e)}"

@app.route('/ask', methods=['POST'])
async def ask():
    try:
        data = await request.get_json()
        question = data.get("question")
        session_id = data.get("session_id")  # 新增的 session_id！

        if not question:
            return {"status": "error", "message": "未提供問題"}, 400
        if not session_id:
            return {"status": "error", "message": "未提供 session_id"}, 400

        # 呼叫 Gemini API
        gemini_answer = await ask_gemini(question, session_id)

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
