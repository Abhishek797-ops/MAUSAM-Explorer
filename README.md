# 🌐 MAUSAM Explorer
### Interactive Climate Data Visualization Dashboard
**Technex '26 — Hack It Out Hackathon | Team ONLY BANS | IIT BHU Varanasi**

---

## 🚀 Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Launch the dashboard
streamlit run app.py
```

The app will open in your browser at `http://localhost:8501`.

---

## ✨ Features

| Feature | Status |
|---------|--------|
| NetCDF file upload (.nc) | ✅ |
| Auto-generated demo dataset (1990–2024) | ✅ |
| Global 2D heatmap (scatter_geo) | ✅ |
| 3D orthographic globe visualization | ✅ |
| Time-series analysis with anomaly detection | ✅ |
| Year-over-year comparison mode | ✅ |
| Guided climate story tour (4 events) | ✅ |
| Live statistics HUD panel | ✅ |
| Dark space theme with circuit decorations | ✅ |
| Multiple color scale options | ✅ |

---

## 🛠️ Tech Stack

- **Framework**: Streamlit
- **Data**: xarray, pandas, numpy, netCDF4
- **Visualization**: Plotly, Matplotlib
- **Statistics**: SciPy (anomaly detection, trend analysis)
- **3D Globe**: Plotly orthographic projection
- **Styling**: Custom CSS (Orbitron + Exo 2 fonts, dark HUD theme)

---

## 📁 Project Structure

```
MAUSAM/
├── app.py                       # Main Streamlit dashboard
├── requirements.txt             # Python dependencies
├── README.md                    # This file
├── data/                        # Place .nc files here
├── assets/
│   └── custom.css               # Dark space theme CSS
├── components/
│   ├── heatmap.py               # 2D spatial heatmap
│   ├── timeseries.py            # Time-series with anomaly highlighting
│   ├── globe_3d.py              # 3D globe visualization
│   ├── comparison.py            # Year-over-year comparison
│   ├── story_mode.py            # Guided climate tour
│   └── stats_panel.py           # Live statistics panel
└── utils/
    ├── data_loader.py           # NetCDF loader + demo data generator
    ├── anomaly_detector.py      # Statistical anomaly detection
    └── theme.py                 # CSS injection + Plotly theme
```

---

## 📊 Data Sources

- **ERA5 Reanalysis**: Download from [Copernicus Climate Data Store](https://cds.climate.copernicus.eu/)
- **Demo Mode**: If no file is uploaded, the app generates a synthetic global temperature + precipitation dataset (1990–2024, 2.5° resolution) for demonstration.

---

## 👥 Team

**Team ONLY BANS** — Built at IIT(BHU) Varanasi for Technex '26 Hack It Out.
