"""
共用工具函數模塊 - 供 Vercel Serverless Functions 使用
"""
import os
import requests
import json
from datetime import datetime, timedelta
import urllib3

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
