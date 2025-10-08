from quart import Quart, request, jsonify
from quart_cors import cors
import json
import os
import asyncio
import google.generativeai as genai
import logging
import requests
from weather import get_weather, get_multi_day_weather
import aiohttp
import math
from datetime import datetime, timedelta

# 配置日誌
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# 載入環境變量
from dotenv import load_dotenv
load_dotenv()

app = Quart(__name__)
app = cors(app)  # 啟用 CORS

# 聊天會話與緩存
chat_sessions = {}
place_cache = {}
route_cache = {}

# API Keys
api_key = os.getenv('GEMINI_API_KEY')
GOOGLE_MAPS_API_KEY = os.getenv('GOOGLE_MAPS_API_KEY')
OPENWEATHERMAP_API_KEY = os.getenv('OPENWEATHERMAP_API_KEY')

# 全局日誌收集器
web_logs = []

def add_web_log(level, message):
    """添加日誌到網頁日誌收集器"""
    global web_logs
    timestamp = datetime.now().strftime("%H:%M:%S")
    web_logs.append({
        "timestamp": timestamp,
        "level": level,
        "message": message
    })
    # 保持最多100條日誌
    if len(web_logs) > 100:
        web_logs = web_logs[-100:]

def clear_web_logs():
    """清空網頁日誌"""
    global web_logs
    web_logs = []

def get_web_logs():
    """獲取網頁日誌"""
    return web_logs.copy()

# 設定 Gemini API Key
if api_key:
    try:
        genai.configure(api_key=api_key)
        logger.info("Gemini API Key 已成功設定")
    except Exception as e:
        logger.error(f"設定 Gemini API Key 時發生錯誤: {e}")
else:
    logger.error("錯誤: 缺少 Gemini API Key，無法設定。")

# 超時設置
MAX_RETRIES = 3
REQUEST_TIMEOUT = 10  # 秒

def retry_on_failure(max_retries=MAX_RETRIES):
    def decorator(func):
        async def wrapper(*args, **kwargs):
            for attempt in range(max_retries):
                try:
                    return await func(*args, **kwargs)
                except Exception as e:
                    logger.error(f"嘗試 {attempt+1}/{max_retries} 失敗: {str(e)}")
                    if attempt == max_retries - 1:
                        return {"error": f"錯誤: {str(e)}"}
                    await asyncio.sleep(1)
            return {"error": "服務暫時無法使用"}
        return wrapper
    return decorator

def calculate_wilson_score(rating, user_ratings_total):
    """
    計算威爾遜分數(Wilson Score)，用於綜合評分和評論數。
    返回一個0-5之間的分數，四捨五入到小數點後一位。
    """
    if user_ratings_total == 0 or not isinstance(rating, (int, float)) or rating <= 0:
        return None

    # Z-score for 95% confidence
    z = 1.96
    # 將5星制評分轉換為0-1區間的正面評價比例
    p = rating / 5.0
    n = user_ratings_total

    try:
        numerator = p + (z**2 / (2 * n)) - z * math.sqrt((p * (1 - p) / n) + (z**2 / (4 * n**2)))
        denominator = 1 + (z**2 / n)

        if denominator == 0:
            return None

        # 計算分數 (0-1區間)
        score_0_1 = numerator / denominator

        # 將分數轉換回5星制並四捨五入到小數點後一位
        final_score = round(score_0_1 * 5, 1)

        return final_score
    except (ValueError, ZeroDivisionError):
        return None

def parse_time_to_minutes(time_str):
    """
    將時間字串轉換為當天從00:00開始的總分鐘數
    支持格式:
    - "09:00" -> (540, 600)  # 假設持續1小時
    - "09:00-12:00" -> (540, 720)  # 實際時間範圍
    返回 (start_minutes, end_minutes) 元組
    """
    try:
        if not isinstance(time_str, str):
            return (0, 60)  # 默認值

        time_str = time_str.strip()

        # 檢查是否包含時間範圍 (如 "09:00-12:00")
        if "-" in time_str:
            start_str, end_str = time_str.split("-", 1)
            start_str = start_str.strip()
            end_str = end_str.strip()

            # 解析開始時間
            if ":" in start_str:
                start_hours, start_minutes = map(int, start_str.split(":"))
                start_total = start_hours * 60 + start_minutes
            else:
                start_total = 0

            # 解析結束時間
            if ":" in end_str:
                end_hours, end_minutes = map(int, end_str.split(":"))
                end_total = end_hours * 60 + end_minutes
            else:
                end_total = start_total + 60  # 默認持續1小時

            return (start_total, end_total)

        # 單一時間點，假設持續1小時
        elif ":" in time_str:
            hours, minutes = map(int, time_str.split(":"))
            start_total = hours * 60 + minutes
            end_total = start_total + 60  # 假設持續1小時
            return (start_total, end_total)

        return (0, 60)  # 默認值

    except (ValueError, TypeError):
        return (0, 60)  # 錯誤時返回默認值

def calculate_playing_time(sections):
    """
    計算一天的遊玩時間（從第一個行程開始到最後一個行程結束的總時間）
    支持時間範圍格式，如 "09:00-12:00"
    返回分鐘數
    """
    if not sections or not isinstance(sections, list):
        return 0

    # 按天分組
    sections_by_day = {}
    for section in sections:
        if isinstance(section, dict):
            day = section.get("day", 1)
            if day not in sections_by_day:
                sections_by_day[day] = []
            sections_by_day[day].append(section)

    total_playing_time = 0

    for day, day_sections in sections_by_day.items():
        if not day_sections:
            continue

        # 找到當天最早的開始時間和最晚的結束時間
        start_times = []
        end_times = []

        for section in day_sections:
            time_str = section.get("time", "")
            if time_str:
                start_minutes, end_minutes = parse_time_to_minutes(time_str)
                start_times.append(start_minutes)
                end_times.append(end_minutes)

        if start_times and end_times:
            day_start = min(start_times)
            day_end = max(end_times)
            day_playing_time = max(0, day_end - day_start)  # 確保不為負數
            total_playing_time += day_playing_time

    return total_playing_time

def calculate_travel_penalty_factor(travel_duration_minutes, playing_time_minutes, threshold=0.25):
    """
    計算交通時間懲罰因子
    參數:
    - travel_duration_minutes: 交通時間總分鐘數
    - playing_time_minutes: 遊玩時間總分鐘數
    - threshold: 可忍受的交通時間占比 (默認25%)

    返回: 懲罰因子 (0.0-1.0)，用於乘以原始評分
    """
    if playing_time_minutes <= 0:
        return 1.0  # 如果沒有遊玩時間，不進行懲罰

    # 計算交通時間占比
    travel_ratio = travel_duration_minutes / playing_time_minutes

    # 如果交通時間占比沒有超過閾值，返回1.0（無懲罰）
    if travel_ratio <= threshold:
        return 1.0

    # 計算懲罰因子: M = 1 - ((travel_ratio - threshold) / (1 - threshold))
    # 這樣當travel_ratio = threshold時，M = 1.0
    # 當travel_ratio = 1.0時，M = 0.0（完全扣分）
    penalty_ratio = (travel_ratio - threshold) / (1 - threshold)
    penalty_factor = max(0.0, 1.0 - penalty_ratio)  # 確保不低於0

    return penalty_factor

