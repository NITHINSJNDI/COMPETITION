import React, { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { Issue } from "../types.js";
import { Calendar, MapPin, CheckCircle, Info } from "lucide-react";

// Import Leaflet CSS
import "leaflet/dist/leaflet.css";

interface IssuesMapProps {
  issues: Issue[];
  onSelectIssue?: (issue: Issue) => void;
  customCenter?: [number, number];
  customZoom?: number;
}

// Recenter sub-component to pan the map when center changes
function RecenterMap({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

// Custom DivIcon creator to avoid broken default Leaflet marker assets and match dashboard styles
const createCustomIcon = (status: Issue["status"]) => {
  let colorClass = "bg-stone-500 border-stone-600 ring-stone-300";
  let dotClass = "bg-white";

  if (status === "Resolved") {
    colorClass = "bg-gov-green-600 border-gov-green-600 ring-green-200";
  } else if (status === "In Progress") {
    colorClass = "bg-gov-maroon-950 border-black ring-stone-400";
  } else if (status === "Verified") {
    colorClass = "bg-blue-500 border-blue-700 ring-blue-200";
  }

  return L.divIcon({
    html: `
      <div class="relative flex items-center justify-center">
        <span class="absolute inline-flex h-6 w-6 animate-ping rounded-full opacity-20 ${
          status === "In Progress" ? "bg-gov-maroon-900" : status === "Resolved" ? "bg-green-500" : "bg-stone-400"
        }"></span>
        <div class="w-6 h-6 rounded-full border-2 border-white shadow-md flex items-center justify-center ${colorClass} text-white">
          <div class="w-1.5 h-1.5 rounded-full ${dotClass}"></div>
        </div>
      </div>
    `,
    className: "custom-leaflet-marker",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });
};

export default function IssuesMap({ issues, customCenter, customZoom }: IssuesMapProps) {
  // Compute center of map dynamically based on markers, default to Chennai if empty
  const centerPosition = useMemo((): [number, number] => {
    if (customCenter) {
      return customCenter;
    }
    if (issues.length === 0) {
      return [11.1271, 78.6569]; // Geographic Center of Tamil Nadu
    }
    const latSum = issues.reduce((acc, issue) => acc + issue.latitude, 0);
    const lngSum = issues.reduce((acc, issue) => acc + issue.longitude, 0);
    return [latSum / issues.length, lngSum / issues.length];
  }, [issues, customCenter]);

  return (
    <div className="border border-stone-200 bg-gov-cream-100 overflow-hidden relative">
      <div className="h-[450px] w-full" id="issues-interactive-map" style={{ zIndex: 1 }}>
        <MapContainer
          center={centerPosition}
          zoom={customZoom || (issues.length > 1 ? 11 : 13)}
          style={{ width: "100%", height: "100%" }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          <RecenterMap center={centerPosition} />

          {issues.map((issue) => {
            const customIcon = createCustomIcon(issue.status);
            return (
              <Marker
                key={issue._id}
                position={[issue.latitude, issue.longitude]}
                icon={customIcon}
              >
                <Popup>
                  <div className="p-1 max-w-[240px] font-sans text-gov-maroon-900 space-y-2">
                    {issue.videoUrl ? (
                      <video
                        src={issue.videoUrl}
                        controls
                        className="w-full h-24 object-cover border border-stone-200"
                      />
                    ) : issue.imageUrl ? (
                      <img
                        src={issue.imageUrl}
                        alt={issue.title}
                        className="w-full h-24 object-cover border border-stone-200"
                        style={{ filter: "grayscale(10%)" }}
                        referrerPolicy="no-referrer"
                      />
                    ) : null}
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[8px] font-bold px-1.5 py-0.5 border uppercase ${
                            issue.status === "Resolved"
                              ? "border-gov-green-600 text-gov-green-700 bg-green-50"
                              : issue.status === "In Progress"
                              ? "border-gov-maroon-950 text-white bg-gov-maroon-950"
                              : "border-stone-300 text-stone-500 bg-gov-cream-100"
                          }`}
                        >
                          {issue.status}
                        </span>
                        <span className="text-[9px] font-sans text-stone-400">
                          {new Date(issue.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold uppercase tracking-tight m-0 text-gov-maroon-950">
                        {issue.title}
                      </h4>
                    </div>
                    <p className="text-[10px] text-stone-500 leading-relaxed m-0 line-clamp-3">
                      {issue.description}
                    </p>
                    <div className="flex items-center gap-1 text-[9px] font-sans text-stone-400 border-t border-gov-cream-200 pt-1.5">
                      <MapPin size={10} />
                      <span>{issue.latitude.toFixed(4)}, {issue.longitude.toFixed(4)}</span>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      {/* Floating protocol banner */}
      <div className="absolute bottom-4 right-4 bg-gov-maroon-950 text-white px-3 py-1.5 text-[9px] font-sans tracking-widest uppercase border border-gov-maroon-800 pointer-events-none shadow-lg" style={{ zIndex: 1000 }}>
        OSM_LAYER_ACTIVE // {issues.length} MARKERS
      </div>
    </div>
  );
}
