"""
共用工具函數模塊 - 供 Vercel Serverless Functions 使用
"""
import os
import requests
import json
from datetime import datetime, timedelta
import urllib3
import math

# 禁用 SSL 警告
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# API Keys
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
GOOGLE_MAPS_API_KEY = os.getenv('GOOGLE_MAPS_API_KEY')
CWA_AUTH = os.getenv('CWA_API_KEY', 'CWA-F3FCE1AF-CFF8-4531-86AD-379B18FE38A2')

# 城市名稱到資料集 ID 的映射
CITY_MAPPING = {
    "台北": "F-D0047-061", "台中": "F-D0047-071", "台南": "F-D0047-075",
    "高雄": "F-D0047-063", "新北": "F-D0047-069", "桃園": "F-D0047-007",
    "新竹": "F-D0047-053", "苗栗": "F-D0047-035", "彰化": "F-D0047-017",
    "南投": "F-D0047-047", "雲林": "F-D0047-081", "嘉義": "F-D0047-011",
    "屏東": "F-D0047-029", "宜蘭": "F-D0047-003", "花蓮": "F-D0047-021",
    "台東": "F-D0047-025", "澎湖": "F-D0047-039", "金門": "F-D0047-033",
    "連江": "F-D0047-073", "基隆": "F-D0047-051",
}