def calculate_trip_dates(query, days):
    """根據用戶查詢和天數計算具體的旅遊日期"""
    today = datetime.now()
    dates = []

    # 解析查詢中的具體日期
    import re

    # 匹配各種日期格式
    date_patterns = [
        r'(\d{4})[/-](\d{1,2})[/-](\d{1,2})',  # YYYY-MM-DD 或 YYYY/MM/DD
        r'(\d{1,2})[/-](\d{1,2})',              # MM/DD 或 M/D
        r'(\d{1,2})月(\d{1,2})日',              # MM月DD日
    ]

    parsed_date = None
    for pattern in date_patterns:
        match = re.search(pattern, query)
        if match:
            groups = match.groups()
            if len(groups) == 3:  # YYYY-MM-DD
                year, month, day = map(int, groups)
            elif len(groups) == 2:  # MM/DD
                year = today.year
                month, day = map(int, groups)
                # 如果月份小於當前月份，可能是明年
                if month < today.month or (month == today.month and day < today.day):
                    year += 1

            try:
                parsed_date = datetime(year, month, day)
                # 如果日期已經過去，調整到明年
                if parsed_date.date() < today.date():
                    parsed_date = parsed_date.replace(year=today.year + 1)
                break
            except ValueError:
                continue

    if parsed_date:
        start_date = parsed_date
    else:
        # 解析查詢中的時間關鍵字
        query_lower = query.lower()

        if "下週" in query or "next week" in query:
            # 下週的計算
            days_until_next_week = (7 - today.weekday()) % 7
            if days_until_next_week == 0:
                days_until_next_week = 7
            start_date = today + timedelta(days=days_until_next_week)
        elif "下個月" in query or "next month" in query:
            # 下個月的計算
            if today.month == 12:
                start_date = today.replace(year=today.year + 1, month=1, day=1)
            else:
                start_date = today.replace(month=today.month + 1, day=1)
        elif "週末" in query or "weekend" in query:
            # 這個週末的計算
            days_until_weekend = (5 - today.weekday()) % 7  # 5 = Saturday
            if days_until_weekend == 0 and today.weekday() >= 5:
                # 如果今天就是週末，算下個週末
                days_until_weekend = 7
            start_date = today + timedelta(days=days_until_weekend)
        elif "明天" in query or "tomorrow" in query:
            start_date = today + timedelta(days=1)
        elif "後天" in query or "day after tomorrow" in query:
            start_date = today + timedelta(days=2)
        else:
            # 預設為今天
            start_date = today

    # 生成連續的天數
    for i in range(days):
        date = start_date + timedelta(days=i)
        dates.append(date.strftime('%Y-%m-%d'))

    return dates

# 簡化 ask_gemini 函數中的 JSON 處理部分

@retry_on_failure()
async def ask_gemini(question, session_id):
    """向Gemini API發送問題，生成兩個不同的行程"""
    if not api_key:
        logger.error("缺少 Gemini API Key")
        return {"error": "錯誤: 未設置 Gemini API Key"}

    try:
        logger.info(f"為 session_id: {session_id} 初始化 Gemini 模型")

        model = genai.GenerativeModel(
            "gemini-2.5-flash",
            system_instruction=(
                "你是一位台灣的專業旅遊行程設計師，擅長針對台灣各地設計詳細的行程規劃。"
                "請嚴格使用以下 JSON 格式回答：\n"
                "{\n"
                "  \"title\": \"行程標題\",\n"
                "  \"sections\": [\n"
                "    {\n"
                "      \"time\": \"09:00-10:30\",\n"
                "      \"location\": \"具體的地點名稱\",\n"
                "      \"details\": [\"活動詳情1\", \"活動詳情2\"],\n"
                "      \"day\": 1\n"
                "    },\n"
                "    {\n"
                "      \"time\": \"10:30-11:00\",\n"
                "      \"location\": \"另一個具體的地點名稱\",\n"
                "      \"details\": [\"活動詳情1\"],\n"
                "      \"day\": 1\n"
                "    },\n"
                "    {\n"
                "      \"time\": \"09:00-10:30\",\n"
                "      \"location\": \"第二天的地點名稱\",\n"
                "      \"details\": [\"活動詳情1\", \"活動詳情2\"],\n"
                "      \"day\": 2\n"
                "    },\n"
                "    {\n"
                "      \"time\": \"10:30-11:00\",\n"
                "      \"location\": \"第二天的另一個地點\",\n"
                "      \"details\": [\"活動詳情1\"],\n"
                "      \"day\": 2\n"
                "    }\n"
                "  ]\n"
                "}\n"
                "重要規則：\n"
                "1. 每個行程項目都必須包含 \"day\" 欄位，表示是第幾天（從1開始編號）\n"
                "2. 時間欄位只包含具體的時間範圍，如 \"09:00-10:30\"，不要包含天數標記\n"
                "3. 多天行程中，同一天的活動按時間順序排列\n"
                "4. 不同天的活動通過 \"day\" 欄位區分\n"
                "5. 地點名稱必須是具體的、可在地圖上找到的真實景點名稱\n"
                "6. 絕對禁止使用幻想或不存在的地點名稱，所有地點必須是真實存在的\n"
                "   - 絕對不要安排任何「交通時間」、「移動時間」、「捷運移動」、「公車移動」、「開車移動」等交通相關項目\n"
                "   - 絕對不要安排「咖啡漫步」、「休息」、「歇息」、「小憩」等模糊活動\n"
                "   - 絕對不要安排「加油站」、「停車場」、「廁所」、「洗手間」等非景點場所\n"
                "   - 每個行程項目必須有具體的觀光、購物、飲食或文化價值\n"
                "   - 所有行程項目必須是實際可造訪的具體景點或場所"
                "7. 住宿相關：推薦具體的飯店名稱，不要使用「飯店」、「旅館」等模糊名稱\n"
                "8. 飲食相關：使用具體的餐廳名稱，不要使用「餐廳」、「咖啡廳」等\n"
                "9. 如果無法找到合適的具體地點，寧可減少行程項目，也不要使用模糊名稱\n"
                "10. 行程應合理安排，考慮交通時間，確保每個活動都有實際意義\n"
                "11. 路線優化：\n"
                "    - 避免不必要的來回走動，盡量按照地理位置順序安排行程\n"
                "    - 考慮地點間的距離和交通便利性\n"
                "    - 同一區域的地點應集中安排，避免在不同區域間頻繁往返\n"
                "    - 優先選擇交通方便、距離適中的地點組合\n"
                "12. 使用繁體中文\n"
                "13. 確保多天行程的日期標記正確且連續\n"
                "你的回應必須是可直接解析的純 JSON，不包含任何其他文字。"
            ),
            generation_config=genai.types.GenerationConfig(
                response_mime_type="application/json"
            )
        )

        if session_id not in chat_sessions:
            logger.info(f"為 {session_id} 創建新的聊天會話")
            chat_sessions[session_id] = model.start_chat()

        chat = chat_sessions[session_id]

        logger.info(f"向 Gemini 發送問題: {question}")
        response = await chat.send_message_async(question)
        logger.info(f"收到 Gemini 原始回應: {response.text[:100]}...")

        try:
            parsed = json.loads(response.text)

            if isinstance(parsed, list) and len(parsed) > 0:
                parsed = parsed[0]  # 取第一個元素作為回應

            # 確保至少有基本結構
            if not isinstance(parsed, dict):
                logger.error(f"解析後的內容不是字典格式: {type(parsed)}")
                return {
                    "error": "生成的內容格式不符合預期",
                    "title": "格式錯誤-自動生成的行程",
                    "sections": [{
                        "time": "全天",
                        "location": "格式錯誤",
                        "details": ["系統無法解析回應，請重新查詢"]
                    }]
                }

            # 確保有必要的欄位
            if "title" not in parsed:
                parsed["title"] = "自動生成的行程"
            if "sections" not in parsed or not isinstance(parsed["sections"], list):
                parsed["sections"] = [{
                    "time": "全天",
                    "location": "資料不完整",
                    "details": ["生成的行程段落資料不完整，請重新查詢"]
                }]
                
            return parsed
        except json.JSONDecodeError as e:
            # 即使設置了 response_mime_type，仍然可能發生解析錯誤，提供一個基本的錯誤回應
            logger.error(f"JSON 解析錯誤: {e}")
            return {
                "error": "生成的內容不是有效的 JSON 格式",
                "title": "解析錯誤行程",
                "sections": [{
                    "time": "全天",
                    "location": "錯誤",
                    "details": ["系統無法解析回應，請重新查詢"]
                }]
            }

    except Exception as e:
        logger.exception(f"Gemini API 請求異常: {str(e)}")
        return {"error": f"Gemini API 錯誤：{str(e)}"}
        
        try:
            parsed = json.loads(response.text)
            
            if isinstance(parsed, list) and len(parsed) > 0:
                parsed = parsed[0]  # 取第一個元素作為回應
            
            # 確保至少有基本結構
            if not isinstance(parsed, dict):
                logger.error(f"解析後的內容不是字典格式: {type(parsed)}")
                return {
                    "error": "生成的內容格式不符合預期",
                    "title": "格式錯誤-自動生成的行程",
                    "sections": [{
                        "time": "全天",
                        "location": "格式錯誤",
                        "details": ["系統無法解析回應，請重新查詢"]
                    }]
                }
            
            # 確保有必要的欄位
            if "title" not in parsed:
                parsed["title"] = "自動生成的行程"
            if "sections" not in parsed or not isinstance(parsed["sections"], list):
                parsed["sections"] = [{
                    "time": "全天",
                    "location": "資料不完整",
                    "details": ["生成的行程段落資料不完整，請重新查詢"]
                }]
                
            return parsed
        except json.JSONDecodeError as e:
            # 即使設置了 response_mime_type，仍然可能發生解析錯誤，提供一個基本的錯誤回應
            logger.error(f"JSON 解析錯誤: {e}")
            return {
                "error": "生成的內容不是有效的 JSON 格式",
                "title": "解析錯誤",
                "sections": [{
                    "time": "全天",
                    "location": "錯誤",
                    "details": ["系統無法解析回應，請重新查詢"]
                }]
            }

    except Exception as e:
        logger.exception(f"Gemini API 請求異常: {str(e)}")
        return {"error": f"Gemini API 錯誤：{str(e)}"}

