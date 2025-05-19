from quart import Quart, request, jsonify
from quart_cors import cors
import json
import os
import asyncio
from google import genai
import logging
import aiohttp
import requests
from weather import get_weather

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

# 簡化 ask_gemini 函數中的 JSON 處理部分

@retry_on_failure()
async def ask_gemini(question, session_id):
    """向Gemini API發送問題"""
    if not api_key:
        logger.error("缺少 Gemini API Key")
        return {"error": "錯誤: 未設置 Gemini API Key"}

    try:
        logger.info(f"初始化 Gemini 客戶端，使用 session_id: {session_id}")
        client = genai.Client(api_key=api_key)

        if session_id not in chat_sessions:
            logger.info(f"創建新的聊天會話: {session_id}")
            chat = client.chats.create(
                model="gemini-2.0-flash",
                config=genai.types.GenerateContentConfig(
                    system_instruction=(
                        "你是一位台灣的專業旅遊行程設計師，擅長針對台灣各地設計詳細的行程規劃。"
                        "請嚴格使用以下 JSON 格式回答：\n"
                        "{\n"
                        "  \"title\": \"行程標題\",\n"
                        "  \"sections\": [\n"
                        "    {\n"
                        "      \"time\": \"09:00-10:30\",\n"
                        "      \"location\": \"地點名稱\",\n"
                        "      \"details\": [\"活動詳情1\", \"活動詳情2\"]\n"
                        "    }\n"
                        "  ]\n"
                        "}\n"
                        "請使用繁體中文，每個行程最多5個地點，確保合理安排。"
                        "你的回應必須是可直接解析的純 JSON，不包含任何其他文字。"
                        "注意：回應必須是單一 JSON 對象，不要返回 JSON 數組或列表。"
                    ),
                    # 限制輸出為 JSON 格式
                    response_mime_type="application/json"
                )
            )
            chat_sessions[session_id] = chat
        else:
            logger.info(f"使用現有聊天會話: {session_id}")
            chat = chat_sessions[session_id]

        logger.info(f"向 Gemini 發送問題: {question}")
        response = chat.send_message(question)
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

