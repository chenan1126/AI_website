import os
import requests
import asyncio
import json
from datetime import datetime, timedelta

async def get_weather(city_name, date=None):
    """異步獲取天氣資訊，直接使用城市名稱而非經緯度"""
    api_key = os.getenv('OPENWEATHERMAP_API_KEY')
    if not api_key:
        raise ValueError("未設置 OpenWeatherMap API Key")

    try:
        # 如果沒有指定日期，獲取當前天氣
        if date is None:
            return await get_current_weather(city_name)

        # 如果指定了日期，獲取該日期的天氣預報
        return await get_weather_for_date(city_name, date)

    except Exception as e:
        print(f"獲取天氣資訊時發生錯誤: {str(e)}")
        return {"error": f"獲取天氣資訊失敗: {str(e)}"}

async def get_current_weather(city_name):
    """獲取當前天氣資訊"""
    api_key = os.getenv('OPENWEATHERMAP_API_KEY')

    # 直接使用城市名稱獲取當前天氣
    current_url = f"http://api.openweathermap.org/data/2.5/weather?q={city_name},tw&appid={api_key}&lang=zh_tw&units=metric"
    current_response = await asyncio.to_thread(requests.get, current_url)
    current_response.raise_for_status()
    current_data = current_response.json()

    # 獲取預報資訊 (包含降雨機率)
    forecast_url = f"http://api.openweathermap.org/data/2.5/forecast?q={city_name},tw&appid={api_key}&lang=zh_tw&units=metric"
    forecast_response = await asyncio.to_thread(requests.get, forecast_url)
    forecast_response.raise_for_status()
    forecast_data = forecast_response.json()

    # 提取當前天氣資訊
    weather_description = current_data['weather'][0]['description']
    temperature = round(current_data['main']['temp'])
    feels_like = round(current_data['main']['feels_like'])
    humidity = current_data['main']['humidity']

    # 從預報中提取今天的資料 (未來24小時)
    current_timestamp = current_data['dt']
    today_forecasts = [f for f in forecast_data['list'] if f['dt'] <= current_timestamp + 24*3600]

    if today_forecasts:
        # 從預報中計算今天的最高溫和最低溫
        day_temps = [forecast['main']['temp'] for forecast in today_forecasts]
        min_temp = round(min(day_temps))
        max_temp = round(max(day_temps))

        # 從預報中提取降雨機率
        rain_probs = [f.get('pop', 0) * 100 for f in today_forecasts if 'pop' in f]
        avg_rain_probability = int(sum(rain_probs) / len(rain_probs)) if rain_probs else 0
    else:
        # 如果沒有預報資料，則使用當前天氣的數值
        min_temp = round(current_data['main']['temp_min'])
        max_temp = round(current_data['main']['temp_max'])
        avg_rain_probability = 0

    # 構建返回的天氣資訊字典
    weather_info = {
        "condition": weather_description,
        "temperature": temperature,
        "feels_like": feels_like,
        "min_temp": min_temp,
        "max_temp": max_temp,
        "humidity": humidity,
        "rain_probability": avg_rain_probability,
        "wind_speed": current_data.get('wind', {}).get('speed', 0),
    }

    return weather_info

async def get_weather_for_date(city_name, date_str):
    """獲取指定日期的天氣預報"""
    api_key = os.getenv('OPENWEATHERMAP_API_KEY')

    try:
        # 解析日期
        target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        today = datetime.now().date()

        # 獲取預報資訊
        forecast_url = f"http://api.openweathermap.org/data/2.5/forecast?q={city_name},tw&appid={api_key}&lang=zh_tw&units=metric"
        forecast_response = await asyncio.to_thread(requests.get, forecast_url)
        forecast_response.raise_for_status()
        forecast_data = forecast_response.json()

        # 過濾指定日期的預報
        target_forecasts = []
        current_timestamp = datetime.now().timestamp()
        
        for forecast in forecast_data['list']:
            forecast_date = datetime.fromtimestamp(forecast['dt']).date()
            if target_date == today:
                # 如果是今天，獲取從現在開始的未來24小時預報（可能跨越到明天）
                if forecast['dt'] >= current_timestamp and forecast['dt'] <= current_timestamp + 24*3600:
                    target_forecasts.append(forecast)
            else:
                # 如果是未來日期，獲取該日期的所有預報
                if forecast_date == target_date:
                    target_forecasts.append(forecast)

        if not target_forecasts:
            return {"error": f"找不到 {date_str} 的天氣預報資料"}

        # 計算該日的天氣統計
        temps = [f['main']['temp'] for f in target_forecasts]
        min_temp = round(min(temps))
        max_temp = round(max(temps))
        avg_temp = round(sum(temps) / len(temps))

        # 獲取主要天氣狀況（取最常出現的）
        conditions = [f['weather'][0]['description'] for f in target_forecasts]
        main_condition = max(set(conditions), key=conditions.count)

        # 計算平均降雨機率
        rain_probs = [f.get('pop', 0) * 100 for f in target_forecasts if 'pop' in f]
        avg_rain_probability = int(sum(rain_probs) / len(rain_probs)) if rain_probs else 0

        # 計算平均濕度
        humidities = [f['main']['humidity'] for f in target_forecasts]
        avg_humidity = int(sum(humidities) / len(humidities))

        return {
            "condition": main_condition,
            "temperature": avg_temp,
            "min_temp": min_temp,
            "max_temp": max_temp,
            "humidity": avg_humidity,
            "rain_probability": avg_rain_probability,
            "date": date_str
        }

    except ValueError as e:
        return {"error": f"日期格式錯誤: {str(e)}"}
    except Exception as e:
        return {"error": f"獲取天氣預報失敗: {str(e)}"}

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