async def parse_query_with_gemini(query):
    """使用Gemini API解析用戶的自然語言輸入，提取地點、縣市和天數。"""
    if not api_key:
        logger.error("缺少 Gemini API Key")
        return {"error": "錯誤: 未設置 Gemini API Key"}

    try:
        logger.info(f"開始解析用戶查詢: {query}")
        model = genai.GenerativeModel("gemini-2.5-flash")

        prompt = (
            "請從以下句子中提取『主要遊玩地點』、『該地點所屬的台灣縣市』和『旅遊天數』，並以 JSON 格式回傳。\n"
            f"句子: \"{query}\"\n"
            "JSON 格式: {\"location\": \"主要遊玩地點\", \"city\": \"台灣的縣市\", \"days\": \"天數\"}\n"
            "例如，如果句子是「想去阿里山看日出」，地點是「阿里山」，縣市是「嘉義縣」。\n"
            "地點必須是台灣的真實存在地點。縣市必須是台灣的一個縣或市。\n"
            "如果句子中沒有明確的旅遊天數，請根據上下文（例如「週末」通常是2天）推斷，如果無法推斷，則預設為「一日遊」。\n"
            "如果無法判斷縣市，請將縣市設為與地點相同。\n"
            "你的回應必須是可直接解析的純 JSON，不包含任何其他文字。"
        )

        logger.info(f"向 Gemini 發送解析請求: {prompt}")
        response = await model.generate_content_async(
            prompt,
            generation_config=genai.types.GenerationConfig(
                response_mime_type="application/json"
            )
        )
        logger.info(f"收到 Gemini 解析回應: {response.text}")
        
        parsed_data = json.loads(response.text)
        
        # 基本驗證
        if "location" not in parsed_data or "days" not in parsed_data or "city" not in parsed_data:
            logger.error(f"解析結果缺少必要欄位: {parsed_data}")
            # 嘗試從地點推斷城市
            location = parsed_data.get("location", "台灣")
            return {"location": location, "city": location, "days": parsed_data.get("days", "一日遊"), "error": "解析不完整"}

        return parsed_data

    except Exception as e:
        logger.exception(f"解析用戶查詢時出錯: {str(e)}")
        # 降級處理：如果解析失敗，至少返回一個預設值
        return {"location": "台灣", "city": "台灣", "days": "一日遊", "error": f"解析查詢時出錯: {str(e)}"}

@app.route('/<path:filename>', methods=['GET'])
async def static_files(filename):
    """提供靜態文件 (CSS, JS 等)"""
    try:
        # 檢查是否是前端目錄中的文件
        frontend_dir = os.path.join(os.path.dirname(__file__), '..', 'frontend')
        file_path = os.path.join(frontend_dir, filename)

        # 安全檢查：確保文件在前端目錄內
        if not os.path.abspath(file_path).startswith(os.path.abspath(frontend_dir)):
            return "無效的文件路徑", 403

        if os.path.exists(file_path) and os.path.isfile(file_path):
            # 根據文件擴展名設置正確的 MIME 類型
            if filename.endswith('.css'):
                mime_type = 'text/css'
            elif filename.endswith('.js'):
                mime_type = 'application/javascript'
            elif filename.endswith('.png'):
                mime_type = 'image/png'
            elif filename.endswith('.jpg') or filename.endswith('.jpeg'):
                mime_type = 'image/jpeg'
            elif filename.endswith('.svg'):
                mime_type = 'image/svg+xml'
            else:
                mime_type = 'text/plain'

            with open(file_path, 'rb') as f:
                return f.read(), 200, {'Content-Type': f'{mime_type}; charset=utf-8'}
        else:
            return "文件未找到", 404
    except Exception as e:
        logger.error(f"載入靜態文件時出錯: {e}")
        return f"載入文件時出錯: {e}", 500

