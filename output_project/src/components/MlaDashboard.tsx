import React, { useState, useMemo, useEffect } from "react";
import { Issue, UserSession } from "../types.js";
import { Link } from "react-router-dom";
import { Award, MapPin, Clock, AlertCircle, AlertTriangle, CheckCircle, Layers, Star } from "lucide-react";
import StatusTracker from "./StatusTracker.tsx";
import { calculateCitizenStats } from "../utils/gamification.ts";

interface MlaDashboardProps {
  issues: Issue[];
  onUpdateStatus: (id: string, newStatus: string, comment?: string) => void;
  session?: UserSession | null;
}

export default function MlaDashboard({ issues, onUpdateStatus, session }: MlaDashboardProps) {
  const [districts, setDistricts] = useState<any[]>([]);
  const [constituencies, setConstituencies] = useState<any[]>([]);
  const [selectedDistrictId, setSelectedDistrictId] = useState("");
  const [selectedMlaId, setSelectedMlaId] = useState("");
  const [loading, setLoading] = useState(true);

  // Load districts and constituencies on mount
  useEffect(() => {
    async function loadData() {
      try {
        const [resDist, resConst] = await Promise.all([
          fetch("/api/districts").then((r) => r.json()),
          fetch("/api/constituencies").then((r) => r.json()),
        ]);
        if (resConst.success && Array.isArray(resConst.data)) {
          if (session?.role === "mla" && session.assignedConstituency) {
            const mlaConst = resConst.data.find(
              (c: any) => c.name.toLowerCase() === session.assignedConstituency?.toLowerCase() || c.id.toLowerCase() === session.assignedConstituency?.toLowerCase()
            );
            if (mlaConst) {
              setConstituencies([mlaConst]);
              setSelectedMlaId(mlaConst.id);
              setSelectedDistrictId(mlaConst.districtId);
              
              if (resDist.success && Array.isArray(resDist.data)) {
                const matchingDist = resDist.data.filter((d: any) => d.id === mlaConst.districtId);
                setDistricts(matchingDist);
              }
            } else {
              setConstituencies([]);
              setDistricts([]);
            }
          } else {
            setConstituencies(resConst.data);
            if (resDist.success && Array.isArray(resDist.data)) {
              setDistricts(resDist.data);
              if (resDist.data.length > 0) {
                setSelectedDistrictId(resDist.data[0].id);
              }
            }
          }
        } else {
          if (resDist.success && Array.isArray(resDist.data)) {
            setDistricts(resDist.data);
          }
        }
      } catch (err) {
        console.error("Error loading MLA dashboard data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [session]);

  // Filter constituencies under selected district
  const filteredConstituencies = useMemo(() => {
    if (!selectedDistrictId) return [];
    return constituencies.filter(
      (c) => c.districtId.toLowerCase() === selectedDistrictId.toLowerCase()
    );
  }, [constituencies, selectedDistrictId]);

  // Set default selected constituency when district changes
  useEffect(() => {
    if (filteredConstituencies.length > 0) {
      const match = filteredConstituencies.some((c) => c.id === selectedMlaId);
      if (!match) {
        setSelectedMlaId(filteredConstituencies[0].id);
      }
    } else {
      setSelectedMlaId("");
    }
  }, [filteredConstituencies, selectedDistrictId]);

  // Find selected constituency details
  const currentConstituency = useMemo(() => {
    if (!selectedMlaId) return null;
    return constituencies.find((c) => c.id === selectedMlaId) || null;
  }, [constituencies, selectedMlaId]);

  // Filter issues belonging strictly to this constituency, retention policy, and sort by severity
  const constituencyIssues = useMemo(() => {
    let baseIssues: Issue[] = [];
    if (session?.role === "mla" && session.assignedConstituency) {
      baseIssues = issues.filter(
        (i) => i.constituency?.toLowerCase() === session.assignedConstituency?.toLowerCase()
      );
    } else if (currentConstituency) {
      baseIssues = issues.filter(
        (i) =>
          i.constituency?.toLowerCase() === currentConstituency.name.toLowerCase() ||
          i.constituency?.toLowerCase() === currentConstituency.id.toLowerCase()
      );
    }

    // Filter out resolved issues older than 30 days
    const filtered = baseIssues.filter((i) => {
      if (i.status !== "Resolved") return true;
      const lastActiveDateStr = i.updatedAt || i.createdAt;
      if (!lastActiveDateStr) return true;
      const lastActiveDate = new Date(lastActiveDateStr);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return lastActiveDate >= thirtyDaysAgo;
    });

    // Sort by Revisited first, then Ongoing, then Resolved. Within each, sort by severity and date.
    return [...filtered].sort((a, b) => {
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
  }, [issues, currentConstituency, session]);

  // Split into Revisited, Ongoing, Resolved groups (inheriting pre-sorted order)
  const { revisited, ongoing, resolved } = useMemo(() => {
    const rev: Issue[] = [];
    const ong: Issue[] = [];
    const res: Issue[] = [];

    constituencyIssues.forEach((issue) => {
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
  }, [constituencyIssues]);

  // Calculate gamification stats
  const gamification = useMemo(() => {
    return calculateCitizenStats(issues, session || null);
  }, [issues, session]);

  // Calculate stats
  const totalCount = constituencyIssues.length;
  const openCount = constituencyIssues.filter((i) => i.status === "Reported").length;
  const inProgressCount = constituencyIssues.filter((i) => i.status === "In Progress").length;
  const resolvedCount = constituencyIssues.filter((i) => i.status === "Resolved").length;

  if (loading) {
    return (
      <div className="py-24 text-center space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gov-maroon-900 mx-auto" />
        <span className="text-xs font-sans text-stone-400 uppercase tracking-widest block">Initializing MLA Workbench...</span>
      </div>
    );
  }

  const renderMlaCard = (issue: Issue) => {
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
              Add/Update MLA Comment
            </label>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const input = (e.target as any).elements.mlaComment;
                if (input && onUpdateStatus) {
                  onUpdateStatus(issue._id || issue.id || "", issue.status, input.value);
                }
              }}
              className="flex gap-2"
            >
              <input
                name="mlaComment"
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
      
      {/* Dynamic Legislative Switcher Header */}
      <div className="bg-gov-maroon-950 text-white p-6 sm:p-8 rounded-sm border border-gov-maroon-900 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 animate-fadeIn">
        <div className="space-y-2">
          <span className="text-[10px] font-black tracking-[0.3em] uppercase text-stone-500 block">
            LEGISLATIVE ASSEMBLY OF TAMIL NADU // MLA PLATFORM
          </span>
          <h2 className="font-display font-black text-2xl uppercase tracking-tight text-white flex items-center gap-2">
            <Award size={20} className="text-stone-400" />
            <span>MLA Assembly Portal</span>
          </h2>
          <p className="text-stone-400 text-xs uppercase tracking-wide leading-relaxed">
            Select a district and assembly constituency seat to manage active repair protocols and monitor local tickets.
          </p>
        </div>

        {/* Dynamic Selectors */}
        <div className="w-full md:w-auto grid grid-cols-1 sm:grid-cols-2 gap-4">
          
          {/* District Select */}
          <div className="flex flex-col space-y-1.5">
            <label className="text-[9px] font-sans text-stone-500 uppercase tracking-widest">
              1. Region (District):
            </label>
            {session?.role === "mla" && session.assignedConstituency ? (
              <span className="bg-gov-maroon-900 border border-gov-maroon-800 px-3 py-2 text-xs font-sans font-bold uppercase tracking-wider text-stone-400">
                {districts.find((d) => d.id === selectedDistrictId)?.name?.toUpperCase() || "ASSIGNED DISTRICT"}
              </span>
            ) : (
              <select
                value={selectedDistrictId}
                onChange={(e) => setSelectedDistrictId(e.target.value)}
                className="bg-gov-maroon-900 text-white border border-gov-maroon-800 px-3 py-2 text-xs font-sans font-bold uppercase tracking-wider focus:border-white focus:ring-0 outline-none rounded-sm cursor-pointer"
              >
                {districts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name.toUpperCase()}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Constituency Select */}
          <div className="flex flex-col space-y-1.5">
            <label className="text-[9px] font-sans text-stone-500 uppercase tracking-widest">
              2. Assembly Seat / MLA:
            </label>
            {session?.role === "mla" && session.assignedConstituency ? (
              <span className="bg-gov-maroon-900 border border-gov-maroon-800 px-3 py-2 text-xs font-sans font-bold uppercase tracking-wider text-stone-400">
                {session.assignedConstituency.toUpperCase()} (LOCKED)
              </span>
            ) : (
              <select
                value={selectedMlaId}
                onChange={(e) => setSelectedMlaId(e.target.value)}
                disabled={filteredConstituencies.length === 0}
                className="bg-gov-maroon-900 text-white border border-gov-maroon-800 px-3 py-2 text-xs font-sans font-bold uppercase tracking-wider focus:border-white focus:ring-0 outline-none rounded-sm cursor-pointer disabled:opacity-50"
              >
                {filteredConstituencies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name.toUpperCase()} — {c.mlaName.toUpperCase()}
                  </option>
                ))}
              </select>
            )}
          </div>

        </div>
      </div>

      {currentConstituency ? (
        <>
          {/* Metrics breakdown for this isolated constituency */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white border border-stone-200 p-5 rounded-sm shadow-sm space-y-2">
              <span className="block text-[8px] font-black uppercase text-stone-400 tracking-wider">CONSTITUENCY LOAD</span>
              <div className="flex justify-between items-baseline">
                <span className="text-2xl font-black text-gov-maroon-950">{totalCount}</span>
                <span className="text-[8px] font-sans text-stone-500">TOTAL CASES</span>
              </div>
            </div>

            <div className="bg-white border border-stone-200 p-5 rounded-sm shadow-sm space-y-2">
              <span className="block text-[8px] font-black uppercase text-stone-400 tracking-wider">PENDING REVIEW</span>
              <div className="flex justify-between items-baseline">
                <span className="text-2xl font-black text-gov-maroon-950">{openCount}</span>
                <span className="text-[8px] font-sans text-stone-500">PENDING</span>
              </div>
            </div>

            <div className="bg-white border border-stone-200 p-5 rounded-sm shadow-sm space-y-2">
              <span className="block text-[8px] font-black uppercase text-stone-400 tracking-wider">DISPATCH ACTIVE</span>
              <div className="flex justify-between items-baseline">
                <span className="text-2xl font-black text-gov-maroon-950">{inProgressCount}</span>
                <span className="text-[8px] font-sans text-stone-500">IN PROGRESS</span>
              </div>
            </div>

            <div className="bg-white border border-stone-200 p-5 rounded-sm shadow-sm space-y-2">
              <span className="block text-[8px] font-black uppercase text-stone-400 tracking-wider">RESOLVED CASES</span>
              <div className="flex justify-between items-baseline">
                <span className="text-2xl font-black text-gov-green-600">{resolvedCount}</span>
                <span className="text-[8px] font-sans text-stone-500 font-bold">FINISHED</span>
              </div>
            </div>
          </div>



          {/* Assembly isolated feed and actions */}
          <div className="bg-white border border-stone-200 rounded-sm shadow-sm p-6 space-y-6">
            <div className="border-b border-gov-cream-200 pb-4 flex justify-between items-center">
              <span className="text-[11px] font-black uppercase tracking-widest text-gov-maroon-800">
                CONSTITUENCY EXCLUSIVE DISPATCH PROTOCOL ({constituencyIssues.length} CASES)
              </span>
              <span className="text-[9px] font-sans text-stone-400">MLA LEGISLATIVE WORKBENCH ACTIVE</span>
            </div>

            {constituencyIssues.length === 0 ? (
              <div className="py-12 text-center border border-gov-cream-200 bg-gov-cream-100/30 text-stone-400 uppercase tracking-widest text-xs font-sans">
                No logged reports in {currentConstituency.name} yet. Use the Citizen "Report" form to log some!
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
                      {revisited.map((issue) => renderMlaCard(issue))}
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
                      {ongoing.map((issue) => renderMlaCard(issue))}
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
                      {resolved.map((issue) => renderMlaCard(issue))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="py-12 border border-dashed border-stone-200 text-center uppercase text-xs font-sans text-stone-400">
          No constituency selected.
        </div>
      )}

    </div>
  );
}
