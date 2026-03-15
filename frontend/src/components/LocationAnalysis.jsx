import React, { useState } from 'react';
import { getTimeSeries } from '../api/client';
import Plot from './PlotlyChart';
import { MapPin, X, TrendingUp, Thermometer, ArrowUpRight, ArrowDownRight, Search, Loader, Sparkles } from 'lucide-react';

export default function LocationAnalysis({ meta, variable, timeRange }) {
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [tsData, setTsData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // AI Insights State
  const [insight, setInsight] = useState(null);
  const [generatingInsight, setGeneratingInsight] = useState(false);

  // Recent searches
  const [recentSearches, setRecentSearches] = useState([]);

  const searchLocation = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data = await res.json();
      setSearchResults(data);
    } catch (err) {
      console.error('Search failed:', err);
      setSearchResults([]);
    }
    setSearching(false);
  };

  const selectLocation = (result) => {
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);
    setSelectedPoint({ lat: lat.toFixed(2), lon: lon.toFixed(2), name: result.display_name });
    setSearchResults([]);
    setSearchQuery(result.display_name.split(',')[0]); // Show short name in input

    // Add to recent searches (max 5)
    setRecentSearches(prev => {
      const updated = [{ name: result.display_name, lat, lon }, ...prev.filter(r => r.name !== result.display_name)];
      return updated.slice(0, 5);
    });

    // Fetch time-series data
    setLoading(true);
    setTsData(null);
    setInsight(null);
    getTimeSeries(variable, lat.toFixed(2), lon.toFixed(2))
      .then(data => {
        setTsData(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  const clearSelection = () => {
    setSelectedPoint(null);
    setTsData(null);
    setInsight(null);
  };

  const generateInsight = async () => {
    if (!tsData) return;
    setGeneratingInsight(true);
    try {
      const res = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variable: tsData.variable,
          lat: tsData.lat,
          lon: tsData.lon,
          times: slicedTimes,
          values: slicedValues,
          units: tsData.units
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setInsight(data.insight);
    } catch (err) {
      setInsight(`Error generating insight: ${err.message}`);
    }
    setGeneratingInsight(false);
  };

  // Kelvin conversion helper
  const formatValue = (val, units) => {
    if (units === 'K' || units === 'Kelvin') {
      return `${(val - 273.15).toFixed(2)} °C`;
    }
    return `${val} ${units}`;
  };

  // Basic markdown to HTML list parser
  const formatInsightContent = (text) => {
    if (!text) return '';
    
    // Split into lines and look for bullets
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    let html = '<ul className="space-y-2 list-disc pl-4 text-white">';
    
    lines.forEach(line => {
      // Remove standard markdown bullets and bold markers
      let cleanLine = line.replace(/^[\*\-]\s+/, '').trim();
      
      // Bold important metrics
      cleanLine = cleanLine.replace(/\*\*(.*?)\*\*/g, '<strong class="text-blue-400 font-bold">$1</strong>');
      
      if (cleanLine) {
        html += `<li class="text-white text-xs leading-relaxed">${cleanLine}</li>`;
      }
    });
    
    html += '</ul>';
    return html;
  };

  const slicedTimes = tsData && timeRange ? tsData.times.slice(timeRange[0], timeRange[1] + 1) : [];
  const slicedValues = tsData && timeRange ? tsData.values.slice(timeRange[0], timeRange[1] + 1) : [];
  const prediction = tsData && slicedTimes.length > 1 ? predictNextValue(slicedTimes, slicedValues) : null;

  return (
    <div className="w-full h-full bg-[#0d1321] flex overflow-hidden">
      {/* Left Panel: Search + Recent */}
      <div className="w-96 border-r border-white/5 flex flex-col overflow-y-auto">
        {/* Search Bar */}
        <div className="p-5 border-b border-white/5">
          <h3 className="text-xs font-black uppercase tracking-widest text-white/40 mb-4 flex items-center gap-2">
            <Search size={12} /> Location Search
          </h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchLocation()}
              placeholder="Search city, country, region..."
              className="flex-1 bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-white/20 outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
            />
            <button
              onClick={searchLocation}
              disabled={searching}
              className="px-4 py-2.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 rounded-xl text-xs font-bold text-white transition-colors flex items-center gap-1.5"
            >
              {searching ? <Loader size={12} className="animate-spin" /> : <Search size={12} />}
            </button>
          </div>

          {/* Search Results Dropdown */}
          {searchResults.length > 0 && (
            <div className="mt-2 bg-[#131b2e] rounded-xl border border-white/10 overflow-hidden">
              {searchResults.map((result, i) => (
                <button
                  key={i}
                  onClick={() => selectLocation(result)}
                  className="w-full text-left px-4 py-3 text-xs text-white/60 hover:bg-blue-500/10 hover:text-white border-b border-white/[0.03] last:border-0 transition-colors flex items-start gap-2"
                >
                  <MapPin size={12} className="text-blue-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-bold text-white/80">{result.display_name.split(',')[0]}</div>
                    <div className="text-[10px] text-white/30 mt-0.5 line-clamp-1">{result.display_name}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Recent Searches */}
        {recentSearches.length > 0 && (
          <div className="p-5 border-b border-white/5">
            <h3 className="text-xs font-black uppercase tracking-widest text-white/40 mb-3">Recent</h3>
            <div className="space-y-1.5">
              {recentSearches.map((r, i) => (
                <button
                  key={i}
                  onClick={() => selectLocation({ lat: r.lat, lon: r.lon, display_name: r.name })}
                  className="w-full text-left px-3 py-2 rounded-lg text-[11px] text-white/40 hover:bg-white/5 hover:text-white/70 transition-colors flex items-center gap-2"
                >
                  <MapPin size={10} className="text-white/20" />
                  {r.name.split(',')[0]}
                  <span className="ml-auto text-[9px] text-white/15">{r.lat.toFixed(1)}°, {r.lon.toFixed(1)}°</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Quick Access: Preset locations */}
        <div className="p-5">
          <h3 className="text-xs font-black uppercase tracking-widest text-white/40 mb-3">Quick Access</h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              { name: 'New York', lat: 40.71, lon: -74.00 },
              { name: 'London', lat: 51.50, lon: -0.12 },
              { name: 'Tokyo', lat: 35.67, lon: 139.65 },
              { name: 'Mumbai', lat: 19.07, lon: 72.87 },
              { name: 'Sydney', lat: -33.86, lon: 151.20 },
              { name: 'Cairo', lat: 30.04, lon: 31.23 },
              { name: 'São Paulo', lat: -23.55, lon: -46.63 },
              { name: 'Moscow', lat: 55.75, lon: 37.61 },
            ].map((city) => (
              <button
                key={city.name}
                onClick={() => selectLocation({ lat: city.lat, lon: city.lon, display_name: city.name })}
                className="px-3 py-2.5 bg-white/[0.03] hover:bg-blue-500/10 border border-white/5 hover:border-blue-500/20 rounded-xl text-[10px] font-bold text-white/50 hover:text-blue-400 transition-all flex items-center gap-1.5"
              >
                <MapPin size={10} />
                {city.name}
              </button>
            ))}
          </div>
        </div>

        {/* AI Insights Section in Sidebar */}
        <div className="mt-auto border-t border-white/5 bg-blue-500/5 relative overflow-hidden shrink-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.15),transparent_70%)] pointer-events-none" />
          
          <div className="relative z-10 p-5">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-4 flex items-center gap-2">
              <Sparkles size={12} className="animate-pulse" /> AI Data Analyst
            </h4>

            {!tsData ? (
              <div className="text-[10px] text-white/30 text-center py-4 bg-white/[0.02] rounded-xl border border-white/5">
                Select a location to generate insights
              </div>
            ) : (
              <div className="space-y-4">
                {/* Predictor Card */}
                {prediction && (
                  <div className="flex items-center gap-3 bg-black/20 p-3 rounded-xl border border-white/5">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      prediction.trend > 0 ? 'bg-red-500/10 text-red-400' : prediction.trend < 0 ? 'bg-cyan-500/10 text-cyan-400' : 'bg-white/10 text-white/40'
                    }`}>
                      {prediction.trend > 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                    </div>
                    <div>
                      <div className="text-[8px] font-black uppercase tracking-widest text-white/30 mb-0.5">Next Projection</div>
                      <div className="flex items-end gap-1.5 mb-2">
                        <div className="text-sm font-black font-outfit text-white">
                          {prediction.value} <span className="text-[9px] text-white/20">{tsData.units}</span>
                        </div>
                        <div className={`text-[9px] font-bold pb-0.5 ${prediction.trend > 0 ? 'text-red-400' : prediction.trend < 0 ? 'text-cyan-400' : 'text-white/40'}`}>
                          {prediction.trend > 0 ? '+' : ''}{prediction.trend}/yr
                        </div>
                      </div>
                      <p className="text-[10px] text-white/60 leading-relaxed font-medium">
                        {prediction.description}
                      </p>
                    </div>
                  </div>
                )}

                {/* AI Output */}
                {!insight && !generatingInsight ? (
                  <button
                    onClick={generateInsight}
                    className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 rounded-xl text-[11px] font-bold text-white transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
                  >
                    <Sparkles size={12} /> Generate Insight
                  </button>
                ) : generatingInsight ? (
                  <div className="bg-black/40 backdrop-blur-md rounded-xl p-4 border border-white/10 flex items-center gap-3">
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />
                    <p className="text-[10px] text-white/60 font-medium">Analyzing patterns...</p>
                  </div>
                ) : (
                  <div className="bg-black/40 backdrop-blur-md rounded-xl p-5 border border-white/10 max-h-64 overflow-y-auto custom-scrollbar">
                    <div dangerouslySetInnerHTML={{ __html: formatInsightContent(insight) }} />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Panel: Location Data */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        {!selectedPoint ? (
          /* Empty State */
          <div className="flex-1 flex flex-col items-center justify-center text-center px-12">
            <div className="w-20 h-20 bg-blue-500/10 rounded-3xl flex items-center justify-center mb-6">
              <MapPin size={32} className="text-blue-400" />
            </div>
            <h2 className="text-lg font-black text-white/80 font-outfit mb-2">Search a Location</h2>
            <p className="text-xs text-white/30 max-w-sm leading-relaxed">
              Type a city, country, or any place in the search bar to get detailed climate data from the dataset at that location.
            </p>
          </div>
        ) : loading ? (
          /* Loading State */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-[10px] text-white/30 font-bold">Fetching data for {selectedPoint.name?.split(',')[0]}...</p>
            </div>
          </div>
        ) : tsData ? (
          /* Data View */
          <>
            {/* Location Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 shrink-0">
              <div>
                <h3 className="text-sm font-black text-white font-outfit flex items-center gap-2">
                  <MapPin size={14} className="text-blue-400" />
                  {selectedPoint.name?.split(',')[0] || 'Selected Location'}
                </h3>
                <p className="text-[10px] text-white/30 font-bold mt-1">
                  {tsData.lat}° N, {tsData.lon}° E · Variable: {tsData.variable} · {tsData.values?.length || 0} time steps
                </p>
              </div>
              <button onClick={clearSelection} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                <X size={16} className="text-white/40" />
              </button>
            </div>

            {/* Stats Cards */}
            <div className="p-6 border-b border-white/5 shrink-0">
              <h4 className="text-[9px] font-black uppercase tracking-widest text-white/30 mb-4 flex items-center gap-2">
                <Thermometer size={10} /> Historical Statistics
              </h4>
              <div className="grid grid-cols-4 gap-3">
                <DetailCard label="Mean" value={formatValue(tsData.mean, tsData.units)} color="text-blue-400" />
                <DetailCard label="Maximum" value={formatValue(tsData.max, tsData.units)} color="text-red-400" icon={<ArrowUpRight size={12} />} />
                <DetailCard label="Minimum" value={formatValue(tsData.min, tsData.units)} color="text-cyan-400" icon={<ArrowDownRight size={12} />} />
                <DetailCard label="Std Dev" value={`${tsData.std} ${tsData.units}`} color="text-amber-400" />
              </div>
            </div>

            {/* Time Series Chart */}
            <div className="p-6 border-b border-white/5">
              <h4 className="text-[9px] font-black uppercase tracking-widest text-white/30 mb-4 flex items-center gap-2">
                <TrendingUp size={10} /> Temporal Profile
              </h4>
              <Plot
                data={[{
                  x: slicedTimes,
                  y: slicedValues,
                  type: 'scatter',
                  mode: 'lines',
                  line: { color: '#3b82f6', width: 2, shape: 'spline' },
                  fill: 'tozeroy',
                  fillcolor: 'rgba(59,130,246,0.08)',
                }]}
                layout={{
                  paper_bgcolor: 'transparent',
                  plot_bgcolor: 'transparent',
                  font: { family: 'Inter', color: '#94a3b8', size: 10 },
                  margin: { t: 10, b: 40, l: 45, r: 10 },
                  xaxis: { gridcolor: 'rgba(255,255,255,0.05)' },
                  yaxis: {
                    gridcolor: 'rgba(255,255,255,0.05)',
                    title: { text: tsData.units, font: { size: 9 } }
                  },
                  height: 220,
                  showlegend: false,
                  hovermode: 'x unified',
                }}
                config={{ displayModeBar: false, responsive: true }}
                style={{ width: '100%' }}
                useResizeHandler={true}
              />
            </div>

            {/* Period Averages */}
            <div className="p-6">
              <h4 className="text-[9px] font-black uppercase tracking-widest text-white/30 mb-4">Period Averages</h4>
              <div className="space-y-2">
                {computePeriodAverages(slicedTimes, slicedValues).map((period, i) => (
                  <div key={i} className="flex items-center justify-between bg-white/[0.03] px-3 py-2 rounded-xl border border-white/5">
                    <span className="text-[10px] text-white/40 font-bold">{period.label}</span>
                    <span className="text-xs font-black text-blue-400 font-outfit">{period.avg} <span className="text-[9px] text-white/20">{tsData.units}</span></span>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-white/20 text-sm font-bold">
            No data available for this location
          </div>
        )}
      </div>
    </div>
  );
}

function DetailCard({ label, value, color = "text-blue-400", icon }) {
  return (
    <div className="bg-white/[0.03] p-3 rounded-xl border border-white/5">
      <div className="text-[8px] font-black uppercase tracking-widest text-white/25 flex items-center gap-1">{icon}{label}</div>
      <div className={`text-lg font-black font-outfit ${color} mt-1`}>
        {value}
      </div>
    </div>
  );
}

function computePeriodAverages(times, values) {
  if (!times || !values || times.length === 0) return [];
  
  const yearMap = {};
  times.forEach((t, i) => {
    const year = parseInt(t.split('-')[0]);
    if (!yearMap[year]) yearMap[year] = [];
    yearMap[year].push(values[i]);
  });

  const years = Object.keys(yearMap).map(Number).sort();
  if (years.length < 2) return [{ label: `${years[0]}`, avg: (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2) }];

  const periods = [];
  for (let i = 0; i < years.length; i += 5) {
    const periodYears = years.slice(i, i + 5);
    const periodVals = periodYears.flatMap(y => yearMap[y]);
    const avg = periodVals.reduce((a, b) => a + b, 0) / periodVals.length;
    periods.push({
      label: `${periodYears[0]}–${periodYears[periodYears.length - 1]}`,
      avg: avg.toFixed(2)
    });
  }
  return periods;
}

// Simple Linear Regression for short-term projection
function predictNextValue(times, values) {
  if (!times || !values || times.length < 2) return null;
  
  const n = values.length;
  // Use indices as x (0 to n-1)
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += (i * values[i]);
    sumX2 += (i * i);
  }
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  
  // Predict next point (x = n)
  const nextVal = slope * n + intercept;
  
  // Convert slope to per-year assuming the steps are roughly evenly spaced over the years
  const startYr = parseInt(times[0].split('-')[0]);
  const endYr = parseInt(times[times.length - 1].split('-')[0]);
  const yearDelta = endYr - startYr || 1;
  const yearlyTrend = (values[values.length - 1] - values[0]) / yearDelta;

  // Calculate variance to understand significance
  const mean = sumY / n;
  let variance = 0;
  for (let i = 0; i < n; i++) variance += Math.pow(values[i] - mean, 2);
  const stdDev = Math.sqrt(variance / n);
  
  // Calculate relative severity of the trend
  const fiveYearImpact = yearlyTrend * 5;
  const isSignificant = Math.abs(fiveYearImpact) > (stdDev * 0.1); 

  // Generate plain-language description
  let description = `Based on historical data from the selected period, this variable is projected to reach ${nextVal.toFixed(2)} in the next step. `;
  
  if (!isSignificant || yearlyTrend === 0) {
    description += `The overall trend appears relatively stable, with no severe upward or downward shifts expected over the next 5 years.`;
  } else {
    const direction = yearlyTrend > 0 ? 'an increase' : 'a decrease';
    const severity = Math.abs(yearlyTrend) > (stdDev * 0.05) ? 'significant' : 'gradual';
    description += `This indicates a ${severity} ${direction}, shifting by approximately ${Math.abs(fiveYearImpact).toFixed(2)} units over a 5-year outlook.`;
  }

  return {
    value: nextVal.toFixed(2),
    trend: yearlyTrend.toFixed(3),
    description
  };
}

// Simple markdown formatter to convert basic markdown to HTML for the insight box
function formatInsightContent(text) {
  if (!text) return '';
  let html = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n- (.*?)(?=\n|$)/g, '<li>$1</li>');
  
  if (html.includes('<li>')) {
    html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
  }
  return `<p>${html}</p>`;
}