@app.route('/', methods=['GET'])
async def index():
    """提供前端主頁面"""
    try:
        frontend_path = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'index.html')
        with open(frontend_path, 'r', encoding='utf-8') as f:
            return f.read(), 200, {'Content-Type': 'text/html; charset=utf-8'}
    except FileNotFoundError:
        return "前端文件未找到，請檢查 frontend/index.html 是否存在", 404
    except Exception as e:
        logger.error(f"載入前端文件時出錯: {e}")
        return f"載入前端文件時出錯: {e}", 500

@app.route('/ask', methods=['POST'])
async def ask():
    """處理用戶問題請求"""
    try:
        data = await request.get_json()
        logger.info(f"收到請求數據: {data}")
        
        natural_language_query = data.get("question")
        session_id = data.get("session_id")

        if not natural_language_query or not session_id:
            logger.error("請求缺少必要參數")
            return jsonify({"status": "error", "message": "缺少必要參數"}), 400

        # 1. 使用 Gemini 解析用戶的自然語言輸入
        parsed_query = await parse_query_with_gemini(natural_language_query)
        if "error" in parsed_query:
            logger.warning(f"解析用戶查詢失敗: {parsed_query['error']}")
            # 即使解析失敗，也繼續使用預設值

        location_name = parsed_query.get("location", "台灣")
        city_for_weather = parsed_query.get("city", location_name) # 如果沒有city，就用location當作天氣查詢城市
        trip_days_str = str(parsed_query.get("days", "一日遊"))  # 確保是字符串
        
        # 解析天數
        if "一日" in trip_days_str or "1天" in trip_days_str or trip_days_str == "1":
            trip_days = 1
        elif "兩天" in trip_days_str or "2天" in trip_days_str or trip_days_str == "2":
            trip_days = 2
        elif "三天" in trip_days_str or "3天" in trip_days_str or trip_days_str == "3":
            trip_days = 3
        elif "四天" in trip_days_str or "4天" in trip_days_str or trip_days_str == "4":
            trip_days = 4
        else:
            trip_days = 1  # 預設為1天
        
        # 根據查詢計算具體日期
        trip_dates = calculate_trip_dates(natural_language_query, trip_days)
        logger.info(f"計算得到的旅行日期: {trip_dates}, trip_days: {trip_days}, natural_language_query: {natural_language_query}")
        
        # 組合最終問題
        question = f"請幫我規劃在「{location_name}」的「{trip_days}天{trip_days-1}夜」行程。原始需求是：「{natural_language_query}」"
        logger.info(f"組合後的問題: {question}")

        # 2. 獲取天氣資訊
        weather_info = None
        english_city_name = ""
        if city_for_weather:
            try:
                english_city_name = extract_city_name(city_for_weather)
                logger.info(f"準備獲取天氣，城市: {english_city_name}, 日期: {trip_dates}")
                if trip_dates:
                    # 如果有具體日期，獲取多日期天氣
                    weather_info = await get_multi_day_weather(english_city_name, trip_dates)
                    logger.info(f"獲取到 {city_for_weather} 的多日期天氣資訊: {weather_info}")
                    
                    # 如果多日期天氣獲取失敗，嘗試獲取第一個日期的天氣
                    if not weather_info or all("error" in str(v) for v in weather_info.values() if isinstance(v, dict)):
                        logger.warning("多日期天氣獲取失敗，嘗試獲取第一個日期的天氣")
                        if trip_dates:
                            weather_info = await get_weather(english_city_name, trip_dates[0])
                            logger.info(f"獲取到 {city_for_weather} 的單日期天氣資訊: {weather_info}")
                else:
                    # 如果沒有具體日期，獲取當前天氣
                    weather_info = await get_weather(english_city_name)
                    logger.info(f"獲取到 {city_for_weather} 的當前天氣資訊: {weather_info}")
            except Exception as e:
                logger.error(f"獲取天氣資訊失敗: {str(e)}")
        
        # 3. 建立增強版提示，加入天氣資訊
        enhanced_question = question
        if weather_info:
            if isinstance(weather_info, dict):
                # 檢查是否是多日期天氣（包含日期鍵且鍵是日期格式）
                date_keys = [k for k in weather_info.keys() if isinstance(k, str) and k.replace('-', '').isdigit() and len(k) == 10]
                if date_keys:
                    # 多日期天氣
                    weather_parts = []
                    for date, weather in weather_info.items():
                        if isinstance(weather, dict) and "error" not in weather:
                            weather_parts.append(
                                f"{date}：{weather.get('condition', '未知天氣')}，"
                                f"溫度：{weather.get('temperature', '未知')}°C (最低 {weather.get('min_temp', '未知')}°C - 最高 {weather.get('max_temp', '未知')}°C)，"
                                f"濕度：{weather.get('humidity', '未知')}%，降雨機率：{weather.get('rain_probability', 0)}%。"
                            )

                    if weather_parts:
                        weather_desc = f"城市：{city_for_weather}\n" + "\n".join(weather_parts)

                        enhanced_question = (
                            f"{question}\n\n"
                            f"請考慮以下各日期的天氣資訊來規劃行程：\n{weather_desc}\n"
                            f"請根據每一天的具體天氣條件調整活動安排，如果某天不適合戶外活動，請提供室內替代方案。"
                        )
                elif "error" not in weather_info and "condition" in weather_info:
                    # 單日期天氣
                    weather_desc = (
                        f"城市：{city_for_weather}，目前天氣：{weather_info['condition']}，"
                        f"溫度：{weather_info['temperature']}°C (最低 {weather_info['min_temp']}°C - 最高 {weather_info['max_temp']}°C)，"
                        f"濕度：{weather_info['humidity']}%，降雨機率：{weather_info['rain_probability']}%。"
                    )

                    enhanced_question = (
                        f"{question}\n\n"
                        f"請考慮以下天氣資訊來規劃行程：\n{weather_desc}\n"
                        f"如果是不適合在此天氣條件下進行的活動，請調整為適合的室內活動或提供替代建議。"
                    )

            logger.info(f"已將天氣資訊加入提示: {enhanced_question}")
        
        # 4. 使用增強版提示獲取 LLM 回覆
        llm_response = await ask_gemini(enhanced_question, session_id)

        if "error" in llm_response:
            logger.error(f"LLM回應錯誤: {llm_response['error']}")
            return jsonify({"status": "error", "message": llm_response["error"]}), 500

        # 5. 處理增強版回答（添加地點詳情和計算距離）
        try:
            maps_api_working = await check_maps_api_status()
            logger.info(f"Google Maps API 狀態: {'可用' if maps_api_working else '不可用'}")

            if maps_api_working:
                try:
                    logger.info("處理LLM回應，添加地點詳情和推薦指數")
                    processed_response = await add_place_details_for_single_itinerary(llm_response, location_name)

                    # 添加天氣資訊到回應（但不調整行程）
                    # 處理天氣數據
                    if weather_info:
                        logger.info(f"處理天氣數據，類型: {type(weather_info)}, 內容: {weather_info}")
                        if isinstance(weather_info, dict):
                            # 檢查是否是多日期天氣
                            date_keys = [k for k in weather_info.keys() if isinstance(k, str) and k.replace('-', '').isdigit() and len(k) == 10]
                            logger.info(f"檢測到的日期鍵: {date_keys}")
                            if date_keys:
                                # 多日期天氣
                                weather_data_list = []
                                for date in sorted(date_keys):
                                    if isinstance(weather_info[date], dict) and "error" not in weather_info[date]:
                                        weather_data_list.append({
                                            "date": date,
                                            "location": city_for_weather,
                                            "city_name": english_city_name,
                                            "weather": weather_info[date]
                                        })
                                processed_response["weather_data"] = weather_data_list
                                logger.info(f"創建多日期天氣數據: {len(weather_data_list)} 項")
                            elif "error" not in weather_info and "condition" in weather_info:
                                # 單日期天氣
                                weather_data = {
                                    "location": city_for_weather,
                                    "city_name": english_city_name,
                                    "weather": weather_info
                                }
                                # 如果有具體日期，添加日期信息
                                if trip_dates:
                                    weather_data["date"] = trip_dates[0]
                                processed_response["weather_data"] = [weather_data]
                                logger.info("創建單日期天氣數據")

                    response_data = {"status": "success", "data": processed_response}

                    logger.info("成功處理完整回應")
                    return jsonify(response_data)

                except Exception as e:
                    logger.exception(f"處理回覆時出錯: {str(e)}")
                    response_data = {"status": "success", "data": llm_response, "warning": "Google Maps 資訊不可用"}
                    return jsonify(response_data)
            else:
                logger.warning("Google Maps API 不可用，使用降級策略")
                response_data = {
                    "status": "success",
                    "data": llm_response,
                    "warning": "Google Maps 服務暫時不可用，顯示基本行程"
                }
                return jsonify(response_data)
        except Exception as e:
            logger.exception(f"處理增強回應時出錯: {str(e)}")
            # 降級處理：至少返回LLM回應
            return jsonify({
                "status": "success",
                "data": llm_response,
                "warning": f"API處理時出錯: {str(e)}"
            })
                        
    except Exception as e:
        logger.exception(f"/ask 路由處理異常: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

def is_location_specific(location):
    """
    檢查地點名稱是否足夠具體，避免查詢模糊或通用性的地點名稱
    """
    if not location or not isinstance(location, str):
        return False

    location = location.strip()

    # 過濾掉明顯模糊或通用的地點名稱
    fuzzy_patterns = [
        "特色咖啡廳", "咖啡廳", "咖啡店", "茶館", "飲料店",
        "伴手禮", "紀念品店", "禮品店", "土產店",
        "餐廳", "小吃店", "美食", "宵夜",
        "休息", "歇息", "休息站", "休息區",
        "返回", "回家", "返程",
        "住宿", "飯店", "旅館", "民宿",
        "加油站", "休息站", "服務區",
        "景觀台", "觀景台", "眺望點",
        "停車場", "停車區",
        "廁所", "洗手間", "休息室"
    ]

    # 如果包含模糊關鍵字，返回False
    for pattern in fuzzy_patterns:
        if pattern in location:
            return False

    # 如果地點名稱太短（少於2個中文字），可能是模糊的
    if len(location) < 4:  # 中文字符通常佔用更多字節
        return False

    # 如果只包含通用詞彙，返回False
    generic_words = ["附近", "周邊", "一帶", "地區", "區域", "地方", "處"]
    for word in generic_words:
        if location == word or location.endswith(word):
            return False

    return True

def extract_city_name(city_name):
    """從地點名稱中提取城市名，並轉換為英文"""
    city_map = {
        "台北": "Taipei", "臺北": "Taipei", "新北": "New Taipei",
        "桃園": "Taoyuan", "台中": "Taichung", "臺中": "Taichung",
        "台南": "Tainan", "臺南": "Tainan", "高雄": "Kaohsiung",
        "基隆": "Keelung", "新竹": "Hsinchu", "嘉義": "Chiayi",
        "苗栗": "Miaoli", "彰化": "Changhua", "南投": "Nantou",
        "雲林": "Yunlin", "屏東": "Pingtung", "宜蘭": "Yilan",
        "花蓮": "Hualien", "台東": "Taitung", "臺東": "Taitung",
        "澎湖": "Penghu", "金門": "Kinmen", "連江": "Lienchiang",
        "台灣": "Taipei", "臺灣": "Taipei"  # 預設使用台北
    }

    # 直接檢查完整城市名稱
    if city_name in city_map:
        return city_map[city_name]

    # 檢查部分匹配
    for chinese, english in city_map.items():
        if chinese in city_name:
            return english

    return city_name
    """
    計算威爾遜分數(Wilson Score)，用於綜合評分和評論數。
    返回一個0-5之間的分數，四捨五入到小數點後一位。
    """
    if user_ratings_total == 0 or not isinstance(rating, (int, float)) or rating <= 0:
        return None

    # Z-score for 95% confidence
    z = 1.96
    # 將5星制評分轉換為0-1區間的正面評價比例
    p = rating / 5.0
    n = user_ratings_total

    try:
        numerator = p + (z**2 / (2 * n)) - z * math.sqrt((p * (1 - p) / n) + (z**2 / (4 * n**2)))
        denominator = 1 + (z**2 / n)
        
        if denominator == 0:
            return None
            
        # 計算分數 (0-1區間)
        score_0_1 = numerator / denominator
        
        # 將分數轉換回5星制並四捨五入到小數點後一位
        final_score = round(score_0_1 * 5, 1)
        
        return final_score
    except (ValueError, ZeroDivisionError):
        return None

async def get_place_details_async(query):
    """使用 Google Maps API 獲取地點詳細資訊"""
    if not GOOGLE_MAPS_API_KEY:
        return {"error": "未設置 Google Maps API Key"}
        
    # 檢查緩存
    if query in place_cache:
        return place_cache[query]
        
    try:
        logger.info(f"查詢地點: {query}")
        
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=REQUEST_TIMEOUT)) as session:
            # Text Search API
            text_search_url = "https://maps.googleapis.com/maps/api/place/textsearch/json"
            text_search_params = {
                "query": query,
                "language": "zh-TW",
                "key": GOOGLE_MAPS_API_KEY
            }

            async with session.get(text_search_url, params=text_search_params) as response:
                text_search_data = await response.json()

            if text_search_data.get("status") != "OK" or not text_search_data.get("results"):
                return {"error": f"未找到地點: {query}"}

            # 獲取 place_id
            place_id = text_search_data["results"][0]["place_id"]
            
            # Place Details API
            place_details_url = "https://maps.googleapis.com/maps/api/place/details/json"
            place_details_params = {
                "place_id": place_id,
                "fields": "name,rating,user_ratings_total,formatted_address",
                "language": "zh-TW",
                "key": GOOGLE_MAPS_API_KEY
            }

            async with session.get(place_details_url, params=place_details_params) as response:
                place_details_data = await response.json()
                
            if place_details_data.get("status") != "OK":
                return {"error": f"無法獲取地點詳情: {query}"}

            # 返回地點詳細資訊
            result = place_details_data.get("result", {})
            place_info = {
                "name": result.get("name", query),
                "rating": result.get("rating", "無評分"),
                "user_ratings_total": result.get("user_ratings_total", 0),
                "address": result.get("formatted_address", "無地址")
            }
            
            # 存入緩存
            place_cache[query] = place_info
            return place_info

    except Exception as e:
        logger.error(f"查詢地點錯誤: {query}, {str(e)}")
        return {"error": str(e)}

