"""
Vercel Serverless Function - 旅遊規劃 API (串流模式)
路徑: /api/ask
使用 Server-Sent Events (SSE) 實現串流響應
"""
from http.server import BaseHTTPRequestHandler
import json
import os
import sys
import re
from datetime import datetime, timedelta
import time

# 添加 api 目錄到 Python 路徑
sys.path.insert(0, os.path.dirname(__file__))

import google.generativeai as genai
from _utils import get_weather_sync, get_multi_day_weather_sync, get_place_details_sync, calculate_route_distance_and_time_sync

# 配置 Gemini API
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
GOOGLE_MAPS_API_KEY = os.getenv('GOOGLE_MAPS_API_KEY')

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

# Gemini 模型配置
generation_config = {
    "temperature": 0.7,
    "top_p": 0.95,
    "top_k": 40,
    "max_output_tokens": 8192,
}

safety_settings = [
    {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
    {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
    {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
    {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
]

def parse_date_from_query(query):
    """從自然語言中解析日期"""
    today = datetime.now().date()
    
    # 檢測「明天」「後天」等
    if "明天" in query or "明日" in query:
        return today + timedelta(days=1)
    elif "後天" in query:
        return today + timedelta(days=2)
    elif "大後天" in query:
        return today + timedelta(days=3)
    elif "今天" in query or "今日" in query:
        return today
    
    # 檢測具體日期 (例如: 10月10日, 10/10, 2025-10-10)
    date_patterns = [
        r'(\d{1,2})月(\d{1,2})[日號]',
        r'(\d{1,2})/(\d{1,2})',
        r'(\d{4})-(\d{1,2})-(\d{1,2})'
    ]
    
    for pattern in date_patterns:
        match = re.search(pattern, query)
        if match:
            try:
                if len(match.groups()) == 3:  # YYYY-MM-DD
                    year, month, day = map(int, match.groups())
                else:  # MM-DD
                    month, day = map(int, match.groups())
                    year = today.year
                    # 如果日期已過，假設是明年
                    if datetime(year, month, day).date() < today:
                        year += 1
                
                return datetime(year, month, day).date()
            except ValueError:
                continue
    
    return None

def calculate_trip_dates(query, num_days):
    """計算旅行日期範圍"""
    start_date = parse_date_from_query(query)
    
    if start_date is None:
        start_date = datetime.now().date() + timedelta(days=1)  # 預設明天
    
    dates = []
    for i in range(num_days):
        date = start_date + timedelta(days=i)
        dates.append(date.strftime('%Y-%m-%d'))
    
    return dates

def extract_city_name(location):
    """從地點名稱中提取城市名"""
    city_mapping = {
        "台北": "台北", "新北": "新北", "桃園": "桃園", "台中": "台中",
        "台南": "台南", "高雄": "高雄", "基隆": "基隆", "新竹": "新竹",
        "苗栗": "苗栗", "彰化": "彰化", "南投": "南投", "雲林": "雲林",
        "嘉義": "嘉義", "屏東": "屏東", "宜蘭": "宜蘭", "花蓮": "花蓮",
        "台東": "台東", "澎湖": "澎湖", "金門": "金門", "連江": "連江"
    }
    
    for city in city_mapping:
        if city in location:
            return city_mapping[city]
    
    return "台北"  # 預設

def parse_trip_days(query):
    """解析旅行天數"""
    day_patterns = [
        (r'(\d+)天', 1),
        (r'一日遊', 1),
        (r'兩天|2天|二日', 2),
        (r'三天|3天|三日', 3),
        (r'四天|4天|四日', 4),
        (r'五天|5天|五日', 5),
    ]
    
    for pattern, days in day_patterns:
        if re.search(pattern, query):
            return days
    
    return 1  # 預設 1 天

class handler(BaseHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        self.start_time = None
        super().__init__(*args, **kwargs)
    
    def check_timeout(self):
        """檢查是否超時"""
        if self.start_time and time.time() - self.start_time > 280:  # 280秒後開始警告
            return True
        return False
    
    def do_POST(self):
        import time
        self.start_time = time.time()
        
        try:
            # 讀取請求數據
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            
            question = data.get('question', '')
            session_id = data.get('session_id', '')
            
            if not question:
                self.send_error(400, "Missing question parameter")
                return
            
            # 設置 SSE 響應頭
            self.send_response(200)
            self.send_header('Content-Type', 'text/event-stream')
            self.send_header('Cache-Control', 'no-cache')
            self.send_header('Connection', 'keep-alive')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('X-Accel-Buffering', 'no')  # 禁用 nginx 緩衝
            self.end_headers()
            
            # 解析查詢
            trip_days = parse_trip_days(question)
            location = extract_city_name(question)
            trip_dates = calculate_trip_dates(question, trip_days)
            
            # 發送解析結果
            self.send_sse_event('parsing', {
                'location': location,
                'days': trip_days,
                'dates': trip_dates
            })
            
            # 獲取天氣資訊
            if self.check_timeout():
                self.send_sse_event('error', {'message': '處理超時：天氣查詢階段'})
                return
            
            self.send_sse_event('weather', {'status': 'fetching'})
            weather_data = get_multi_day_weather_sync(location, trip_dates)
            
            # 將字典格式轉換為數組格式供前端使用
            weather_array = []
            for date in trip_dates:
                if date in weather_data:
                    weather_array.append({
                        'date': date,
                        'weather': weather_data[date]
                    })
            
            self.send_sse_event('weather', {'status': 'complete', 'data': weather_array})
            
            # 構建 Gemini 提示詞
            if self.check_timeout():
                self.send_sse_event('error', {'message': '處理超時：提示詞構建階段'})
                return
                
            prompt = self.build_prompt(question, location, trip_days, trip_dates, weather_data)
            
            # 使用 Gemini 串流生成並累積完整回應
            self.send_sse_event('generation', {'status': 'starting'})
            full_response = self.stream_gemini_response_and_collect(prompt)
            
            # 解析 Gemini 回應
            self.send_sse_event('parsing_response', {'status': 'parsing'})
            try:
                # 嘗試從回應中提取 JSON
                json_start = full_response.find('```json')
                json_end = full_response.find('```', json_start + 1)
                
                if json_start != -1 and json_end != -1:
                    json_content = full_response[json_start + 7:json_end].strip()
                    trip_data = json.loads(json_content)
                    
                    # 查詢 Google Maps 資料
                    if self.check_timeout():
                        self.send_sse_event('error', {'message': '處理超時：Google Maps 查詢階段'})
                        return
                        
                    self.send_sse_event('maps', {'status': 'fetching'})
                    
                    # 添加超時處理
                    import time
                    maps_start_time = time.time()
                    trip_data = self.enrich_with_maps_data(trip_data, location)
                    maps_elapsed = time.time() - maps_start_time
                    
                    self.send_sse_event('maps', {
                        'status': 'completed', 
                        'elapsed_seconds': round(maps_elapsed, 1)
                    })
                    
                    # 發送最終結果
                    self.send_sse_event('result', {'data': trip_data})
                else:
                    raise ValueError("無法找到 JSON 內容")
                    
            except Exception as e:
                self.send_sse_event('error', {'message': f"解析回應失敗: {str(e)}"})
                return
            
            # 發送完成信號
            self.send_sse_event('done', {'status': 'complete'})
            
        except Exception as e:
            error_msg = f"Error: {str(e)}"
            self.send_sse_event('error', {'message': error_msg})
    
    def send_sse_event(self, event_type, data):
        """發送 Server-Sent Event"""
        try:
            message = f"event: {event_type}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"
            self.wfile.write(message.encode('utf-8'))
            self.wfile.flush()
        except Exception as e:
            print(f"Error sending SSE: {e}")
    
    def stream_gemini_response_and_collect(self, prompt):
        """使用 Gemini 串流 API 生成回應並累積完整內容"""
        import time
        start_time = time.time()
        
        try:
            self.send_sse_event('generation', {'status': 'connecting_to_gemini'})
            
            model = genai.GenerativeModel(
                model_name="gemini-1.5-flash",
                generation_config={
                    "temperature": 0.7,
                    "top_p": 0.95,
                    "top_k": 40,
                    "max_output_tokens": 8192,  # 減少 token 限制以加快速度
                },
                safety_settings=safety_settings
            )
            
            self.send_sse_event('generation', {'status': 'sending_prompt'})
            
            # 啟用串流模式
            response = model.generate_content(prompt, stream=True)
            
            self.send_sse_event('generation', {'status': 'receiving_response'})
            
            full_content = ""
            chunk_count = 0
            
            # 逐塊發送生成的文字並累積
            for chunk in response:
                chunk_count += 1
                if chunk.text:
                    full_content += chunk.text
                    # 每10個chunk發送一次進度更新
                    if chunk_count % 10 == 0:
                        elapsed = time.time() - start_time
                        self.send_sse_event('generation', {
                            'status': 'generating', 
                            'chunks': chunk_count, 
                            'elapsed_seconds': round(elapsed, 1)
                        })
                        
                        # 檢查是否超過 250 秒（留一些緩衝時間）
                        if elapsed > 250:
                            self.send_sse_event('error', {'message': '生成時間過長，已取消'})
                            return full_content  # 返回已生成的內容
            
            elapsed = time.time() - start_time
            self.send_sse_event('generation', {
                'status': 'completed', 
                'total_chunks': chunk_count, 
                'total_seconds': round(elapsed, 1)
            })
            
            return full_content
        
        except Exception as e:
            elapsed = time.time() - start_time
            self.send_sse_event('error', {
                'message': f"Gemini API Error after {round(elapsed, 1)}s: {str(e)}"
            })
            return ""
    
    def enrich_with_maps_data(self, trip_data, city_location):
        """使用 Google Maps 資料 enrich 行程資料"""
        try:
            if not trip_data.get('sections'):
                return trip_data
            
            # 收集所有景點名稱
            places = set()
            for section in trip_data['sections']:
                if section.get('location'):
                    places.add(section['location'])
            
            # 查詢每個景點的 Google Maps 資料
            places_data = {}
            for place_name in places:
                try:
                    maps_data = get_place_details_sync(place_name, city_location)
                    if 'error' not in maps_data:
                        places_data[place_name] = maps_data
                    else:
                        print(f"Google Maps 查詢失敗: {place_name} - {maps_data['error']}")
                except Exception as e:
                    print(f"查詢景點 {place_name} 時發生錯誤: {str(e)}")
            
            # 計算相鄰景點間的交通時間和距離
            sections_with_maps = []
            previous_location = None
            
            for section in trip_data['sections']:
                enriched_section = section.copy()
                place_name = section.get('location')
                
                # 添加 Google Maps 資料
                if place_name and place_name in places_data:
                    maps_info = places_data[place_name]
                    enriched_section['maps_data'] = {
                        'rating': maps_info.get('rating', 0),
                        'user_ratings_total': maps_info.get('user_ratings_total', 0),
                        'address': maps_info.get('address', ''),
                        'google_maps_name': maps_info.get('name', place_name)
                    }
                
                # 計算交通時間（除了第一個景點）
                if previous_location and place_name:
                    try:
                        route_data = calculate_route_distance_and_time_sync(previous_location, place_name)
                        if 'error' not in route_data:
                            enriched_section['travel_info'] = {
                                'from': previous_location,
                                'to': place_name,
                                'distance': route_data.get('distance_text', ''),
                                'duration': route_data.get('duration_text', ''),
                                'mode': route_data.get('mode', 'driving')
                            }
                    except Exception as e:
                        print(f"計算交通時間失敗 {previous_location} -> {place_name}: {str(e)}")
                
                sections_with_maps.append(enriched_section)
                previous_location = place_name
            
            trip_data['sections'] = sections_with_maps
            return trip_data
            
        except Exception as e:
            print(f"Enrich maps data 時發生錯誤: {str(e)}")
            return trip_data
    
    def build_prompt(self, question, location, days, dates, weather_data):
        """構建 Gemini 提示詞"""
        prompt = f"""你是一位台灣的專業旅遊行程設計師，擅長針對台灣各地設計詳細的行程規劃。

用戶需求：{question}
目的地：{location}
天數：{days}天
日期：{', '.join(dates)}

"""
        
        # 添加天氣資訊
        if weather_data:
            prompt += "天氣預報：\n"
            for date, weather in weather_data.items():
                if isinstance(weather, dict) and 'error' not in weather:
                    prompt += f"- {date}：{weather.get('condition', '未知')}，"
                    prompt += f"溫度 {weather.get('temp', '?')}°C "
                    prompt += f"({weather.get('min_temp', '?')}-{weather.get('max_temp', '?')}°C)，"
                    prompt += f"降雨機率 {weather.get('rain_chance', '?')}%\n"
            prompt += "\n"
        
        prompt += """請提供簡潔的 JSON 格式行程規劃：

{
  "title": "行程標題",
  "recommendation_score": 4.5,
  "sections": [
    {
      "day": 1,
      "time": "09:00-10:30",
      "location": "具體景點名稱",
      "details": ["活動詳情"]
    }
  ]
}

規則：
- 所有地點必須是真實存在的具體景點
- 不要包含交通時間或休息活動
- 使用繁體中文
- 保持簡潔

請直接輸出 JSON："""
        
        return prompt
        
        return prompt
    
    def do_OPTIONS(self):
        """處理 CORS 預檢請求"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
