import React, { useState, useEffect, useMemo } from "react";
import { Sparkles, Loader2, RefreshCw, Layers, AlertTriangle, Info, MapPin, Calendar, CheckCircle, Clock, Star } from "lucide-react";
import { Issue, UserSession } from "../types.ts";
import StatusTracker from "./StatusTracker.tsx";
import { calculateCitizenStats } from "../utils/gamification.ts";

interface AiIssueCategoryPageProps {
  issues: Issue[];
  session: UserSession | null;
  onToggleUpvote?: (id: string) => Promise<void> | void;
  onUpdateStatus?: (id: string, status: string, response?: string) => Promise<void> | void;
}

interface AICategoryIssue {
  id: string;
  title: string;
  originalCategory: string;
  urgencyLevel: "High" | "Medium" | "Low" | "Critical";
  aiReasoning: string;
  preventiveAction: string;
}

interface AICategory {
  name: string;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  issues: AICategoryIssue[];
}

interface AICategorizationData {
  summary: string;
  categories?: AICategory[];
  isFallback?: boolean;
}

export default function AiIssueCategoryPage({ issues = [], session, onToggleUpvote, onUpdateStatus }: AiIssueCategoryPageProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AICategorizationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedDetailsIssue, setSelectedDetailsIssue] = useState<Issue | null>(null);

  const gamification = useMemo(() => {
    return calculateCitizenStats(issues, session);
  }, [issues, session]);
  // Tracks whether we've already run an initial classification for the
  // current district/constituency filter. Used so that updating an issue's
  // status (e.g. a collector marking it Resolved) doesn't yank the collector
  // back into the full-page "Running AI Classifiers..." loading screen.
  const hasLoadedRef = React.useRef(false);

  // Filter and Location selection states
  const [districts, setDistricts] = useState<{ id: string; name: string }[]>([]);
  const [constituencies, setConstituencies] = useState<{ id: string; name: string; districtId: string }[]>([]);
  
  const [selectedDistrict, setSelectedDistrict] = useState<string>("All");
  const [selectedConstituency, setSelectedConstituency] = useState<string>("All");

  // Determine user role and bounds
  const userRole = session?.role || "citizen";
  const userDistrict = session?.role === "collector" ? session.assignedDistrict : undefined;
  const userConstituency = session?.role === "mla" ? session.assignedConstituency : undefined;

  // Load Tamil Nadu districts and constituencies
  useEffect(() => {
    let active = true;
    async function fetchLocations() {
      try {
        const [resDist, resConst] = await Promise.all([
          fetch("/api/districts").then((r) => r.json()),
          fetch("/api/constituencies").then((r) => r.json()),
        ]);
        if (active) {
          if (resDist.success && Array.isArray(resDist.data)) {
            setDistricts(resDist.data);
          }
          if (resConst.success && Array.isArray(resConst.data)) {
            setConstituencies(resConst.data);
          }
        }
      } catch (err) {
        console.error("Error loading location metadata:", err);
      }
    }
    fetchLocations();
    return () => {
      active = false;
    };
  }, []);

  // Initialize selected location filters based on roles
  useEffect(() => {
    if (userRole === "collector" && userDistrict) {
      setSelectedDistrict(userDistrict);
      setSelectedConstituency("All");
    } else if (userRole === "mla" && userConstituency) {
      setSelectedConstituency(userConstituency);
      // Try to find the district for this constituency
      const matchedConst = constituencies.find(
        (c) => c.name.toLowerCase() === userConstituency.toLowerCase()
      );
      if (matchedConst) {
        const matchedDist = districts.find((d) => d.id === matchedConst.districtId);
        if (matchedDist) {
          setSelectedDistrict(matchedDist.name);
        }
      }
    }
  }, [userRole, userDistrict, userConstituency, constituencies, districts]);

  // Filter constituencies dropdown options based on selected district
  const filteredConstituencyOptions = React.useMemo(() => {
    if (selectedDistrict === "All") {
      return constituencies;
    }
    const matchedDist = districts.find(
      (d) => d.name.toLowerCase() === selectedDistrict.toLowerCase()
    );
    if (!matchedDist) return [];
    return constituencies.filter((c) => c.districtId === matchedDist.id);
  }, [selectedDistrict, constituencies, districts]);

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "Resolved":
        return {
          wrapper: "border border-gov-maroon-900 bg-white text-gov-maroon-900",
          label: "RESOLVED",
        };
      case "In Progress":
        return {
          wrapper: "bg-gov-maroon-900 text-white border border-gov-maroon-900",
          label: "IN PROGRESS",
        };
      case "Reported":
      default:
        return {
          wrapper: "border border-stone-200 bg-gov-cream-100 text-stone-500",
          label: "REPORTED",
        };
    }
  };

  // Run AI Categorization Analysis.
  // `silent` skips the full-page loading screen — used when we're just
  // re-syncing in the background (e.g. after a status update) rather than
  // a fresh load or an explicit "Refresh AI Analysis" click.
  const runCategorization = async (silent = false) => {
    if (!silent) {
      setLoading(true);
    }
    setError(null);
    try {
      let queryUrl = "/api/issues/ai-categorized-overview";
      const params = new URLSearchParams();
      if (selectedConstituency !== "All") {
        params.append("constituency", selectedConstituency);
      } else if (selectedDistrict !== "All") {
        params.append("district", selectedDistrict);
      }
      if (params.toString()) {
        queryUrl += `?${params.toString()}`;
      }

      const response = await fetch(queryUrl);
      const resJson = await response.json();
      if (resJson.success && resJson.data) {
        setData(resJson.data);
      } else {
        setError(resJson.error || "Failed to analyze issues. Verify your Gemini API Key.");
      }
    } catch (err: any) {
      console.error(err);
      setError("An unexpected network error occurred while running AI classification.");
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const handleQuickStatusUpdate = async (issueId: string, status: string) => {
    if (onUpdateStatus) {
      await onUpdateStatus(issueId, status);
      // Trigger a silent background refresh to update the categorization list counts!
      runCategorization(true);
    }
  };

  // Automatically run first analysis once districts and filters load.
  // Only the FIRST run for a given district/constituency filter shows the
  // full-page loading screen. If the collector changes filters again later,
  // hasLoadedRef resets so that change still shows the loading state (since
  // the visible data is now stale for the new region), but unrelated parent
  // re-renders (e.g. from clicking "Mark Resolved") won't refire this at all
  // since `issues` is intentionally not a dependency here.
  useEffect(() => {
    if (districts.length > 0 && constituencies.length > 0) {
      hasLoadedRef.current = true;
      runCategorization();
    }
  }, [selectedConstituency, selectedDistrict, districts, constituencies]);


  return (
    <div className="space-y-8 animate-fadeIn pt-4" id="ai-issue-category-page-container">
      
      {/* Page Header */}
      <div className="border-b border-stone-200 pb-5 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1.5">
          <span className="text-[9px] font-black tracking-[0.3em] text-stone-400 uppercase font-sans">
            AI-POWERED CATEGORY OVERVIEW
          </span>
          <h1 className="text-3xl font-black uppercase tracking-tight text-gov-maroon-900 font-display flex items-center gap-2">
            <Sparkles className="text-gov-maroon-950 shrink-0" size={28} />
            AI Issue Category Overview
          </h1>
          <p className="text-xs text-stone-500 uppercase tracking-wider font-sans">
            District and constituency-wide view of all complaints grouped by AI-assigned category and urgency — High, Medium, or Low.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => runCategorization()}
            disabled={loading}
            className="inline-flex items-center gap-2 text-[10px] font-sans font-bold px-3.5 py-2 bg-gov-maroon-950 text-white uppercase tracking-wider hover:bg-gov-maroon-800 disabled:opacity-50 cursor-pointer transition-colors"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={12} />
                Classifying...
              </>
            ) : (
              <>
                <RefreshCw size={12} />
                Refresh AI Analysis
              </>
            )}
          </button>
        </div>
      </div>

      {/* Region Selector Bar */}
      <div className="bg-white border border-stone-200 p-5 font-sans text-xs text-gov-maroon-700 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-end">
        
        {/* District Filter Selector */}
        <div className="space-y-1.5">
          <label className="text-[9px] font-black tracking-widest text-stone-400 uppercase block">
            1. Target District Selection
          </label>
          {userRole === "collector" ? (
            <div className="bg-gov-cream-200 border border-stone-200 p-2.5 font-bold text-gov-maroon-800 uppercase tracking-wider">
              {selectedDistrict} (Your Assigned District)
            </div>
          ) : userRole === "mla" ? (
            <div className="bg-gov-cream-200 border border-stone-200 p-2.5 font-bold text-gov-maroon-800 uppercase tracking-wider">
              {selectedDistrict || "District"}
            </div>
          ) : (
            <select
              value={selectedDistrict}
              onChange={(e) => {
                setSelectedDistrict(e.target.value);
                setSelectedConstituency("All");
              }}
              className="w-full bg-white border border-stone-200 p-2 text-xs uppercase font-bold text-gov-maroon-800 outline-none focus:border-gov-maroon-900"
            >
              <option value="All">All Tamil Nadu Districts</option>
              {districts.map((d) => (
                <option key={d.id} value={d.name}>
                  {d.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Constituency Filter Selector */}
        <div className="space-y-1.5">
          <label className="text-[9px] font-black tracking-widest text-stone-400 uppercase block">
            2. Constituency Filter
          </label>
          {userRole === "mla" ? (
            <div className="bg-gov-cream-200 border border-stone-200 p-2.5 font-bold text-gov-maroon-800 uppercase tracking-wider">
              {selectedConstituency} (Your Constituency)
            </div>
          ) : (
            <select
              value={selectedConstituency}
              onChange={(e) => setSelectedConstituency(e.target.value)}
              className="w-full bg-white border border-stone-200 p-2 text-xs uppercase font-bold text-gov-maroon-800 outline-none focus:border-gov-maroon-900"
            >
              <option value="All">All Constituencies</option>
              {filteredConstituencyOptions.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Info/Scope Indicator badge */}
        <div className="md:col-span-2 lg:col-span-1 bg-gov-cream-100 border border-stone-200/60 p-3 flex items-start gap-2.5 text-[10px] text-stone-500">
          <Info size={14} className="text-stone-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold text-gov-maroon-700 block uppercase text-[8px] tracking-wide">
              {userRole === "citizen" ? "Public Citizen Access" : `${userRole.toUpperCase()} ACCESS LOCK`}
            </span>
            <p className="leading-relaxed">
              {userRole === "citizen"
                ? "Citizens can query and analyze any district or constituency in Tamil Nadu."
                : `Locked region constraints apply. You are restricted to viewing insights for ${
                    userRole === "collector" ? `district "${selectedDistrict}"` : `constituency "${selectedConstituency}"`
                  }.`}
            </p>
          </div>
        </div>

      </div>

      {loading ? (
        <div className="py-28 text-center space-y-4">
          <Loader2 className="mx-auto text-gov-maroon-800 animate-spin" size={44} />
          <div className="space-y-1">
            <h3 className="text-xs font-sans font-black text-gov-maroon-800 uppercase tracking-widest">
              Running AI Classifiers & Urgencies
            </h3>
            <p className="text-[10px] text-stone-500 font-sans uppercase tracking-wider max-w-[340px] mx-auto leading-normal">
              Analyzing active reports in {selectedConstituency === "All" ? (selectedDistrict === "All" ? "Tamil Nadu" : selectedDistrict) : selectedConstituency} through Gemini modeling.
            </p>
          </div>
        </div>
      ) : error ? (
        <div className="max-w-xl mx-auto p-6 bg-red-50 border border-red-200 text-center space-y-4">
          <AlertTriangle className="mx-auto text-red-600" size={32} />
          <div className="space-y-1">
            <h3 className="text-xs font-sans font-black text-gov-maroon-800 uppercase tracking-widest">
              AI Classifier Mode Offline
            </h3>
            <p className="text-xs text-red-700 font-sans">
              {error}
            </p>
          </div>
          <button
            onClick={() => runCategorization()}
            className="bg-gov-maroon-900 hover:bg-gov-maroon-950 text-white font-sans text-[9px] font-bold uppercase tracking-widest px-4 py-2 border border-gov-maroon-950"
          >
            Retry Analysis
          </button>
        </div>
      ) : data ? (
        <div className="space-y-8">
          
          {/* Executive Summary Card */}
          <div className="bg-white text-gov-maroon-900 p-6 border border-stone-200 space-y-3 rounded-sm shadow-sm">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Layers size={14} className="text-gov-gold-700" />
                <span className="text-[9px] font-sans tracking-[0.2em] text-stone-500 block uppercase">
                  Cognitive Summary Report
                </span>
              </div>
              {data.isFallback && (
                <span className="text-[8px] font-sans font-bold bg-gov-gold-100 border border-gov-gold-500/30 text-gov-gold-700 px-2 py-0.5 uppercase tracking-widest rounded-sm">
                  Offline Rule-Based Fallback Active
                </span>
              )}
            </div>
            <h2 className="text-base font-bold tracking-tight text-gov-maroon-950 font-sans leading-tight">
              AI Insight Summary for {selectedConstituency === "All" ? (selectedDistrict === "All" ? "All Regions" : `${selectedDistrict} District`) : `${selectedConstituency} Constituency`}
            </h2>
            <p className="text-xs text-stone-600 font-sans leading-relaxed">
              {data.summary || "No active issues to analyze for this constituency or district."}
            </p>
            {data.isFallback && (
              <p className="text-[10px] text-gov-gold-700 font-sans bg-gov-gold-100 p-2.5 border border-gov-gold-500/20 leading-normal rounded-sm">
                Notice: Standard Gemini API quota limits or rate restrictions are active in this workspace. 
                The platform automatically deployed a high-speed, local rule-based civic classifier to keep your experience completely active and responsive.
              </p>
            )}
          </div>

          {/* AI Categories Breakdown Grid */}
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-stone-200 pb-2">
              <h3 className="text-sm font-black uppercase text-gov-maroon-950 font-sans tracking-wide">
                AI Category Breakdown & Dispatch Workbench
              </h3>
              <span className="text-[9px] font-sans font-bold text-stone-400 uppercase tracking-widest">
                Showing {data.categories?.length || 0} Sectors
              </span>
            </div>

            <div className="grid grid-cols-1 gap-6">
              {data.categories?.map((cat) => {
                const hasIssues = cat.issues && cat.issues.length > 0;
                
                return (
                  <div key={cat.name} className="bg-white border border-stone-200 shadow-sm rounded-sm overflow-hidden">
                    {/* Category Header */}
                    <div className="bg-gov-cream-100 border-b border-stone-200 px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <h4 className="text-sm font-bold uppercase tracking-tight text-gov-maroon-950 font-sans">
                          {cat.name}
                        </h4>
                        <span className="text-[9px] font-sans text-stone-400 uppercase tracking-wider block">
                          Hyperlocal Public Sector Categorization
                        </span>
                      </div>
                      
                      {/* Urgency Counts Pills */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {cat.highCount > 0 && (
                          <span className="bg-red-50 text-red-700 border border-red-600 px-2 py-0.5 text-[9px] font-sans font-bold uppercase tracking-wide rounded-sm">
                            {cat.highCount} High/Critical
                          </span>
                        )}
                        {cat.mediumCount > 0 && (
                          <span className="bg-gov-gold-100 text-gov-gold-700 border border-gov-gold-500 px-2 py-0.5 text-[9px] font-sans font-bold uppercase tracking-wide rounded-sm">
                            {cat.mediumCount} Medium
                          </span>
                        )}
                        {cat.lowCount > 0 && (
                          <span className="bg-green-50 text-gov-green-700 border border-gov-green-600 px-2 py-0.5 text-[9px] font-sans font-bold uppercase tracking-wide rounded-sm">
                            {cat.lowCount} Low
                          </span>
                        )}
                        {!hasIssues && (
                          <span className="bg-stone-50 text-stone-400 border border-stone-200 px-2 py-0.5 text-[9px] font-sans font-bold uppercase tracking-wide rounded-sm">
                            0 Issues Active
                          </span>
                        )}
                      </div>
                    </div>

{/* Category Issues List */}
                    <div className="p-5">
                      {!hasIssues ? (
                        <p className="text-[11px] font-sans text-stone-400 uppercase tracking-wider py-2">
                          No active complaints flagged in this category for the selected filter.
                        </p>
                      ) : (
                        <div className={
                          session?.role === "collector" || session?.role === "mla"
                            ? "space-y-6"
                            : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                        }>
                          {cat.issues.map((item) => {
                            const fullIssue = issues.find(i => i._id === item.id);
                            if (!fullIssue) return null;

                            // 1. Official/Horizontal Card Layout
                            if (session?.role === "collector" || session?.role === "mla") {
                              const reporterStats = gamification.leaderboard.find(
                                (c) => c.email === fullIssue.citizenId || c.name === fullIssue.reporterName
                              );
                              const severityColors = {
                                Low: "border-gov-green-600 text-gov-green-700 bg-green-50",
                                Medium: "border-gov-gold-500 text-gov-gold-700 bg-gov-gold-100",
                                High: "border-red-600 text-red-700 bg-red-50",
                              };

                              return (
                                <div key={fullIssue._id || fullIssue.id} className="border border-stone-200 p-5 bg-gov-cream-100/20 hover:bg-gov-cream-100/50 transition-all rounded-sm flex flex-col lg:flex-row gap-6 justify-between items-start animate-fadeIn text-left">
                                  
                                  {/* Left block: Info & Image */}
                                  <div className="flex flex-col sm:flex-row gap-5 flex-1 text-left items-start">
                                    {fullIssue.videoUrl ? (
                                      <div className="w-full sm:w-32 h-24 bg-gov-cream-200 shrink-0 border border-stone-200">
                                        <video
                                          src={fullIssue.videoUrl}
                                          controls
                                          className="w-full h-full object-cover"
                                        />
                                      </div>
                                    ) : fullIssue.imageUrl ? (
                                      <div className="w-full sm:w-32 h-24 bg-gov-cream-200 shrink-0 border border-stone-200">
                                        <img
                                          src={fullIssue.imageUrl}
                                          alt={fullIssue.title}
                                          className="w-full h-full object-cover grayscale"
                                          referrerPolicy="no-referrer"
                                        />
                                      </div>
                                    ) : null}

                                    <div className="space-y-2 flex-1 min-w-0">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className={`px-2 py-0.5 text-[8px] font-bold uppercase border ${
                                          fullIssue.status === "Resolved"
                                            ? "border-gov-green-600 text-gov-green-700 bg-green-50"
                                            : fullIssue.status === "In Progress"
                                            ? "border-gov-maroon-950 text-white bg-gov-maroon-950"
                                            : "border-stone-300 text-stone-500 bg-gov-cream-100"
                                        }`}>
                                          {fullIssue.status}
                                        </span>
                                        {fullIssue.reReported && (
                                          <span className="px-2 py-0.5 text-[8px] font-bold uppercase border border-red-600 bg-red-50 text-red-700 animate-pulse">
                                            RE-REPORTED
                                          </span>
                                        )}
                                        <span className={`px-2 py-0.5 text-[8px] font-bold uppercase border ${severityColors[fullIssue.severity as keyof typeof severityColors || "Medium"]}`}>
                                          {fullIssue.severity || "Medium"} Severity
                                        </span>
                                        <span className="text-[9px] font-sans text-stone-400">
                                          LOGGED: {new Date(fullIssue.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                                        </span>
                                      </div>

                                      <div className="flex flex-col gap-1 text-[11px] text-stone-500 font-sans">
                                        <div className="flex flex-wrap items-center gap-1.5 uppercase text-[9px] tracking-wider text-stone-400">
                                          <span>Reported By: <strong className="text-gov-maroon-800">{fullIssue.reporterName || "Anonymous Citizen"}</strong></span>
                                          {reporterStats && (
                                            <span className="inline-flex items-center gap-1 bg-gov-gold-500 text-gov-maroon-950 text-[7px] font-sans font-bold px-1.5 py-0.5 leading-none">
                                              <Star size={9} className="inline -mt-0.5 mr-0.5 fill-current" /> {reporterStats.rankTitle.toUpperCase()} ({reporterStats.points} PTS)
                                            </span>
                                          )}
                                          <span>•</span>
                                          <span>On: <strong className="text-gov-maroon-800">{new Date(fullIssue.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}</strong></span>
                                        </div>
                                        
                                        {/* GPS & Address */}
                                        {(() => {
                                          const showGps = fullIssue.hasGps !== undefined ? fullIssue.hasGps : (fullIssue.latitude !== 13.0827 || fullIssue.longitude !== 80.2707);
                                          const showAddress = fullIssue.hasAddress !== undefined ? fullIssue.hasAddress : (!!fullIssue.address && fullIssue.address.trim() !== "");
                                          return (
                                            <div className="flex flex-col gap-1 text-[10px] text-stone-500 font-sans mt-1 text-left">
                                              {showAddress && (
                                                <div className="flex items-start gap-1">
                                                  <span className="font-bold text-gov-maroon-700">ADDRESS:</span>
                                                  <span>{fullIssue.address}</span>
                                                </div>
                                              )}
                                              {showGps && (
                                                <div className="flex items-center gap-1">
                                                  <span className="font-bold text-gov-maroon-700">GPS:</span>
                                                  <span className="bg-gov-cream-200 px-1.5 py-0.5 border border-stone-200/60 text-gov-maroon-800 font-sans text-[9px]">
                                                    {fullIssue.latitude.toFixed(6)}, {fullIssue.longitude.toFixed(6)}
                                                  </span>
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })()}
                                      </div>

                                      <h4 className="font-display font-black text-base uppercase text-gov-maroon-955 font-bold leading-tight mt-1">
                                        {fullIssue.title}
                                      </h4>
                                      <p className="text-stone-600 text-xs sm:text-sm leading-relaxed max-w-2xl mt-1 normal-case">
                                        {fullIssue.description}
                                      </p>
                                      
                                      <StatusTracker currentStatus={fullIssue.status} />
                                      
                                      {fullIssue.officialResponse && (
                                        <div className="bg-white border-l-2 border-gov-maroon-800 p-2.5 mt-2 shadow-xs">
                                          <span className="block text-[8px] font-black uppercase text-stone-400 tracking-wider">OFFICIAL DISPATCH COMMENT:</span>
                                          <p className="text-xs text-gov-maroon-700 font-serif italic">"{fullIssue.officialResponse}"</p>
                                        </div>
                                      )}

                                      {fullIssue.reReported && fullIssue.reReportedComment && (
                                        <div className="bg-red-50 border-l-2 border-red-600 p-2.5 mt-2 shadow-xs">
                                          <span className="block text-[8px] font-black uppercase text-red-600 tracking-wider">CITIZEN RE-REPORT REASON:</span>
                                          <p className="text-xs text-gov-maroon-800 font-sans italic">"{fullIssue.reReportedComment}"</p>
                                        </div>
                                      )}

                                      <div className="text-[9px] font-sans text-stone-400 uppercase mt-2.5">
                                        AI Category: <span className="text-gov-maroon-700 font-bold">{cat.name}</span> | Constituency: <span className="text-gov-maroon-700 font-bold">{fullIssue.constituency}</span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Right block: Operational actions for status updates & comments */}
                                  <div className="w-full lg:w-80 shrink-0 space-y-4 lg:text-right border-t lg:border-t-0 border-stone-200/50 pt-4 lg:pt-0">
                                    <span className="block text-[8px] font-black uppercase text-stone-400 tracking-widest">DISPATCH DIRECTIVE</span>
                                    
                                    <div className="flex flex-wrap lg:justify-end gap-1.5">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          handleQuickStatusUpdate(fullIssue._id || fullIssue.id || "", "Verified");
                                        }}
                                        disabled={fullIssue.status === "Verified"}
                                        className={`px-2.5 py-1.5 text-[9px] font-sans font-bold uppercase border tracking-wider transition-all rounded-sm cursor-pointer ${
                                          fullIssue.status === "Verified"
                                            ? "bg-blue-700 border-blue-800 text-white cursor-not-allowed opacity-85"
                                            : "bg-white border-stone-200 text-stone-500 hover:text-gov-maroon-955 hover:border-stone-400"
                                        }`}
                                      >
                                        Verify Details
                                      </button>

                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          handleQuickStatusUpdate(fullIssue._id || fullIssue.id || "", "In Progress");
                                        }}
                                        className={`px-2.5 py-1.5 text-[9px] font-sans font-bold uppercase border tracking-wider transition-all rounded-sm cursor-pointer ${
                                          fullIssue.status === "In Progress"
                                            ? "bg-gov-maroon-950 border-black text-white"
                                            : "bg-white border-stone-200 text-stone-500 hover:text-gov-maroon-950 hover:border-stone-400"
                                        }`}
                                      >
                                        Dispatch Review
                                      </button>

                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          handleQuickStatusUpdate(fullIssue._id || fullIssue.id || "", "Resolved");
                                        }}
                                        className={`px-2.5 py-1.5 text-[9px] font-sans font-bold uppercase border tracking-wider transition-all rounded-sm cursor-pointer ${
                                          fullIssue.status === "Resolved"
                                            ? "bg-gov-green-600 border-gov-green-600 text-white"
                                            : "bg-white border-stone-200 text-stone-500 hover:text-gov-maroon-950 hover:border-stone-400"
                                        }`}
                                      >
                                        <CheckCircle size={12} className="inline -mt-0.5 mr-1" />Mark Resolved
                                      </button>
                                    </div>

                                    {/* Official Comment Box */}
                                    <div className="pt-2 border-t border-gov-cream-200 space-y-1.5 text-left">
                                      <label className="block text-[8px] font-black uppercase tracking-widest text-stone-400">
                                        Add/Update Collector Comment
                                      </label>
                                      <form
                                        onSubmit={(e) => {
                                          e.preventDefault();
                                          const input = (e.target as any).elements.collectorComment;
                                          if (input && onUpdateStatus) {
                                            onUpdateStatus(fullIssue._id || fullIssue.id || "", fullIssue.status, input.value);
                                            runCategorization(true);
                                          }
                                        }}
                                        className="flex gap-2"
                                      >
                                        <input
                                          name="collectorComment"
                                          type="text"
                                          placeholder="Write action protocol..."
                                          defaultValue={fullIssue.officialResponse || ""}
                                          className="bg-gov-cream-100 border border-stone-200 px-3 py-1.5 text-xs text-gov-maroon-800 focus:border-gov-maroon-900 focus:ring-0 outline-none rounded-sm flex-1 font-sans"
                                        />
                                        <button
                                          type="submit"
                                          className="bg-gov-maroon-900 text-white text-[9px] font-bold uppercase tracking-wider px-3 py-1.5 hover:bg-gov-maroon-800 transition-colors rounded-sm cursor-pointer shrink-0 font-sans"
                                        >
                                          Save
                                        </button>
                                      </form>
                                    </div>
                                  </div>

                                </div>
                              );
                            }

                            // 2. Citizen/Grid Card Layout
                            const statusConfig = getStatusStyle(fullIssue.status);

                            return (
                              <div
                                key={fullIssue._id}
                                className="bg-white border border-stone-200 rounded-sm overflow-hidden hover:border-gov-maroon-900 transition-all duration-300 flex flex-col group h-full text-left"
                              >
                                {/* Media / Image Preview */}
                                <div className="relative h-44 w-full bg-gov-cream-100 overflow-hidden border-b border-stone-200 shrink-0">
                                  {fullIssue.videoUrl ? (
                                    <video
                                      src={fullIssue.videoUrl}
                                      controls
                                      className="w-full h-full object-cover"
                                    />
                                  ) : fullIssue.imageUrl ? (
                                    <img
                                      src={fullIssue.imageUrl}
                                      alt={fullIssue.title}
                                      className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                                      referrerPolicy="no-referrer"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-stone-400 gap-2 bg-gov-cream-200/40">
                                      <div className="p-2.5 bg-gov-cream-200 rounded-sm border border-stone-200/50 text-stone-400">
                                        <MapPin size={18} />
                                      </div>
                                      <span className="text-[8px] font-sans font-bold uppercase tracking-wider">NO MEDIA</span>
                                    </div>
                                  )}

                                  {/* Absolute badges: Status & Severity */}
                                  <div className="absolute top-3 left-3 flex flex-col gap-1 items-start">
                                    <span className={`inline-flex items-center px-2 py-0.5 text-[8px] font-bold tracking-widest uppercase ${statusConfig.wrapper}`}>
                                      {statusConfig.label}
                                    </span>
                                    {fullIssue.reReported && (
                                      <span className="inline-flex items-center px-2 py-0.5 text-[8px] font-bold tracking-widest uppercase border border-red-600 bg-red-50 text-red-700 animate-pulse">
                                        RE-REPORTED
                                      </span>
                                    )}
                                    {fullIssue.severity && (
                                      <span className={`inline-flex items-center px-2 py-0.5 text-[8px] font-bold tracking-widest uppercase border shadow-sm ${
                                        fullIssue.severity === "High"
                                          ? "bg-red-50 text-red-700 border-red-600"
                                          : fullIssue.severity === "Medium"
                                          ? "bg-gov-gold-100 text-gov-gold-700 border-gov-gold-500"
                                          : "bg-green-50 text-gov-green-700 border-gov-green-600"
                                      }`}>
                                        {fullIssue.severity}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Card Content */}
                                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                                  <div className="space-y-2">
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[8px] font-sans font-bold tracking-wider text-stone-400 uppercase">
                                      <div className="flex items-center gap-0.5">
                                        <MapPin size={9} />
                                        <span>District: <strong className="text-gov-maroon-700">{fullIssue.district}</strong></span>
                                      </div>
                                      <span>•</span>
                                      <span>Constituency: <strong className="text-gov-maroon-700">{fullIssue.constituency}</strong></span>
                                    </div>
                                    <h5 className="font-display font-black text-sm text-gov-maroon-950 uppercase tracking-tight group-hover:text-stone-500 transition-colors leading-tight font-bold">
                                      {fullIssue.title}
                                    </h5>
                                    <p className="text-stone-500 text-xs leading-relaxed line-clamp-3 normal-case">
                                      {fullIssue.description}
                                    </p>
                                  </div>

                                  {/* Footer metadata and reply details */}
                                  <div className="space-y-3 pt-3 border-t border-stone-100">
                                    <div className="flex flex-col gap-1 text-[9px] text-stone-400 font-sans font-bold uppercase tracking-wider">
                                      <div className="flex items-center gap-1">
                                        <Calendar size={10} />
                                        <span>{formatDate(fullIssue.createdAt)}</span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <span className="text-stone-400">Reporter:</span>
                                        <span className="text-gov-maroon-800 font-bold">{fullIssue.reporterName || "Anonymous Citizen"}</span>
                                      </div>
                                    </div>

                                    {fullIssue.officialResponse && (
                                      <div className="bg-gov-cream-100 border-l-2 border-gov-maroon-800 p-2 text-[9px] font-sans">
                                        <span className="block text-[7px] font-black uppercase text-stone-400 tracking-wider">OFFICIAL RESPONSE:</span>
                                        <p className="text-gov-maroon-700 font-serif italic">"{fullIssue.officialResponse}"</p>
                                      </div>
                                    )}

                                    {fullIssue.reReported && fullIssue.reReportedComment && (
                                      <div className="bg-red-50 border-l-2 border-red-600 p-2 text-[9px] font-sans">
                                        <span className="block text-[7px] font-black uppercase text-red-600 tracking-wider">RE-REPORT COMMENT:</span>
                                        <p className="text-gov-maroon-800 italic">"{fullIssue.reReportedComment}"</p>
                                      </div>
                                    )}



                                    {/* Citizen Upvote Button */}
                                    {fullIssue && (!session || session.role === "citizen") && onToggleUpvote && (
                                      <div className="pt-2 flex justify-between items-center border-t border-dashed border-stone-200/50 gap-2">
                                        <div className="flex gap-1.5">

                                          {session && fullIssue.citizenId === session.email ? (
                                            <span className="text-[8px] font-sans font-bold text-stone-400 uppercase tracking-widest self-center">YOUR COMPLAINT</span>
                                          ) : (
                                            <button
                                              onClick={() => onToggleUpvote(fullIssue._id || fullIssue.id)}
                                              className={`px-3 py-1 text-[8px] font-bold uppercase tracking-wider border rounded-sm transition-all cursor-pointer ${
                                                session && fullIssue.upvotes?.includes(session.email || "")
                                                  ? "bg-gov-maroon-900 text-white border-gov-maroon-900"
                                                  : "bg-white text-gov-maroon-950 border-stone-200 hover:border-gov-maroon-900"
                                              }`}
                                            >
                                              {session && fullIssue.upvotes?.includes(session.email || "") ? "Supported" : "Support"}
                                            </button>
                                          )}
                                        </div>
                                        <span className="text-[9px] font-sans text-stone-400 lowercase">{fullIssue.upvotes?.length || 0} upvotes</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="py-20 text-center">
          <p className="text-stone-500 font-sans text-xs uppercase">No categorizations processed yet.</p>
        </div>
        )}

    </div>
  );
}