def calculate_route_distance_and_time(origin, destination):
    """計算兩地之間的距離和行駛時間"""
    if not GOOGLE_MAPS_API_KEY:
        error_msg = "❌ 未設置 Google Maps API Key"
        logger.error(error_msg)
        add_web_log("error", error_msg)
        return {"error": "未設置 Google Maps API Key"}
        
    # 檢查緩存
    cache_key = f"{origin}_{destination}"
    if cache_key in route_cache:
        cached_result = route_cache[cache_key]
        cache_msg = f"📦 使用緩存路線: {origin} → {destination}"
        logger.info(cache_msg)
        add_web_log("info", cache_msg)
        add_web_log("info", f"   距離: {cached_result.get('distance', 'N/A')}")
        add_web_log("info", f"   時間: {cached_result.get('duration', 'N/A')}")
        return cached_result
        
    try:
        start_msg = f"🔍 開始計算路線: {origin} → {destination}"
        logger.info(start_msg)
        add_web_log("info", start_msg)
        
        # Routes API
        routes_url = "https://maps.googleapis.com/maps/api/directions/json"
        routes_params = {
            "origin": origin,
            "destination": destination,
            "language": "zh-TW",
            "key": GOOGLE_MAPS_API_KEY
        }

        api_msg = "📡 呼叫 Google Maps API..."
        logger.info(api_msg)
        add_web_log("info", api_msg)
        
        routes_response = requests.get(routes_url, params=routes_params, timeout=REQUEST_TIMEOUT)
        routes_data = routes_response.json()

        if routes_data.get("status") != "OK":
            error_msg = f"路線計算錯誤: {routes_data.get('status')}"
            logger.error(f"❌ API 錯誤: {error_msg}")
            add_web_log("error", f"❌ API 錯誤: {error_msg}")
            if routes_data.get("error_message"):
                detail_msg = f"   詳細錯誤: {routes_data.get('error_message')}"
                logger.error(detail_msg)
                add_web_log("error", detail_msg)
            return {"error": error_msg}

        # 獲取距離和時間
        route = routes_data["routes"][0]["legs"][0]
        route_info = {
            "distance": route["distance"]["text"],
            "duration": route["duration"]["text"]
        }
        
        success_msg = "✅ 路線計算成功!"
        logger.info(success_msg)
        add_web_log("success", success_msg)
        add_web_log("info", f"   起點: {origin}")
        add_web_log("info", f"   終點: {destination}")
        add_web_log("info", f"   距離: {route_info['distance']} ({route['distance']['value']} 公尺)")
        add_web_log("info", f"   時間: {route_info['duration']} ({route['duration']['value']} 秒)")
        
        # 存入緩存
        route_cache[cache_key] = route_info
        cache_save_msg = "💾 已緩存路線資料"
        logger.info(cache_save_msg)
        add_web_log("info", cache_save_msg)
        return route_info

    except Exception as e:
        error_msg = f"計算路線錯誤: {origin} -> {destination}, {str(e)}"
        logger.error(f"❌ {error_msg}")
        logger.error(f"   Exception 類型: {type(e).__name__}")
        logger.error(f"   Exception 詳情: {str(e)}")
        add_web_log("error", f"❌ {error_msg}")
        add_web_log("error", f"   Exception 類型: {type(e).__name__}")
        add_web_log("error", f"   Exception 詳情: {str(e)}")
        return {"error": str(e)}

