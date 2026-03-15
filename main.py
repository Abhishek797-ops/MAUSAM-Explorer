from fastapi import FastAPI, HTTPException, UploadFile, File, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse
from pydantic import BaseModel
import xarray as xr
import pandas as pd
import numpy as np
import os
import shutil
import io
import sys
from dotenv import load_dotenv

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.cm as cm
import matplotlib.colors as colors
import google.generativeai as genai

load_dotenv()

app = FastAPI(
    title="MAUSAM Explorer API",
    description="High-performance climate data API for the React WebGL Frontend",
    default_response_class=ORJSONResponse
)

# Enable CORS for the cloud frontend (Vercel/Netlify) and local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins so Vercel can connect
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global dataset reference
DATASET = None

class InsightRequest(BaseModel):
    variable: str
    lat: float
    lon: float
    times: list[str]
    values: list[float]
    units: str

class LocationItem(BaseModel):
    lat: float
    lon: float
    name: str

class CompareRequest(BaseModel):
    locations: list[LocationItem]
    start_time_index: int = 0
    end_time_index: int = 0

@app.on_event("startup")
async def load_data():
    global DATASET
    print("Loading default demo dataset (1990-2024)...")
    try:
        from utils.data_loader import generate_demo_dataset
        DATASET = generate_demo_dataset()
        print(f"Demo dataset loaded: {list(DATASET.data_vars)} with {dict(DATASET.dims)} dimensions")
    except Exception as e:
        print(f"Error loading demo dataset: {e}")

