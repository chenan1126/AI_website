import os
import requests
import asyncio
import json
from datetime import datetime, timedelta
import urllib3

# 禁用 SSL 警告（因為 CWA API 證書問題）
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# 台灣中央氣象署 API 授權碼
CWA_AUTH = "CWA-F3FCE1AF-CFF8-4531-86AD-379B18FE38A2"

# 城市名稱到資料集 ID 的映射 (使用一週天氣預報,提供完整資訊)
CITY_MAPPING = {
    "台北": "F-D0047-061",  # 台北市 一週天氣預報
    "台中": "F-D0047-071",  # 台中市 一週天氣預報
    "台南": "F-D0047-075",  # 台南市 一週天氣預報
    "高雄": "F-D0047-063",  # 高雄市 一週天氣預報
    "新北": "F-D0047-069",  # 新北市 一週天氣預報
    "桃園": "F-D0047-007",  # 桃園市 一週天氣預報
    "新竹": "F-D0047-053",  # 新竹市 一週天氣預報
    "苗栗": "F-D0047-035",  # 苗栗縣 一週天氣預報
    "彰化": "F-D0047-017",  # 彰化縣 一週天氣預報
    "南投": "F-D0047-047",  # 南投縣 一週天氣預報
    "雲林": "F-D0047-081",  # 雲林縣 一週天氣預報
    "嘉義": "F-D0047-011",  # 嘉義市 一週天氣預報
    "屏東": "F-D0047-029",  # 屏東縣 一週天氣預報
    "宜蘭": "F-D0047-003",  # 宜蘭縣 一週天氣預報
    "花蓮": "F-D0047-021",  # 花蓮縣 一週天氣預報
    "台東": "F-D0047-025",  # 台東縣 一週天氣預報
    "澎湖": "F-D0047-039",  # 澎湖縣 一週天氣預報
    "金門": "F-D0047-033",  # 金門縣 一週天氣預報
    "連江": "F-D0047-073",  # 連江縣 一週天氣預報
    "基隆": "F-D0047-051",  # 基隆市 一週天氣預報
}