def extract_numeric_value(value, units):
    """從帶有單位的字符串中提取數值"""
    parse_msg = f"🔢 解析數值: '{value}', 單位: {units}"
    logger.debug(parse_msg)
    add_web_log("debug", parse_msg)
    
    for unit in units:
        if unit in value:
            try:
                cleaned_value = value.replace(unit, "").replace(",", "").strip()
                result = float(cleaned_value)
                success_msg = f"   ✅ 解析成功: {result} (原始: '{value}')"
                logger.debug(success_msg)
                add_web_log("debug", success_msg)
                return result
            except ValueError:
                fail_msg = f"   ❌ 解析失敗: '{value}' -> '{cleaned_value}'"
                logger.warning(fail_msg)
                add_web_log("warning", fail_msg)
                return 0.0
    no_unit_msg = f"   ⚠️ 未找到匹配單位: '{value}'"
    logger.warning(no_unit_msg)
    add_web_log("warning", no_unit_msg)
    return 0.0

async def process_llm_response(llm_response, city_name=None):
    """處理LLM回覆，添加天氣資訊和地點詳情，不處理室內外活動調整"""
    try:
        # 清空之前的網頁日誌
        clear_web_logs()
        
        start_msg = f"🚀 開始處理 LLM 回應，城市: {city_name}"
        logger.info(start_msg)
        add_web_log("info", start_msg)
        
        # 首先檢查 llm_response 是否為預期的格式
        if not isinstance(llm_response, dict):
            logger.error(f"LLM 回應格式錯誤，預期字典但收到 {type(llm_response)}")
            # 如果收到列表，嘗試轉換為預期格式
            if isinstance(llm_response, list) and llm_response:
                converted_response = {
                    "title": "自動生成的行程",
                    "sections": []
                }
                
                if all(isinstance(item, dict) for item in llm_response):
                    for item in llm_response:
                        if "location" in item or "time" in item:
                            converted_response["sections"].append(item)
                
                llm_response = converted_response
                logger.info("已將列表格式轉換為預期的字典格式")
            else:
                logger.error("無法處理的回應格式，創建一個基本結構")
                return {
                    "title": "格式錯誤-自動生成的行程",
                    "sections": [{
                        "time": "全天",
                        "location": "請重新查詢",
                        "details": ["系統無法解析回應，請重新查詢"]
                    }]
                }
        
        # 檢查 sections 結構
        sections = llm_response.get("sections", [])
        if not sections:
            logger.warning("LLM 回應中沒有 sections 或為空")
            return llm_response

        # 獲取天氣資訊
        weather_info = None
        if city_name:
            english_city_name = extract_city_name(city_name)
            weather_info = await get_weather(english_city_name)

        # 添加天氣資訊，但不調整行程
        if weather_info:
            # 添加天氣資訊
            llm_response["weather_data"] = [{
                "location": city_name,
                "city_name": english_city_name,
                "weather": weather_info
            }]
        
        # 處理地點詳情
        async def process_location(section):
            if not isinstance(section, dict):
                logger.warning(f"段落格式錯誤: {section}")
                return {"time": "未知時間", "location": "未知地點", "details": ["格式錯誤"]}
                
            location = section.get("location", "")
            if location:
                place_details = await get_place_details_async(f"{city_name} {location}")
                
                if "error" not in place_details:
                    section["rating"] = place_details.get("rating", "無評分")
                    section["user_ratings_total"] = place_details.get("user_ratings_total", 0)
                    section["address"] = place_details.get("address", "無地址")
                    # 計算並添加威爾遜分數
                    section["wilson_score"] = calculate_wilson_score(section["rating"], section["user_ratings_total"])

            return section
            
        # 確保每個段落都是字典形式
        valid_sections = []
        for section in sections:
            if isinstance(section, dict) and section.get("location"):
                valid_sections.append(section)
            elif isinstance(section, dict):
                # 部分資訊缺失但仍是字典
                if not section.get("location") and section.get("time"):
                    section["location"] = "未指定地點"
                if not section.get("time") and section.get("location"):
                    section["time"] = "時間未指定"
                if not section.get("details"):
                    section["details"] = ["未提供詳情"]
                valid_sections.append(section)
        
        # 更新 sections 為有效的段落
        llm_response["sections"] = valid_sections
        
        tasks = [process_location(section) for section in valid_sections]
        await asyncio.gather(*tasks)
        
        # 按天分組行程項目
        sections_by_day = {}
        for section in valid_sections:
            day = section.get("day", 1)
            if day not in sections_by_day:
                sections_by_day[day] = []
            sections_by_day[day].append(section)

        # 計算每一天的距離和時間
        total_distance = 0.0
        total_duration = 0.0
        day_summaries = []

        # 排序天數
        sorted_days = sorted(sections_by_day.keys())

        previous_hotel = None  # 記錄前一天的住宿地點

        for day in sorted_days:
            day_sections = sections_by_day[day]
            day_distance = 0.0
            day_duration = 0.0

            # 獲取這一天的景點列表
            locations = []
            for section in day_sections:
                if section.get("location"):
                    locations.append(section["location"])

            # 如果是第二天或之後，且有前一天的住宿地點，在景點列表前加上住宿地點
            if day > 1 and previous_hotel and locations:
                locations.insert(0, previous_hotel)

            # 計算這一天的距離
            if len(locations) > 1:
                for i in range(len(locations) - 1):
                    route_info = calculate_route_distance_and_time(locations[i], locations[i + 1])

                    if "error" not in route_info:
                        distance_value = extract_numeric_value(route_info["distance"], [" 公里", " km"])
                        duration_value = extract_numeric_value(route_info["duration"], [" 分鐘", " 小時", " mins", " hours"])

                        day_distance += distance_value
                        day_duration += duration_value

            total_distance += day_distance
            total_duration += day_duration

            # 記錄這一天的住宿地點（如果有的話）
            for section in day_sections:
                location = section.get("location", "").lower()
                if any(keyword in location for keyword in ["飯店", "旅館", "酒店", "民宿"]):
                    previous_hotel = section["location"]
                    break

            day_summaries.append({
                "day": day,
                "distance": f"{day_distance:.1f} 公里",
                "duration": f"{int(day_duration)} 分鐘"
            })

        llm_response["total_distance"] = f"{total_distance:.1f} 公里"
        llm_response["total_duration"] = f"{int(total_duration)} 分鐘"
        llm_response["day_summaries"] = day_summaries
        
        summary_msg = "🏁 行程計算總結:"
        logger.info(summary_msg)
        add_web_log("info", summary_msg)
        
        distance_msg = f"   總距離: {total_distance:.1f} 公里"
        logger.info(distance_msg)
        add_web_log("info", distance_msg)
        
        duration_msg = f"   總時間: {int(total_duration)} 分鐘"
        logger.info(duration_msg)
        add_web_log("info", duration_msg)
        
        days_msg = f"   總天數: {len(day_summaries)} 天"
        logger.info(days_msg)
        add_web_log("info", days_msg)
        
        # 添加網頁日誌到回應中
        llm_response["debug_logs"] = get_web_logs()
        
        return llm_response

    except Exception as e:
        logger.exception(f"處理 LLM 回覆時發生錯誤：{str(e)}")
        # 返回一個安全的回應
        return {
            "title": "處理錯誤-自動生成的行程",
            "sections": [{
                "time": "全天",
                "location": "處理錯誤",
                "details": [f"處理回應時出錯: {str(e)}", "請重新查詢或簡化問題"]
            }]
        }

