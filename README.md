# 🌍 MAUSAM Explorer
### Interactive Climate Data Visualization Dashboard


MAUSAM Explorer is a modern, full-stack web application designed for processing, visualizing, and analyzing heavy climate datasets (like ERA5 NetCDF files) through an immersive 3D WebGL interface.

---

## ✨ Features

- **Interactive 3D WebGL Globe**: Photorealistic rotating Earth with smooth, server-generated heatmap data overlays.
- **Data Explorer**: Pagination-supported raw data grid to inspect thousands of coordinate values instantly.
- **Time-Series Analysis**: Dynamic line, bar, and anomaly charts powered by Plotly for historical trend analysis.
- **Location Inspector**: Click anywhere on the globe to extract historical statistics and 5-year averages for that specific lat/lon.
- **High-Performance Backend**: FastAPI and `xarray` process heavy `.nc` files in memory, delivering sub-second API responses.
- **Automated Data Pipeline**: Includes `download_era5.py` to seamlessly fetch decades of climate data from the Copernicus API limit-free.

---

## 🛠️ Tech Stack

### Frontend (User Interface)
- **Framework**: React 18 (Vite)
- **3D Rendering**: `three`, `react-three-fiber`, `react-globe.gl`
- **Charting**: `plotly.js-dist-min` (Optimized factory wrapper)
- **Styling**: Tailwind CSS + Framer Motion for cinematic animations
- **Icons**: Lucide React

### Backend (Data Engine)
- **Framework**: FastAPI (Python)
- **Data Processing**: `xarray`, `numpy`, `pandas`, `netCDF4`
- **Visualization Engine**: `matplotlib` (for smooth equirectangular texture generation)
- **Server**: Uvicorn

---

## 🚀 Quick Start Guide

### 1. Backend Setup (FastAPI)
Open a terminal in the project root folder:
```bash
# Create and activate a virtual environment
python -m venv venv
venv\Scripts\activate  # On Windows

# Install Python dependencies
pip install -r requirements.txt
pip install matplotlib scipy

# Start the FastAPI server
python -m uvicorn main:app --port 8000 --reload
```
*The backend API will run on `http://localhost:8000`*

### 2. Frontend Setup (React)
Open a new terminal in the `frontend/` directory:
```bash
cd frontend

# Install Node dependencies
npm install

# Start the Vite development server
npm run dev
```
*The dashboard will open in your browser at `http://localhost:5173`*

---

## 📁 Project Structure

```
MAUSAM-Explorer/
├── main.py                      # FastAPI server & endpoints
├── download_era5.py             # Copernicus ERA5 API downloader script
├── requirements.txt             # Backend dependencies
├── frontend/                    # React Web Application
│   ├── package.json             # Frontend dependencies
│   ├── vite.config.js           # Vite configuration (optimized for 3D)
│   └── src/
│       ├── App.jsx              # Main Dashboard Shell (Tab Navigation)
│       ├── api/client.js        # Axios API client wrapper
│       └── components/          # Dashboard Tabs
│           ├── LandingPage.jsx  # Cinematic 3D entry page
│           ├── ClimateProfile.jsx
│           ├── TimeSeriesTab.jsx
│           ├── DataExplorer.jsx
│           └── LocationAnalysis.jsx
└── utils/
    └── data_loader.py           # NetCDF parsing and caching
```

---

## 📊 Getting Climate Data

The application requires `.nc` (NetCDF) datasets to function. 

You can download global ERA5 climate data natively using the included downloader script:
```bash
venv\Scripts\python download_era5.py
```
*This requires a valid `~/.cdsapirc` file configured with your Copernicus CDS API key.*

---