def get_weather_sync(city_name, date=None):
    """同步獲取天氣資訊"""
    try:
        dataset_id = CITY_MAPPING.get(city_name, "F-D0047-063")
        url = f"https://opendata.cwa.gov.tw/api/v1/rest/datastore/{dataset_id}?Authorization={CWA_AUTH}&format=JSON"
        
        response = requests.get(url, verify=False, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        if data.get('success') != 'true':
            return {"error": "獲取天氣資料失敗"}
        
        if date is None:
            return get_current_weather_from_forecast(data)
        else:
            return get_weather_for_date(data, date)
    
    except Exception as e:
        return {"error": f"獲取天氣資訊時發生錯誤: {str(e)}"}

def get_current_weather_from_forecast(data):
    """從預報數據中獲取當前天氣"""
    try:
        location = data['records']['locations'][0]['location'][0]
        weather_elements = location['weatherElement']
        
        weather_info = {
            'condition': '無資料', 'temperature': '無資料', 'max_temp': '無資料',
            'min_temp': '無資料', 'feels_like': '無資料', 'humidity': '無資料',
            'rain_probability': '無資料', 'wind_speed': '無資料',
            'wind_direction': '無資料', 'uv_index': '無資料', 'icon': '☀️'
        }
        
        for element in weather_elements:
            element_name = element['elementName']
            time_data = element['time'][0] if element['time'] else {}
            element_values = time_data.get('elementValue', [])
            
            if not element_values:
                continue
            
            value_obj = element_values[0]
            
            if element_name == 'Wx':
                value = value_obj.get('value', '')
                weather_info['condition'] = value if value else '無資料'
            elif element_name in ['T', 'AT']:
                value = value_obj.get('value', '')
                weather_info['temperature'] = round(float(value)) if value and value != '-' else '無資料'
            elif element_name == 'MaxT':
                value = value_obj.get('value', '')
                weather_info['max_temp'] = round(float(value)) if value and value != '-' else '無資料'
            elif element_name == 'MinT':
                value = value_obj.get('value', '')
                weather_info['min_temp'] = round(float(value)) if value and value != '-' else '無資料'
            elif element_name in ['MaxAT', 'MinAT']:
                value = value_obj.get('value', '')
                if 'feels_like' not in weather_info or weather_info['feels_like'] == '無資料':
                    weather_info['feels_like'] = round(float(value)) if value and value != '-' else '無資料'
            elif element_name == 'RH':
                value = value_obj.get('value', '')
                weather_info['humidity'] = int(float(value)) if value and value != '-' else '無資料'
            elif element_name == 'PoP6h':
                value = value_obj.get('value', '')
                weather_info['rain_probability'] = int(float(value)) if value and value != '-' else '無資料'
            elif element_name == 'UVI':
                value = value_obj.get('value', '')
                weather_info['uv_index'] = round(float(value), 1) if value and value != '-' else '無資料'
        
        # 設置圖標
        condition = weather_info['condition']
        if '晴' in condition:
            weather_info['icon'] = '☀️'
        elif '雨' in condition:
            weather_info['icon'] = '🌧️'
        elif '雲' in condition or '陰' in condition:
            weather_info['icon'] = '☁️'
        elif '雷' in condition:
            weather_info['icon'] = '⛈️'
        
        return weather_info
    
    except Exception as e:
        return {"error": f"解析天氣資料失敗: {str(e)}"}

def get_weather_for_date(data, date_str):
    """獲取指定日期的天氣"""
    try:
        target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        location = data['records']['locations'][0]['location'][0]
        weather_elements = location['weatherElement']
        
        temps, max_temps, min_temps, conditions, humidities, rain_probs = [], [], [], [], [], []
        uv_indices, wind_speeds, wind_directions = [], [], []
        
        for element in weather_elements:
            element_name = element['elementName']
            time_slots = element.get('Time', [])
            
            for slot in time_slots:
                start_time_str = slot.get('StartTime', '')
                if not start_time_str:
                    continue
                
                start_time = datetime.fromisoformat(start_time_str.replace('Z', '+00:00'))
                slot_date = start_time.date()
                
                if slot_date == target_date:
                    element_values = slot.get('ElementValue', [])
                    if element_values:
                        value_obj = element_values[0]
                        
                        try:
                            if element_name == 'Wx':
                                conditions.append(value_obj.get('Weather', ''))
                            elif element_name in ['T', 'AT']:
                                temps.append(float(value_obj.get('Temperature', 0)))
                            elif element_name == 'MaxT':
                                max_temps.append(float(value_obj.get('MaxTemperature', 0)))
                            elif element_name == 'MinT':
                                min_temps.append(float(value_obj.get('MinTemperature', 0)))
                            elif element_name == 'RH':
                                humidities.append(float(value_obj.get('RelativeHumidity', 0)))
                            elif element_name == 'PoP6h':
                                rain_probs.append(float(value_obj.get('Probability', 0)))
                            elif element_name == 'UVI':
                                uv_indices.append(float(value_obj.get('UVIndex', 0)))
                        except (ValueError, TypeError):
                            continue
        
        if not temps and not max_temps:
            return {"error": f"找不到 {date_str} 的天氣資料"}
        
        avg_temp = round(sum(temps) / len(temps)) if temps else '無資料'
        actual_max_temp = round(max(max_temps)) if max_temps else (round(max(temps)) if temps else '無資料')
        actual_min_temp = round(min(min_temps)) if min_temps else (round(min(temps)) if temps else '無資料')
        main_condition = max(set(conditions), key=conditions.count) if conditions else '無資料'
        avg_humidity = int(sum(humidities) / len(humidities)) if humidities else '無資料'
        avg_rain_probability = int(sum(rain_probs) / len(rain_probs)) if rain_probs else '無資料'
        avg_uv_index = round(sum(uv_indices) / len(uv_indices), 1) if uv_indices else '無資料'
        
        icon = '☀️'
        if '晴' in main_condition:
            icon = '☀️'
        elif '雨' in main_condition:
            icon = '🌧️'
        elif '雲' in main_condition or '陰' in main_condition:
            icon = '☁️'
        elif '雷' in main_condition:
            icon = '⛈️'
        
        return {
            "condition": main_condition,
            "temp": avg_temp,
            "min_temp": actual_min_temp,
            "max_temp": actual_max_temp,
            "humidity": avg_humidity,
            "rain_chance": avg_rain_probability,
            "uv_index": avg_uv_index,
            "icon": icon,
            "date": date_str
        }
    
    except Exception as e:
        return {"error": f"解析天氣預報失敗: {str(e)}"}

def get_multi_day_weather_sync(city_name, dates):
    """獲取多日期的天氣資訊"""
    if not dates:
        return {}
    
    weather_data = {}
    for date in dates:
        try:
            weather = get_weather_sync(city_name, date)
            if "error" not in weather:
                weather_data[date] = weather
        except Exception as e:
            print(f"獲取 {date} 天氣失敗: {str(e)}")
    
    return weather_data


def get_place_details_sync(place_name, location="台灣"):
    """同步獲取 Google Maps 景點詳情"""
    try:
        if not GOOGLE_MAPS_API_KEY:
            return {"error": "Google Maps API Key 未設置"}

        # 使用 Places API 搜尋景點
        search_url = "https://maps.googleapis.com/maps/api/place/findplacefromtext/json"
        search_params = {
            'input': place_name,
            'inputtype': 'textquery',
            'fields': 'place_id,name,rating,user_ratings_total,formatted_address',
            'locationbias': f'region:{location}',
            'key': GOOGLE_MAPS_API_KEY
        }

        search_response = requests.get(search_url, params=search_params, verify=False, timeout=10)
        search_response.raise_for_status()
        search_data = search_response.json()

        if search_data.get('status') != 'OK' or not search_data.get('candidates'):
            return {"error": f"找不到景點: {place_name}"}

        candidate = search_data['candidates'][0]
        place_id = candidate.get('place_id')

        if not place_id:
            return {"error": "無法獲取景點 ID"}

        # 使用 Place Details API 獲取更多資訊
        details_url = "https://maps.googleapis.com/maps/api/place/details/json"
        details_params = {
            'place_id': place_id,
            'fields': 'name,rating,user_ratings_total,formatted_address,geometry,types',
            'key': GOOGLE_MAPS_API_KEY
        }

        details_response = requests.get(details_url, params=details_params, verify=False, timeout=10)
        details_response.raise_for_status()
        details_data = details_response.json()

        if details_data.get('status') != 'OK':
            return {"error": f"獲取景點詳情失敗: {details_data.get('status')}"}

        result = details_data.get('result', {})

        return {
            'name': result.get('name', place_name),
            'rating': result.get('rating', 0),
            'user_ratings_total': result.get('user_ratings_total', 0),
            'address': result.get('formatted_address', ''),
            'location': result.get('geometry', {}).get('location', {}),
            'types': result.get('types', [])
        }

    except Exception as e:
        return {"error": f"獲取景點詳情時發生錯誤: {str(e)}"}


def calculate_route_distance_and_time_sync(origin, destination, mode="driving"):
    """同步計算兩地間的距離和時間"""
    try:
        if not GOOGLE_MAPS_API_KEY:
            return {"error": "Google Maps API Key 未設置"}

        # 使用 Directions API 計算路線
        directions_url = "https://maps.googleapis.com/maps/api/directions/json"
        directions_params = {
            'origin': origin,
            'destination': destination,
            'mode': mode,
            'key': GOOGLE_MAPS_API_KEY,
            'language': 'zh-TW'
        }

        response = requests.get(directions_url, params=directions_params, verify=False, timeout=10)
        response.raise_for_status()
        data = response.json()

        if data.get('status') != 'OK' or not data.get('routes'):
            return {"error": f"無法計算路線: {origin} -> {destination}"}

        route = data['routes'][0]
        leg = route['legs'][0]

        return {
            'distance_text': leg['distance']['text'],
            'distance_value': leg['distance']['value'],  # 公尺
            'duration_text': leg['duration']['text'],
            'duration_value': leg['duration']['value'],  # 秒
            'mode': mode
        }

    except Exception as e:
        return {"error": f"計算路線時發生錯誤: {str(e)}"}

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
                start_hours, start_minutes = map(int, start_str.split(":", 1))
                start_total = start_hours * 60 + start_minutes
            else:
                start_total = 0

            # 解析結束時間
            if ":" in end_str:
                end_hours, end_minutes = map(int, end_str.split(":", 1))
                end_total = end_hours * 60 + end_minutes
            else:
                end_total = start_total + 60  # 默認持續1小時

            return (start_total, end_total)

        # 單一時間點，假設持續1小時
        elif ":" in time_str:
            parts = time_str.split(":")
            if len(parts) >= 2:
                hours, minutes = map(int, parts[:2])
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


def is_location_specific(location):
    """檢查地點名稱是否足夠具體"""
    if not location or not isinstance(location, str):
        return False

    location = location.strip()

    # 太過籠統的地點名稱
    generic_locations = [
        "台灣", "台北", "台中", "台南", "高雄", "新北", "桃園", "新竹",
        "苗栗", "彰化", "南投", "雲林", "嘉義", "屏東", "宜蘭", "花蓮",
        "台東", "澎湖", "金門", "連江", "基隆", "台灣各地", "全台",
        "北部", "中部", "南部", "東部", "離島", "城市", "鄉村",
        "山區", "海邊", "郊區", "市區", "鄉鎮", "村莊"
    ]

    # 如果是籠統的地點名稱，返回False
    if location.lower() in [loc.lower() for loc in generic_locations]:
        return False

    # 如果長度太短（少於2個字），可能是籠統名稱
    if len(location) < 2:
        return False

    # 如果包含「附近」、「周邊」、「一帶」等模糊詞彙
    fuzzy_words = ["附近", "周邊", "一帶", "地區", "區域", "地方", "景點"]
    if any(word in location for word in fuzzy_words):
        return False

    return True


def extract_city_name(city_name):
    """從城市名稱提取對應的英文城市名稱，用於天氣API"""
    city_mapping = {
        "台北": "Taipei", "新北": "New Taipei", "桃園": "Taoyuan",
        "台中": "Taichung", "台南": "Tainan", "高雄": "Kaohsiung",
        "基隆": "Keelung", "新竹": "Hsinchu", "苗栗": "Miaoli",
        "彰化": "Changhua", "南投": "Nantou", "雲林": "Yunlin",
        "嘉義": "Chiayi", "屏東": "Pingtung", "宜蘭": "Yilan",
        "花蓮": "Hualien", "台東": "Taitung", "澎湖": "Penghu",
        "金門": "Kinmen", "連江": "Lienchiang"
    }

    # 直接匹配
    if city_name in city_mapping:
        return city_mapping[city_name]

    # 模糊匹配（包含關係）
    for key, value in city_mapping.items():
        if key in city_name:
            return value

    # 預設返回Taipei
    return "Taipei"
