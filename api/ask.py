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

# 添加 api 目錄到 Python 路徑
sys.path.insert(0, os.path.dirname(__file__))

import google.generativeai as genai
from _utils import get_weather_sync, get_multi_day_weather_sync

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
    def do_POST(self):
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
            self.send_sse_event('weather', {'status': 'fetching'})
            weather_data = get_multi_day_weather_sync(location, trip_dates)
            self.send_sse_event('weather', {'status': 'complete', 'data': weather_data})
            
            # 構建 Gemini 提示詞
            prompt = self.build_prompt(question, location, trip_days, trip_dates, weather_data)
            
            # 使用 Gemini 串流生成
            self.send_sse_event('generation', {'status': 'starting'})
            self.stream_gemini_response(prompt)
            
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
    
    def stream_gemini_response(self, prompt):
        """使用 Gemini 串流 API 生成回應"""
        try:
            model = genai.GenerativeModel(
                model_name="gemini-2.0-flash-exp",
                generation_config=generation_config,
                safety_settings=safety_settings
            )
            
            # 啟用串流模式
            response = model.generate_content(prompt, stream=True)
            
            # 逐塊發送生成的文字
            for chunk in response:
                if chunk.text:
                    self.send_sse_event('chunk', {'text': chunk.text})
        
        except Exception as e:
            self.send_sse_event('error', {'message': f"Gemini API Error: {str(e)}"})
    
    def build_prompt(self, question, location, days, dates, weather_data):
        """構建 Gemini 提示詞"""
        prompt = f"""你是一位專業的旅遊規劃助手。請幫用戶規劃一個詳細的旅遊行程。

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
        
        prompt += """請提供：
1. **行程標題**：吸引人的標題
2. **每日行程**：
   - 時間：具體時間點 (例如：09:00)
   - 地點：景點名稱
   - 活動：詳細描述要做什麼
   - 地址：景點地址
   - 評分：預估評分 (1-5)
3. **推薦指數**：整體行程評分 (1-5)
4. **遊玩時間**：總遊玩時間
5. **交通占比**：交通時間占比

請用 JSON 格式回覆，結構如下：
```json
{
  "title": "行程標題",
  "recommendation_score": 4.5,
  "playing_time_display": "8小時",
  "travel_ratio_display": "20%",
  "sections": [
    {
      "day": 1,
      "time": "09:00",
      "location": "景點名稱",
      "details": ["活動1", "活動2"],
      "address": "景點地址",
      "rating": 4.5
    }
  ]
}
```

請開始規劃："""
        
        return prompt
    
    def do_OPTIONS(self):
        """處理 CORS 預檢請求"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
