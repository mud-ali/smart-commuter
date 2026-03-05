"use client";
import { useEffect, useState } from "react";

export default function CommuteDisplay() {
    const [schedData, setSchedData] = useState<any>(null);
    const [routes, setRoutes] = useState<any[]>([]);
    const [origin, setOrigin] = useState("");
    const [destination, setDestination] = useState("");
    const [manualEndTime, setManualEndTime] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setOrigin(localStorage.getItem("smart_origin") || "");
        setDestination(localStorage.getItem("smart_dest") || "");
        
        fetch("http://localhost:8080/schedule")
            .then(res => res.json())
            .then(data => setSchedData(data));
    }, []);

    const getTransitOptions = async () => {
    if (!origin || !destination) return;
    setLoading(true);
    
    const departureTime = manualEndTime || schedData?.lastEnd || new Date().toISOString();

    try {
        const res = await fetch(
            `http://localhost:8080/directions?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&departureTime=${departureTime}`
        );
        const data = await res.json();
        
        // Only update if data is an array, otherwise reset to empty
        if (Array.isArray(data)) {
            setRoutes(data);
        } else {
            console.error("API Error:", data.error);
            setRoutes([]); // Clear routes if there's an error
            alert(data.error || "No routes found for this time.");
        }
    } catch (err) {
        setRoutes([]);
    } finally {
        setLoading(false);
    }
};

    // Find the minimum duration value among all returned routes
    const minDuration = routes.length > 0 
        ? Math.min(...routes.map(r => r.durationValue)) 
        : null;

    return (
        <div className="w-full max-w-md p-6 bg-white/5 border border-white/10 rounded-3xl backdrop-blur-xl space-y-6">
            
            {/* Address Inputs */}
            <div className="space-y-3">
                <input 
                    type="text" placeholder="Work Address" value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-sm"
                />
                <input 
                    type="text" placeholder="Home Address" value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-sm"
                />
                <button 
                    onClick={getTransitOptions}
                    className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold transition-all"
                >
                    {loading ? "Searching..." : "Calculate Best Routes"}
                </button>
            </div>

            {/* Route Options */}
            <div className="space-y-4">
                {routes.map((route, idx) => {
                    const isFastest = idx === 0;
                    return (
                        <div 
                            key={idx}
                            className={`p-4 rounded-2xl border transition-all ${
                                isFastest 
                                ? "bg-green-500/10 border-green-500/40 shadow-[0_0_15px_rgba(34,197,94,0.1)]" 
                                : "bg-white/5 border-white/10 opacity-70"
                            }`}
                        >
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-lg font-bold">Arrive {route.arrivalTime}</p>
                                    <p className="text-[10px] opacity-60">Leaves at {route.departureTime}</p>
                                </div>
                                <div className="text-right">
                                    <p className={`text-xl font-black ${isFastest ? 'text-green-400' : 'text-white'}`}>
                                        {route.durationText}
                                    </p>
                                    {isFastest && <span className="text-[8px] bg-green-500 text-black px-2 py-0.5 rounded-full font-bold">FASTEST</span>}
                                </div>
                            </div>
                            <div className="mt-3 flex gap-2">
                                {route.steps.map((step: any, i: number) => (
                                    <span key={i} className="px-2 py-1 bg-white/10 rounded text-[9px] font-mono flex items-center gap-1">
                                        {step.type === 'SUBWAY' ? '🚇' : '🚌'} {step.line}
                                    </span>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Leave Now / Undo Toggle */}
            <button 
                onClick={() => setManualEndTime(manualEndTime ? null : new Date().toISOString())}
                className={`w-full py-3 rounded-xl text-xs font-bold transition-all ${
                    manualEndTime ? "bg-red-500/20 text-red-400" : "bg-white/10 text-white"
                }`}
            >
                {manualEndTime ? "↺ Undo Manual Departure" : "🚀 Leave Now (Override Schedule)"}
            </button>
        </div>
    );
}