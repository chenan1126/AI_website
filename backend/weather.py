import os
import requests
import asyncio
import json

async def get_weather(city_name):
    """異步獲取天氣資訊，直接使用城市名稱而非經緯度"""
    api_key = os.getenv('OPENWEATHERMAP_API_KEY')
    if not api_key:
        raise ValueError("未設置 OpenWeatherMap API Key")

    try:
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
        
    except requests.exceptions.RequestException as e:
        print(f"API 請求錯誤: {str(e)}")
        return {"error": f"天氣 API 請求失敗: {str(e)}"}
    except KeyError as e:
        print(f"解析天氣資料錯誤: {str(e)}")
        return {"error": f"獲取天氣資訊失敗: {str(e)}"}
    except Exception as e:
        print(f"獲取天氣資訊時發生未知錯誤: {str(e)}")
        return {"error": f"獲取天氣資訊失敗: {str(e)}"}