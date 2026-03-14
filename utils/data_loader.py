"""
Data loading utilities for MAUSAM Explorer.
Handles NetCDF file loading, synthetic demo data generation,
and dataset introspection with auto-detection of coordinate names.
"""

import numpy as np
import xarray as xr
import pandas as pd


def generate_demo_dataset():
    """Generate synthetic ERA5-like global climate dataset (1990-2024)."""
    lats = np.linspace(-90, 90, 73)       # 2.5° resolution
    lons = np.linspace(-180, 180, 144)
    times = pd.date_range('1990-01', '2024-12', freq='MS')

    # Base temperature field (realistic latitudinal gradient)
    lat_grid, lon_grid = np.meshgrid(lats, lons, indexing='ij')
    base_temp = 30 - 0.6 * np.abs(lat_grid)  # Warm equator, cold poles

    # Global warming trend: +0.02°C/year
    n_times = len(times)
    trend = np.linspace(0, 0.7, n_times)

    # Build temperature with seasonal cycle + noise
    temp_data = np.zeros((n_times, len(lats), len(lons)))
    for t_idx in range(n_times):
        seasonal = 5 * np.sin(2 * np.pi * t_idx / 12 - lat_grid * np.pi / 180)
        noise = np.random.normal(0, 0.5, (len(lats), len(lons)))
        temp_data[t_idx] = base_temp + seasonal + trend[t_idx] + noise

    # Precipitation (mm/day) — exponential distribution weighted by latitude
    precip_data = np.random.exponential(2, (n_times, len(lats), len(lons)))
    precip_data *= np.exp(-np.abs(lat_grid[np.newaxis]) / 20)

    ds = xr.Dataset({
        'temperature': xr.DataArray(
            temp_data,
            dims=['time', 'lat', 'lon'],
            attrs={'units': '°C', 'long_name': 'Surface Temperature'}
        ),
        'precipitation': xr.DataArray(
            precip_data,
            dims=['time', 'lat', 'lon'],
            attrs={'units': 'mm/day', 'long_name': 'Precipitation Rate'}
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
