import React, { useState } from "react";
import { Search, MapPin, Calendar, RotateCcw, AlertCircle, AlertTriangle, CheckCircle, Tag, ShieldAlert, Clock, Award, Star, Trophy } from "lucide-react";
import { Issue, UserSession } from "../types.js";
import IssuesMap from "./IssuesMap.js";
import StatusTracker from "./StatusTracker.tsx";
import { calculateCitizenStats, BADGES_LIST } from "../utils/gamification.ts";

interface DashboardProps {
  issues: Issue[];
  isLoading: boolean;
  onUpdateStatus: (
    id: string,
    newStatus: string,
    officialResponse?: string,
    reReported?: boolean,
    reReportedComment?: string
  ) => void;
  onRefresh: () => void;
  session?: UserSession | null;
  onToggleUpvote?: (id: string) => void;
}

export default function Dashboard({
  issues,
  isLoading,
  onUpdateStatus,
  onRefresh,
  session,
  onToggleUpvote,
}: DashboardProps) {
  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [districtFilter, setDistrictFilter] = useState<string>(() => {
    if (session?.role === "citizen" && session.district) {
      return session.district;
    }
    if (session?.role === "collector" && session.assignedDistrict) {
      return session.assignedDistrict;
    }
    return "All";
  });
  const [constituencyFilter, setConstituencyFilter] = useState<string>(() => {
    if (session?.role === "citizen" && session.constituency) {
      return session.constituency;
    }
    if (session?.role === "mla" && session.assignedConstituency) {
      return session.assignedConstituency;
    }
    return "All";
  });

  const [reReportOpenId, setReReportOpenId] = useState<string | null>(null);
  const [reReportReason, setReReportReason] = useState<string>("");

  const [apiDistricts, setApiDistricts] = useState<{ id: string; name: string }[]>([]);
  const [apiConstituencies, setApiConstituencies] = useState<{ id: string; name: string; districtId: string }[]>([]);

  // Load Tamil Nadu districts & constituencies from database
  React.useEffect(() => {
    let active = true;
    async function loadLocations() {
      try {
        const [resDist, resConst] = await Promise.all([
          fetch("/api/districts").then((r) => r.json()),
          fetch("/api/constituencies").then((r) => r.json()),
        ]);
        if (active && resDist.success && Array.isArray(resDist.data)) {
          setApiDistricts(resDist.data);
        }
        if (active && resConst.success && Array.isArray(resConst.data)) {
          setApiConstituencies(resConst.data);
        }
      } catch (err) {
        console.error("Error loading locations in Dashboard:", err);
      }
    }
    loadLocations();
    return () => {
      active = false;
    };
  }, []);

  // Sync state whenever session updates
  React.useEffect(() => {
    if (session?.role === "citizen") {
      setDistrictFilter(session.district || "All");
      setConstituencyFilter(session.constituency || "All");
    } else if (session?.role === "collector" && session.assignedDistrict) {
      setDistrictFilter(session.assignedDistrict);
      setConstituencyFilter("All");
    } else if (session?.role === "mla" && session.assignedConstituency) {
      setConstituencyFilter(session.assignedConstituency);
      setDistrictFilter("All");
    } else {
      setDistrictFilter("All");
      setConstituencyFilter("All");
    }
  }, [session]);

  const uniqueDistricts = React.useMemo(() => {
    if (apiDistricts.length > 0) {
      return apiDistricts.map((d) => d.name);
    }
    const set = new Set<string>();
    issues.forEach((i) => {
      if (i.district) set.add(i.district);
    });
    return Array.from(set).sort();
  }, [apiDistricts, issues]);

  const uniqueConstituencies = React.useMemo(() => {
    if (apiConstituencies.length > 0) {
      let filtered = apiConstituencies;
      if (districtFilter !== "All") {
        const matchedDist = apiDistricts.find(
          (d) => d.name.toLowerCase() === districtFilter.toLowerCase() || d.id.toLowerCase() === districtFilter.toLowerCase()
        );
        if (matchedDist) {
          filtered = apiConstituencies.filter((c) => c.districtId.toLowerCase() === matchedDist.id.toLowerCase());
        } else {
          filtered = [];
        }
      }
      return filtered.map((c) => c.name);
    }
    const set = new Set<string>();
    issues.forEach((i) => {
      if (i.constituency) {
        if (districtFilter === "All" || i.district?.toLowerCase() === districtFilter.toLowerCase()) {
          set.add(i.constituency);
        }
      }
    });
    return Array.from(set).sort();
  }, [apiConstituencies, apiDistricts, districtFilter, issues]);

  // Casing-normalization helper lookups so browser select value binding matches options perfectly
  const getNormalizedDistrict = (val: string) => {
    if (val === "All") return "All";
    const found = uniqueDistricts.find((d) => d.toLowerCase() === val.toLowerCase());
    return found || val;
  };

  const getNormalizedConstituency = (val: string) => {
    if (val === "All") return "All";
    const found = uniqueConstituencies.find((c) => c.toLowerCase() === val.toLowerCase());
    return found || val;
  };

  // Calculate gamification stats
  const gamification = React.useMemo(() => {
    return calculateCitizenStats(issues, session || null);
  }, [issues, session]);

  // Filtering Logic
  const filteredIssues = React.useMemo(() => {
    let baseIssues = issues;

    // Strict authority filtering (not allowed to view other areas)
    if (session?.role === "collector" && session.assignedDistrict) {
      baseIssues = issues.filter(
        (i) => i.district?.toLowerCase() === session.assignedDistrict?.toLowerCase()
      );
    } else if (session?.role === "mla" && session.assignedConstituency) {
      baseIssues = issues.filter(
        (i) => i.constituency?.toLowerCase() === session.assignedConstituency?.toLowerCase()
      );
    } else if (session && (session.role === "citizen" || !session.role)) {
      // For citizens or standard users: Filter out other areas' resolved issues if older than 30 days
      const userDistrict = session.district || "";
      const userConstituency = session.constituency || "";
      
      baseIssues = issues.filter((i) => {
        if (i.status !== "Resolved") return true;
        
        const isOtherArea = 
          (userDistrict && i.district?.toLowerCase() !== userDistrict.toLowerCase()) ||
          (userConstituency && i.constituency?.toLowerCase() !== userConstituency.toLowerCase());
          
        if (!isOtherArea) return true;
        
        const lastActiveDateStr = i.updatedAt || i.createdAt;
        if (!lastActiveDateStr) return true;
        
        const lastActiveDate = new Date(lastActiveDateStr);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        return lastActiveDate >= thirtyDaysAgo;
      });
    }

    const filtered = baseIssues.filter((issue) => {
      const matchesSearch =
        issue.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        issue.description.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === "All" || issue.status === statusFilter;
      const matchesDistrict = districtFilter === "All" || issue.district?.toLowerCase() === districtFilter.toLowerCase();
      const matchesConstituency = constituencyFilter === "All" || issue.constituency?.toLowerCase() === constituencyFilter.toLowerCase();

      return matchesSearch && matchesStatus && matchesDistrict && matchesConstituency;
    });

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
  }, [issues, searchTerm, statusFilter, districtFilter, constituencyFilter, session]);

  // Split into Revisited, Ongoing, Resolved groups (inheriting the pre-sorted order)
  const { revisited, ongoing, resolved } = React.useMemo(() => {
    const rev: Issue[] = [];
    const ong: Issue[] = [];
    const res: Issue[] = [];

    filteredIssues.forEach((issue) => {
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
  }, [filteredIssues]);

  // Formatting helper
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

  // Status Badge styling helper
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

  const renderCard = (issue: Issue) => {
    const statusConfig = getStatusStyle(issue.status);
    const reporterStats = gamification.leaderboard.find(
      (c) => c.email === issue.citizenId || c.name === issue.reporterName
    );
    return (
      <div
        key={issue._id}
        className="bg-white border border-stone-200 rounded-sm overflow-hidden hover:border-gov-maroon-900 transition-all duration-300 flex flex-col group h-full"
      >
        {/* Image/Video or fallback placeholder */}
        <div className="relative h-56 w-full bg-gov-cream-100 overflow-hidden border-b border-stone-200 shrink-0">
          {issue.videoUrl ? (
            <video
              src={issue.videoUrl}
              controls
              className="w-full h-full object-cover"
            />
          ) : issue.imageUrl ? (
            <img
              src={issue.imageUrl}
              alt={issue.title}
              className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-stone-400 gap-3">
              <div className="p-3 bg-gov-cream-200 rounded-sm text-stone-400 border border-stone-200/50">
                <MapPin size={22} />
              </div>
              <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-stone-400">NO MEDIA RECORDED</span>
            </div>
          )}

          {/* Absolute status and severity badges */}
          <div className="absolute top-4 left-4 flex flex-col gap-1.5 items-start">
            <span
              className={`inline-flex items-center px-2.5 py-1 text-[9px] font-bold tracking-widest uppercase ${statusConfig.wrapper}`}
            >
              {statusConfig.label}
            </span>
            {issue.reReported && (
              <span className="inline-flex items-center px-2.5 py-1 text-[9px] font-bold tracking-widest uppercase border border-red-600 bg-red-50 text-red-700 animate-pulse">
                RE-REPORTED
              </span>
            )}
            {issue.severity && (
              <span className={`inline-flex items-center px-2.5 py-1 text-[9px] font-bold tracking-widest uppercase border shadow-sm ${
                issue.severity === "High"
                  ? "bg-red-50 text-red-700 border-red-600"
                  : issue.severity === "Medium"
                  ? "bg-gov-gold-100 text-gov-gold-700 border-gov-gold-500"
                  : "bg-green-50 text-gov-green-700 border-gov-green-600"
              }`}>
                <AlertTriangle size={10} className="inline -mt-0.5 mr-0.5" /> {issue.severity}
              </span>
            )}
          </div>
        </div>

        {/* Card Body */}
        <div className="p-6 flex-1 flex flex-col justify-between space-y-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[9px] font-sans font-bold tracking-wider text-stone-400 uppercase">
              <div className="flex items-center gap-1">
                <MapPin size={10} className="text-stone-400 shrink-0" />
                <span>District: <strong className="text-gov-maroon-700">{issue.district || "Chennai"}</strong></span>
              </div>
              <span>•</span>
              <span>Constituency: <strong className="text-gov-maroon-700">{issue.constituency || "General"}</strong></span>
            </div>
            <h3 className="font-display font-black text-lg text-gov-maroon-950 uppercase tracking-tight group-hover:text-stone-500 transition-colors leading-tight">
              {issue.title}
            </h3>
            <p className="text-stone-500 text-sm leading-relaxed line-clamp-3">
              {issue.description}
            </p>
          </div>

          {/* Status Tracker Line */}
          <StatusTracker currentStatus={issue.status} />

          {/* Metadata and Actions */}
          <div className="space-y-4 pt-4 border-t border-stone-200">
            <div className="flex flex-col gap-2 text-[11px] text-stone-400 font-sans font-bold uppercase tracking-wider">
              <div className="flex items-center gap-1.5">
                <Calendar size={12} className="text-stone-400 shrink-0" />
                <span>{formatDate(issue.createdAt)}</span>
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-stone-400">Reporter:</span>
                  <span className="text-gov-maroon-800 font-bold">{issue.reporterName || "Anonymous Citizen"}</span>
                </div>
                {reporterStats && (
                  <div className="flex flex-wrap items-center gap-1 mt-0.5">
                    <span className="inline-flex items-center gap-1 bg-gov-gold-500/15 text-gov-gold-700 text-[8px] font-sans font-bold uppercase tracking-wider px-1.5 py-0.5 border border-gov-gold-500/10 leading-none">
                      <Star size={9} className="inline -mt-0.5 mr-0.5 fill-current" /> {reporterStats.rankTitle} ({reporterStats.points} PTS)
                    </span>
                    <div className="flex gap-0.5">
                      {reporterStats.badges.slice(0, 3).map(b => (
                        <span key={b.id} title={b.name} className="text-[7px] font-bold tracking-wide bg-gov-cream-200 text-gov-maroon-800 border border-stone-200 px-1 py-0.5 rounded-sm leading-none">{b.emoji}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Selective Location Rendering */}
              {(() => {
                const showGps = issue.hasGps !== undefined ? issue.hasGps : (issue.latitude !== 13.0827 || issue.longitude !== 80.2707);
                const showAddress = issue.hasAddress !== undefined ? issue.hasAddress : (!!issue.address && issue.address.trim() !== "");
                return (
                  <div className="flex flex-col gap-1.5 mt-1 border-t border-dashed border-gov-cream-200 pt-1.5 font-normal normal-case text-stone-500">
                    {showAddress && (
                      <div className="flex items-start gap-1">
                        <span className="font-bold text-gov-maroon-700 uppercase text-[9px] shrink-0">Address:</span>
                        <span className="text-stone-600 font-sans text-xs">{issue.address}</span>
                      </div>
                    )}
                    {showGps && (
                      <div className="flex items-center gap-1">
                        <span className="font-bold text-gov-maroon-700 uppercase text-[9px] shrink-0">GPS Coords:</span>
                        <span className="bg-gov-cream-200 px-1.5 py-0.5 border border-stone-200/60 text-gov-maroon-800 text-[10px]">
                          {issue.latitude.toFixed(6)}, {issue.longitude.toFixed(6)}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Official Response if present */}
            {issue.officialResponse && (
              <div className="bg-gov-cream-100 border-l-2 border-gov-maroon-900 p-3 space-y-1">
                <span className="block text-[9px] font-black uppercase tracking-widest text-gov-maroon-900">
                  Official Response
                </span>
                <p className="text-xs font-serif italic text-gov-maroon-700 leading-relaxed">
                  "{issue.officialResponse}"
                </p>
              </div>
            )}

            {issue.reReported && issue.reReportedComment && (
              <div className="bg-red-50 border-l-2 border-red-600 p-3 space-y-1">
                <span className="block text-[9px] font-black uppercase tracking-widest text-red-600">
                  Citizen Re-report Reason
                </span>
                <p className="text-xs font-sans italic text-gov-maroon-800 leading-relaxed">
                  "{issue.reReportedComment}"
                </p>
              </div>
            )}

            {/* Upvote support block for Citizens */}
            {(!session || session.role === "citizen") ? (
              <div className="flex items-center justify-between pt-2">
                {session && issue.citizenId === session.email ? (
                  <div className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-gov-cream-200 text-stone-500 border border-stone-200">
                    <span>YOUR COMPLAINT</span>
                  </div>
                ) : (
                  <button
                    onClick={() => onToggleUpvote && onToggleUpvote(issue._id)}
                    className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider border rounded-sm transition-all ${
                      session && issue.upvotes?.includes(session.email || "")
                        ? "bg-gov-maroon-900 text-white border-gov-maroon-900"
                        : "bg-white text-gov-maroon-950 border-stone-200 hover:border-gov-maroon-900"
                    }`}
                  >
                    <span>{session && issue.upvotes?.includes(session.email || "") ? "Supported" : "Support Issue"}</span>
                    <span className="bg-gov-cream-200 text-gov-maroon-800 text-[10px] font-sans px-1.5 py-0.5 rounded-sm font-black">
                      {issue.upvotes?.length || 0}
                    </span>
                  </button>
                )}
                <span className="text-[9px] font-sans uppercase text-stone-400">
                  {issue.upvotes?.length || 0} supporters
                </span>
              </div>
            ) : (
              /* Authority Dashboard: Status Cycle Panel + Add Official Response form! */
              <div className="bg-gov-cream-100 p-4 border border-stone-200 rounded-sm space-y-3">
                <span className="block text-[9px] font-black uppercase tracking-widest text-gov-maroon-900">
                  Authority Directive Panel
                </span>
                
                <div className="grid grid-cols-1 gap-2">
                  {issue.status !== "In Progress" && issue.status !== "Resolved" && (
                    <button
                      onClick={() => onUpdateStatus(issue._id, "In Progress")}
                      className="text-[10px] font-bold uppercase tracking-widest bg-white border border-gov-maroon-900 hover:bg-gov-maroon-900 hover:text-white text-gov-maroon-900 py-2 px-3 transition-colors text-center rounded-sm cursor-pointer"
                    >
                      Initiate Dispatch
                    </button>
                  )}
                  {issue.status !== "Resolved" && (
                    <button
                      onClick={() => onUpdateStatus(issue._id, "Resolved")}
                      className="text-[10px] font-bold uppercase tracking-widest bg-gov-maroon-900 hover:bg-gov-maroon-800 text-white py-2 px-3 transition-colors text-center rounded-sm cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle size={11} /> Mark Resolved
                    </button>
                  )}
                  {issue.status === "Resolved" && (
                    <button
                      onClick={() => onUpdateStatus(issue._id, "Reported")}
                      className="text-[10px] font-bold uppercase tracking-widest bg-gov-cream-200 hover:bg-stone-200 text-gov-maroon-700 py-2 px-3 transition-colors text-center rounded-sm cursor-pointer border border-stone-200"
                    >
                      Re-open Investigation
                    </button>
                  )}
                </div>

                {/* Text form to update officialResponse comment */}
                <div className="pt-2 border-t border-stone-200 space-y-1.5">
                  <label className="block text-[8px] font-black uppercase tracking-widest text-stone-500">
                    Add/Update Official Comment
                  </label>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const input = (e.target as any).elements.officialResponseInput;
                      if (input) {
                        onUpdateStatus(issue._id, issue.status, input.value);
                      }
                    }}
                    className="flex gap-2"
                  >
                    <input
                      name="officialResponseInput"
                      type="text"
                      placeholder="Write dispatch update..."
                      defaultValue={issue.officialResponse || ""}
                      className="bg-white border border-stone-200 px-3 py-1.5 text-xs text-gov-maroon-800 focus:border-gov-maroon-900 focus:ring-0 outline-none rounded-sm flex-1 font-sans"
                    />
                    <button
                      type="submit"
                      className="bg-gov-maroon-900 text-white text-[9px] font-bold uppercase tracking-wider px-3 py-1.5 hover:bg-gov-maroon-800 transition-colors rounded-sm cursor-pointer shrink-0"
                    >
                      Save
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-10 py-8 animate-fadeIn">
      
      {/* Header section with refresh */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 border-b border-stone-200 pb-6">
        <div className="space-y-2">
          <span className="text-[10px] font-black tracking-[0.3em] uppercase text-stone-400 block">
            LIVE REGISTRY / PUBLIC LOGS
          </span>
          <h2 className="font-display font-black text-3xl sm:text-4xl uppercase tracking-tight text-gov-maroon-950">
            Incident Log Feed
          </h2>
          <p className="text-stone-500 text-xs sm:text-sm uppercase tracking-wide leading-relaxed max-w-2xl">
            A real-time, transparent ledger of reported hyperlocal infrastructure failures. Search active cases, monitor work crews, and trigger status updates directly.
          </p>
        </div>
      </div>

      {/* 30-Day Retention Notice */}
      <div className="bg-gov-cream-100 border border-stone-200 p-4 flex items-start gap-3 rounded-sm">
        <Clock className="text-stone-600 shrink-0 mt-0.5" size={16} />
        <div className="space-y-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-gov-maroon-900">
            Retention Notice: 30-Day Resolved Policy
          </p>
          <p className="text-xs text-stone-500 leading-relaxed uppercase tracking-wider text-[10px]">
            Resolved issues belonging to other districts or constituencies are automatically removed from your dashboard feed 30 days after they are resolved to maintain focus on current regional complaints.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-stone-200 p-6 flex flex-col xl:flex-row gap-6 items-center rounded-sm">
        {/* Search input */}
        <div className="relative w-full xl:flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
          <input
            type="text"
            placeholder="Search incident registries..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 border border-stone-200 focus:border-gov-maroon-900 focus:ring-0 outline-none text-gov-maroon-900 text-sm placeholder-stone-400 bg-gov-cream-100/20 rounded-sm transition-all"
            id="dashboard-search-input"
          />
        </div>

        {/* Filter controls */}
        <div className="flex flex-col md:flex-row gap-6 w-full xl:w-auto items-start md:items-center flex-wrap">
          {/* District Filter Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-stone-400 mr-2 shrink-0">
              District:
            </span>
            <select
              value={getNormalizedDistrict(districtFilter)}
              onChange={(e) => {
                setDistrictFilter(e.target.value);
                setConstituencyFilter("All");
              }}
              className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest border border-stone-200 bg-white text-gov-maroon-700 focus:border-gov-maroon-900 outline-none rounded-sm cursor-pointer disabled:opacity-80 disabled:cursor-not-allowed"
              disabled={session?.role === "collector" || session?.role === "mla"}
            >
              {!(session?.role === "collector" || session?.role === "mla") && (
                <option value="All">ALL DISTRICTS</option>
              )}
              {uniqueDistricts.map((d) => (
                <option key={d} value={d}>
                  {d.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {/* Constituency Filter Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-stone-400 mr-2 shrink-0">
              Constituency:
            </span>
            <select
              value={getNormalizedConstituency(constituencyFilter)}
              onChange={(e) => setConstituencyFilter(e.target.value)}
              className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest border border-stone-200 bg-white text-gov-maroon-700 focus:border-gov-maroon-900 outline-none rounded-sm cursor-pointer disabled:opacity-80 disabled:cursor-not-allowed"
              disabled={session?.role === "mla"}
            >
              {session?.role !== "mla" && <option value="All">ALL CONSTITUENCIES</option>}
              {uniqueConstituencies.map((c) => (
                <option key={c} value={c}>
                  {c.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {/* Status filter */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-stone-400 mr-2 shrink-0">
              Status:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {["All", "Reported", "In Progress", "Resolved"].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3.5 py-2 text-[10px] font-bold uppercase tracking-widest border transition-all rounded-sm cursor-pointer ${
                    statusFilter === status
                      ? "bg-gov-maroon-900 border-gov-maroon-900 text-white"
                      : "bg-white border-stone-200 text-stone-600 hover:text-gov-maroon-950 hover:border-gov-maroon-900"
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Map Layer */}
      {!isLoading && (
        <div className="space-y-4">
          <div className="border-b border-stone-200 pb-3 flex justify-between items-center">
            <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-gov-maroon-800">
              Interactive Incident Map
            </h3>
            <span className="text-[10px] font-sans text-stone-400">GEOLOCATION_GRID</span>
          </div>
          <IssuesMap issues={filteredIssues} />
        </div>
      )}

      {/* Loading state */}
      {isLoading ? (
        <div className="py-24 text-center space-y-4">
          <svg className="animate-spin h-8 w-8 text-gov-maroon-900 mx-auto" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Fetching live entries...</p>
        </div>
      ) : filteredIssues.length === 0 ? (
        /* Empty State */
        <div className="bg-white border border-stone-200 p-12 text-center max-w-xl mx-auto space-y-6 rounded-sm">
          <div className="w-12 h-12 bg-gov-cream-200 text-stone-500 rounded-sm flex items-center justify-center mx-auto">
            <AlertCircle size={20} />
          </div>
          <div className="space-y-2">
            <h3 className="font-display font-black text-lg uppercase tracking-tight text-gov-maroon-950">No cases matched criteria</h3>
            <p className="text-stone-500 text-xs sm:text-sm uppercase tracking-wide leading-relaxed">
              {issues.length === 0
                ? "No incidents have been logged in the community database yet."
                : "No matching incidents found for the selected filter keywords."}
            </p>
          </div>
          {issues.length === 0 && session?.role !== "collector" && (
            <button
              onClick={() => onUpdateStatus("demo_redirect", "")}
              className="border border-gov-maroon-900 bg-gov-maroon-900 text-white hover:bg-white hover:text-gov-maroon-900 px-6 py-3.5 text-xs font-black uppercase tracking-[0.2em] transition-all rounded-sm cursor-pointer"
            >
              Log First Incident
            </button>
          )}
        </div>
      ) : (
        /* Grid of Issue Cards divided into Revisited, Ongoing, and Resolved sections (Full-Width, Sidebar Removed) */
        <div className="space-y-12">
          {/* Revisited Section */}
          {revisited.length > 0 && (
            <div className="space-y-6">
              <div className="border-l-4 border-red-600 pl-4 py-1">
                <h3 className="font-display font-black text-xl uppercase tracking-tight text-red-700 flex items-center gap-2">
                  <span>Revisited Issues</span>
                  <span className="bg-red-100 text-gov-maroon-800 text-xs px-2.5 py-0.5 rounded-full font-sans font-bold">
                    {revisited.length}
                  </span>
                </h3>
                <p className="text-stone-500 text-[10px] uppercase font-bold tracking-widest mt-0.5">
                  Re-reported by citizens after marked as resolved
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {revisited.map((issue) => renderCard(issue))}
              </div>
            </div>
          )}

          {/* Ongoing Section */}
          {ongoing.length > 0 && (
            <div className="space-y-6">
              <div className="border-l-4 border-gov-maroon-900 pl-4 py-1">
                <h3 className="font-display font-black text-xl uppercase tracking-tight text-gov-maroon-900 flex items-center gap-2">
                  <span>Ongoing Issues</span>
                  <span className="bg-gov-cream-200 text-gov-maroon-800 text-xs px-2.5 py-0.5 rounded-full font-sans font-bold">
                    {ongoing.length}
                  </span>
                </h3>
                <p className="text-stone-500 text-[10px] uppercase font-bold tracking-widest mt-0.5">
                  Currently active and under review / repair
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {ongoing.map((issue) => renderCard(issue))}
              </div>
            </div>
          )}

          {/* Resolved Section */}
          {resolved.length > 0 && (
            <div className="space-y-6">
              <div className="border-l-4 border-gov-green-600 pl-4 py-1">
                <h3 className="font-display font-black text-xl uppercase tracking-tight text-gov-green-700 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5"><CheckCircle size={18} />Resolved Issues</span>
                  <span className="bg-green-100 text-gov-green-700 text-xs px-2.5 py-0.5 rounded-full font-sans font-bold">
                    {resolved.length}
                  </span>
                </h3>
                <p className="text-stone-500 text-[10px] uppercase font-bold tracking-widest mt-0.5">
                  Successfully addressed and verified cases
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {resolved.map((issue) => renderCard(issue))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
