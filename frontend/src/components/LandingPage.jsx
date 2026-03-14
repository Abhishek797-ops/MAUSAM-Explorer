import React, { useState } from 'react';
import { Upload, ArrowRight, Globe, FileCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import GlobeVisual from './GlobeVisual';

export default function LandingPage({ onUploadSuccess }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected && selected.name.endsWith('.nc')) {
      setFile(selected);
      setError(null);
    } else {
      setError("Please select a valid .nc (NetCDF) file.");
    }
  };

  const handleAnalyze = async () => {
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      await axios.post('/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      onUploadSuccess();
    } catch (err) {
      setError("Analysis failed. Dataset schema might be invalid.");
      setUploading(false);
    }
  };

  return (
    <div className="h-screen w-screen flex bg-[#0a0f1d] overflow-hidden font-outfit text-white">
      {/* LEFT: Rotating Earth Visual */}
      <div className="w-1/2 h-full relative border-r border-white/5 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.1)_0%,transparent_70%)]">
        <GlobeVisual />
        
        {/* Floating Branding */}
        <div className="absolute top-12 left-12 z-20">
          <div className="flex items-center gap-3">
            <Globe className="text-blue-400 w-8 h-8" />
            <span className="text-2xl font-black tracking-tighter">MAUSAM <span className="text-blue-400">EXPLORER</span></span>
          </div>
          <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-white/30 mt-2">v2.0 Real Earth Engine</p>
        </div>
      </div>

      {/* RIGHT: Upload Portal */}
      <div className="w-1/2 h-full flex items-center justify-center p-20 relative">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none" />
        
        <motion.div 
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-md w-full"
        >
          <h1 className="text-5xl font-black mb-4 leading-none tracking-tighter">
            Analyze Global <br /> <span className="text-blue-400 text-6xl">Climate</span>
          </h1>
          <p className="text-white/40 font-medium text-sm mb-12 leading-relaxed">
            Upload NetCDF datasets to generate immersive WebGL 3D visualizations, spatial heatmaps, and temporal anomaly insights.
          </p>

          <div className="space-y-6">
            <div className={`p-8 rounded-[32px] border-2 border-dashed transition-all duration-300 ${
              file ? 'border-blue-400 bg-blue-400/5' : 'border-white/10 bg-white/5 hover:border-white/20'
            }`}>
              <div className="flex flex-col items-center text-center">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-transform ${file ? 'bg-blue-400 text-navy-900 scale-110' : 'bg-white/5 text-white/40'}`}>
                  {file ? <FileCheck size={32} /> : <Upload size={32} />}
                </div>
                
                <h3 className="text-lg font-bold mb-1">
                  {file ? file.name : "Select Dataset"}
                </h3>
                <p className="text-[10px] uppercase font-black tracking-widest text-white/20 mb-6">
                  format: .nc (NetCDF)
                </p>

                <label className="cursor-pointer text-xs font-black uppercase tracking-widest py-3 px-8 rounded-full border border-white/10 hover:bg-white/10 transition-all active:scale-95">
                  Browse Files
                  <input type="file" className="hidden" accept=".nc" onChange={handleFileChange} />
                </label>
              </div>
            </div>

            <button 
              onClick={handleAnalyze}
              disabled={!file || uploading}
              className={`w-full py-5 rounded-[24px] font-black text-sm uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all ${
                file && !uploading 
                  ? 'bg-blue-500 text-white shadow-xl shadow-blue-500/20 hover:bg-blue-400 hover:-translate-y-1' 
                  : 'bg-white/5 text-white/20 cursor-not-allowed border border-white/5'
              }`}
            >
              {uploading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  Analyze Data
                  <ArrowRight size={18} />
                </>
              )}
            </button>

            <AnimatePresence>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="p-4 bg-red-400/10 border border-red-400/20 rounded-2xl text-red-400 text-[11px] font-bold text-center"
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
