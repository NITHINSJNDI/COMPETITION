import React, { useState, useRef, useEffect, useMemo } from "react";
import { Upload, MapPin, Check, AlertCircle, AlertTriangle, Film } from "lucide-react";
import { ActiveTab, UserSession } from "../types.ts";
import { CHENNAI_CONSTITUENCIES } from "../data/constituencies.ts";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const reportMapIcon = L.divIcon({
  html: `
    <div class="relative flex items-center justify-center">
      <span class="absolute inline-flex h-6 w-6 animate-ping rounded-full opacity-30 bg-red-400"></span>
      <div class="w-6 h-6 rounded-full border-2 border-white shadow-md flex items-center justify-center bg-red-600 text-white">
        <div class="w-2 h-2 rounded-full bg-white"></div>
      </div>
    </div>
  `,
  className: "custom-leaflet-marker",
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const DISTRICT_CENTERS: Record<string, [number, number]> = {
  chennai: [13.0827, 80.2707],
  coimbatore: [11.0168, 76.9558],
  madurai: [9.9195, 78.1193],
  salem: [11.6643, 78.1460],
  trichy: [10.7905, 78.7047],
  tirunelveli: [8.7139, 77.7567],
  ariyalur: [11.1400, 79.0800],
  chengalpattu: [12.6825, 79.9864],
};

function MapEventsHandler({ onMapClick, center }: { onMapClick: (lat: number, lng: number) => void; center?: [number, number] }) {
  const map = useMap();
  
  useEffect(() => {
    if (center) {
      map.setView(center, map.getZoom() < 10 ? 12 : map.getZoom());
    }
  }, [center, map]);

  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });

  return null;
}

interface ReportIssueProps {
  onIssueReported: () => void;
  setActiveTab: (tab: ActiveTab) => void;
  session?: UserSession | null;
}

interface CoordinatePreset {
  name: string;
  lat: number;
  lng: number;
  districtId: string;
  constituency: string;
}

const PRESETS: CoordinatePreset[] = [
  { name: "Ariyalur Town Center", lat: 11.14, lng: 79.08, districtId: "ariyalur", constituency: "Ariyalur" },
  { name: "Coimbatore Town Hall", lat: 11.0168, lng: 76.9558, districtId: "coimbatore", constituency: "Coimbatore South" },
  { name: "Madurai Meenakshi Temple", lat: 9.9195, lng: 78.1193, districtId: "madurai", constituency: "Madurai East" },
  { name: "Chennai Harbour Area", lat: 13.0900, lng: 80.2850, districtId: "chennai", constituency: "Harbour" },
];