@app.get("/api/explore")
async def explore_mode():
    """Force-load the built-in 1990-2024 demo dataset for Explore mode."""
    global DATASET
    try:
        from utils.data_loader import generate_demo_dataset
        DATASET = generate_demo_dataset()
        return {"status": "success", "message": "Loaded 1990-2024 climate model", "variables": list(DATASET.data_vars)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/meta")
async def get_metadata():
    """Returns dataset variables and available time indices."""
    if DATASET is None:
        raise HTTPException(status_code=500, detail="Dataset not initialized")
    
    variables = list(DATASET.data_vars.keys())
    
    # Identify time coordinate
    time_key = None
    for k in ["time", "valid_time", "t"]:
        if k in DATASET.coords:
            time_key = k
            break
    if not time_key:
        time_key = list(DATASET.coords)[-1]
    
    times_raw = DATASET.coords[time_key].values
    
    # Convert to string representation safely
    times = []
    for t in times_raw:
        try:
            times.append(t.strftime('%Y-%m-%d %H:%M'))
        except AttributeError:
            times.append(str(t))
    
    return {
        "variables": variables,
        "times": times,
        "total_indices": len(times),
        "time_key": time_key
    }

@app.get("/api/info")
async def get_dataset_info():
    """Returns detailed dataset introspection for the Info Panel."""
    if DATASET is None:
        raise HTTPException(status_code=500, detail="Dataset not initialized")
    
    from utils.data_loader import get_dataset_metadata
    return get_dataset_metadata(DATASET)

from fastapi import UploadFile, File
import shutil

@app.post("/api/upload")
async def upload_dataset(file: UploadFile = File(...)):
    """Uploads an .nc file and re-initializes the global dataset."""
    global DATASET
    if not file.filename.endswith('.nc'):
        raise HTTPException(status_code=400, detail="Only .nc files are supported")
    
    upload_path = f"data/{file.filename}"
    try:
        os.makedirs(os.path.dirname(upload_path), exist_ok=True)
        
        # Close current dataset to release file handles (Windows locks open files)
        if DATASET is not None:
            try:
                DATASET.close()
            except Exception:
                pass
            DATASET = None
        
        # Write in chunks (1MB) for reliable large file handling
        total_bytes = 0
        with open(upload_path, "wb") as buffer:
            while True:
                chunk = await file.read(1024 * 1024)  # 1MB chunks
                if not chunk:
                    break
                # Explicitly cast to bytes to satisfy linter Buffer expectation
                buffer.write(bytes(chunk))
                total_bytes += len(chunk)
        
        print(f"Upload complete: {upload_path} ({total_bytes / (1024*1024):.1f} MB)")
        
        # Reload dataset
        DATASET = xr.open_dataset(upload_path, use_cftime=True)
        print(f"Dataset loaded successfully: {upload_path}")
        return {"status": "success", "filename": file.filename, "size_mb": round(total_bytes / (1024*1024), 1)}
    except Exception as e:
        print(f"Upload/Load Error: {e}")
        # Clean up partial file on failure
        if os.path.exists(upload_path):
            try:
                os.remove(upload_path)
            except:
                pass
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/spatial")
async def get_spatial_data(variable: str, start_time_index: int = 0, end_time_index: int = 0):
    """Returns a highly optimized 1D array of lat, lon, and values for Deck.gl."""
    if DATASET is None:
        raise HTTPException(status_code=500, detail="Dataset not initialized")
    if variable not in DATASET.data_vars:
        raise HTTPException(status_code=400, detail=f"Variable {variable} not found")

    from utils.data_loader import get_coord_keys, get_variable_units, get_variable_long_name
    lat_key, lon_key, time_key = get_coord_keys(DATASET)
    
    # Handle time range by taking the mean across the slice
    if start_time_index == end_time_index:
        data_slice = DATASET[variable].isel(**{time_key: start_time_index})
    else:
        # Ensure correct order
        start = min(start_time_index, end_time_index)
        end = max(start_time_index, end_time_index)
        data_slice = DATASET[variable].isel(**{time_key: slice(start, end + 1)}).mean(dim=time_key, skipna=True)
    
    lats = DATASET.coords[lat_key].values
    lons = DATASET.coords[lon_key].values
    values = data_slice.values

    lon_grid, lat_grid = np.meshgrid(lons, lats)
    
    # Subsample heavily for 60FPS fluid WebGL
    max_points = 15000 
    total_points = lat_grid.size
    if total_points > max_points:
        step = max(1, int(np.sqrt(total_points / max_points)))
        lat_flat = lat_grid[::step, ::step].flatten()
        lon_flat = lon_grid[::step, ::step].flatten()
        val_flat = values[::step, ::step].flatten()
    else:
        lat_flat = lat_grid.flatten()
        lon_flat = lon_grid.flatten()
        val_flat = values.flatten()

    mask = np.isfinite(val_flat)
    lat_flat = lat_flat[mask]
    lon_flat = lon_flat[mask]
    val_flat = val_flat[mask]
    
    # Format directly for Deck.gl JSON
    # We round floats to reduce JSON payload size
    return {
        "meta": {
            "units": get_variable_units(DATASET, variable),
            "long_name": get_variable_long_name(DATASET, variable),
            "min": float(np.min(val_flat)),
            "max": float(np.max(val_flat)),
        },
        "data": [
            {
                "lat": round(float(lat), 2),
                "lon": round(float(lon), 2),
                "value": round(float(val), 3)
            }
            for lat, lon, val in zip(lat_flat, lon_flat, val_flat)
        ]
    }


@app.get("/api/heatmap")
async def get_heatmap(variable: str, start_time_index: int = 0, end_time_index: int = 0):
    """Generates an equirectangular PNG heatmap image for mapping onto the 3D globe."""
    if DATASET is None:
        raise HTTPException(status_code=500, detail="Dataset not initialized")
    if variable not in DATASET.data_vars:
        raise HTTPException(status_code=400, detail=f"Variable {variable} not found")

    import sys
    import os
    venv_site_packages = os.path.join(os.getcwd(), 'venv', 'Lib', 'site-packages')
    if venv_site_packages not in sys.path:
        sys.path.append(venv_site_packages)

    from utils.data_loader import get_coord_keys
    from fastapi.responses import Response
    import matplotlib.cm as cm
    import matplotlib.colors as mcolors
    import matplotlib.pyplot as plt
    import io

    lat_key, lon_key, time_key = get_coord_keys(DATASET)

    # Extract 2D slice or compute mean over range
    if time_key in DATASET.dims:
        if start_time_index == end_time_index:
            data_slice = DATASET[variable].isel(**{time_key: start_time_index}).values
        else:
            start = min(start_time_index, end_time_index)
            end = max(start_time_index, end_time_index)
            data_slice = DATASET[variable].isel(**{time_key: slice(start, end + 1)}).mean(dim=time_key, skipna=True).values
    else:
        data_slice = DATASET[variable].values

    lats = DATASET.coords[lat_key].values
    lons = DATASET.coords[lon_key].values

    # Convert to 2D numpy array
    data = np.array(data_slice, dtype=float)

    # Ensure correct orientation for equirectangular projection
    # 1. Flip lat if it goes from negative to positive (South to North).
    #    Image Y=0 is Top (North). So we want 90 -> -90.
    if lats[0] < lats[-1]:
        data = np.flipud(data)

    # 2. Roll lon if it goes 0 to 360.
    #    Equirectangular texture starts at -180 (X=0) to 180 (X=width).
    if lons.max() > 180:
        shift = len(lons) // 2
        data = np.roll(data, shift, axis=1)

    valid_data = data[np.isfinite(data)]
    if len(valid_data) == 0:
        # Return empty transparent PNG
        img = np.zeros((data.shape[0], data.shape[1], 4), dtype=np.uint8)
        buf = io.BytesIO()
        plt.imsave(buf, img, format='png')
        buf.seek(0)
        return Response(content=buf.getvalue(), media_type="image/png")

    vmin, vmax = valid_data.min(), valid_data.max()
    norm = mcolors.Normalize(vmin=vmin, vmax=vmax)
    colormap = cm.get_cmap('turbo')

    # Apply colormap (returns RGBA floats 0-1)
    rgba = colormap(norm(data))

    # Make NaNs fully transparent, reduce opacity to 50% so continents and boundaries are clearly visible
    nan_mask = np.isnan(data)
    rgba[..., 3] = 0.65
    rgba[nan_mask, 3] = 0.0

    buf = io.BytesIO()
    plt.imsave(buf, rgba, format='png')
    buf.seek(0)

    return Response(content=buf.getvalue(), media_type="image/png")


@app.get("/api/timeseries")
async def get_timeseries(variable: str, lat: float, lon: float):
    """Returns a time-series for a variable at the nearest grid point to (lat, lon)."""
    if DATASET is None:
        raise HTTPException(status_code=500, detail="Dataset not initialized")
    if variable not in DATASET.data_vars:
        raise HTTPException(status_code=400, detail=f"Variable {variable} not found")

    from utils.data_loader import get_coord_keys, get_variable_units
    lat_key, lon_key, time_key = get_coord_keys(DATASET)

    # Find nearest grid point
    ds_point = DATASET[variable].sel(
        **{lat_key: lat, lon_key: lon}, method="nearest"
    )
    values = ds_point.values.flatten()
    times_raw = DATASET.coords[time_key].values

    times = []
    for t in times_raw:
        try:
            times.append(t.strftime('%Y-%m-%d'))
        except AttributeError:
            times.append(str(t))

    actual_lat = float(ds_point.coords[lat_key].values)
    actual_lon = float(ds_point.coords[lon_key].values)

    mask = np.isfinite(values)
    clean_vals = values[mask].tolist()
    clean_times = [t for t, m in zip(times, mask) if m]

    return {
        "variable": variable,
        "units": get_variable_units(DATASET, variable),
        "lat": round(actual_lat, 2),
        "lon": round(actual_lon, 2),
        "times": clean_times,
        "values": [round(float(v), 3) for v in clean_vals],
        "mean": round(float(np.nanmean(values)), 3),
        "min": round(float(np.nanmin(values)), 3),
        "max": round(float(np.nanmax(values)), 3),
        "std": round(float(np.nanstd(values)), 3),
    }


@app.get("/api/stats")
async def get_stats(variable: str):
    """Returns global summary statistics for a variable across all time steps."""
    if DATASET is None:
        raise HTTPException(status_code=500, detail="Dataset not initialized")
    if variable not in DATASET.data_vars:
        raise HTTPException(status_code=400, detail=f"Variable {variable} not found")

    from utils.data_loader import get_variable_units, get_variable_long_name, get_coord_keys
    lat_key, lon_key, time_key = get_coord_keys(DATASET)

    data = DATASET[variable].values
    flat = data.flatten()
    flat = flat[np.isfinite(flat)]

    # Per-timestep means for the chart
    n_times = data.shape[0]
    time_means = []
    for i in range(n_times):
        slice_data = data[i].flatten()
        slice_data = slice_data[np.isfinite(slice_data)]
        time_means.append(round(float(np.mean(slice_data)), 3) if len(slice_data) > 0 else None)

    times_raw = DATASET.coords[time_key].values
    times = []
    for t in times_raw:
        try:
            times.append(t.strftime('%Y-%m-%d'))
        except AttributeError:
            times.append(str(t))

    return {
        "variable": variable,
        "units": get_variable_units(DATASET, variable),
        "long_name": get_variable_long_name(DATASET, variable),
        "global_mean": round(float(np.mean(flat)), 3),
        "global_min": round(float(np.min(flat)), 3),
        "global_max": round(float(np.max(flat)), 3),
        "global_std": round(float(np.std(flat)), 3),
        "total_points": int(len(flat)),
        "times": times,
        "time_means": time_means,
    }

@app.post("/api/compare")
async def compare_locations(request: CompareRequest):
    """Compares all variables across up to 3 locations over a time range."""
    if DATASET is None:
        raise HTTPException(status_code=500, detail="Dataset not initialized")
    if len(request.locations) < 1 or len(request.locations) > 3:
        raise HTTPException(status_code=400, detail="Provide 1 to 3 locations")

    from utils.data_loader import get_coord_keys, get_variable_units, get_variable_long_name
    lat_key, lon_key, time_key = get_coord_keys(DATASET)

    results = []
    for var in DATASET.data_vars:
        var_entry = {
            "variable": var,
            "units": get_variable_units(DATASET, var),
            "long_name": get_variable_long_name(DATASET, var),
            "locations": []
        }
        for loc in request.locations:
            try:
                point = DATASET[var].sel(**{lat_key: loc.lat, lon_key: loc.lon}, method="nearest")
                if time_key in DATASET.dims:
                    start = min(request.start_time_index, request.end_time_index)
                    end = max(request.start_time_index, request.end_time_index)
                    if start == end:
                        val = float(point.isel(**{time_key: start}).values)
                    else:
                        val = float(point.isel(**{time_key: slice(start, end + 1)}).mean(dim=time_key, skipna=True).values)
                else:
                    val = float(point.values)
                var_entry["locations"].append({
                    "name": loc.name,
                    "lat": loc.lat,
                    "lon": loc.lon,
                    "value": round(float(val), 3) if np.isfinite(val) else None
                })
            except Exception:
                var_entry["locations"].append({
                    "name": loc.name,
                    "lat": loc.lat,
                    "lon": loc.lon,
                    "value": None
                })
        results.append(var_entry)

    return {"comparisons": results}

class YearCompareRequest(BaseModel):
    lat: float
    lon: float
    variable: str
    years: list[int]

@app.post("/api/compare-years")
async def compare_years(request: YearCompareRequest):
    """Compare monthly values for a single location across different years."""
    if DATASET is None:
        raise HTTPException(status_code=500, detail="Dataset not initialized")
    if request.variable not in DATASET.data_vars:
        raise HTTPException(status_code=400, detail=f"Variable {request.variable} not found")
    
    from utils.data_loader import get_coord_keys
    lat_key, lon_key, time_key = get_coord_keys(DATASET)
    
    point = DATASET[request.variable].sel(**{lat_key: request.lat, lon_key: request.lon}, method="nearest")
    
    import pandas as pd
    times = pd.DatetimeIndex(DATASET.coords[time_key].values)
    
    result = []
    for year in request.years:
        year_mask = times.year == year
        if not year_mask.any():
            continue
        year_data = point.isel(**{time_key: year_mask})
        year_times = times[year_mask]
        
        months = [t.strftime('%b') for t in year_times]
        values = [round(float(v), 3) if np.isfinite(v) else None for v in year_data.values]
        
        result.append({
            "year": year,
            "months": months,
            "values": values,
            "mean": round(float(np.nanmean(year_data.values)), 3),
            "max": round(float(np.nanmax(year_data.values)), 3),
            "min": round(float(np.nanmin(year_data.values)), 3),
        })
    
    return {"location": {"lat": request.lat, "lon": request.lon}, "variable": request.variable, "years": result}

@app.get("/api/tour")
async def get_tour(variable: str):
    """Finds global climate anomalies to create a guided tour."""
    if DATASET is None:
        raise HTTPException(status_code=500, detail="Dataset not initialized")
    if variable not in DATASET.data_vars:
        raise HTTPException(status_code=400, detail=f"Variable {variable} not found")

    from utils.data_loader import get_coord_keys, get_variable_units
    lat_key, lon_key, time_key = get_coord_keys(DATASET)
    units = get_variable_units(DATASET, variable)

    if time_key not in DATASET.dims:
        raise HTTPException(status_code=400, detail="Dataset must have a time dimension for tour mode")

    var_data = DATASET[variable]
    arr = var_data.transpose(time_key, lat_key, lon_key).values
    lats = DATASET.coords[lat_key].values
    lons = DATASET.coords[lon_key].values
    times = DATASET.coords[time_key].values

    def format_time(t):
        try:
            return t.strftime('%B %Y')
        except AttributeError:
            return str(t)

    stops = []

    # 1. Global Maximum
    max_idx = np.unravel_index(np.nanargmax(arr), arr.shape)
    t_idx_max, lat_idx_max, lon_idx_max = max_idx
    max_val = float(arr[max_idx])
    stops.append({
        "id": "global-max",
        "title": "Historical Maximum",
        "description": f"The highest recorded {variable} in this dataset occurred here in {format_time(times[t_idx_max])}, reaching {max_val:.2f} {units}.",
        "lat": float(lats[lat_idx_max]),
        "lon": float(lons[lon_idx_max]),
        "time_index": int(t_idx_max),
        "value": max_val
    })

    # 2. Global Minimum
    min_idx = np.unravel_index(np.nanargmin(arr), arr.shape)
    t_idx_min, lat_idx_min, lon_idx_min = min_idx
    min_val = float(arr[min_idx])
    stops.append({
        "id": "global-min",
        "title": "Historical Minimum",
        "description": f"The lowest recorded {variable} plummeted to {min_val:.2f} {units} here in {format_time(times[t_idx_min])}.",
        "lat": float(lats[lat_idx_min]),
        "lon": float(lons[lon_idx_min]),
        "time_index": int(t_idx_min),
        "value": min_val
    })

    # 3. Highest Variance (Volatility)
    std_arr = np.nanstd(arr, axis=0)
    var_idx = np.unravel_index(np.nanargmax(std_arr), std_arr.shape)
    lat_idx_var, lon_idx_var = var_idx
    loc_timeseries = arr[:, lat_idx_var, lon_idx_var]
    t_idx_var = int(np.nanargmax(loc_timeseries))
    peak_val = float(loc_timeseries[t_idx_var])
    
    stops.append({
        "id": "highest-variance",
        "title": "Extreme Volatility Zone",
        "description": f"This region experienced the most drastic fluctuations in {variable} across the entire timeline. It peaked at {peak_val:.2f} {units} in {format_time(times[t_idx_var])}.",
        "lat": float(lats[lat_idx_var]),
        "lon": float(lons[lon_idx_var]),
        "time_index": t_idx_var,
        "value": peak_val
    })

    return {"stops": stops}

@app.post("/api/insights")
async def generate_insight(request: InsightRequest):
    """Generates natural language climate insights using the Google Gemini API."""
    try:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key or api_key == "your_api_key_here":
            return {"error": "GEMINI_API_KEY is missing or invalid in the .env file."}

        import google.generativeai as genai
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-2.5-flash')
        
        # Calculate context statistics
        min_val = min(request.values)
        max_val = max(request.values)
        avg_val = sum(request.values) / len(request.values)
        
        prompt = f"""You are an expert climate data analyst. Analyze this time-series data for a location at Latitude {request.lat}, Longitude {request.lon}.
Variable: {request.variable}
Units: {request.units}
Time Period: {request.times[0]} to {request.times[-1]}
Data Points: {len(request.values)}
Min: {min_val:.2f}, Max: {max_val:.2f}, Average: {avg_val:.2f}

Provide exactly 4 to 5 concise bullet points summarizing this data using Markdown formatting:
- Include the overall trend (increasing, decreasing, or stable).
- Note any significant volatility, seasonal spread, or anomalies.
- State the real-world implications of this metric's behavior at this specific geographic location.

Be direct, highly professional, and use the specific numbers provided above. DO NOT include introductory filler (like "Here is the analysis") nor any concluding summary paragraphs. Output ONLY bullet points.
"""
        response = model.generate_content(prompt)
        return {"insight": response.text}
    except Exception as e:
        print(f"Insight Generation Error: {e}")
        return {"error": str(e)}