async def check_maps_api_status():
    """檢查 Google Maps API 是否可用"""
    if not GOOGLE_MAPS_API_KEY:
        return False
        
    try:
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=5)) as session:
            url = "https://maps.googleapis.com/maps/api/place/textsearch/json"
            params = {"query": "台北101", "key": GOOGLE_MAPS_API_KEY}

            async with session.get(url, params=params) as response:
                data = await response.json()
                return data.get("status") == "OK"
                
    except Exception:
        return False

def is_location_specific(location):
    """
    檢查地點名稱是否足夠具體，避免查詢模糊或通用性的地點名稱
    """
    if not location or not isinstance(location, str):
        return False

    location = location.strip()

    # 過濾掉明顯模糊或通用的地點名稱
    fuzzy_patterns = [
        "特色咖啡廳", "咖啡廳", "咖啡店", "茶館", "飲料店",
        "伴手禮", "紀念品店", "禮品店", "土產店",
        "餐廳", "小吃店", "美食", "宵夜",
        "休息", "歇息", "休息站", "休息區",
        "返回", "回家", "返程",
        "住宿", "飯店", "旅館", "民宿",
        "加油站", "休息站", "服務區",
        "景觀台", "觀景台", "眺望點",
        "停車場", "停車區",
        "廁所", "洗手間", "休息室"
    ]

    # 如果包含模糊關鍵字，返回False
    for pattern in fuzzy_patterns:
        if pattern in location:
            return False

    # 如果地點名稱太短（少於2個中文字），可能是模糊的
    if len(location) < 4:  # 中文字符通常佔用更多字節
        return False

    # 如果只包含通用詞彙，返回False
    generic_words = ["附近", "周邊", "一帶", "地區", "區域", "地方", "處"]
    for word in generic_words:
        if location == word or location.endswith(word):
            return False

    return True
    """從地點名稱中提取城市名，並轉換為英文"""
    city_map = {
        "台北": "Taipei", "臺北": "Taipei", "新北": "New Taipei",
        "桃園": "Taoyuan", "台中": "Taichung", "臺中": "Taichung",
        "台南": "Tainan", "臺南": "Tainan", "高雄": "Kaohsiung",
        "基隆": "Keelung", "新竹": "Hsinchu", "嘉義": "Chiayi",
        "苗栗": "Miaoli", "彰化": "Changhua", "南投": "Nantou",
        "雲林": "Yunlin", "屏東": "Pingtung", "宜蘭": "Yilan",
        "花蓮": "Hualien", "台東": "Taitung", "臺東": "Taitung",
        "澎湖": "Penghu", "金門": "Kinmen", "連江": "Lienchiang"
    }

    # 直接檢查完整城市名稱
    if city_name in city_map:
        return city_map[city_name]

    # 檢查部分匹配
    for chinese, english in city_map.items():
        if chinese in city_name:
            return english

    return city_name
    """從地點名稱中提取城市名，並轉換為英文"""
    city_map = {
        "台北": "Taipei", "臺北": "Taipei", "新北": "New Taipei",
        "桃園": "Taoyuan", "台中": "Taichung", "臺中": "Taichung",
        "台南": "Tainan", "臺南": "Tainan", "高雄": "Kaohsiung",
        "基隆": "Keelung", "新竹": "Hsinchu", "嘉義": "Chiayi",
        "苗栗": "Miaoli", "彰化": "Changhua", "南投": "Nantou",
        "雲林": "Yunlin", "屏東": "Pingtung", "宜蘭": "Yilan",
        "花蓮": "Hualien", "台東": "Taitung", "臺東": "Taitung",
        "澎湖": "Penghu", "金門": "Kinmen", "連江": "Lienchiang"
    }
    
    # 直接檢查完整城市名稱
    if city_name in city_map:
        return city_map[city_name]
    
    # 檢查部分匹配
    for chinese, english in city_map.items():
        if chinese in city_name:
            return english
    
    return city_name

