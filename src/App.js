import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import './App.css';
import tamilnaduGeoJson from './tamilnadu.json'; 

export default function App() {
  const [constituencies, setConstituencies] = useState([]);
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [debugError, setDebugError] = useState(""); 
  const [activeYear, setActiveYear] = useState("2026"); 
  const [refreshCount, setRefreshCount] = useState(0);

  useEffect(() => {
    const fetchLiveData = () => {
      axios.get('https://tn-election-live-tracker-2026.onrender.com')
        .then(response => {
          setConstituencies(response.data);
          setRefreshCount(prev => prev + 1); 
          console.log("✅ Live Data Fetched!"); 
        })
        .catch(error => {
          console.error("API error:", error);
        });
    };

    fetchLiveData(); 
    const intervalId = setInterval(fetchLiveData, 60000); 

    return () => clearInterval(intervalId);
  }, []);

  // --- MUKKIYAM: MISSING NAMES KANDUPUDIKKUM LOGIC ---
  useEffect(() => {
    if (constituencies.length > 0 && tamilnaduGeoJson) {
       const missingNames = [];
       tamilnaduGeoJson.features.forEach(f => {
           const geoName = f.properties.AC_NAME; // Unga map file-la ulla peru
           const cleaned = superClean(geoName);
           const found = constituencies.find(c => superClean(c.name) === cleaned);
           if (!found) {
               missingNames.push(geoName);
           }
       });
       if (missingNames.length > 0) {
           console.warn("⚠️ MAP-LA MATCH AAGATHA PERUGAL (Itha nameAlias-la add pannunga):", [...new Set(missingNames)]);
       } else {
           console.log("🎉 Ellaa thoguthiyum pakka-va match aagiduchu!");
       }
    }
  }, [constituencies]);
  // -----------------------------------------------------

  // INGA THAAN NEENGA MISSING NAMES-A ADD PANNANUM
  const nameAlias = {
    // Pazhaya mappings
    "drradhakrishnannagar": "rknagar", 
    "chepaukthiruvallikeni": "chepauk", 
    "kanniyakumari": "kanyakumari", 
    "viluppuram": "villupuram",
    "kancheepuram": "kanchipuram",

    // Munthi add panna fixes
    "tiruvottiyur": "thiruvottiyur",
    "chepaukthiruvalliken": "chepauk",
    "madurantakam": "maduranthakam",
    "palacodu": "palacode",
    "tiruchengodu": "tiruchengode",
    "mettuppalayam": "mettupalayam",
    "nilakkottai": "nilakottai",
    "thirumangalam": "tirumangalam",

    // --- IPPO KANDUPUDICHA 4 FINAL FIXES ---
    "kilvaithinankuppamsc": "kvkuppam", // Map-la closing bracket illatha thappu!
    "tirupattur": "tirupathur",         // Vellore 
    "tiruppathur": "tiruppattur",       // Sivaganga 
    "manapparai": "manaparai"           // ECI-la single 'p' thaan irukku
  };

  const superClean = (name) => {
    if (!name) return "";
    let cleaned = name.toLowerCase()
      .replace(/\(sc\)/g, '')
      .replace(/\(st\)/g, '')
      .replace(/[^a-z]/g, ''); 
    return nameAlias[cleaned] || cleaned;
  };

  const getPartyColor = (partyName) => {
    if (!partyName) return '#94a3b8'; 
    const party = partyName.toUpperCase();
    
    if (party === 'DMK') return '#dc2626'; 
    if (party === 'ADMK' || party === 'AIADMK') return '#16a34a'; 
    if (party === 'INC' || party === 'CONGRESS') return '#2563eb'; 
    if (party === 'TVK') return '#9f1239';
    if (party === 'BJP') return '#f97316'; 
    if (party === 'NTK') return '#0ea5e9'; 
    if (party === 'PMK') return '#fbbf24'; 
    if (party === 'IUML') return '#15803d'; 
    if (party === 'MNM' || party === 'VCK' || party === 'CPI' || party === 'CPIM' || party === 'CPI(M)') return '#ef4444'; 
    if (party === 'DMDK') return '#fb923c';
    if (party === 'AMMK') return '#14b8a6';
    return '#64748b'; 
  };

  const mapStyle = (feature) => {
    const geoJsonName = feature.properties.AC_NAME;
    const cleanedGeoName = superClean(geoJsonName);
    const seatData = constituencies.find(c => superClean(c.name) === cleanedGeoName);
    
    let partyToColor = null;
    let isWon = false;

    if (seatData) {
      partyToColor = activeYear === "2021" ? seatData.winning_party_2021 : seatData.live_leading_party;
      
      if (activeYear === "2021") {
          isWon = true; 
      } else if (seatData.live_status && (seatData.live_status.toLowerCase().includes('won') || seatData.live_status.toLowerCase().includes('declared'))) {
          isWon = true; 
      }
    }

    if (!seatData || !partyToColor) {
      return { fillColor: 'transparent', weight: 1, color: '#cbd5e1', fillOpacity: 0 };
    }

    return {
      fillColor: getPartyColor(partyToColor),
      fillOpacity: isWon ? 0.95 : 0.6, 
      color: isWon ? '#000000' : '#ffffff', 
      weight: isWon ? 2 : 1.5
    };
  };

  const onEachFeature = (feature, layer) => {
    const geoJsonName = feature.properties.AC_NAME; 

    layer.on({
      click: () => {
        setDebugError(""); 
        const cleanedGeoName = superClean(geoJsonName);
        const seatData = constituencies.find(c => superClean(c.name) === cleanedGeoName);

        if (seatData) {
          setSelectedSeat(seatData);
        } else {
          setSelectedSeat({
            name: geoJsonName,
            district: "Waiting for ECI Data...",
            live_leading_party: null
          });
        }
      },
      mouseover: function () {
        this.setStyle({ fillOpacity: 0.9, color: '#1e293b', weight: 2 });
      },
      mouseout: function () {
        this.setStyle(mapStyle(feature)); 
      }
    });
  };

  const calculatePartySummary = () => {
    const summary = {};
    constituencies.forEach(c => {
       const party = activeYear === "2021" ? c.winning_party_2021 : c.live_leading_party;
       let isWon = false;
       
       if (activeYear === "2021") {
           isWon = true;
       } else if (c.live_status && (c.live_status.toLowerCase().includes('won') || c.live_status.toLowerCase().includes('declared'))) {
           isWon = true;
       }

       if (isWon && party) {
           if (!summary[party]) summary[party] = 0;
           summary[party]++;
       }
    });
    return Object.entries(summary).sort((a, b) => b[1] - a[1]);
  };

  const partySummary = calculatePartySummary();

  return (
    <div className="min-h-screen bg-slate-50 p-4 font-sans">
      <header className="mb-6 text-center">
        <h1 className="text-3xl font-bold text-slate-800">TN Election - Live Tracker</h1>
        
        <div className="flex justify-center gap-4 mt-4">
          <button
            onClick={() => setActiveYear("2021")}
            className={`px-6 py-2 rounded-full font-bold transition-all ${
              activeYear === "2021" ? "bg-slate-800 text-white shadow-lg" : "bg-white text-slate-600 border border-slate-300 hover:bg-slate-100"
            }`}
          >
            2021 Results
          </button>
          <button
            onClick={() => setActiveYear("2026")}
            className={`px-6 py-2 rounded-full font-bold transition-all flex items-center gap-2 ${
              activeYear === "2026" ? "bg-emerald-600 text-white shadow-lg" : "bg-white text-slate-600 border border-slate-300 hover:bg-slate-100"
            }`}
          >
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-100"></span>
            </span>
            2026 Live
          </button>
        </div>
      </header>
      
      <div className="flex flex-col lg:flex-row gap-6 max-w-7xl mx-auto">
        <div className="w-full lg:w-2/3 bg-white p-2 rounded-xl shadow-md border border-slate-200">
          <div className="h-[70vh] rounded-lg overflow-hidden relative z-0">
            {tamilnaduGeoJson ? (
              <MapContainer center={[11.1271, 78.6569]} zoom={7} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; OpenStreetMap contributors'
                />
                {constituencies.length > 0 && (
                  <GeoJSON 
                    key={`map-${activeYear}-${refreshCount}`} 
                    data={tamilnaduGeoJson} 
                    onEachFeature={onEachFeature} 
                    style={mapStyle}
                  />
                )}
              </MapContainer>
            ) : (
              <div className="h-full w-full flex items-center justify-center bg-slate-100 text-slate-500">
                Map load aagikondirukkirathu...
              </div>
            )}
          </div>
        </div>

        <div className="w-full lg:w-1/3 flex flex-col gap-4">
          
          {debugError && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded shadow-sm">
              <h3 className="text-red-700 font-bold flex items-center gap-2">⚠️ Missing Data</h3>
              <p className="text-sm text-red-600 mt-1">{debugError}</p>
            </div>
          )}

          <div className="bg-white p-5 rounded-xl shadow-md border border-slate-200">
            <h2 className="text-lg font-bold text-slate-800 mb-3 pb-2 border-b flex items-center gap-2">
              📊 {activeYear === "2021" ? "2021 Final Standings" : "Live Declared Wins"}
            </h2>
            <div className="grid grid-cols-2 gap-2">
               {partySummary.map(([party, count]) => (
                  <div key={party} className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-100 shadow-sm">
                     <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: getPartyColor(party) }}></span>
                        <span className="font-bold text-slate-700 text-sm">{party}</span>
                     </div>
                     <span className="font-extrabold text-lg text-slate-900">{count}</span>
                  </div>
               ))}
               {partySummary.length === 0 && (
                   <p className="text-sm text-slate-500 col-span-2 italic text-center py-2">
                     Innum entha thoguthiyilum result arivikkapadavillai...
                   </p>
               )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-md border border-slate-200 flex-1">
            <h2 className="text-xl font-bold text-slate-800 mb-4 pb-2 border-b">Constituency Info</h2>
            
            {selectedSeat ? (
              <div className="space-y-4 animate-fade-in">
                <div>
                  <p className="text-sm text-slate-500 uppercase tracking-wide">Name</p>
                  <p className="text-2xl font-bold text-slate-900">{selectedSeat.name}</p>
                </div>
                
                <div>
                  <p className="text-sm text-slate-500 uppercase tracking-wide">District</p>
                  <p className="text-lg font-medium text-slate-700">{selectedSeat.district}</p>
                </div>

                {activeYear === "2021" ? (
                  <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-100">
                     <h3 className="text-sm font-bold text-slate-500 mb-2 uppercase tracking-wide">2021 Results</h3>
                     <div className="flex items-center justify-between">
                       <p className="text-xl font-extrabold text-blue-700">{selectedSeat.winning_party_2021 || "N/A"}</p>
                       <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-bold rounded-full">Winner</span>
                     </div>
                     <p className="text-slate-600 mt-2 font-medium">{selectedSeat.winning_candidate_2021}</p>
                  </div>
                ) : (
                  <div className="mt-4 p-4 bg-emerald-50 rounded-lg border border-emerald-100 relative overflow-hidden">
                     <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                     <h3 className="text-sm font-bold text-emerald-800 mb-1 uppercase tracking-wide">Live 2026 Status</h3>
                     <div className="mt-2">
                       {selectedSeat.live_leading_party ? (
                         <>
                           {selectedSeat.live_status && (selectedSeat.live_status.toLowerCase().includes('won') || selectedSeat.live_status.toLowerCase().includes('declared')) ? (
                               <p className="text-2xl font-extrabold text-emerald-800 uppercase">{selectedSeat.live_leading_party} WON 🏆</p>
                           ) : (
                               <p className="text-xl font-bold text-emerald-700">{selectedSeat.live_leading_party} is Leading</p>
                           )}
                           <p className="text-sm text-emerald-600 mt-1 flex items-center gap-1">
                              Status: <span className="font-semibold">{selectedSeat.live_status || 'Counting in progress'}</span>
                           </p>
                         </>
                       ) : (
                         <div className="flex items-center gap-2">
                           <span className="relative flex h-3 w-3">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                            </span>
                           <p className="text-emerald-700 font-medium italic text-sm">Awaiting Live Data...</p>
                         </div>
                       )}
                     </div>
                  </div>
                )}
              </div>
            ) : (
              !debugError && (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                  <span className="text-4xl mb-2">🗺️</span>
                  <p>Map-la ethavathu oru thoguthiya click pannunga.</p>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}