# MAUSAM Explorer

MAUSAM (Meteorological Analysis & Universal Spatial Anomaly Mapper) Explorer is a high-performance, full-stack climate data visualization dashboard. It allows researchers, students, and enthusiasts to natively load, explore, and compare multi-decadal global climate datasets in real-time directly from `.nc` (NetCDF) files.

Features a custom-built 1990–2024 High-Fidelity Synthetic Climate Generator for immediate exploration without needing to download massive raw datasets.

![MAUSAM Explorer](https://github.com/user-attachments/assets/placeholder-image) <!-- Add a screenshot here -->

## ✨ Key Features

### 🌍 3D Global Heatmaps & Interactive Tours
- **WebGL-powered 3D Globe**: Render global temperature (`t2m`) and precipitation (`tp`) patterns dynamically on an interactive Earth.
- **Story Mode**: Automatically calculates historical climate anomalies (e.g., El Niño 1997, Heatwave 2003) and takes users on a guided, animated tour.

### 📊 Advanced Time-Series Analysis
- **Year-over-Year Comparison**: Select any location to view an overlaid, multi-year comparison chart (up to 5 years simultaneously) to easily spot climate shifts.
- **Statistical Summaries**: Global means, minimums, maximums, and standard deviations tracked at every time step.
- **Real-time Anomaly Detection**: Distribution thresholds dynamically highlight anomalous months.

### 🛠️ "Explore" Mode (1990–2024)
Don't have a NetCDF file? Click **EXPLORE** to immediately visualize a high-fidelity synthetic climate model covering 420 months (1990–2024). 
- Calibrated using real-world baseline anomalies.
- accurately simulates latitudinal gradients, seasonal cycles (June monsoons, January freezes), and observed multidecadal global warming trends.

### 📂 In-Browser NetCDF Processing
- Parse massive scientific NetCDF (.nc) files purely through a localized Python FastAPI backend (using `xarray`), with seamless chunking to the React frontend.
- Zero-latency dataset switching via the sidebar.

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [Python 3.10+](https://www.python.org/)
- Make sure `pip` is installed.

### 1. Backend Setup (FastAPI + xarray)
Navigate to the project root directory and set up a Python virtual environment:
```bash
# Create and activate virtual environment
python -m venv venv
source venv/bin/activate  # On Windows use `venv\Scripts\activate`

# Install requirements
pip install fastapi uvicorn xarray numpy netCDF4 pandas pydantic typing-extensions 'matplotlib<3.9.0'
```

Start the backend server:
```bash
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
*The backend will be running at `http://localhost:8000`*

### 2. Frontend Setup (React + Vite + Tailwind)
Open a new terminal, navigate to the `frontend` directory:
```bash
cd frontend

# Install dependencies
npm install

# Start the dev server
npm run dev
```

*The frontend will be running at `http://localhost:5173`*

---

## 🛠️ Tech Stack

**Frontend:**
- React (Vite)
- Tailwind CSS
- Plotly.js (Data Visualization)
- react-globe.gl & Three.js (3D Spatial Mapping)
- Lucide Icons

**Backend:**
- Python FastAPI
- xarray & pandas (Scientific Data Processing)
- netCDF4 (I/O)
- Matplotlib (PNG Heatmap generation)

---

## 💡 How to Use
1. Open `http://localhost:5173`.
2. Click **EXPLORE** to use the built-in 1990-2024 climate model, OR select **Upload** to load your own `.nc` file.
3. Use the **Variable** dropdown to switch between temperature and precipitation.
4. Open the **Time-Series** tab -> **Year Compare** to analyze location-specific historical trends.
5. Open the **Story Mode** tab to take an automated, animated tour of global historical anomalies.

---

## 🤝 Contributing
Contributions, issues, and feature requests are welcome!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

