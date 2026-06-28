import React, { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { Issue } from "../types.js";
import IssuesMap from "./IssuesMap.tsx";
import { MapPin, Award, ArrowLeft, Layers, Info, Calendar, Tag, ShieldAlert } from "lucide-react";
import StatusTracker from "./StatusTracker.tsx";

interface ConstituencyPageProps {
  issues: Issue[];
}

export default function ConstituencyPage({ issues }: ConstituencyPageProps) {
  const { constituencyId } = useParams<{ constituencyId: string }>();

  const [constituencies, setConstituencies] = useState<any[]>([]);
  const [districts, setDistricts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [resConst, resDist] = await Promise.all([
          fetch("/api/constituencies").then((r) => r.json()),
          fetch("/api/districts").then((r) => r.json()),
        ]);
        if (resConst.success && Array.isArray(resConst.data)) {
          setConstituencies(resConst.data);
        }
        if (resDist.success && Array.isArray(resDist.data)) {
          setDistricts(resDist.data);
        }
      } catch (err) {
        console.error("Error loading constituencies page:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Find the constituency details dynamically
  const constituency = useMemo(() => {
    if (!constituencyId) return null;
    const cleanId = constituencyId.toLowerCase().replace(/[^a-z0-9]/g, "");
    return constituencies.find(
      (c) =>
        c.id.toLowerCase() === cleanId ||
        c.name.toLowerCase().replace(/[^a-z0-9]/g, "") === cleanId
    );
  }, [constituencies, constituencyId]);

  // Find corresponding district details
  const parentDistrict = useMemo(() => {
    if (!constituency || !districts.length) return null;
    return districts.find((d) => d.id.toLowerCase() === constituency.districtId.toLowerCase());
  }, [constituency, districts]);

  // Filter issues belonging strictly to this constituency
  const constituencyIssues = useMemo(() => {
    if (!constituency) return [];
    return issues.filter(
      (i) =>
        i.constituency?.toLowerCase() === constituency.name.toLowerCase() ||
        i.constituency?.toLowerCase() === constituency.id.toLowerCase()
    );
  }, [issues, constituency]);

  // Loading state
  if (loading) {
    return (
      <div className="py-24 text-center space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gov-maroon-900 mx-auto" />
        <span className="text-xs font-sans text-stone-400 uppercase tracking-widest block">Retrieving Assembly Ledger...</span>
      </div>
    );
  }

  // If not found, show directory
  if (!constituency) {
    return (
      <div className="space-y-10 animate-fadeIn py-12 max-w-4xl mx-auto">
        <div className="bg-white border border-stone-200 p-8 sm:p-12 text-center space-y-6 rounded-sm">
          <div className="w-12 h-12 bg-gov-maroon-900 text-white rounded-sm flex items-center justify-center mx-auto">
            <ShieldAlert size={20} />
          </div>
          <div className="space-y-2">
            <h3 className="font-display font-black text-2xl uppercase tracking-tight text-gov-maroon-950">
              Assembly Segment Registry Not Found
            </h3>
            <p className="text-stone-500 text-xs sm:text-sm uppercase tracking-wide max-w-md mx-auto leading-relaxed">
              The requested constituency ID is not listed in the active registry. Please return to the homepage to select your constituency block.
            </p>
          </div>

          <div className="pt-6">
            <Link
              to="/"
              className="inline-flex items-center gap-2 border border-gov-maroon-900 px-6 py-3 text-xs font-bold uppercase tracking-widest hover:bg-gov-maroon-900 hover:text-white transition-all rounded-sm font-sans"
            >
              <ArrowLeft size={12} />
              <span>RETURN HOME</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Stats calculation
  const totalCount = constituencyIssues.length;
  const openCount = constituencyIssues.filter((i) => i.status === "Reported" || i.status === "In Progress").length;
  const resolvedCount = constituencyIssues.filter((i) => i.status === "Resolved").length;

  return (
    <div className="space-y-10 animate-fadeIn py-6">
      {/* Back to Home Button & Breadcrumbs */}
      <div className="flex flex-wrap items-center gap-3">
        {parentDistrict && (
          <>
            <Link
              to={`/district/${parentDistrict.id}`}
              className="inline-flex items-center gap-1.5 text-stone-400 hover:text-gov-maroon-950 text-xs font-bold uppercase tracking-widest transition-colors font-sans"
            >
              <ArrowLeft size={12} />
              <span>BACK TO {parentDistrict.name.toUpperCase()} DISTRICT</span>
            </Link>
            <span className="text-stone-300">•</span>
          </>
        )}
        <Link
          to="/"
          className="text-stone-400 hover:text-gov-maroon-950 text-xs font-bold uppercase tracking-widest transition-colors font-sans"
        >
          <span>HOME</span>
        </Link>
      </div>

      {/* Assembly Header Panel */}
      <div className="bg-white border border-stone-200 p-6 sm:p-8 rounded-sm shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <span className="bg-gov-maroon-950 text-white font-sans text-[9px] font-bold px-2 py-0.5 uppercase tracking-wider">
              {constituency.mlaParty} SEAT
            </span>
            <span className="text-[9px] font-sans text-stone-400 uppercase tracking-wider">
              NO. {constituency.constituencyNo} // {parentDistrict?.name.toUpperCase() || "TAMIL NADU"} REGION
            </span>
          </div>
          <h2 className="font-display font-black text-3xl uppercase tracking-tight text-gov-maroon-950">
            {constituency.name} Constituency
          </h2>
          <p className="text-stone-500 text-xs sm:text-sm uppercase tracking-wide leading-relaxed max-w-xl">
            Public operational view. Incident log records, real-time remediation status updates, and map coordinates for the local {constituency.name} assembly division.
          </p>
        </div>

        {/* Representative Info Box */}
        <div className="border border-stone-200 bg-gov-cream-100/50 p-4 shrink-0 w-full md:w-80 rounded-sm space-y-1.5 font-sans text-xs uppercase tracking-wide">
          <div className="flex items-center gap-1.5 pb-2 border-b border-stone-200/50">
            <Award size={14} className="text-gov-maroon-950" />
            <span className="text-[10px] font-black tracking-wider uppercase text-gov-maroon-800">LEGISLATIVE REPRESENTATIVE</span>
          </div>
          <div className="pt-1.5">
            <span className="block text-[8px] font-bold text-stone-400">MLA REPRESENTATIVE</span>
            <strong className="text-gov-maroon-950 text-sm leading-tight block">{constituency.mlaName}</strong>
          </div>
          <div className="grid grid-cols-2 gap-4 pt-1.5">
            <div>
              <span className="block text-[8px] font-bold text-stone-400">EST. POPULATION</span>
              <strong className="text-gov-maroon-950 text-xs">{constituency.population}</strong>
            </div>
            <div>
              <span className="block text-[8px] font-bold text-stone-400">AREA SIZING</span>
              <strong className="text-gov-maroon-950 text-xs">{constituency.areaSqKm} SQ KM</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Constituency Sizing Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white border border-stone-200 p-5 rounded-sm shadow-sm space-y-2 text-center">
          <span className="block text-[9px] font-black uppercase text-stone-400 tracking-wider">TOTAL LOGGED INCIDENTS</span>
          <span className="text-3xl font-black text-gov-maroon-950">{totalCount}</span>
        </div>

        <div className="bg-white border border-stone-200 p-5 rounded-sm shadow-sm space-y-2 text-center">
          <span className="block text-[9px] font-black uppercase text-stone-400 tracking-wider">PENDING REPAIRS</span>
          <span className="text-3xl font-black text-gov-maroon-950">{openCount}</span>
        </div>

        <div className="bg-white border border-stone-200 p-5 rounded-sm shadow-sm space-y-2 text-center">
          <span className="block text-[9px] font-black uppercase text-stone-400 tracking-wider">RESOLVED REMEDIATIONS</span>
          <span className="text-3xl font-black text-gov-green-600">{resolvedCount}</span>
        </div>
      </div>

      {/* Isolated Interactive Map */}
      <div className="bg-white border border-stone-200 p-4 rounded-sm shadow-sm space-y-4">
        <div className="flex justify-between items-center border-b border-gov-cream-200 pb-3">
          <span className="text-[11px] font-black uppercase tracking-widest text-gov-maroon-800">
            {constituency.name} ASSEMBLY GEO-MAP ({constituencyIssues.length} CASES PLOTTED)
          </span>
          <span className="text-[9px] font-sans text-stone-400 uppercase">SUB-SEGMENT LEVEL LAYER</span>
        </div>
        <IssuesMap issues={constituencyIssues} customCenter={constituency.center} customZoom={13} />
      </div>

      {/* Recent Public Reports */}
      <div className="bg-white border border-stone-200 rounded-sm shadow-sm p-6 space-y-6">
        <div className="border-b border-gov-cream-200 pb-4">
          <span className="text-[11px] font-black uppercase tracking-widest text-gov-maroon-800">
            RECENT CITIZEN INCIDENT REPORTS FOR {constituency.name.toUpperCase()}
          </span>
        </div>

        {constituencyIssues.length === 0 ? (
          <div className="py-12 text-center border border-gov-cream-200 bg-gov-cream-100/30 text-stone-400 uppercase tracking-widest text-xs font-sans">
            No incident reports recorded in this constituency sector yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {constituencyIssues.map((issue) => {
              const severityColors = {
                Low: "border-gov-green-600 text-gov-green-700 bg-green-50",
                Medium: "border-gov-gold-500 text-gov-gold-700 bg-gov-gold-100",
                High: "border-red-600 text-red-700 bg-red-50",
              };

              const statusColors = {
                Reported: "border-stone-300 text-stone-500 bg-gov-cream-100",
                "In Progress": "border-gov-maroon-950 text-white bg-gov-maroon-950",
                Resolved: "border-gov-green-600 text-gov-green-700 bg-green-50",
              };

              return (
                <div key={issue._id || issue.id} className="border border-stone-200 p-5 bg-gov-cream-100/10 hover:border-gov-maroon-950 transition-all rounded-sm flex flex-col sm:flex-row gap-5">
                  {issue.videoUrl ? (
                    <div className="w-full sm:w-28 h-24 bg-gov-cream-200 shrink-0 border border-stone-200 overflow-hidden">
                      <video
                        src={issue.videoUrl}
                        controls
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : issue.imageUrl ? (
                    <div className="w-full sm:w-28 h-24 bg-gov-cream-200 shrink-0 border border-stone-200 overflow-hidden">
                      <img
                        src={issue.imageUrl}
                        alt={issue.title}
                        className="w-full h-full object-cover grayscale"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  ) : null}

                  <div className="space-y-2 flex-1 flex flex-col justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`px-2 py-0.5 text-[7px] font-bold uppercase border ${statusColors[issue.status as keyof typeof statusColors] || "border-stone-200"}`}>
                          {issue.status}
                        </span>
                        {issue.reReported && (
                          <span className="px-2 py-0.5 text-[7px] font-bold uppercase border border-red-600 bg-red-50 text-red-700 animate-pulse">
                            RE-REPORTED
                          </span>
                        )}
                        <span className={`px-2 py-0.5 text-[7px] font-bold uppercase border ${severityColors[issue.severity as keyof typeof severityColors || "Medium"]}`}>
                          {issue.severity || "Medium"}
                        </span>
                        <span className="text-[8px] font-sans text-stone-400 ml-auto">
                          {new Date(issue.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      </div>
                      <h4 className="font-display font-black text-sm uppercase text-gov-maroon-950 leading-tight">
                        {issue.title}
                      </h4>
                      <p className="text-stone-500 text-xs line-clamp-2 leading-relaxed">
                        {issue.description}
                      </p>

                      <StatusTracker currentStatus={issue.status} />
                      {issue.reReported && issue.reReportedComment && (
                        <div className="mt-2 bg-red-50/50 border-l-2 border-red-400 p-2 text-[10px] text-gov-maroon-800 font-sans">
                          <span className="font-bold uppercase text-[8px] block text-red-700">Citizen Re-Report Note:</span>
                          "{issue.reReportedComment}"
                        </div>
                      )}
                    </div>

                    <div className="text-[8px] font-sans text-stone-400 uppercase flex items-center gap-1 pt-1.5 border-t border-gov-cream-200">
                      <Tag size={10} className="text-stone-400" />
                      <span>Category: {issue.category || "Other"}</span>
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
}
