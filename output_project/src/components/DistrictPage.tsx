import React, { useState, useEffect, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { MapPin, Users, Award, ShieldAlert, ArrowLeft, PlusCircle, AlertTriangle } from "lucide-react";
import { Issue } from "../types.js";
import IssuesMap from "./IssuesMap.tsx";
import StatusTracker from "./StatusTracker.tsx";

interface DistrictPageProps {
  issues: Issue[];
}

export default function DistrictPage({ issues }: DistrictPageProps) {
  const { districtName } = useParams<{ districtName: string }>();
  const navigate = useNavigate();
  
  const [districts, setDistricts] = useState<any[]>([]);
  const [constituencies, setConstituencies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [resDist, resConst] = await Promise.all([
          fetch("/api/districts").then(r => r.json()),
          fetch("/api/constituencies").then(r => r.json())
        ]);
        if (resDist.success && Array.isArray(resDist.data)) {
          setDistricts(resDist.data);
        }
        if (resConst.success && Array.isArray(resConst.data)) {
          setConstituencies(resConst.data);
        }
      } catch (err) {
        console.error("Error loading district page data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Find active district (slugified matches or exact name match)
  const activeDistrict = useMemo(() => {
    if (!districtName) return null;
    const cleanParam = districtName.toLowerCase().replace(/[^a-z0-9]/g, "");
    return districts.find(
      (d) =>
        d.id.toLowerCase() === cleanParam ||
        d.name.toLowerCase().replace(/[^a-z0-9]/g, "") === cleanParam
    );
  }, [districts, districtName]);

  // Find constituencies belonging to this district
  const districtConstituencies = useMemo(() => {
    if (!activeDistrict) return [];
    return constituencies.filter(
      (c) => c.districtId.toLowerCase() === activeDistrict.id.toLowerCase()
    );
  }, [constituencies, activeDistrict]);

  // Filter issues in this district
  const districtIssues = useMemo(() => {
    if (!activeDistrict) return [];
    return issues.filter(
      (i) => i.district?.toLowerCase() === activeDistrict.name.toLowerCase() ||
             i.district?.toLowerCase() === activeDistrict.id.toLowerCase()
    );
  }, [issues, activeDistrict]);

  if (loading) {
    return (
      <div className="py-24 text-center space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gov-maroon-900 mx-auto" />
        <span className="text-xs font-sans text-stone-400 uppercase tracking-widest block">Loading District Ledger...</span>
      </div>
    );
  }

  if (!activeDistrict) {
    return (
      <div className="max-w-xl mx-auto my-16 bg-white border border-stone-200 p-8 text-center space-y-6">
        <div className="mx-auto w-12 h-12 bg-gov-cream-200 flex items-center justify-center text-gov-maroon-900">
          <ShieldAlert size={24} />
        </div>
        <div className="space-y-2">
          <span className="text-[9px] font-black tracking-widest text-stone-400 block uppercase">LEDGER ACCESS FAILURE</span>
          <h3 className="font-display font-black text-2xl uppercase text-gov-maroon-900">DISTRICT NOT FOUND</h3>
          <p className="text-stone-500 text-xs">
            The district <strong className="text-gov-maroon-950 font-bold">"{districtName}"</strong> could not be identified in the Tamil Nadu database.
          </p>
        </div>
        <div className="pt-4 border-t border-gov-cream-200 flex justify-center gap-3">
          <Link
            to="/"
            className="px-4 py-2 border border-gov-maroon-900 text-xs font-bold uppercase tracking-widest text-gov-maroon-900 hover:bg-gov-maroon-950 hover:text-white transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  // Statistics
  const totalCount = districtIssues.length;
  const resolvedCount = districtIssues.filter((i) => i.status === "Resolved").length;
  const pendingCount = totalCount - resolvedCount;

  return (
    <div className="space-y-12 py-8 animate-fadeIn">
      {/* Header breadcrumb */}
      <div>
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-[10px] font-black tracking-widest text-stone-400 hover:text-gov-maroon-900 uppercase transition-colors"
        >
          <ArrowLeft size={12} />
          <span>Back to Tamil Nadu Index</span>
        </Link>
      </div>

      {/* Editorial Title Section */}
      <section className="border-b border-stone-200 pb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-3">
          <span className="text-[10px] font-black tracking-[0.3em] uppercase text-stone-400 block">
            DISTRICT RECORD CENTRE // TN_ID: {activeDistrict.id.toUpperCase()}
          </span>
          <h1 className="text-4xl sm:text-6xl font-black tracking-tighter uppercase text-gov-maroon-950 font-display">
            {activeDistrict.name} DISTRICT
          </h1>
          <p className="text-stone-500 text-xs sm:text-sm uppercase tracking-wide max-w-xl">
            Overarching public oversight, assembly constituency tallies, and critical infrastructure logs for {activeDistrict.name}.
          </p>
        </div>

        <div className="flex gap-4">
          <div className="bg-white px-5 py-4 border border-stone-200 text-center min-w-[100px]">
            <span className="text-[8px] font-sans text-stone-400 block uppercase">TOTAL LOAD</span>
            <span className="text-3xl font-light font-serif text-gov-maroon-900">{totalCount}</span>
          </div>
          <div className="bg-white px-5 py-4 border border-stone-200 text-center min-w-[100px]">
            <span className="text-[8px] font-sans text-stone-400 block uppercase">RESOLVED</span>
            <span className="text-3xl font-light font-serif text-gov-green-600">{resolvedCount}</span>
          </div>
        </div>
      </section>

      {/* Constituency blocks matrix */}
      <section className="space-y-6">
        <div className="border-b border-stone-200 pb-3 flex justify-between items-center">
          <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-gov-maroon-800">
            Assembly Segments under {activeDistrict.name}
          </h3>
          <span className="text-[10px] font-sans text-stone-400">{districtConstituencies.length} CONSTITUENCIES</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {districtConstituencies.map((c) => {
            const count = issues.filter(
              (i) => i.constituency?.toLowerCase() === c.name.toLowerCase()
            ).length;

            return (
              <Link
                key={c.id}
                to={`/constituency/${c.id}`}
                className="border border-stone-200 hover:border-gov-maroon-950 bg-white p-5 transition-all flex flex-col justify-between space-y-4 group"
              >
                <div className="space-y-1.5">
                  <span className="text-[8px] font-sans text-stone-400 uppercase">NO. {c.constituencyNo} // ASSEMBLY BLOCK</span>
                  <h4 className="font-display font-black text-base uppercase text-gov-maroon-900 leading-tight">
                    {c.name}
                  </h4>
                  <p className="text-[10px] text-stone-500">
                    MLA: <span className="font-bold text-gov-maroon-800">{c.mlaName}</span> ({c.mlaParty})
                  </p>
                </div>
                <div className="flex justify-between items-center pt-3 border-t border-gov-cream-200 text-[10px]">
                  <span className="text-[8px] font-sans text-stone-400 uppercase">POP: {c.population}</span>
                  <span className="font-sans font-bold px-2 py-0.5 bg-gov-cream-200 text-gov-maroon-700">
                    {count} {count === 1 ? 'CASE' : 'CASES'}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Map and reported issues */}
      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="border-b border-stone-200 pb-3">
            <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-gov-maroon-800">
              Active Issue Map Ledger
            </h3>
          </div>
          <div className="h-[400px] border border-stone-200 bg-gov-cream-200">
            <IssuesMap issues={districtIssues} />
          </div>
        </div>

        <div className="space-y-6">
          <div className="border-b border-stone-200 pb-3">
            <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-gov-maroon-800">
              District Issues List ({totalCount})
            </h3>
          </div>
          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
            {districtIssues.length === 0 ? (
              <div className="p-8 border border-dashed border-stone-200 text-center space-y-2">
                <p className="text-xs text-stone-500 uppercase tracking-wider font-sans">No active issues recorded</p>
                <p className="text-[10px] text-stone-400">All public assets in this district are clear or pending report.</p>
              </div>
            ) : (
              districtIssues.map((issue) => (
                <div key={issue._id || issue.id} className="border border-stone-200 p-4 bg-white space-y-2">
                  <div className="flex justify-between items-start gap-2">
                    <h4 className="font-bold text-xs uppercase tracking-tight text-gov-maroon-900 truncate">
                      {issue.title}
                    </h4>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`text-[8px] font-sans font-bold uppercase px-1.5 py-0.5 ${
                        issue.status === "Resolved"
                          ? "bg-green-100 text-gov-green-700"
                          : issue.status === "In Progress"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-gov-gold-100 text-gov-gold-700"
                      }`}>
                        {issue.status}
                      </span>
                      {issue.reReported && (
                        <span className="text-[7px] font-sans font-bold uppercase bg-red-100 text-gov-maroon-800 px-1.5 py-0.5 animate-pulse">
                          RE-REPORTED
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-[11px] text-stone-500 line-clamp-2">{issue.description}</p>
                  
                  <StatusTracker currentStatus={issue.status} />
                  
                  {issue.reReported && issue.reReportedComment && (
                    <div className="bg-red-50/50 border-l border-red-400 p-2 text-[10px] text-gov-maroon-800 font-sans">
                      <span className="font-bold uppercase text-[8px] block">Citizen Re-Report Reason:</span>
                      "{issue.reReportedComment}"
                    </div>
                  )}
                  <div className="pt-2 border-t border-gov-cream-200 flex justify-between items-center text-[9px] font-sans text-stone-400">
                    <span>SECTOR: {issue.category?.toUpperCase()}</span>
                    <div className="flex gap-2 items-center">
                      {issue.videoUrl ? (
                        <span className="text-gov-maroon-800 font-black bg-gov-cream-200 px-1.5 py-0.5 rounded-sm text-[8px] tracking-wider uppercase">VIDEO</span>
                      ) : issue.imageUrl ? (
                        <span className="text-gov-maroon-800 font-black bg-gov-cream-200 px-1.5 py-0.5 rounded-sm text-[8px] tracking-wider uppercase">PHOTO</span>
                      ) : null}
                      <span>BLOCK: {issue.constituency?.toUpperCase()}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