async def add_place_details_for_single_itinerary(itinerary, city_name=None):
    """處理單個行程，添加地點詳情和推薦指數"""
    try:
        # 檢查 itinerary 格式
        if not isinstance(itinerary, dict):
            logger.error(f"行程格式錯誤，預期字典但收到 {type(itinerary)}")
            return itinerary

        sections = itinerary.get("sections", [])
        if not sections:
            return itinerary

        # 處理地點詳情
        async def process_location(section):
            if not isinstance(section, dict):
                return section

            location = section.get("location", "")
            if location and city_name:
                place_details = await get_place_details_async(f"{city_name} {location}")

                if "error" not in place_details:
                    rating = place_details.get("rating")
                    user_ratings_total = place_details.get("user_ratings_total", 0)

                    section["rating"] = rating if isinstance(rating, (int, float)) else "無評分"
                    section["user_ratings_total"] = user_ratings_total
                    section["address"] = place_details.get("address", "無地址")

                    # 計算並添加威爾遜分數
                    section["wilson_score"] = calculate_wilson_score(rating, user_ratings_total)
                else:
                    # 如果查詢失敗，設置默認值
                    section["rating"] = "無評分"
                    section["user_ratings_total"] = 0
                    section["address"] = "無地址"
                    section["wilson_score"] = None

            return section

        # 確保每個段落都有必要的欄位
        for section in sections:
            if isinstance(section, dict):
                if not section.get("location"):
                    section["location"] = "未指定地點"
                if not section.get("time"):
                    section["time"] = "時間未指定"
                if not section.get("details") or not isinstance(section["details"], list):
                    section["details"] = ["未提供詳情"]

        # 處理每個段落
        tasks = [process_location(section) for section in sections]
        await asyncio.gather(*tasks)

        # 按天分組行程項目
        sections_by_day = {}
        for section in sections:
            day = section.get("day", 1)
            if day not in sections_by_day:
                sections_by_day[day] = []
            sections_by_day[day].append(section)

        # 計算每一天的距離和時間
        total_distance = 0.0
        total_duration = 0.0
        day_summaries = []

        # 排序天數
        sorted_days = sorted(sections_by_day.keys())

        previous_hotel = None  # 記錄前一天的住宿地點

        for day in sorted_days:
            day_sections = sections_by_day[day]
            day_distance = 0.0
            day_duration = 0.0

            # 獲取這一天的景點列表
            locations = []
            for section in day_sections:
                if section.get("location"):
                    locations.append(section["location"])

            # 如果是第二天或之後，且有前一天的住宿地點，在景點列表前加上住宿地點
            if day > 1 and previous_hotel and locations:
                locations.insert(0, previous_hotel)

            # 計算這一天的距離
            if len(locations) > 1:
                for i in range(len(locations) - 1):
                    route_info = calculate_route_distance_and_time(locations[i], locations[i + 1])

                    if "error" not in route_info:
                        distance_value = extract_numeric_value(route_info["distance"], [" 公里", " km"])
                        duration_value = extract_numeric_value(route_info["duration"], [" 分鐘", " 小時", " mins", " hours"])

                        day_distance += distance_value
                        day_duration += duration_value

            total_distance += day_distance
            total_duration += day_duration

            # 記錄這一天的住宿地點（如果有的話）
            for section in day_sections:
                location = section.get("location", "").lower()
                if any(keyword in location for keyword in ["飯店", "旅館", "酒店", "民宿"]):
                    previous_hotel = section["location"]
                    break

            day_summaries.append({
                "day": day,
                "distance": f"{day_distance:.1f} 公里",
                "duration": f"{int(day_duration)} 分鐘"
            })

        itinerary["total_distance"] = f"{total_distance:.1f} 公里"
        itinerary["total_duration"] = f"{int(total_duration)} 分鐘"
        itinerary["day_summaries"] = day_summaries

        # 計算推薦指數（Wilson score 平均值，並考慮交通時間懲罰）
        wilson_scores = []
        for section in sections:
            if isinstance(section, dict) and "wilson_score" in section and section["wilson_score"] is not None:
                wilson_scores.append(section["wilson_score"])

        if wilson_scores:
            avg_wilson_score = sum(wilson_scores) / len(wilson_scores)

            # 計算遊玩時間和交通時間懲罰
            playing_time_minutes = calculate_playing_time(sections)
            travel_duration_minutes = total_duration  # 從之前計算的交通時間

            penalty_factor = calculate_travel_penalty_factor(travel_duration_minutes, playing_time_minutes)

            # 應用懲罰因子
            final_score = avg_wilson_score * penalty_factor
            itinerary["recommendation_score"] = round(final_score, 1)

            # 計算顯示用的格式化數據
            playing_time_hours = round(playing_time_minutes / 60, 1)
            travel_ratio_percentage = round((travel_duration_minutes / playing_time_minutes * 100), 1) if playing_time_minutes > 0 else 0

            # 添加顯示信息
            itinerary["playing_time_display"] = f"{playing_time_hours}小時"
            itinerary["travel_ratio_display"] = f"{travel_ratio_percentage}%"

            # 添加調試信息（可選）
            itinerary["playing_time_minutes"] = playing_time_minutes
            itinerary["travel_duration_minutes"] = travel_duration_minutes
            itinerary["travel_penalty_factor"] = round(penalty_factor, 2)
        else:
            itinerary["recommendation_score"] = None

        return itinerary

    except Exception as e:
        logger.exception(f"處理單行程時出錯：{str(e)}")
        return itinerary  # 如果處理失敗，返回原始行程

if __name__ == '__main__':
    logger.info("啟動後端服務器...")
    app.run(debug=True, port=5000, host='localhost')