async def get_weather(city_name, date=None):
    """異步獲取天氣資訊，使用台灣中央氣象署 API"""
    try:
        dataset_id = CITY_MAPPING.get(city_name, "F-D0047-063")  # 預設台北市
        
        # 請求天氣預報數據
        url = f"https://opendata.cwa.gov.tw/api/v1/rest/datastore/{dataset_id}?Authorization={CWA_AUTH}&format=JSON"
        # 禁用 SSL 驗證以避免證書問題（僅在開發/部署環境中）
        response = await asyncio.to_thread(requests.get, url, verify=False, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        if data.get('success') != 'true':
            return {"error": "獲取天氣資料失敗"}
        
        # 如果沒有指定日期，獲取最近的預報
        if date is None:
            return await get_current_weather_from_forecast(data)
        
        # 如果指定了日期，獲取該日期的天氣預報
        return await get_weather_for_date_from_forecast(data, date)
        
    except Exception as e:
        print(f"獲取天氣資訊時發生錯誤: {str(e)}")
        return {"error": f"獲取天氣資訊失敗: {str(e)}"}

async def get_current_weather_from_forecast(data):
    """從預報數據中提取最近的天氣資訊"""
    try:
        from datetime import timezone, timedelta
        
        records = data.get('records', {})
        locations = records.get('Locations', [])
        if not locations:
            return {"error": "無天氣資料"}
        
        location_data = locations[0]  # 第一個縣市
        regions = location_data.get('Location', [])
        if not regions:
            return {"error": "無地區資料"}
        
        region = regions[0]  # 第一個地區
        weather_elements = region.get('WeatherElement', [])
        
        # 獲取最新的預報數據 (使用台灣時區 UTC+8)
        tw_tz = timezone(timedelta(hours=8))
        current_time = datetime.now(tw_tz)
        
        # 找到最近的時間段 (支援 '溫度' 或 '平均溫度')
        recent_forecast = None
        for element in weather_elements:
            element_name = element.get('ElementName')
            if element_name in ['溫度', '平均溫度']:
                time_slots = element.get('Time', [])
                for slot in time_slots:
                    start_time_str = slot.get('StartTime', '')
                    end_time_str = slot.get('EndTime', '')
                    if start_time_str and end_time_str:
                        start_time = datetime.fromisoformat(start_time_str.replace('Z', '+00:00'))
                        end_time = datetime.fromisoformat(end_time_str.replace('Z', '+00:00'))
                        if start_time <= current_time <= end_time:
                            recent_forecast = slot
                            break
                if recent_forecast:
                    break
        
        if not recent_forecast:
            # 如果沒有找到當前時間段，取第一個
            for element in weather_elements:
                element_name = element.get('ElementName')
                if element_name in ['溫度', '平均溫度']:
                    time_slots = element.get('Time', [])
                    if time_slots:
                        recent_forecast = time_slots[0]
                    break
        
        if not recent_forecast:
            return {"error": "無可用天氣資料"}
        
        # 提取天氣資訊
        weather_info = {}
        
        for element in weather_elements:
            element_name = element.get('ElementName')
            time_slots = element.get('Time', [])
            
            # 找到對應的 slot
            slot = None
            if recent_forecast:
                for s in time_slots:
                    if s.get('StartTime') == recent_forecast.get('StartTime'):
                        slot = s
                        break
            
            if not slot and time_slots:
                slot = time_slots[0]
            
            if slot:
                element_values = slot.get('ElementValue', [])
                if element_values:
                    value_obj = element_values[0]
                    
                    # 根據元素名稱提取對應的數值
                    if element_name == '天氣現象':
                        value = value_obj.get('Weather', '')
                    elif element_name == '溫度':
                        value = value_obj.get('Temperature', '')
                    elif element_name == '平均溫度':
                        value = value_obj.get('Temperature', '')
                    elif element_name == '最高溫度':
                        value = value_obj.get('MaxTemperature', '')
                    elif element_name == '最低溫度':
                        value = value_obj.get('MinTemperature', '')
                    elif element_name == '最高體感溫度':
                        value = value_obj.get('MaxApparentTemperature', '')
                    elif element_name == '最低體感溫度':
                        value = value_obj.get('MinApparentTemperature', '')
                    elif element_name == '相對濕度':
                        value = value_obj.get('RelativeHumidity', '')
                    elif element_name == '平均相對濕度':
                        value = value_obj.get('RelativeHumidity', '')
                    elif element_name == '3小時降雨機率':
                        value = value_obj.get('ProbabilityOfPrecipitation', '')
                    elif element_name == '12小時降雨機率':
                        value = value_obj.get('ProbabilityOfPrecipitation', '')
                    elif element_name == '風速':
                        value = value_obj.get('WindSpeed', '')
                    elif element_name == '風向':
                        value = value_obj.get('WindDirection', '')
                    elif element_name == '紫外線指數':
                        value = value_obj.get('UVIndex', '')
                    elif element_name == '天氣預報綜合描述':
                        value = value_obj.get('WeatherDescription', '')
                    elif element_name == '最大舒適度指數':
                        value = value_obj.get('ComfortIndexDescription', '')
                    elif element_name == '最小舒適度指數':
                        value = value_obj.get('ComfortIndexDescription', '')
                    else:
                        value = value_obj.get('value', '')  # 預設值
                    
                    # 設置天氣資訊
                    if element_name == '天氣現象':
                        weather_info['condition'] = value if value else '無資料'
                    elif element_name == '溫度' or element_name == '平均溫度':
                        weather_info['temperature'] = round(float(value)) if value and value != '-' else '無資料'
                    elif element_name == '最高溫度':
                        weather_info['max_temp'] = round(float(value)) if value and value != '-' else '無資料'
                    elif element_name == '最低溫度':
                        weather_info['min_temp'] = round(float(value)) if value and value != '-' else '無資料'
                    elif element_name == '最高體感溫度' or element_name == '最低體感溫度':
                        if 'feels_like' not in weather_info or weather_info['feels_like'] == '無資料':
                            weather_info['feels_like'] = round(float(value)) if value and value != '-' else '無資料'
                    elif element_name == '相對濕度' or element_name == '平均相對濕度':
                        weather_info['humidity'] = int(float(value)) if value and value != '-' else '無資料'
                    elif element_name == '3小時降雨機率' or element_name == '12小時降雨機率':
                        weather_info['rain_probability'] = int(float(value)) if value and value != '-' else '無資料'
                    elif element_name == '風速':
                        weather_info['wind_speed'] = round(float(value), 1) if value and value != '-' else '無資料'
                    elif element_name == '風向':
                        weather_info['wind_direction'] = value if value else '無資料'
                    elif element_name == '紫外線指數':
                        weather_info['uv_index'] = round(float(value), 1) if value and value != '-' else '無資料'
                    elif element_name == '天氣預報綜合描述':
                        weather_info['description'] = value if value else '無資料'
                    elif element_name == '最大舒適度指數' or element_name == '最小舒適度指數':
                        if 'comfort' not in weather_info or weather_info['comfort'] == '無資料':
                            weather_info['comfort'] = value if value else '無資料'
        
        # 設置預設值
        weather_info.setdefault('condition', '無資料')
        weather_info.setdefault('temperature', '無資料')
        weather_info.setdefault('feels_like', '無資料')
        weather_info.setdefault('humidity', '無資料')
        weather_info.setdefault('rain_probability', '無資料')
        weather_info.setdefault('wind_speed', '無資料')
        weather_info.setdefault('wind_direction', '無資料')
        weather_info.setdefault('description', '無資料')
        weather_info.setdefault('comfort', '無資料')
        weather_info.setdefault('min_temp', '無資料')
        weather_info.setdefault('max_temp', '無資料')
        weather_info.setdefault('uv_index', '無資料')
        
        # 添加 icon
        condition = weather_info['condition']
        if '晴' in condition:
            weather_info['icon'] = '☀️'
        elif '雨' in condition:
            weather_info['icon'] = '🌧️'
        elif '雲' in condition or '陰' in condition:
            weather_info['icon'] = '☁️'
        elif '雷' in condition:
            weather_info['icon'] = '⛈️'
        elif '雪' in condition:
            weather_info['icon'] = '❄️'
        else:
            weather_info['icon'] = '☀️'
        
        # 重新命名鍵以匹配前端期望
        weather_info['temp'] = weather_info.pop('temperature')
        weather_info['rain_chance'] = weather_info.pop('rain_probability')
        
        return weather_info
        
    except Exception as e:
        return {"error": f"解析天氣資料失敗: {str(e)}"}

async def get_weather_for_date_from_forecast(data, date_str):
    """從預報數據中提取指定日期的天氣資訊"""
    try:
        target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        
        records = data.get('records', {})
        locations = records.get('Locations', [])
        if not locations:
            return {"error": "無天氣資料"}
        
        location_data = locations[0]  # 第一個縣市
        regions = location_data.get('Location', [])
        if not regions:
            return {"error": "無地區資料"}
        
        region = regions[0]  # 第一個地區
        weather_elements = region.get('WeatherElement', [])
        
        # 收集指定日期的所有時間段數據
        date_weather_data = []
        
        for element in weather_elements:
            element_name = element.get('ElementName')
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
                        
                        # 根據元素名稱提取對應的數值
                        if element_name == '天氣現象':
                            value = value_obj.get('Weather', '')
                        elif element_name == '溫度':
                            value = value_obj.get('Temperature', '')
                        elif element_name == '平均溫度':
                            value = value_obj.get('Temperature', '')
                        elif element_name == '最高溫度':
                            value = value_obj.get('MaxTemperature', '')
                        elif element_name == '最低溫度':
                            value = value_obj.get('MinTemperature', '')
                        elif element_name == '最高體感溫度':
                            value = value_obj.get('MaxApparentTemperature', '')
                        elif element_name == '最低體感溫度':
                            value = value_obj.get('MinApparentTemperature', '')
                        elif element_name == '相對濕度':
                            value = value_obj.get('RelativeHumidity', '')
                        elif element_name == '平均相對濕度':
                            value = value_obj.get('RelativeHumidity', '')
                        elif element_name == '3小時降雨機率':
                            value = value_obj.get('ProbabilityOfPrecipitation', '')
                        elif element_name == '12小時降雨機率':
                            value = value_obj.get('ProbabilityOfPrecipitation', '')
                        elif element_name == '風速':
                            value = value_obj.get('WindSpeed', '')
                        elif element_name == '風向':
                            value = value_obj.get('WindDirection', '')
                        elif element_name == '紫外線指數':
                            value = value_obj.get('UVIndex', '')
                        elif element_name == '天氣預報綜合描述':
                            value = value_obj.get('WeatherDescription', '')
                        elif element_name == '最大舒適度指數':
                            value = value_obj.get('ComfortIndexDescription', '')
                        elif element_name == '最小舒適度指數':
                            value = value_obj.get('ComfortIndexDescription', '')
                        else:
                            value = value_obj.get('value', '')  # 預設值
                        
                        date_weather_data.append({
                            'element': element_name,
                            'value': value,
                            'start_time': start_time
                        })
        
        if not date_weather_data:
            return {"error": f"找不到 {date_str} 的天氣預報資料"}
        
        # 統計該日的數據
        temps = []
        conditions = []
        humidities = []
        rain_probs = []
        max_temps = []
        min_temps = []
        feels_like_temps = []
        descriptions = []
        uv_indices = []
        wind_speeds = []
        wind_directions = []
        comfort_indices = []
        
        for item in date_weather_data:
            if item['value'] and item['value'] != '-':  # 跳過空值和 '-'
                try:
                    if item['element'] == '溫度' or item['element'] == '平均溫度':
                        temps.append(float(item['value']))
                    elif item['element'] == '天氣現象':
                        conditions.append(item['value'])
                    elif item['element'] == '相對濕度' or item['element'] == '平均相對濕度':
                        humidities.append(float(item['value']))
                    elif item['element'] == '3小時降雨機率' or item['element'] == '12小時降雨機率':
                        rain_probs.append(float(item['value']))
                    elif item['element'] == '最高溫度':
                        max_temps.append(float(item['value']))
                    elif item['element'] == '最低溫度':
                        min_temps.append(float(item['value']))
                    elif item['element'] == '最高體感溫度' or item['element'] == '最低體感溫度':
                        feels_like_temps.append(float(item['value']))
                    elif item['element'] == '天氣預報綜合描述':
                        descriptions.append(item['value'])
                    elif item['element'] == '紫外線指數':
                        uv_indices.append(float(item['value']))
                    elif item['element'] == '風速':
                        wind_speeds.append(float(item['value']))
                    elif item['element'] == '風向':
                        wind_directions.append(item['value'])
                    elif item['element'] == '最大舒適度指數' or item['element'] == '最小舒適度指數':
                        comfort_indices.append(item['value'])
                except ValueError:
                    # 跳過無法轉換的數值
                    continue
        
        # 計算統計值
        if temps:
            avg_temp = round(sum(temps) / len(temps))
        else:
            # 如果沒有直接的溫度數據，嘗試從綜合描述中提取
            avg_temp = '無資料'
            for desc in descriptions:
                if desc and '溫度攝氏' in desc:
                    import re
                    temp_match = re.search(r'溫度攝氏(\d+)度', desc)
                    if temp_match:
                        avg_temp = int(temp_match.group(1))
                        break
        
        # 使用實際的最高溫和最低溫數據
        if max_temps:
            actual_max_temp = round(max(max_temps))
        else:
            actual_max_temp = '無資料'
            
        if min_temps:
            actual_min_temp = round(min(min_temps))
        else:
            actual_min_temp = '無資料'
        
        # 體感溫度取平均
        if feels_like_temps:
            avg_feels_like = round(sum(feels_like_temps) / len(feels_like_temps))
        else:
            avg_feels_like = '無資料'
        
        main_condition = max(set(conditions), key=conditions.count) if conditions else '無資料'
        avg_humidity = int(sum(humidities) / len(humidities)) if humidities else '無資料'
        avg_rain_probability = int(sum(rain_probs) / len(rain_probs)) if rain_probs else '無資料'
        main_description = max(set(descriptions), key=descriptions.count) if descriptions else '無資料'
        avg_uv_index = round(sum(uv_indices) / len(uv_indices), 1) if uv_indices else '無資料'
        avg_wind_speed = round(sum(wind_speeds) / len(wind_speeds), 1) if wind_speeds else '無資料'
        main_wind_direction = max(set(wind_directions), key=wind_directions.count) if wind_directions else '無資料'
        main_comfort = max(set(comfort_indices), key=comfort_indices.count) if comfort_indices else '無資料'
        avg_feels_like = round(sum(feels_like_temps) / len(feels_like_temps)) if feels_like_temps else '無資料'
        
        # 添加 icon
        if '晴' in main_condition:
            icon = '☀️'
        elif '雨' in main_condition:
            icon = '🌧️'
        elif '雲' in main_condition or '陰' in main_condition:
            icon = '☁️'
        elif '雷' in main_condition:
            icon = '⛈️'
        elif '雪' in main_condition:
            icon = '❄️'
        else:
            icon = '☀️'
        
        return {
            "condition": main_condition,
            "temp": avg_temp,
            "min_temp": actual_min_temp,
            "max_temp": actual_max_temp,
            "feels_like": avg_feels_like,
            "humidity": avg_humidity,
            "rain_chance": avg_rain_probability,
            "description": main_description,
            "uv_index": avg_uv_index,
            "wind_speed": avg_wind_speed,
            "wind_direction": main_wind_direction,
            "comfort": main_comfort,
            "icon": icon,
            "date": date_str
        }
        
    except ValueError as e:
        return {"error": f"日期格式錯誤: {str(e)}"}
    except Exception as e:
        return {"error": f"解析天氣預報失敗: {str(e)}"}

async def get_multi_day_weather(city_name, dates):
    """獲取多日期的天氣資訊"""
    if not dates:
        return {}

    weather_data = {}
    for date in dates:
        try:
            weather = await get_weather(city_name, date)
            if "error" not in weather:
                weather_data[date] = weather
        except Exception as e:
            print(f"獲取 {date} 天氣失敗: {str(e)}")

    return weather_data