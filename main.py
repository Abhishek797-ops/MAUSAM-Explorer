from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse
import xarray as xr
import pandas as pd
import numpy as np
import os

app = FastAPI(
    title="MAUSAM Explorer API",
    description="High-performance climate data API for the React WebGL Frontend",
    default_response_class=ORJSONResponse
)

# Enable CORS for the local Vite React server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global dataset reference
DATASET = None

@app.on_event("startup")
async def load_data():
    global DATASET
    print("Loading ERA5 dataset...")
    try:
        data_path = "data/era5_temperature.nc"
        if not os.path.exists(data_path):
            data_path = "data/era5_monthly_climate_data.nc"
        
        if not os.path.exists(data_path):
            print("Creating dummy dataset for development testing...")
            from utils.data_loader import create_dummy_dataset
            DATASET = create_dummy_dataset(data_path)
        else:
            DATASET = xr.open_dataset(data_path, use_cftime=True)
        print(f"Dataset loaded successfully from {data_path}")
    except Exception as e:
        print(f"Error loading dataset: {e}")

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
        with open(upload_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Reload dataset
        DATASET = xr.open_dataset(upload_path, use_cftime=True)
        print(f"New dataset loaded: {upload_path}")
        return {"status": "success", "filename": file.filename}
    except Exception as e:
        print(f"Upload/Load Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/spatial")
async def get_spatial_data(variable: str, time_index: int):
    """Returns a highly optimized 1D array of lat, lon, and values for Deck.gl."""
    if DATASET is None:
        raise HTTPException(status_code=500, detail="Dataset not initialized")
    if variable not in DATASET.data_vars:
        raise HTTPException(status_code=400, detail=f"Variable {variable} not found")

    from utils.data_loader import get_coord_keys, get_variable_units, get_variable_long_name
    lat_key, lon_key, time_key = get_coord_keys(DATASET)
    
    data_slice = DATASET[variable].isel(**{time_key: time_index})
    
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
async def get_heatmap(variable: str, time_index: int = 0):
    """Generates an equirectangular PNG heatmap image for mapping onto the 3D globe."""
    if DATASET is None:
        raise HTTPException(status_code=500, detail="Dataset not initialized")
    if variable not in DATASET.data_vars:
        raise HTTPException(status_code=400, detail=f"Variable {variable} not found")

    from utils.data_loader import get_coord_keys
    from fastapi.responses import Response
    import matplotlib.cm as cm
    import matplotlib.colors as mcolors
    import matplotlib.pyplot as plt
    import io

    lat_key, lon_key, time_key = get_coord_keys(DATASET)

    # Extract 2D slice
    if time_key in DATASET.dims:
        data_slice = DATASET[variable].isel(**{time_key: time_index}).values
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

    # Make NaNs fully transparent, and valid data slightly transparent (75% opacity) so map shows through
    nan_mask = np.isnan(data)
    rgba[..., 3] = 0.75
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
