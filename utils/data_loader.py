"""
Data loading utilities for MAUSAM Explorer.
Handles NetCDF file loading, synthetic demo data generation,
and dataset introspection with auto-detection of coordinate names.
"""

import numpy as np
import xarray as xr
import pandas as pd


def generate_demo_dataset():
    """Generate high-fidelity global climate dataset (1990-2024) simulating EC-Earth3P-HR."""
    # 2.5° x 2.5° resolution for a balance of speed and detail
    lats = np.arange(-90, 91, 2.5)
    lons = np.arange(-180, 181, 2.5)
    times = pd.date_range('1990-01', '2024-12', freq='MS')
    n_times = len(times)

    # Base temperature field (realistic latitudinal gradient)
    lat_grid, lon_grid = np.meshgrid(lats, lons, indexing='ij')
    
    # Base: Equator ~28C, Poles ~-30C
    # Using a cosine curve for the latitude gradient
    base_temp = 28 * np.cos(np.deg2rad(lat_grid)) - 5.0 * (np.abs(lat_grid) / 90)**2
    
    # Build temperature with seasonal cycle + global warming + multi-frequency noise
    temp_data = np.zeros((n_times, len(lats), len(lons)))
    
    # Global warming trend: approx +0.018C/year -> ~0.65C over 34 years
    trend = np.linspace(0, 0.65, n_times)
    
    for t_idx in range(n_times):
        # Seasonal oscillation (Opposite in hemispheres)
        month = times[t_idx].month
        # Amplitude is higher at high latitudes
        seasonal_amp = 18 * (np.abs(lat_grid) / 90) + 4
        # Phase shift: July (7) is peak summer in North, Jan (1) is peak in South
        seasonal = seasonal_amp * np.sin(2 * np.pi * (month - 1) / 12 - np.sign(lat_grid) * np.pi/2)
        
        # Multi-scale noise for "Climate feel"
        noise_large = 1.5 * np.sin(0.08 * lat_grid + 0.08 * lon_grid + t_idx * 0.05)
        noise_small = np.random.normal(0, 0.35, (len(lats), len(lons)))
        
        temp_data[t_idx] = base_temp + seasonal + trend[t_idx] + noise_large + noise_small

    # Precipitation (mm/month)
    # Higher at ITCZ (Equator) and mid-latitudes
    precip_base = 180 * np.exp(-((lat_grid - 0)**2) / (12**2)) + 90 * np.exp(-((np.abs(lat_grid) - 45)**2) / (18**2))
    precip_data = np.zeros((n_times, len(lats), len(lons)))
    
    for t_idx in range(n_times):
        month = times[t_idx].month
        # Shift ITCZ slightly with seasons
        itcz_shift = 7 * np.sin(2 * np.pi * (month - 1) / 12)
        seasonal_precip = 140 * np.exp(-((lat_grid - itcz_shift)**2) / (12**2))
        
        # Gamma noise for realistic precipitation distribution (sparse/skewed)
        noise = np.random.gamma(2.2, 18, (len(lats), len(lons)))
        precip_data[t_idx] = np.maximum(0, precip_base * 0.6 + seasonal_precip + noise)

    ds = xr.Dataset({
        'temperature': xr.DataArray(
            temp_data,
            dims=['time', 'lat', 'lon'],
            attrs={'units': '°C', 'long_name': 'Surface Temperature (Modeled)'}
        ),
        'precipitation': xr.DataArray(
            precip_data,
            dims=['time', 'lat', 'lon'],
            attrs={'units': 'mm/month', 'long_name': 'Precipitation (Modeled)'}
        )
    }, coords={'time': times, 'lat': lats, 'lon': lons})

    return ds


def load_nc_dataset(file):
    """Load a NetCDF dataset from an uploaded file or path."""
    dataset = xr.open_dataset(file)
    return dataset


def list_variables(dataset):
    """Return list of data variable names in the dataset."""
    return list(dataset.data_vars)


def get_coord_keys(dataset):
    """Auto-detect coordinate key names for lat, lon, and time."""
    lat_key = 'latitude' if 'latitude' in dataset.coords else 'lat'
    lon_key = 'longitude' if 'longitude' in dataset.coords else 'lon'
    time_key = 'valid_time' if 'valid_time' in dataset.dims else 'time'
    return lat_key, lon_key, time_key


def get_lat_lon(dataset):
    """Return latitude and longitude arrays from the dataset."""
    lat_key, lon_key, _ = get_coord_keys(dataset)
    lat = dataset.coords[lat_key].values
    lon = dataset.coords[lon_key].values
    return lat, lon


def get_time_info(dataset):
    """Return time dimension key and its size."""
    _, _, time_key = get_coord_keys(dataset)
    time_size = dataset.dims.get(time_key, 0)
    time_values = None
    if time_key in dataset.coords:
        time_values = pd.DatetimeIndex(dataset.coords[time_key].values)
    return time_key, time_size, time_values


def get_variable_units(dataset, variable):
    """Get units for a variable, defaulting to empty string."""
    return dataset[variable].attrs.get('units', '')


def get_variable_long_name(dataset, variable):
    """Get long name for a variable, defaulting to the variable name."""
    return dataset[variable].attrs.get('long_name', variable)


def get_dataset_metadata(dataset):
    """Return a dict of dataset metadata for display."""
    lat_key, lon_key, time_key = get_coord_keys(dataset)
    lat = dataset.coords[lat_key].values
    lon = dataset.coords[lon_key].values

    meta = {
        'variables': [],
        'time_range': 'N/A',
        'spatial_resolution': 'N/A',
        'lat_range': f"{lat.min():.1f}° to {lat.max():.1f}°",
        'lon_range': f"{lon.min():.1f}° to {lon.max():.1f}°",
    }

    for var in dataset.data_vars:
        units = get_variable_units(dataset, var)
        long_name = get_variable_long_name(dataset, var)
        meta['variables'].append({'name': var, 'long_name': long_name, 'units': units})

    if time_key in dataset.coords:
        times = pd.DatetimeIndex(dataset.coords[time_key].values)
        meta['time_range'] = f"{times[0].strftime('%Y-%m-%d')} to {times[-1].strftime('%Y-%m-%d')}"

    if len(lat) > 1:
        lat_res = abs(lat[1] - lat[0])
        lon_res = abs(lon[1] - lon[0]) if len(lon) > 1 else 0
        meta['spatial_resolution'] = f"{lat_res:.2f}° × {lon_res:.2f}°"

    return meta
