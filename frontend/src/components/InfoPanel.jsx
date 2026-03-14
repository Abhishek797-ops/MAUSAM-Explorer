import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Info, BarChart3, Map as MapIcon, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';

export default function InfoPanel() {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    axios.get('/api/info').then(res => setInfo(res.data));
  }, []);

  if (!info) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="bg-white/80 backdrop-blur-md p-6 rounded-[32px] shadow-2xl border border-white/50 w-full"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
          <Info className="text-blue-600 w-5 h-5" />
        </div>
        <div>
          <h3 className="text-lg font-black text-slate-800 tracking-tight leading-none">Dataset Brief</h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Spatial Metrics</p>
        </div>
      </div>

      <div className="space-y-4">
        <InfoRow icon={<MapIcon size={14}/>} label="Spatial Res" value={info.spatial_resolution} />
        <InfoRow icon={<Calendar size={14}/>} label="Temporal Range" value={info.time_range} />
        
        <div className="pt-4 border-t border-slate-100">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
            <BarChart3 size={10} /> Data Variables
          </div>
          <div className="flex flex-wrap gap-2">
            {info.variables.map(v => (
              <span key={v.name} className="px-3 py-1 bg-slate-100 rounded-full text-[11px] font-bold text-slate-600 border border-slate-200">
                {v.name} ({v.units || 'raw'})
              </span>
            ))}
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 grid grid-cols-2 gap-4">
          <div>
            <div className="text-[9px] font-black text-slate-400 uppercase mb-1">Lat Span</div>
            <div className="text-xs font-bold text-slate-700">{info.lat_range}</div>
          </div>
          <div>
            <div className="text-[9px] font-black text-slate-400 uppercase mb-1">Lon Span</div>
            <div className="text-xs font-bold text-slate-700">{info.lon_range}</div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <div className="flex items-center justify-between group">
      <div className="flex items-center gap-2">
        <span className="text-slate-400 group-hover:text-blue-500 transition-colors">{icon}</span>
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-tight">{label}</span>
      </div>
      <span className="text-xs font-black text-slate-700">{value}</span>
    </div>
  );
}