export default function ReportIssue({ onIssueReported, setActiveTab, session }: ReportIssueProps) {
  // Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [reporterName, setReporterName] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [address, setAddress] = useState("");
  const [locationMode, setLocationMode] = useState<"coordinates" | "address">("coordinates");
  const [agreedToTruthDeclaration, setAgreedToTruthDeclaration] = useState(false);
  
  // Dynamic Locations State
  const [districts, setDistricts] = useState<{ id: string; name: string }[]>([]);
  const [constituencies, setConstituencies] = useState<{ id: string; name: string; districtId: string }[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [constituency, setConstituency] = useState("");
  const [severity, setSeverity] = useState<"Low" | "Medium" | "High">("Medium");
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [mediaType, setMediaType] = useState<"image" | "video" | null>(null);

  // UI State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [geoStatus, setGeoStatus] = useState<"idle" | "fetching" | "success" | "error">("idle");
  const [geoError, setGeoError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fallbacks for offline / load duration
  const fallbackDistricts = useMemo(() => [
    { id: "ariyalur", name: "Ariyalur" },
    { id: "chengalpattu", name: "Chengalpattu" },
    { id: "chennai", name: "Chennai" },
    { id: "coimbatore", name: "Coimbatore" },
  ], []);

  const fallbackConstituencies = useMemo(() => CHENNAI_CONSTITUENCIES.map(c => ({
    id: c.id,
    name: c.name,
    districtId: "chennai",
  })), []);

  const activeDistricts = districts.length > 0 ? districts : fallbackDistricts;
  const activeConstituencies = constituencies.length > 0 ? constituencies : fallbackConstituencies;

  // Initialize selectedDistrict if empty or restricted by citizen session
  useEffect(() => {
    if (session?.role === "citizen" && session.district) {
      const matchingDist = activeDistricts.find(
        (d) => d.name.toLowerCase() === session.district?.toLowerCase() || d.id.toLowerCase() === session.district?.toLowerCase()
      );
      if (matchingDist) {
        setSelectedDistrict(matchingDist.id);
      }
    } else if (activeDistricts.length > 0 && !selectedDistrict) {
      setSelectedDistrict(activeDistricts[0].id);
    }
  }, [activeDistricts, selectedDistrict, session]);

  // Sync reporter name from user session automatically
  useEffect(() => {
    if (session?.name) {
      setReporterName(session.name);
    } else if (session?.email) {
      const emailPrefix = session.email.split("@")[0];
      const fallbackName = emailPrefix
        .split(/[._]+/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
      setReporterName(fallbackName);
    } else {
      setReporterName("Anonymous Citizen");
    }
  }, [session]);

  // Filtered Constituencies
  const filteredConstituencies = useMemo(() => {
    if (!selectedDistrict) return [];
    return activeConstituencies.filter(
      (c) => c.districtId.toLowerCase() === selectedDistrict.toLowerCase()
    );
  }, [activeConstituencies, selectedDistrict]);

  // Selected district name helper
  const selectedDistrictName = useMemo(() => {
    const d = activeDistricts.find(item => item.id.toLowerCase() === selectedDistrict.toLowerCase());
    return d ? d.name : "Select District";
  }, [activeDistricts, selectedDistrict]);

  // Load districts & constituencies
  useEffect(() => {
    let active = true;
    async function loadLocations() {
      try {
        const resDist = await fetch("/api/districts");
        const distData = await resDist.json();
        if (active && distData.success && Array.isArray(distData.data)) {
          setDistricts(distData.data);
          if (distData.data.length > 0) {
            setSelectedDistrict(distData.data[0].id);
          }
        }

        const resConst = await fetch("/api/constituencies");
        const constData = await resConst.json();
        if (active && constData.success && Array.isArray(constData.data)) {
          setConstituencies(constData.data);
        }
      } catch (err) {
        console.error("Error loading districts/constituencies:", err);
      }
    }
    loadLocations();
    return () => {
      active = false;
    };
  }, []);

  // Update constituency when filtered list changes or restricted by citizen session
  useEffect(() => {
    if (session?.role === "citizen" && session.constituency) {
      setConstituency(session.constituency);
    } else if (filteredConstituencies.length > 0) {
      const matches = filteredConstituencies.some(c => c.name.toLowerCase() === constituency.toLowerCase());
      if (!matches) {
        setConstituency(filteredConstituencies[0].name);
      }
    }
  }, [filteredConstituencies, constituency, session]);

  // Geo Handler
  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setGeoStatus("error");
      setGeoError("Geolocation is not supported by your browser");
      return;
    }

    setGeoStatus("fetching");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toFixed(6));
        setLongitude(position.coords.longitude.toFixed(6));
        setGeoStatus("success");
      },
      (error) => {
        console.warn("Geolocation warning:", error.message || error);
        setGeoStatus("error");
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setGeoError("Permission denied. Try clicking a Preset city below!");
            break;
          case error.POSITION_UNAVAILABLE:
            setGeoError("Location info unavailable. Try clicking a Preset city below!");
            break;
          case error.TIMEOUT:
            setGeoError("Location request timed out. Try clicking a Preset city below!");
            break;
          default:
            setGeoError("Could not retrieve GPS coordinates.");
        }
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Preset Selection Helper
  const applyPreset = (preset: CoordinatePreset) => {
    setLatitude(preset.lat.toString());
    setLongitude(preset.lng.toString());
    setSelectedDistrict(preset.districtId);
    if (preset.constituency) {
      setConstituency(preset.constituency);
    }
    setGeoStatus("success");
  };

  // Image or Video Selection Handler
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImage(file);
      const isVideo = file.type.startsWith("video/");
      setMediaType(isVideo ? "video" : "image");
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Drag and Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (file.type.startsWith("image/") || file.type.startsWith("video/")) {
        setImage(file);
        const isVideo = file.type.startsWith("video/");
        setMediaType(isVideo ? "video" : "image");
        const reader = new FileReader();
        reader.onloadend = () => {
          setImagePreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleRemoveImage = () => {
    setImage(null);
    setImagePreview("");
    setMediaType(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");

    const hasCoords = latitude.trim() && longitude.trim();
    const hasAddress = address.trim();

    if (!title.trim() || !reporterName.trim() || !description.trim() || (!hasCoords && !hasAddress)) {
      setSubmitError(
        "Please fill out all required fields: Title, Your Name, Description, and either GPS Coordinates or physical Address."
      );
      return;
    }

    if (latitude.trim() || longitude.trim()) {
      if (!latitude.trim() || !longitude.trim()) {
        setSubmitError("If you provide GPS coordinates, both Latitude and Longitude are required.");
        return;
      }
      const latVal = Number(latitude);
      const lngVal = Number(longitude);
      if (isNaN(latVal) || isNaN(lngVal)) {
        setSubmitError("Latitude and Longitude must be valid numbers.");
        return;
      }
    }

    if (!agreedToTruthDeclaration) {
      setSubmitError("Please confirm that the information you are submitting is true before continuing.");
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("title", title.trim());
      formData.append("description", description.trim());
      if (hasCoords) {
        formData.append("latitude", latitude);
        formData.append("longitude", longitude);
      }
      if (hasAddress) {
        formData.append("address", address.trim());
      }
      formData.append("district", session?.role === "citizen" && session.district ? session.district : selectedDistrictName);
      formData.append("constituency", session?.role === "citizen" && session.constituency ? session.constituency : constituency);
      formData.append("severity", severity);
      if (session?.email) {
        formData.append("citizenId", session.email);
      }
      formData.append("reporterName", reporterName.trim());
      if (image) {
        formData.append("image", image);
      }

      const response = await fetch("/api/issues", {
        method: "POST",
        body: formData,
      });

      const resText = await response.text();
      let resJson: any = {};
      try {
        resJson = JSON.parse(resText);
      } catch (parseErr) {
        console.error("Failed to parse response as JSON:", resText);
      }

      if (!response.ok) {
        throw new Error(resJson.message || `Failed to submit the report (Status: ${response.status}).`);
      }

      setSubmitSuccess(true);
      onIssueReported();

      // Reset form
      setTitle("");
      setDescription("");
      setReporterName(session?.name || "Anonymous Citizen");
      setLatitude("");
      setLongitude("");
      setAddress("");
      setAgreedToTruthDeclaration(false);
      setImage(null);
      setImagePreview("");
      setMediaType(null);
    } catch (err: any) {
      console.error("Submission error:", err);
      setSubmitError(err.message || "Could not reach the server. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (session?.role === "collector" || session?.role === "mla") {
    const isCollector = session?.role === "collector";
    const isMla = session?.role === "mla";
    
    let roleTitle = "District Collector";
    let targetTab: ActiveTab = "collector";
    if (isMla) {
      roleTitle = "MLA";
      targetTab = "mla";
    }

    return (
      <div className="max-w-3xl mx-auto py-12 animate-fadeIn">
        <div className="bg-white border border-stone-200 p-8 sm:p-12 space-y-6 rounded-sm text-center">
          <div className="w-12 h-12 rounded-full bg-gov-cream-200 flex items-center justify-center mx-auto text-gov-maroon-950">
            <AlertCircle size={24} />
          </div>
          <h3 className="font-display font-black text-xl uppercase tracking-tight text-gov-maroon-950">
            Action Unauthorized
          </h3>
          <p className="text-stone-500 text-sm leading-relaxed max-w-md mx-auto uppercase tracking-wide">
            As an {roleTitle}, you are not authorized to log public incidents. Your jurisdiction is designated for administrative oversight and issue resolution.
          </p>
          <div className="pt-4">
            <button
              onClick={() => setActiveTab(targetTab)}
              className="px-6 py-3 border-2 border-gov-maroon-900 bg-gov-maroon-900 text-white text-xs font-black uppercase tracking-[0.2em] hover:bg-white hover:text-gov-maroon-900 transition-all cursor-pointer"
            >
              Go to {roleTitle} Room
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 animate-fadeIn">
      <div className="bg-white border border-stone-200 p-8 sm:p-12 space-y-10 rounded-sm">
        
        {/* Form Header */}
        <div className="border-b border-stone-200 pb-6 space-y-3">
          <span className="text-[10px] font-black tracking-[0.3em] uppercase text-stone-400 block">
            ENTRY PROTOCOL
          </span>
          <h2 className="font-display font-black text-3xl sm:text-4xl uppercase tracking-tight text-gov-maroon-950">
            Report Local Incident
          </h2>
          <p className="text-stone-500 text-xs sm:text-sm uppercase tracking-wide leading-relaxed max-w-2xl">
            Please catalog the community issue precisely. Coordinates and clear photographic documentation are required to activate maintenance response workflows.
          </p>
        </div>

        {submitSuccess ? (
          <div className="bg-gov-cream-100 border border-stone-200 p-8 text-center space-y-6 rounded-sm">
            <div className="w-12 h-12 bg-gov-maroon-900 text-white rounded-sm flex items-center justify-center mx-auto">
              <Check size={20} />
            </div>
            <div className="space-y-2">
              <h3 className="font-display font-black text-lg uppercase tracking-tight text-gov-maroon-950">Report Successfully Logged</h3>
              <p className="text-stone-500 text-xs sm:text-sm uppercase tracking-wide max-w-md mx-auto leading-relaxed">
                Thank you for documenting this friction. Your report has been integrated into the central public registry.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 justify-center pt-2">
              <button
                onClick={() => setSubmitSuccess(false)}
                className="border border-gov-maroon-900 px-6 py-3 text-xs font-bold uppercase tracking-widest hover:bg-gov-maroon-900 hover:text-white transition-all rounded-sm cursor-pointer"
              >
                File Another Incident
              </button>
              <button
                onClick={() => setActiveTab("dashboard")}
                className="bg-gov-maroon-900 text-white px-6 py-3 text-xs font-bold uppercase tracking-widest hover:bg-gov-maroon-800 transition-all rounded-sm cursor-pointer"
              >
                View Feed
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-8">
            {submitError && (
              <div className="bg-gov-maroon-900 text-white p-5 rounded-sm flex gap-3 items-start text-xs uppercase tracking-wide">
                <AlertCircle className="shrink-0 text-stone-400" size={16} />
                <span>{submitError}</span>
              </div>
            )}

            {/* Title field */}
            <div className="space-y-2">
              <label htmlFor="issue-title" className="block text-[10px] font-black tracking-widest uppercase text-stone-400">
                Issue Title / Header <span className="text-gov-maroon-900">*</span>
              </label>
              <input
                id="issue-title"
                type="text"
                placeholder="e.g. Broken Lighting Grid B"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={80}
                required
                className="w-full px-4 py-3.5 border border-stone-200 focus:border-gov-maroon-900 focus:ring-0 outline-none text-gov-maroon-900 text-sm placeholder-stone-400 rounded-sm bg-gov-cream-100/20 transition-all"
              />
            </div>

            {/* Description field */}
            <div className="space-y-2">
              <label htmlFor="issue-desc" className="block text-[10px] font-black tracking-widest uppercase text-stone-400">
                Detailed Case Description <span className="text-gov-maroon-900">*</span>
              </label>
              <textarea
                id="issue-desc"
                rows={4}
                placeholder="Specify precise context, potential commuting risks, sizing parameters, and temporal background of the incident."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={1000}
                required
                className="w-full px-4 py-3.5 border border-stone-200 focus:border-gov-maroon-900 focus:ring-0 outline-none text-gov-maroon-900 text-sm placeholder-stone-400 rounded-sm bg-gov-cream-100/20 resize-y transition-all"
              />
            </div>

            {/* District & Constituency Selection Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label htmlFor="district-select" className="block text-[10px] font-black tracking-widest uppercase text-stone-400">
                  Select District <span className="text-gov-maroon-900">*</span>
                </label>
                {session?.role === "citizen" && session.district ? (
                  <div className="w-full px-4 py-3.5 border border-stone-200 text-gov-maroon-900 text-sm font-bold uppercase tracking-wider bg-gov-cream-200">
                    {session.district} (Locked to Residence)
                  </div>
                ) : (
                  <select
                    id="district-select"
                    value={selectedDistrict}
                    onChange={(e) => setSelectedDistrict(e.target.value)}
                    className="w-full px-4 py-3.5 border border-stone-200 focus:border-gov-maroon-900 focus:ring-0 outline-none text-gov-maroon-900 text-sm rounded-sm bg-gov-cream-100/20 transition-all appearance-none cursor-pointer font-medium"
                  >
                    {activeDistricts.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="space-y-2">
                <label htmlFor="constituency-select" className="block text-[10px] font-black tracking-widest uppercase text-stone-400">
                  Select Constituency <span className="text-gov-maroon-900">*</span>
                </label>
                {session?.role === "citizen" && session.constituency ? (
                  <div className="w-full px-4 py-3.5 border border-stone-200 text-gov-maroon-900 text-sm font-bold uppercase tracking-wider bg-gov-cream-200">
                    {session.constituency} (Locked to Residence)
                  </div>
                ) : (
                  <select
                    id="constituency-select"
                    value={constituency}
                    onChange={(e) => setConstituency(e.target.value)}
                    disabled={filteredConstituencies.length === 0}
                    className="w-full px-4 py-3.5 border border-stone-200 focus:border-gov-maroon-900 focus:ring-0 outline-none text-gov-maroon-900 text-sm rounded-sm bg-gov-cream-100/20 transition-all appearance-none cursor-pointer font-medium disabled:opacity-50"
                  >
                    {filteredConstituencies.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Severity Level Selection */}
            <div className="space-y-2">
              <label className="block text-[10px] font-black tracking-widest uppercase text-stone-400">
                Severity Level <span className="text-gov-maroon-900">*</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(["Low", "Medium", "High"] as const).map((level) => {
                  const activeColors = {
                    Low: "bg-green-50 text-gov-green-700 border-gov-green-600",
                    Medium: "bg-gov-gold-100 text-gov-gold-700 border-gov-gold-500",
                    High: "bg-red-50 text-red-700 border-red-600",
                  };
                  return (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setSeverity(level)}
                      className={`py-3.5 text-xs font-bold uppercase tracking-widest border text-center transition-all duration-150 rounded-sm cursor-pointer ${
                        severity === level
                          ? activeColors[level]
                          : "bg-white border-stone-200 text-stone-500 hover:text-gov-maroon-900 hover:border-stone-400"
                      }`}
                    >
                      {level}
                    </button>
                  );
                })}
              </div>
            </div>
                        {/* Location Panel (Coordinates and/or Address) */}
            <div className="bg-gov-cream-100 border border-stone-200 p-6 space-y-6 rounded-sm">
              <div className="flex items-center gap-2 border-b border-stone-200 pb-4">
                <MapPin className="text-gov-maroon-900" size={16} />
                <span className="text-[10px] font-black tracking-widest uppercase text-gov-maroon-800">
                  Location of Issue <span className="text-stone-400">*</span>
                </span>
              </div>

              <div className="space-y-6">
                {/* GPS section */}
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                    <span className="text-[10px] font-black tracking-widest uppercase text-stone-500">
                      GPS Coordinates (Option A)
                    </span>
                    <button
                      type="button"
                      onClick={handleGetLocation}
                      disabled={geoStatus === "fetching"}
                      className="border border-gov-maroon-900 bg-white hover:bg-gov-maroon-900 hover:text-white px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-all rounded-sm cursor-pointer disabled:opacity-50 self-start sm:self-auto"
                    >
                      {geoStatus === "fetching" ? "Locating..." : "Use Live GPS Location"}
                    </button>
                  </div>

                  {geoStatus === "error" && (
                    <div className="text-[10px] text-stone-600 bg-gov-cream-200 border border-stone-200 p-3 rounded-sm uppercase tracking-wider leading-relaxed">
                      {geoError}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label htmlFor="latitude" className="block text-[10px] font-bold tracking-widest uppercase text-stone-400">
                        Latitude
                      </label>
                      <input
                        id="latitude"
                        type="text"
                        placeholder="e.g. 13.0827"
                        value={latitude}
                        onChange={(e) => setLatitude(e.target.value)}
                        className="w-full px-4 py-3 border border-stone-200 focus:border-gov-maroon-900 focus:ring-0 outline-none text-gov-maroon-900 text-xs font-sans bg-white rounded-sm transition-all"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="longitude" className="block text-[10px] font-bold tracking-widest uppercase text-stone-400">
                        Longitude
                      </label>
                      <input
                        id="longitude"
                        type="text"
                        placeholder="e.g. 80.2707"
                        value={longitude}
                        onChange={(e) => setLongitude(e.target.value)}
                        className="w-full px-4 py-3 border border-stone-200 focus:border-gov-maroon-900 focus:ring-0 outline-none text-gov-maroon-900 text-xs font-sans bg-white rounded-sm transition-all"
                      />
                    </div>
                  </div>

                  {/* Interactive Leaflet Map for pinpointing location */}
                  <div className="space-y-2 pt-2">
                    <span className="block text-[10px] font-bold tracking-widest uppercase text-stone-400">
                      Interactive Map (Click Map to Drop Pin)
                    </span>
                    <div className="border border-stone-200 h-[220px] w-full overflow-hidden relative" style={{ zIndex: 1 }}>
                      <MapContainer
                        center={[11.1271, 78.6569]} // default center of Tamil Nadu
                        zoom={7}
                        style={{ width: "100%", height: "100%" }}
                        scrollWheelZoom={true}
                      >
                        <TileLayer
                          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        <MapEventsHandler
                          onMapClick={(lat, lng) => {
                            setLatitude(lat.toFixed(6));
                            setLongitude(lng.toFixed(6));
                            setGeoStatus("success");
                          }}
                          center={(() => {
                            const latVal = parseFloat(latitude);
                            const lngVal = parseFloat(longitude);
                            if (!isNaN(latVal) && !isNaN(lngVal)) {
                              return [latVal, lngVal];
                            }
                            // Fallback to selected district center
                            const center = DISTRICT_CENTERS[selectedDistrict.toLowerCase()];
                            if (center) {
                              return center;
                            }
                            return undefined;
                          })()}
                        />
                        {(() => {
                          const latVal = parseFloat(latitude);
                          const lngVal = parseFloat(longitude);
                          if (!isNaN(latVal) && !isNaN(lngVal)) {
                            return <Marker position={[latVal, lngVal]} icon={reportMapIcon} />;
                          }
                          return null;
                        })()}
                      </MapContainer>
                    </div>
                    <p className="text-[10px] text-stone-400 uppercase tracking-wide">
                      Tip: You can search or pan on the map and click anywhere to automatically set Latitude and Longitude coordinates.
                    </p>
                  </div>

                  {/* Coordinates Presets Quick-fill */}
                  {session?.role !== "citizen" && (
                    <div className="space-y-2 pt-2">
                      <span className="block text-[10px] font-bold tracking-widest uppercase text-stone-400">
                        Quick Sandbox Presets:
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {PRESETS.map((preset) => (
                          <button
                            key={preset.name}
                            type="button"
                            onClick={() => applyPreset(preset)}
                            className="px-3 py-1.5 text-[10px] font-sans font-bold border border-stone-200 bg-white text-gov-maroon-700 hover:bg-gov-maroon-900 hover:border-gov-maroon-900 hover:text-white transition-all rounded-sm cursor-pointer"
                          >
                            {preset.name.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Divider line between GPS and physical address */}
                <div className="relative flex py-2 items-center">
                  <div className="flex-grow border-t border-stone-200"></div>
                  <span className="flex-shrink mx-4 text-[9px] font-sans text-stone-400 uppercase tracking-widest font-black">AND / OR</span>
                  <div className="flex-grow border-t border-stone-200"></div>
                </div>

                {/* Physical Address section */}
                <div className="space-y-1.5">
                  <label htmlFor="address-text" className="block text-[10px] font-black tracking-widest uppercase text-stone-500">
                    Physical Address (Option B)
                  </label>
                  <textarea
                    id="address-text"
                    rows={3}
                    placeholder="e.g. 24, Gandhi Street, Near Bus Stand, T. Nagar, Chennai - 600017"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    maxLength={300}
                    className="w-full px-4 py-3 border border-stone-200 focus:border-gov-maroon-900 focus:ring-0 outline-none text-gov-maroon-900 text-sm bg-white rounded-sm transition-all resize-y"
                  />
                  <p className="text-[10px] text-stone-400 uppercase tracking-wide pt-1">
                    Please provide a clear location, address, or landmark description. At least one location reference (GPS or physical address) is required.
                  </p>
                </div>
              </div>
            </div>

            {/* Photo / Video upload section */}
            <div className="space-y-2">
              <label className="block text-[10px] font-black tracking-widest uppercase text-stone-400">
                Evidence Media (Photograph or Video) <span className="text-stone-300 font-normal">(Highly Recommended)</span>
              </label>

              {imagePreview ? (
                <div className="relative border border-stone-200 rounded-sm p-3 bg-gov-cream-100/50">
                  {mediaType === "video" ? (
                    <video
                      src={imagePreview}
                      controls
                      className="w-full h-56 object-cover rounded-sm border border-stone-200"
                    />
                  ) : (
                    <img
                      src={imagePreview}
                      alt="Uploaded preview"
                      className="w-full h-56 object-cover rounded-sm border border-stone-200 grayscale hover:grayscale-0 transition-all duration-300"
                    />
                  )}
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="absolute top-6 right-6 bg-gov-maroon-950 text-white rounded-sm px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-all cursor-pointer shadow-md z-10"
                  >
                    Delete Media
                  </button>
                </div>
              ) : (
                <div
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="border border-dashed border-stone-300 hover:border-gov-maroon-900 hover:bg-gov-cream-100/50 transition-all rounded-sm p-12 text-center cursor-pointer space-y-4 group"
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageChange}
                    accept="image/*,video/*"
                    className="hidden"
                  />
                  <div className="w-10 h-10 bg-gov-cream-200 group-hover:bg-gov-maroon-900 group-hover:text-white text-stone-500 rounded-sm flex items-center justify-center mx-auto transition-colors">
                    <Upload size={16} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold uppercase tracking-widest text-gov-maroon-700">
                      Click to choose image or video, or drag & drop here
                    </p>
                    <p className="text-[10px] font-sans text-stone-400">
                      PNG, JPG, MP4, WEBM, MOV up to 25MB
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Legal Warning + Truth Declaration */}
            <div className="bg-gov-maroon-900 text-white p-6 space-y-4 rounded-sm border border-gov-maroon-900">
              <div className="flex items-start gap-3">
                <AlertTriangle size={18} className="text-stone-300 shrink-0 mt-0.5" />
                <div className="space-y-1.5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-stone-300">
                    Warning: False Reporting is a Punishable Offence
                  </p>
                  <p className="text-xs text-stone-400 leading-relaxed">
                    This platform is a civic tool for genuine public grievances. Filing a false, exaggerated, or
                    fabricated complaint — including against a real person, official, or department — can lead to
                    legal action under applicable law, including penalties for misuse of a government grievance
                    system. Please ensure that everything you submit is accurate to the best of your knowledge.
                  </p>
                </div>
              </div>

              <label className="flex items-start gap-3 pt-3 border-t border-gov-maroon-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={agreedToTruthDeclaration}
                  onChange={(e) => setAgreedToTruthDeclaration(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-white shrink-0 cursor-pointer"
                />
                <span className="text-xs text-stone-300 leading-relaxed">
                  I confirm that the information provided in this report is true and accurate to the best of my
                  knowledge, and I understand that submitting a false complaint may result in legal action.
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={isSubmitting || !agreedToTruthDeclaration}
                className="border-2 border-gov-maroon-900 bg-gov-maroon-900 text-white hover:bg-white hover:text-gov-maroon-900 py-4 px-8 text-xs font-black uppercase tracking-[0.2em] transition-all rounded-sm w-full flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Logging Incident Protocol...</span>
                  </>
                ) : (
                  <>
                    <span>Submit Incident Report</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}