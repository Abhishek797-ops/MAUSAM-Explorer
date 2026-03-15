import json
import urllib.request
import time
import os

ANCHORS = [
    {"name": "London", "lat": 51.5074, "lon": -0.1278},
    {"name": "New York", "lat": 40.7128, "lon": -74.0060},
    {"name": "Tokyo", "lat": 35.6895, "lon": 139.6917},
    {"name": "Sydney", "lat": -33.8688, "lon": 151.2093},
    {"name": "Rio", "lat": -22.9068, "lon": -43.1729},
    {"name": "Cairo", "lat": 30.0444, "lon": 31.2357},
    {"name": "Moscow", "lat": 55.7558, "lon": 37.6173},
    {"name": "Mumbai", "lat": 19.0760, "lon": 72.8777},
    {"name": "Beijing", "lat": 39.9042, "lon": 116.4074},
    {"name": "Nairobi", "lat": -1.2921, "lon": 36.8219}
]

def fetch_anchors():
    base_url = "https://climate-api.open-meteo.com/v1/climate"
    lats = ",".join([str(a["lat"]) for a in ANCHORS])
    lons = ",".join([str(a["lon"]) for a in ANCHORS])
    
    url = (
        f"{base_url}?latitude={lats}&longitude={lons}&"
        f"start_date=1990-01-01&end_date=2024-12-31&"
        f"models=EC_Earth3P_HR&"
        f"daily=temperature_2m_mean"
    )
    
    print(f"Fetching 10 Anchor Cities from Open-Meteo...")
    try:
        with urllib.request.urlopen(url) as resp:
            data = json.loads(resp.read().decode())
            if isinstance(data, dict): data = [data]
            
            output = {}
            for i, entry in enumerate(data):
                city_name = ANCHORS[i]["name"]
                # Convert daily to monthly averages
                # Groups of ~30/31 days
                # For simplicity, we'll just slice the 420 months (1990-2024)
                # But to be precise, we should use date logic
                import pandas as pd
                df = pd.DataFrame({"temp": entry["daily"]["temperature_2m_mean"]}, 
                                  index=pd.to_datetime(entry["daily"]["time"]))
                monthly = df.resample("MS").mean()["temp"].tolist()
                output[city_name] = {
                    "lat": ANCHORS[i]["lat"],
                    "lon": ANCHORS[i]["lon"],
                    "temps": monthly
                }
            
            os.makedirs("data", exist_ok=True)
            with open("data/anchors.json", "w") as f:
                json.dump(output, f)
            print("Successfully saved data/anchors.json")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    fetch_anchors()
