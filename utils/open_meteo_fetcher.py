import numpy as np
import xarray as xr
import pandas as pd
import urllib.request
import json
import os
import time

def fetch_open_meteo_grid(start_year=1990, end_year=2024, res=20.0):
    """
    Fetches real climate data from Open-Meteo for a global grid.
    Aggregates daily data to monthly.
    """
    lats = np.arange(-90, 91, res)
    lons = np.arange(-180, 181, res)
    
    # Using 1-year windows to keep responses small and avoid timeouts/400s
    start_date = f"{start_year}-01-01"
    end_date = f"{end_year}-12-31"
    
    print(f"Fetching Open-Meteo Daily data ({start_year}-{end_year}) at {res} deg resolution...")
    print(f"Grid size: {len(lats)}x{len(lons)} = {len(lats)*len(lons)} points")

    all_coords = [(lat, lon) for lat in lats for lon in lons]
    batch_size = 5
    results_temp = []

    for i in range(0, len(all_coords), batch_size):
        batch = all_coords[i:i + batch_size]
        batch_lats = ",".join([f"{c[0]:.4f}" for c in batch])
        batch_lons = ",".join([f"{c[1]:.4f}" for c in batch])
        
        url = (
            f"https://climate-api.open-meteo.com/v1/climate?"
            f"latitude={batch_lats}&longitude={batch_lons}&"
            f"start_date={start_date}&end_date={end_date}&"
            f"models=EC_Earth3P_HR&"
            f"daily=temperature_2m_mean"
        )
        
        success = False
        retries = 0
        while not success and retries < 3:
            try:
                with urllib.request.urlopen(url) as response:
                    data = json.loads(response.read().decode())
                    if isinstance(data, dict) and "daily" in data: data = [data]
                    
                    for entry in data:
                        # Resample daily to monthly
                        df = pd.DataFrame({"temp": entry["daily"]["temperature_2m_mean"]}, 
                                          index=pd.to_datetime(entry["daily"]["time"]))
                        monthly = df.resample("MS").mean()["temp"].tolist()
                        results_temp.append(monthly)
                    
                    success = True
                    print(f"Batch {i//batch_size + 1} success...")
            except Exception as e:
                retries += 1
                wait_time = 10 * retries
                print(f"Error at batch {i} (Retry {retries}/3): {e}. Waiting {wait_time}s...")
                time.sleep(wait_time)
        
        if not success:
            print(f"Giving up on batch {i}. Filling with NaNs.")
            for _ in range(len(batch)): results_temp.append([np.nan] * 420)
            
        time.sleep(1.5) # Constant delay to respect rate limit

    n_months = len(results_temp[0]) if results_temp else 0
    if n_months == 0: return None

    time_idx = pd.date_range(start=f"{start_year}-01-01", periods=n_months, freq='MS')
    temp_array = np.array(results_temp).reshape(len(lats), len(lons), n_months)
    temp_array = np.transpose(temp_array, (2, 0, 1))

    ds = xr.Dataset({
        'temperature': xr.DataArray(
            temp_array,
            dims=['time', 'lat', 'lon'],
            coords={'time': time_idx, 'lat': lats, 'lon': lons},
            attrs={'units': '°C', 'long_name': 'Mean Surface Temperature'}
        )
    })
    return ds

if __name__ == "__main__":
    os.makedirs("data", exist_ok=True)
    ds = fetch_open_meteo_grid(res=20.0) # 20 deg for success
    if ds:
        ds.to_netcdf("data/open_meteo_1990_2024.nc")
        print("Successfully saved data/open_meteo_1990_2024.nc")