@app.route('/ask', methods=['POST'])
async def ask():
    """處理用戶問題請求"""
    try:
        data = await request.get_json()
        logger.info(f"收到請求數據: {data}")
        
        question = data.get("question")
        session_id = data.get("session_id")
        city_name = data.get("city_name")
        get_both_responses = data.get("get_both_responses", False)

        if not question or not session_id:
            logger.error("請求缺少必要參數")
            return jsonify({"status": "error", "message": "缺少必要參數"}), 400

        logger.info(f"處理問題: {question}, 城市: {city_name}, 會話ID: {session_id}")
        
        # 1. 如需純回答，先獲取純LLM回覆（不帶天氣資訊）
        pure_llm_response = None
        if get_both_responses:
            pure_session_id = f"{session_id}_pure"
            pure_llm_response = await ask_gemini(question, pure_session_id) 
            if "error" in pure_llm_response:
                logger.error(f"純LLM回應錯誤: {pure_llm_response['error']}")
        
        # 2. 獲取天氣資訊
        weather_info = None
        if city_name:
            try:
                english_city_name = extract_city_name(city_name)
                weather_info = await get_weather(english_city_name)
                logger.info(f"獲取到 {city_name} 的天氣資訊: {weather_info}")
            except Exception as e:
                logger.error(f"獲取天氣資訊失敗: {str(e)}")
        
        # 3. 建立增強版提示，加入天氣資訊
        enhanced_question = question
        if weather_info and "error" not in weather_info:
            weather_desc = (
                f"城市：{city_name}，目前天氣：{weather_info['condition']}，"
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
        enhanced_session_id = f"{session_id}_enhanced"
        llm_response = await ask_gemini(enhanced_question, enhanced_session_id)
        
        if "error" in llm_response:
            logger.error(f"LLM回應錯誤: {llm_response['error']}")
            return jsonify({"status": "error", "message": llm_response["error"]}), 500
        
        # 5. 處理增強版回答（添加地點詳情和計算距離）
        try:
            maps_api_working = await check_maps_api_status()
            logger.info(f"Google Maps API 狀態: {'可用' if maps_api_working else '不可用'}")
            
            if maps_api_working:
                try:
                    logger.info("處理LLM回應，添加地點詳情")
                    processed_response = await add_place_details(llm_response, city_name)
                    
                    # 添加天氣資訊到回應（但不調整行程）
                    if weather_info and "error" not in weather_info:
                        processed_response["weather_data"] = [{
                            "location": city_name,
                            "city_name": english_city_name,
                            "weather": weather_info
                        }]
                    
                    response_data = {"status": "success", "data": processed_response}
                    
                    if get_both_responses and pure_llm_response:
                        response_data["pure_llm_response"] = pure_llm_response
                    
                    logger.info("成功處理完整回應")
                    return jsonify(response_data)
                    
                except Exception as e:
                    logger.exception(f"處理回覆時出錯: {str(e)}")
                    response_data = {"status": "success", "data": llm_response, "warning": "Google Maps 資訊不可用"}
                    
                    if get_both_responses and pure_llm_response:
                        response_data["pure_llm_response"] = pure_llm_response
                        
                    return jsonify(response_data)
            else:
                logger.warning("Google Maps API 不可用，使用降級策略")
                response_data = {
                    "status": "success",
                    "data": llm_response,
                    "warning": "Google Maps 服務暫時不可用，顯示基本行程"
                }
                
                if get_both_responses and pure_llm_response:
                    response_data["pure_llm_response"] = pure_llm_response
                    
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

@app.route('/test', methods=['GET'])
async def test():
    """檢查後端是否運行正常"""
    return jsonify({"status": "success", "message": "後端服務器正常運行"})

@app.route('/place', methods=['GET'])
async def get_place():
    """處理地點查詢請求"""
    try:
        query = request.args.get('query')
        if not query:
            return jsonify({"status": "error", "message": "請提供查詢關鍵詞"}), 400
            
        place_details = await get_place_details_async(query)
        
        if "error" in place_details:
            return jsonify({"status": "error", "message": place_details["error"]}), 400
            
        return jsonify({"status": "success", "data": place_details})
    except Exception as e:
        logger.error(f"處理地點查詢出錯: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/route', methods=['GET'])
async def calculate_route():
    """處理路線計算請求"""
    try:
        origin = request.args.get('origin')
        destination = request.args.get('destination')
        
        if not origin or not destination:
            return jsonify({"status": "error", "message": "請提供起點和終點"}), 400
            
        route_info = calculate_route_distance_and_time(origin, destination)
        
        if "error" in route_info:
            return jsonify({"status": "error", "message": route_info["error"]}), 400
            
        return jsonify({"status": "success", "data": route_info})
    except Exception as e:
        logger.error(f"計算路線出錯: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

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
        return {"error": "未設置 Google Maps API Key"}
        
    # 檢查緩存
    cache_key = f"{origin}_{destination}"
    if cache_key in route_cache:
        return route_cache[cache_key]
        
    try:
        # Routes API
        routes_url = "https://maps.googleapis.com/maps/api/directions/json"
        routes_params = {
            "origin": origin,
            "destination": destination,
            "language": "zh-TW",
            "key": GOOGLE_MAPS_API_KEY
        }

        routes_response = requests.get(routes_url, params=routes_params, timeout=REQUEST_TIMEOUT)
        routes_data = routes_response.json()

        if routes_data.get("status") != "OK":
            return {"error": f"路線計算錯誤: {routes_data.get('status')}"}

        # 獲取距離和時間
        route = routes_data["routes"][0]["legs"][0]
        route_info = {
            "distance": route["distance"]["text"],
            "duration": route["duration"]["text"]
        }
        
        # 存入緩存
        route_cache[cache_key] = route_info
        return route_info

    except Exception as e:
        logger.error(f"計算路線錯誤: {origin} -> {destination}, {str(e)}")
        return {"error": str(e)}

def extract_numeric_value(value, units):
    """從帶有單位的字符串中提取數值"""
    for unit in units:
        if unit in value:
            try:
                cleaned_value = value.replace(unit, "").replace(",", "").strip()
                return float(cleaned_value)
            except ValueError:
                return 0.0
    return 0.0

async def process_llm_response(llm_response, city_name=None):
    """處理LLM回覆，添加天氣資訊和地點詳情，不處理室內外活動調整"""
    try:
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
        
        # 計算行程距離和時間
        locations = [section.get("location") for section in valid_sections if section.get("location")]
        total_distance = 0.0
        total_duration = 0.0
        
        for i in range(len(locations) - 1):
            route_info = calculate_route_distance_and_time(locations[i], locations[i + 1])
            
            if "error" not in route_info:
                total_distance += extract_numeric_value(route_info["distance"], [" 公里", " km"])
                total_duration += extract_numeric_value(route_info["duration"], [" 分鐘", " 小時", " mins", " hours"])

        llm_response["total_distance"] = f"{total_distance:.1f} 公里"
        llm_response["total_duration"] = f"{int(total_duration)} 分鐘"
        
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

async def add_place_details(llm_response, city_name=None):
    """僅添加地點詳情和路線資訊，不修改行程結構"""
    try:
        # 檢查 llm_response 格式
        if not isinstance(llm_response, dict):
            logger.error(f"LLM 回應格式錯誤，預期字典但收到 {type(llm_response)}")
            if isinstance(llm_response, list) and llm_response:
                llm_response = llm_response[0]  # 取第一個元素
                logger.info("已將列表格式轉換為字典格式")
            else:
                return llm_response  # 如果無法修復，直接返回
        
        # 檢查 sections 結構
        sections = llm_response.get("sections", [])
        if not sections:
            return llm_response
        
        # 處理地點詳情
        async def process_location(section):
            if not isinstance(section, dict):
                return section
                
            location = section.get("location", "")
            if location and city_name:
                place_details = await get_place_details_async(f"{city_name} {location}")
                
                if "error" not in place_details:
                    section["rating"] = place_details.get("rating", "無評分")
                    section["user_ratings_total"] = place_details.get("user_ratings_total", 0)
                    section["address"] = place_details.get("address", "無地址")
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
        
        # 計算行程距離和時間
        locations = [section.get("location") for section in sections if section.get("location")]
        
        if city_name:
            locations = [f"{city_name} {loc}" if not loc.startswith(city_name) else loc for loc in locations]
            
        total_distance = 0.0
        total_duration = 0.0
        
        for i in range(len(locations) - 1):
            route_info = calculate_route_distance_and_time(locations[i], locations[i + 1])
            
            if "error" not in route_info:
                total_distance += extract_numeric_value(route_info["distance"], [" 公里", " km"])
                total_duration += extract_numeric_value(route_info["duration"], [" 分鐘", " 小時", " mins", " hours"])

        llm_response["total_distance"] = f"{total_distance:.1f} 公里"
        llm_response["total_duration"] = f"{int(total_duration)} 分鐘"
        
        return llm_response

    except Exception as e:
        logger.exception(f"添加地點詳情時出錯：{str(e)}")
        return llm_response  # 如果處理失敗，返回原始回應

if __name__ == '__main__':
    logger.info("啟動後端服務器...")
    app.run(debug=True, port=5000, host='0.0.0.0')
