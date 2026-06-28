import React, { useState, useEffect, useMemo } from "react";
import { PlusCircle, LayoutDashboard, ShieldAlert, CheckCircle2, AlertTriangle, Info, ArrowUpRight, Search, MapPin } from "lucide-react";
import { ActiveTab, Issue, UserSession } from "../types.js";
import { Link } from "react-router-dom";
import { calculateCitizenStats } from "../utils/gamification.ts";

interface HomeProps {
  setActiveTab: (tab: ActiveTab) => void;
  issues: Issue[];
  session?: UserSession | null;
}

export default function Home({ setActiveTab, issues, session }: HomeProps) {
  // Compute dynamic stats from issues
  const totalCount = issues.length;
  const inProgressCount = issues.filter(i => i.status === "In Progress").length;
  const resolvedCount = issues.filter(i => i.status === "Resolved").length;
  const reportedCount = issues.filter(i => i.status === "Reported" || !i.status).length;

  const [districts, setDistricts] = useState<any[]>([]);
  const [constituencies, setConstituencies] = useState<any[]>([]);
  const [selectedDistrictId, setSelectedDistrictId] = useState("ariyalur");
  const [constituencySearch, setConstituencySearch] = useState("");
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
          if (session?.role === "citizen" && session.district) {
            const matchingDist = resDist.data.find(
              (d: any) => d.name.toLowerCase() === session.district?.toLowerCase() || d.id.toLowerCase() === session.district?.toLowerCase()
            );
            if (matchingDist) {
              setSelectedDistrictId(matchingDist.id);
            } else if (resDist.data.length > 0) {
              setSelectedDistrictId(resDist.data[0].id);
            }
          } else if (resDist.data.length > 0) {
            // Pick a non-Chennai or first district as default
            const hasAriyalur = resDist.data.some(d => d.id === "ariyalur");
            setSelectedDistrictId(hasAriyalur ? "ariyalur" : resDist.data[0].id);
          }
        }
        if (resConst.success && Array.isArray(resConst.data)) {
          setConstituencies(resConst.data);
        }
      } catch (err) {
        console.error("Error loading home directory:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [session]);

  // Filter constituencies by selected district
  const filteredByDistrict = useMemo(() => {
    return constituencies.filter(
      (c) => c.districtId.toLowerCase() === selectedDistrictId.toLowerCase()
    );
  }, [constituencies, selectedDistrictId]);

  // Search across all constituencies in Tamil Nadu
  const searchedConstituencies = useMemo(() => {
    if (!constituencySearch.trim()) return [];
    const query = constituencySearch.toLowerCase().trim();
    return constituencies.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.mlaName.toLowerCase().includes(query) ||
        c.mlaParty.toLowerCase().includes(query)
    ).slice(0, 12); // Limit global search results for performance/display
  }, [constituencies, constituencySearch]);

  const selectedDistrictName = useMemo(() => {
    const d = districts.find(item => item.id.toLowerCase() === selectedDistrictId.toLowerCase());
    return d ? d.name : "Ariyalur";
  }, [districts, selectedDistrictId]);

  const currentDistrict = useMemo(() => {
    return session?.district || session?.assignedDistrict || "";
  }, [session]);

  const currentConstituency = useMemo(() => {
    return session?.constituency || session?.assignedConstituency || "";
  }, [session]);

  const userDistrictObj = useMemo(() => {
    if (!currentDistrict) return null;
    return districts.find(
      (d) =>
        d.name?.toLowerCase() === currentDistrict.toLowerCase() ||
        d.id?.toLowerCase() === currentDistrict.toLowerCase()
    );
  }, [districts, currentDistrict]);

  const userConstituencyObj = useMemo(() => {
    if (!currentConstituency) return null;
    return constituencies.find(
      (c) =>
        c.name?.toLowerCase() === currentConstituency.toLowerCase() ||
        c.id?.toLowerCase() === currentConstituency.toLowerCase()
    );
  }, [constituencies, currentConstituency]);

  return (
    <div className="space-y-16 py-8 animate-fadeIn">
      
      {/* Formal Notice / Letterhead Section */}
      <section className="relative py-10 md:py-14 border-b-2 border-gov-gold-500 bg-gov-cream-200/60 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 rounded-sm">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
          <div className="space-y-4">
            <span className="text-[11px] font-bold tracking-[0.3em] uppercase text-gov-gold-700 block">
              Public Notice · Civic Grievance Redressal
            </span>
            <h1 className="text-3xl sm:text-5xl leading-tight font-bold tracking-tight text-gov-maroon-950 font-display">
              Empowering Citizens,<br/>One Local Issue at a Time
            </h1>
          </div>

          <div className="max-w-md space-y-6">
            <p className="text-stone-600 text-sm leading-relaxed">
              Welcome to the Tamil Nadu Public Grievance Portal. This platform allows citizens to easily report and track local public infrastructure issues directly to local administrative authorities. Register new cases, monitor resolution progress, and help improve our communities.
            </p>
            
            <div className="flex flex-wrap gap-3">
              {session?.role !== "collector" && session?.role !== "mla" && (
                <button
                  onClick={() => setActiveTab("report")}
                  className="border-2 border-gov-maroon-900 bg-gov-maroon-900 text-white px-6 py-3.5 text-xs font-bold uppercase tracking-[0.15em] hover:bg-white hover:text-gov-maroon-900 transition-all cursor-pointer shadow-xs rounded-sm"
                  id="hero-report-btn"
                >
                  Report Issue
                </button>
              )}
              <button
                onClick={() => {
                  if (session?.role === "collector") setActiveTab("collector");
                  else if (session?.role === "mla") setActiveTab("mla");
                  else setActiveTab("dashboard");
                }}
                className="border-2 border-gov-maroon-900 bg-white text-gov-maroon-900 px-6 py-3.5 text-xs font-black uppercase tracking-[0.2em] hover:bg-gov-maroon-900 hover:text-white transition-all cursor-pointer shadow-xs"
                id="hero-view-map"
              >
                {session?.role === "collector"
                  ? "Open Collector Room"
                  : session?.role === "mla"
                  ? "Open MLA Room"
                  : "Check Dashboard"}
              </button>
            </div>
          </div>
        </div>

        {/* Collector Office Identification Block */}
        {session?.role === "collector" && (
          <div className="mt-12 border-t border-stone-200 pt-8 flex flex-col md:flex-row md:items-center justify-between gap-6 animate-fadeIn">
            <div className="space-y-2">
              <span className="inline-flex items-center px-2.5 py-1 text-[9px] font-sans font-bold tracking-widest uppercase bg-gov-maroon-900 text-white rounded-sm">
                Office of the District Collector
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-gov-maroon-950 font-display">
                {userDistrictObj?.collectorName || "Thiru. K. P. Karthikeyan, IAS"}
              </h2>
              <p className="text-sm font-sans text-stone-500">
                Presiding Administrative &amp; Revenue Commissioner of {currentDistrict?.toUpperCase() || "the Assigned"} District
              </p>
            </div>
            <div className="bg-gov-cream-100 border border-stone-200 p-4 shrink-0 font-sans text-[10px] space-y-1 rounded-sm">
              <div className="text-stone-400 uppercase tracking-wider">Office Classification</div>
              <div className="font-bold text-gov-maroon-900 uppercase">Indian Administrative Service</div>
              <div className="text-stone-400 uppercase tracking-wider pt-1">Grievance Channel Status</div>
              <div className="font-bold text-gov-green-600 uppercase">Online &amp; Connected</div>
            </div>
          </div>
        )}

        {/* MLA Office Identification Block */}
        {session?.role === "mla" && (
          <div className="mt-12 border-t border-stone-200 pt-8 flex flex-col md:flex-row md:items-center justify-between gap-6 animate-fadeIn">
            <div className="space-y-2">
              <span className="inline-flex items-center px-2.5 py-1 text-[9px] font-sans font-bold tracking-widest uppercase bg-gov-maroon-900 text-white rounded-sm">
                Legislative Assembly Member (MLA)
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-gov-maroon-950 font-display">
                {userConstituencyObj?.mlaName || "Thiru. K. Srinivasan"}
              </h2>
              <p className="text-sm font-sans text-stone-500">
                Presiding Elected Legislative Assembly Member of {currentConstituency?.toUpperCase() || "the Assigned"} Constituency
              </p>
            </div>
            <div className="bg-gov-cream-100 border border-stone-200 p-4 shrink-0 font-sans text-[10px] space-y-1 rounded-sm">
              <div className="text-stone-400 uppercase tracking-wider">Office Classification</div>
              <div className="font-bold text-gov-maroon-900 uppercase">State Legislative Representative</div>
              <div className="text-stone-400 uppercase tracking-wider pt-1">Grievance Channel Status</div>
              <div className="font-bold text-gov-green-600 uppercase">Online &amp; Connected</div>
            </div>
          </div>
        )}
      </section>

      {/* Local Authorities Directory Section */}
      <section className="space-y-8 animate-fadeIn pt-4">
        <div className="border-b border-stone-200 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold uppercase tracking-wide text-gov-maroon-950">
              Your Local Administration Officials
            </h3>
            <p className="text-[11px] text-stone-500">
              The primary state administrators and elected representatives assigned to your region.
            </p>
          </div>
          <div className="flex gap-2">
            <span className="inline-flex items-center text-[10px] font-sans font-bold px-2.5 py-1 bg-gov-cream-200 text-gov-maroon-800 uppercase border border-stone-200 rounded-sm">
              <MapPin size={11} className="mr-1" /> {session?.district?.toUpperCase() || "TAMIL NADU"}
            </span>
            {session?.constituency && (
              <span className="inline-flex items-center text-[10px] font-sans font-bold px-2.5 py-1 bg-gov-maroon-900 text-white uppercase rounded-sm">
                {session.constituency.toUpperCase()}
              </span>
            )}
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs font-sans text-stone-400 animate-pulse uppercase tracking-wider">
            Loading Regional Administration Records...
          </div>
        ) : session ? (
          (() => {
            const currentDistrict = session.district || session.assignedDistrict || "";
            const currentConstituency = session.constituency || session.assignedConstituency || "";

            const userDistrictObj = districts.find(
              (d) =>
                d.name?.toLowerCase() === currentDistrict.toLowerCase() ||
                d.id?.toLowerCase() === currentDistrict.toLowerCase()
            );

            const userConstituencyObj = constituencies.find(
              (c) =>
                c.name?.toLowerCase() === currentConstituency.toLowerCase() ||
                c.id?.toLowerCase() === currentConstituency.toLowerCase()
            );

            const isCollectorRole = session?.role === "collector";
            const isSpecialRole = isCollectorRole;

            if (isSpecialRole) {
              return (
                <div className="space-y-10 animate-fadeIn">
                  {/* Collector Administration Info Card */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white p-6 border border-stone-200 flex flex-col justify-between space-y-6">
                      <div className="space-y-3">
                        <span className="text-[9px] font-bold tracking-[0.25em] uppercase text-stone-400 block">
                          District Collector
                        </span>
                        <h4 className="text-lg font-black uppercase tracking-tight text-gov-maroon-950">
                          {userDistrictObj?.collectorName || "Thiru. K. P. Karthikeyan, IAS"}
                        </h4>
                        <p className="text-xs text-stone-500 uppercase tracking-wider leading-relaxed">
                          Chief Administrative and Revenue Officer of the District. Directs all municipality tasks, registers civic grievances, and controls state programs.
                        </p>
                      </div>
                      <div className="pt-4 border-t border-gov-cream-200 flex justify-between items-center">
                        <span className="text-[9px] font-sans text-stone-400 uppercase">Administration</span>
                        <span className="text-[9px] font-sans font-bold px-2 py-0.5 bg-gov-cream-200 border border-stone-200/60 text-gov-maroon-700">
                          INDIAN ADMIN SERVICE
                        </span>
                      </div>
                    </div>

                    {/* Admin Instructions block */}
                    <div className="bg-gov-cream-100 p-6 border border-dashed border-stone-200 flex flex-col justify-center space-y-4">
                      <span className="text-[9px] font-sans font-bold text-stone-400 uppercase tracking-widest block">
                        ADMINISTRATIVE OFFICE NOTE
                      </span>
                      <p className="text-xs text-stone-500 leading-relaxed uppercase tracking-wider font-sans">
                        As the presiding District Collector, you hold administrative authority over regional resource dispatches and civic grievance resolution for your assigned district.
                      </p>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* MLA Card */}
                <div className="bg-white p-6 border border-stone-200 flex flex-col justify-between space-y-6">
                  <div className="space-y-3">
                    <span className="text-[9px] font-bold tracking-[0.25em] uppercase text-stone-400 block">
                      Elected Legislative Member
                    </span>
                    <h4 className="text-3xl font-black uppercase tracking-tight text-gov-maroon-950">
                      {userConstituencyObj?.mlaName || "Thiru. K. Srinivasan"}
                    </h4>
                    <p className="text-xs text-stone-500 uppercase tracking-wider leading-relaxed">
                      Member of the Legislative Assembly (MLA) representing {currentConstituency || "your constituency"}. Responsible for local development funds and voicing assembly grievances.
                    </p>
                  </div>
                  <div className="pt-4 border-t border-gov-cream-200 flex justify-between items-center">
                    <span className="text-[9px] font-sans text-stone-400 uppercase">Political Party</span>
                    <span className="text-[9px] font-sans font-bold px-2 py-0.5 bg-gov-cream-200 border border-stone-200/60 text-gov-maroon-700">
                      {userConstituencyObj?.mlaParty || "AIADMK"}
                    </span>
                  </div>
                </div>

                {/* Collector Card */}
                {!isCollectorRole && (
                  <div className="bg-white p-6 border border-stone-200 flex flex-col justify-between space-y-6">
                    <div className="space-y-3">
                      <span className="text-[9px] font-bold tracking-[0.25em] uppercase text-stone-400 block">
                        District Collector
                      </span>
                      <h4 className="text-lg font-black uppercase tracking-tight text-gov-maroon-950">
                        {userDistrictObj?.collectorName || "Thiru. K. P. Karthikeyan, IAS"}
                      </h4>
                      <p className="text-xs text-stone-500 uppercase tracking-wider leading-relaxed">
                        Chief Administrative and Revenue Officer of {currentDistrict || "the District"}. Directs all municipality tasks, registers civic grievances, and controls state programs.
                      </p>
                    </div>
                    <div className="pt-4 border-t border-gov-cream-200 flex justify-between items-center">
                      <span className="text-[9px] font-sans text-stone-400 uppercase">Administration</span>
                      <span className="text-[9px] font-sans font-bold px-2 py-0.5 bg-gov-cream-200 border border-stone-200/60 text-gov-maroon-700">
                        INDIAN ADMIN SERVICE
                      </span>
                    </div>
                  </div>
                )}

              </div>
            );
          })()
        ) : (
          <div className="p-12 border border-stone-200 text-center text-stone-500 text-xs font-sans uppercase bg-gov-cream-100/50">
            Please log in to view local public administration authorities assigned to your district.
          </div>
        )}
      </section>
    </div>
  );
}