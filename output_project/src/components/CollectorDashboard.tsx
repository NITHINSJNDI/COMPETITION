import React, { useState, useMemo, useEffect } from "react";
import { Issue, UserSession } from "../types.js";
import { Link } from "react-router-dom";
import { Activity, AlertTriangle, CheckCircle, Clock, MapPin, Layers, Star } from "lucide-react";
import StatusTracker from "./StatusTracker.tsx";
import { calculateCitizenStats } from "../utils/gamification.ts";

interface CollectorDashboardProps {
  issues: Issue[];
  session?: UserSession | null;
  onUpdateStatus?: (id: string, status: string, comment?: string) => void;
}

export default function CollectorDashboard({ issues, session, onUpdateStatus }: CollectorDashboardProps) {
  const [districts, setDistricts] = useState<any[]>([]);
  const [constituencies, setConstituencies] = useState<any[]>([]);
  const [selectedDistrictId, setSelectedDistrictId] = useState("");
  const [constituencyFilter, setConstituencyFilter] = useState("All");
  const [loading, setLoading] = useState(true);

  // Load districts and constituencies on mount
  useEffect(() => {
    async function loadData() {
      try {
        const [resDist, resConst] = await Promise.all([
          fetch("/api/districts").then((r) => r.json()),
          fetch("/api/constituencies").then((r) => r.json()),
        ]);
        if (resDist.success && Array.isArray(resDist.data)) {
          if (session?.role === "collector" && session.assignedDistrict) {
            const matchingDist = resDist.data.filter(
              (d: any) => d.name.toLowerCase() === session.assignedDistrict?.toLowerCase() || d.id.toLowerCase() === session.assignedDistrict?.toLowerCase()
            );
            setDistricts(matchingDist);
            if (matchingDist.length > 0) {
              setSelectedDistrictId(matchingDist[0].id);
            }
          } else {
            setDistricts(resDist.data);
            if (resDist.data.length > 0) {
              setSelectedDistrictId(resDist.data[0].id);
            }
          }
        }
        if (resConst.success && Array.isArray(resConst.data)) {
          if (session?.role === "collector" && session.assignedDistrict) {
            const matchingDist = resDist.data.find(
              (d: any) => d.name.toLowerCase() === session.assignedDistrict?.toLowerCase() || d.id.toLowerCase() === session.assignedDistrict?.toLowerCase()
            );
            if (matchingDist) {
              setConstituencies(resConst.data.filter((c: any) => c.districtId.toLowerCase() === matchingDist.id.toLowerCase()));
            } else {
              setConstituencies([]);
            }
          } else {
            setConstituencies(resConst.data);
          }
        }
      } catch (err) {
        console.error("Error loading collector dashboard data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [session]);

  const selectedDistrictName = useMemo(() => {
    const d = districts.find((item) => item.id.toLowerCase() === selectedDistrictId.toLowerCase());
    return d ? d.name : "Select District";
  }, [districts, selectedDistrictId]);

  // Filter issues belonging strictly to the selected district and retention policy
  const districtIssues = useMemo(() => {
    let baseIssues: Issue[] = [];
    if (session?.role === "collector" && session.assignedDistrict) {
      baseIssues = issues.filter(
        (i) => i.district?.toLowerCase() === session.assignedDistrict?.toLowerCase()
      );
    } else if (selectedDistrictId) {
      baseIssues = issues.filter(
        (i) =>
          i.district?.toLowerCase() === selectedDistrictId.toLowerCase() ||
          i.district?.toLowerCase() === selectedDistrictName.toLowerCase()
      );
    }

    // Filter out resolved issues older than 30 days
    return baseIssues.filter((i) => {
      if (i.status !== "Resolved") return true;
      const lastActiveDateStr = i.updatedAt || i.createdAt;
      if (!lastActiveDateStr) return true;
      const lastActiveDate = new Date(lastActiveDateStr);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return lastActiveDate >= thirtyDaysAgo;
    });
  }, [issues, selectedDistrictId, selectedDistrictName, session]);

  // Filter constituencies belonging strictly to the selected district
  const districtConstituencies = useMemo(() => {
    if (!selectedDistrictId) return [];
    return constituencies.filter(
      (c) => c.districtId.toLowerCase() === selectedDistrictId.toLowerCase()
    );
  }, [constituencies, selectedDistrictId]);

  // Filter issues based on constituency filter and sort by Revisited first, then Ongoing, then Resolved
  const filteredDistrictIssues = useMemo(() => {
    let matching = districtIssues;
    if (constituencyFilter !== "All") {
      matching = districtIssues.filter(
        (i) => i.constituency?.toLowerCase() === constituencyFilter.toLowerCase()
      );
    }

    return [...matching].sort((a, b) => {
      // 1. Group by: Revisited (2), Ongoing (1), Resolved (0)
      const groupA = a.reReported ? 2 : (a.status !== "Resolved" ? 1 : 0);
      const groupB = b.reReported ? 2 : (b.status !== "Resolved" ? 1 : 0);

      if (groupA !== groupB) {
        return groupB - groupA;
      }

      // 2. Sort by severity inside group
      const severityOrder: Record<string, number> = { High: 3, Medium: 2, Low: 1 };
      const weightA = severityOrder[a.severity || "Medium"] || 2;
      const weightB = severityOrder[b.severity || "Medium"] || 2;
      if (weightA !== weightB) {
        return weightB - weightA;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [districtIssues, constituencyFilter]);

  // Split into Revisited, Ongoing, Resolved groups (inheriting pre-sorted order)
  const { revisited, ongoing, resolved } = useMemo(() => {
    const rev: Issue[] = [];
    const ong: Issue[] = [];
    const res: Issue[] = [];

    filteredDistrictIssues.forEach((issue) => {
      if (issue.reReported) {
        rev.push(issue);
      } else if (issue.status === "Resolved") {
        res.push(issue);
      } else {
        ong.push(issue);
      }
    });

    return {
      revisited: rev,
      ongoing: ong,
      resolved: res,
    };
  }, [filteredDistrictIssues]);

  // Calculate gamification stats
  const gamification = useMemo(() => {
    return calculateCitizenStats(issues, session || null);
  }, [issues, session]);

  // 1. Calculate district stats
  const totalCount = districtIssues.length;
  const openCount = districtIssues.filter((i) => i.status === "Reported").length;
  const inProgressCount = districtIssues.filter((i) => i.status === "In Progress").length;
  const resolvedCount = districtIssues.filter((i) => i.status === "Resolved").length;

  // 2. Calculate constituency stats for selected district
  const constituencyStats = useMemo(() => {
    return districtConstituencies
      .map((c) => {
        const cIssues = districtIssues.filter(
          (i) =>
            i.constituency?.toLowerCase() === c.name.toLowerCase() ||
            i.constituency?.toLowerCase() === c.id.toLowerCase()
        );
        const open = cIssues.filter((i) => i.status === "Reported" || i.status === "In Progress").length;
        const resolved = cIssues.filter((i) => i.status === "Resolved").length;
        return {
          name: c.name,
          id: c.id,
          total: cIssues.length,
          open,
          resolved,
        };
      })
      .sort((a, b) => b.total - a.total); // Sort by highest total first
  }, [districtIssues, districtConstituencies]);



  if (loading) {
    return (
      <div className="py-24 text-center space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gov-maroon-900 mx-auto" />
        <span className="text-xs font-sans text-stone-400 uppercase tracking-widest block">Initializing Collector Analytics...</span>
      </div>
    );
  }

  const renderCollectorCard = (issue: Issue) => {
    const reporterStats = gamification.leaderboard.find(
      (c) => c.email === issue.citizenId || c.name === issue.reporterName
    );
    const severityColors = {
      Low: "border-gov-green-600 text-gov-green-700 bg-green-50",
      Medium: "border-gov-gold-500 text-gov-gold-700 bg-gov-gold-100",
      High: "border-red-600 text-red-700 bg-red-50",
    };

    return (
      <div key={issue._id || issue.id} className="border border-stone-200 p-5 bg-gov-cream-100/20 hover:bg-gov-cream-100/50 transition-all rounded-sm flex flex-col lg:flex-row gap-6 justify-between items-start animate-fadeIn">
        
        {/* Left block: Info & Image */}
        <div className="flex flex-col sm:flex-row gap-5 flex-1">
          {issue.videoUrl ? (
            <div className="w-full sm:w-32 h-24 bg-gov-cream-200 shrink-0 border border-stone-200">
              <video
                src={issue.videoUrl}
                controls
                className="w-full h-full object-cover"
              />
            </div>
          ) : issue.imageUrl ? (
            <div className="w-full sm:w-32 h-24 bg-gov-cream-200 shrink-0 border border-stone-200">
              <img
                src={issue.imageUrl}
                alt={issue.title}
                className="w-full h-full object-cover grayscale"
                referrerPolicy="no-referrer"
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`px-2 py-0.5 text-[8px] font-bold uppercase border ${
                issue.status === "Resolved"
                  ? "border-gov-green-600 text-gov-green-700 bg-green-50"
                  : issue.status === "In Progress"
                  ? "border-gov-maroon-950 text-white bg-gov-maroon-950"
                  : "border-stone-300 text-stone-500 bg-gov-cream-100"
              }`}>
                {issue.status}
              </span>
              {issue.reReported && (
                <span className="px-2 py-0.5 text-[8px] font-bold uppercase border border-red-600 bg-red-50 text-red-700 animate-pulse">
                  RE-REPORTED
                </span>
              )}
              <span className={`px-2 py-0.5 text-[8px] font-bold uppercase border ${severityColors[issue.severity as keyof typeof severityColors || "Medium"]}`}>
                {issue.severity || "Medium"} Severity
              </span>
              <span className="text-[9px] font-sans text-stone-400">
                LOGGED: {new Date(issue.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>

            <div className="flex flex-col gap-1 text-[11px] text-stone-500 font-sans">
              <div className="flex flex-wrap items-center gap-1.5 uppercase text-[9px] tracking-wider text-stone-400">
                <span>Reported By: <strong className="text-gov-maroon-800">{issue.reporterName || "Anonymous Citizen"}</strong></span>
                {reporterStats && (
                  <span className="inline-flex items-center gap-1 bg-gov-gold-500 text-gov-maroon-950 text-[7px] font-sans font-bold px-1.5 py-0.5 leading-none">
                    <Star size={9} className="inline -mt-0.5 mr-0.5 fill-current" /> {reporterStats.rankTitle.toUpperCase()} ({reporterStats.points} PTS)
                  </span>
                )}
                <span>•</span>
                <span>On: <strong className="text-gov-maroon-800">{new Date(issue.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}</strong></span>
              </div>
              
              {/* Conditional Location Rendering */}
              {(() => {
                const showGps = issue.hasGps !== undefined ? issue.hasGps : (issue.latitude !== 13.0827 || issue.longitude !== 80.2707);
                const showAddress = issue.hasAddress !== undefined ? issue.hasAddress : (!!issue.address && issue.address.trim() !== "");
                return (
                  <div className="flex flex-col gap-1 text-[10px] text-stone-500 font-sans mt-1">
                    {showAddress && (
                      <div className="flex items-start gap-1">
                        <span className="font-bold text-gov-maroon-700">ADDRESS:</span>
                        <span>{issue.address}</span>
                      </div>
                    )}
                    {showGps && (
                      <div className="flex items-center gap-1">
                        <span className="font-bold text-gov-maroon-700">GPS:</span>
                        <span className="bg-gov-cream-200 px-1.5 py-0.5 border border-stone-200/60 text-gov-maroon-800 font-sans text-[9px]">
                          {issue.latitude.toFixed(6)}, {issue.longitude.toFixed(6)}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            <h4 className="font-display font-black text-base uppercase text-gov-maroon-950 font-bold">
              {issue.title}
            </h4>
            <p className="text-stone-600 text-xs sm:text-sm leading-relaxed max-w-2xl">
              {issue.description}
            </p>
            
            <StatusTracker currentStatus={issue.status} />
            
            {issue.officialResponse && (
              <div className="bg-white border-l-2 border-gov-maroon-800 p-2.5 mt-2 shadow-xs">
                <span className="block text-[8px] font-black uppercase text-stone-500 tracking-wider">OFFICIAL DISPATCH COMMENT:</span>
                <p className="text-xs text-gov-maroon-700 font-serif italic">"{issue.officialResponse}"</p>
              </div>
            )}

            {issue.reReported && issue.reReportedComment && (
              <div className="bg-red-50 border-l-2 border-red-600 p-2.5 mt-2 shadow-xs">
                <span className="block text-[8px] font-black uppercase text-red-600 tracking-wider">CITIZEN RE-REPORT REASON:</span>
                <p className="text-xs text-gov-maroon-800 font-sans italic">"{issue.reReportedComment}"</p>
              </div>
            )}

            <div className="text-[9px] font-sans text-stone-400 uppercase">
              Constituency: <span className="text-gov-maroon-700 font-bold">{issue.constituency}</span>
            </div>
          </div>
        </div>

        {/* Right block: Operational actions for status updates & comments */}
        <div className="w-full lg:w-80 shrink-0 space-y-4 lg:text-right border-t lg:border-t-0 border-stone-200/50 pt-4 lg:pt-0">
          <span className="block text-[8px] font-black uppercase text-stone-400 tracking-widest">DISPATCH DIRECTIVE</span>
          
          <div className="flex flex-wrap lg:justify-end gap-1.5">
            <button
              onClick={() => onUpdateStatus && onUpdateStatus(issue._id || issue.id || "", "Verified")}
              className={`px-2.5 py-1.5 text-[9px] font-sans font-bold uppercase border tracking-wider transition-all rounded-sm cursor-pointer ${
                issue.status === "Verified"
                  ? "bg-blue-700 border-blue-800 text-white"
                  : "bg-white border-stone-200 text-stone-500 hover:text-gov-maroon-950 hover:border-stone-400"
              }`}
            >
              Verify Details
            </button>

            <button
              onClick={() => onUpdateStatus && onUpdateStatus(issue._id || issue.id || "", "In Progress")}
              className={`px-2.5 py-1.5 text-[9px] font-sans font-bold uppercase border tracking-wider transition-all rounded-sm cursor-pointer ${
                issue.status === "In Progress"
                  ? "bg-gov-maroon-950 border-black text-white"
                  : "bg-white border-stone-200 text-stone-500 hover:text-gov-maroon-950 hover:border-stone-400"
              }`}
            >
              Dispatch Review
            </button>

            <button
              onClick={() => onUpdateStatus && onUpdateStatus(issue._id || issue.id || "", "Resolved")}
              className={`px-2.5 py-1.5 text-[9px] font-sans font-bold uppercase border tracking-wider transition-all rounded-sm cursor-pointer ${
                issue.status === "Resolved"
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
                  onUpdateStatus(issue._id || issue.id || "", issue.status, input.value);
                }
              }}
              className="flex gap-2"
            >
              <input
                name="collectorComment"
                type="text"
                placeholder="Write action protocol..."
                defaultValue={issue.officialResponse || ""}
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
  };

  return (
    <div className="space-y-10 animate-fadeIn py-6">
      
      {/* Dynamic District Selector Header */}
      <div className="border-b border-stone-200 pb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-2">
          <span className="text-[10px] font-black tracking-[0.3em] uppercase text-stone-400 block">
            CENTRAL MANAGEMENT OFFICE // STATE-WIDE OVERSIGHT
          </span>
          <h2 className="font-display font-black text-3xl sm:text-4xl uppercase tracking-tight text-gov-maroon-950">
            {selectedDistrictName} District Dashboard
          </h2>
          <p className="text-stone-500 text-xs sm:text-sm uppercase tracking-wide max-w-2xl leading-relaxed">
            Operational oversight panel for the selected jurisdiction. Real-time logging metrics, spatial aggregation, and inter-departmental workflows.
          </p>
        </div>

        {/* District selection dropdown */}
        <div className="flex items-center gap-3 w-full md:w-auto shrink-0 bg-white border border-stone-200 px-4 py-2">
          <Layers size={14} className="text-stone-400" />
          <span className="text-[10px] font-sans font-black uppercase tracking-wider text-stone-400">JURISDICTION:</span>
          {session?.role === "collector" && session.assignedDistrict ? (
            <span className="text-xs font-sans font-black uppercase text-gov-maroon-900 font-bold">
              {session.assignedDistrict.toUpperCase()} (LOCKED)
            </span>
          ) : (
            <select
              value={selectedDistrictId}
              onChange={(e) => setSelectedDistrictId(e.target.value)}
              className="text-xs font-sans font-black uppercase text-gov-maroon-900 border-none outline-hidden bg-transparent cursor-pointer"
            >
              {districts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name.toUpperCase()}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white border border-stone-200 p-6 flex flex-col justify-between space-y-4 rounded-sm shadow-sm">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-black uppercase tracking-wider text-stone-400">TOTAL REPORTED CASES</span>
            <Activity size={16} className="text-stone-400" />
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-3xl sm:text-4xl font-black text-gov-maroon-950">{totalCount}</span>
            <span className="text-[9px] font-sans text-stone-400">REGISTERED</span>
          </div>
        </div>

        <div className="bg-white border border-stone-200 p-6 flex flex-col justify-between space-y-4 rounded-sm shadow-sm">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-black uppercase tracking-wider text-stone-400">PENDING (REPORTED)</span>
            <Clock size={16} className="text-stone-400" />
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-3xl sm:text-4xl font-black text-gov-maroon-950">{openCount}</span>
            <span className="text-[9px] font-sans text-stone-400">AWAITING REVIEW</span>
          </div>
        </div>

        <div className="bg-white border border-stone-200 p-6 flex flex-col justify-between space-y-4 rounded-sm shadow-sm">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-black uppercase tracking-wider text-stone-400">ACTIVE DISPATCH (IN PROGRESS)</span>
            <AlertTriangle size={16} className="text-stone-400" />
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-3xl sm:text-4xl font-black text-gov-maroon-950">{inProgressCount}</span>
            <span className="text-[9px] font-sans text-stone-400">ON-SITE DISPATCH</span>
          </div>
        </div>

        <div className="bg-white border border-stone-200 p-6 flex flex-col justify-between space-y-4 rounded-sm shadow-sm">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-black uppercase tracking-wider text-stone-400">RESOLVED REPAIR PROTOCOLS</span>
            <CheckCircle size={16} className="text-stone-400" />
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-3xl sm:text-4xl font-black text-gov-green-600">{resolvedCount}</span>
            <span className="text-[9px] font-sans text-stone-400">RESOLVED</span>
          </div>
        </div>
      </div>



      {/* Assembly Constituency Registry List */}
      <div className="bg-white border border-stone-200 rounded-sm shadow-sm space-y-4 p-6">
        <div className="flex items-center justify-between border-b border-gov-cream-200 pb-4">
          <div className="flex items-center gap-2">
            <MapPin size={16} className="text-gov-maroon-950" />
            <span className="text-[11px] font-black uppercase tracking-widest text-gov-maroon-800">
              {selectedDistrictName} Assembly Constituency Matrix
            </span>
          </div>
          <span className="text-[9px] font-sans text-stone-400">{districtConstituencies.length} DISTRICT SUBDIVISIONS ACTIVE</span>
        </div>

        {constituencyStats.length === 0 ? (
          <div className="py-12 border border-dashed border-stone-200 text-center uppercase text-xs font-sans text-stone-400">
            No registered assembly constituencies found under {selectedDistrictName}.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {constituencyStats.map((c) => (
              <div key={c.id} className="border border-stone-200 bg-gov-cream-100/50 hover:bg-gov-cream-100 hover:border-gov-maroon-950 transition-all p-4 rounded-sm flex flex-col justify-between space-y-4">
                <div className="space-y-1">
                  <span className="text-[9px] font-sans text-stone-400">ASSEMBLY SEAT</span>
                  <h4 className="font-display font-black text-base uppercase text-gov-maroon-950 leading-tight truncate">
                    {c.name}
                  </h4>
                </div>

                <div className="grid grid-cols-2 gap-2 text-center py-2 border-t border-t-stone-200/50">
                  <div className="bg-white border border-gov-cream-200 py-2">
                    <span className="block text-[8px] font-black uppercase text-stone-400 tracking-wider">OPEN</span>
                    <span className="text-lg font-sans font-black text-gov-maroon-950">{c.open}</span>
                  </div>
                  <div className="bg-white border border-gov-cream-200 py-2">
                    <span className="block text-[8px] font-black uppercase text-stone-400 tracking-wider">RESOLVED</span>
                    <span className="text-lg font-sans font-black text-gov-green-600">{c.resolved}</span>
                  </div>
                </div>

                <Link
                  to={`/constituency/${c.id}`}
                  className="block text-center border border-gov-maroon-900 bg-white hover:bg-gov-maroon-900 hover:text-white text-gov-maroon-900 py-2 text-[10px] font-bold uppercase tracking-widest transition-all rounded-sm font-sans"
                >
                  VIEW CONSTITUENCY PAGE →
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Active District Incident Logs & Directives */}
      <div className="bg-white border border-stone-200 rounded-sm shadow-sm p-6 space-y-6">
        <div className="border-b border-gov-cream-200 pb-4 flex justify-between items-center">
          <span className="text-[11px] font-black uppercase tracking-widest text-gov-maroon-800">
            DISTRICT INCIDENT RESOLUTION WORKBENCH ({districtIssues.length} ACTIVE CASES)
          </span>
          <span className="text-[9px] font-sans text-stone-400">COLLECTOR DIRECT OPERATIONAL ACCESS</span>
        </div>

        {districtIssues.length === 0 ? (
          <div className="py-12 text-center border border-gov-cream-200 bg-gov-cream-100/30 text-stone-400 uppercase tracking-widest text-xs font-sans">
            No logged reports in {selectedDistrictName} district yet.
          </div>
        ) : (
          <div className="space-y-6">


            {filteredDistrictIssues.length === 0 ? (
              <div className="py-8 text-center border border-dashed border-stone-200 bg-white text-stone-400 uppercase tracking-widest text-[10px] font-sans">
                No active cases found in this district.
              </div>
            ) : (
              <div className="space-y-12">
                {/* Revisited Section */}
                {revisited.length > 0 && (
                  <div className="space-y-4">
                    <div className="border-l-4 border-red-600 pl-4 py-1">
                      <h3 className="font-display font-black text-lg uppercase tracking-tight text-red-700 flex items-center gap-2">
                        <span>Revisited Issues</span>
                        <span className="bg-red-100 text-gov-maroon-800 text-xs px-2 py-0.5 rounded-full font-sans font-bold">
                          {revisited.length}
                        </span>
                      </h3>
                      <p className="text-stone-500 text-[9px] uppercase font-bold tracking-widest mt-0.5">
                        Re-reported by citizens after marked as resolved
                      </p>
                    </div>
                    <div className="space-y-5">
                      {revisited.map((issue) => renderCollectorCard(issue))}
                    </div>
                  </div>
                )}

                {/* Ongoing Section */}
                {ongoing.length > 0 && (
                  <div className="space-y-4">
                    <div className="border-l-4 border-gov-maroon-900 pl-4 py-1">
                      <h3 className="font-display font-black text-lg uppercase tracking-tight text-gov-maroon-900 flex items-center gap-2">
                        <span>Ongoing Issues</span>
                        <span className="bg-gov-cream-200 text-gov-maroon-800 text-xs px-2 py-0.5 rounded-full font-sans font-bold">
                          {ongoing.length}
                        </span>
                      </h3>
                      <p className="text-stone-500 text-[9px] uppercase font-bold tracking-widest mt-0.5">
                        Currently active and under review / repair
                      </p>
                    </div>
                    <div className="space-y-5">
                      {ongoing.map((issue) => renderCollectorCard(issue))}
                    </div>
                  </div>
                )}

                {/* Resolved Section */}
                {resolved.length > 0 && (
                  <div className="space-y-4">
                    <div className="border-l-4 border-gov-green-600 pl-4 py-1">
                      <h3 className="font-display font-black text-lg uppercase tracking-tight text-gov-green-700 flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5"><CheckCircle size={18} />Resolved Issues</span>
                        <span className="bg-green-100 text-gov-green-700 text-xs px-2 py-0.5 rounded-full font-sans font-bold">
                          {resolved.length}
                        </span>
                      </h3>
                      <p className="text-stone-500 text-[9px] uppercase font-bold tracking-widest mt-0.5">
                        Successfully addressed and verified cases (removed after 30 days)
                      </p>
                    </div>
                    <div className="space-y-5">
                      {resolved.map((issue) => renderCollectorCard(issue))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
