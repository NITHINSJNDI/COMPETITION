import React, { useState, useEffect, useMemo } from "react";
import { Award, Trophy, MapPin, Landmark, Search, ShieldCheck, HelpCircle } from "lucide-react";
import { Issue, UserSession } from "../types.ts";
import { calculateCitizenStats, CitizenStats, Badge } from "../utils/gamification.ts";

interface LeaderboardPageProps {
  issues: Issue[];
  session: UserSession | null;
}

type LeaderboardTab = "state" | "district" | "constituency";

export default function LeaderboardPage({ issues, session }: LeaderboardPageProps) {
  const [districts, setDistricts] = useState<any[]>([]);
  const [constituencies, setConstituencies] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<LeaderboardTab>("state");

  // Filter selections
  const [selectedDistrict, setSelectedDistrict] = useState<string>("All");
  const [selectedConstituency, setSelectedConstituency] = useState<string>("All");

  // Load districts and constituencies for filters on mount
  useEffect(() => {
    async function fetchMetadata() {
      try {
        const [resDist, resConst] = await Promise.all([
          fetch("/api/districts").then((r) => r.json()),
          fetch("/api/constituencies").then((r) => r.json()),
        ]);
        if (resDist.success && Array.isArray(resDist.data)) {
          setDistricts(resDist.data);
        }
        if (resConst.success && Array.isArray(resConst.data)) {
          setConstituencies(resConst.data);
        }
      } catch (err) {
        console.error("Failed to load metadata for filters:", err);
      }
    }
    fetchMetadata();
  }, []);

  // Initialize filters based on user session when metadata loads
  useEffect(() => {
    if (session) {
      if (session.role === "citizen") {
        if (session.district) setSelectedDistrict(session.district);
        if (session.constituency) setSelectedConstituency(session.constituency);
      } else if (session.role === "collector" && session.assignedDistrict) {
        setSelectedDistrict(session.assignedDistrict);
      } else if (session.role === "mla" && session.assignedConstituency) {
        setSelectedConstituency(session.assignedConstituency);
        // Find district for this constituency if possible to align filters
        const matchingConst = constituencies.find(
          (c) => c.name.toLowerCase() === session.assignedConstituency?.toLowerCase() || c.id.toLowerCase() === session.assignedConstituency?.toLowerCase()
        );
        if (matchingConst) {
          const matchingDist = districts.find((d) => d.id === matchingConst.districtId);
          if (matchingDist) setSelectedDistrict(matchingDist.name);
        }
      }
    }
  }, [session, districts, constituencies]);

  // Calculate stats and leaderboards from gamification engine
  const { currentUserStats, leaderboard } = useMemo(() => {
    return calculateCitizenStats(issues, session);
  }, [issues, session]);

  // Tab filtered leaderboards
  const stateLeaderboard = leaderboard;

  const districtLeaderboard = useMemo(() => {
    if (selectedDistrict === "All") return leaderboard;
    return leaderboard.filter(
      (c) => c.district?.toLowerCase() === selectedDistrict.toLowerCase()
    );
  }, [leaderboard, selectedDistrict]);

  const constituencyLeaderboard = useMemo(() => {
    if (selectedConstituency === "All") return leaderboard;
    return leaderboard.filter(
      (c) => c.constituency?.toLowerCase() === selectedConstituency.toLowerCase()
    );
  }, [leaderboard, selectedConstituency]);

  // Get active list to render
  const activeList = useMemo(() => {
    if (activeTab === "state") return stateLeaderboard;
    if (activeTab === "district") return districtLeaderboard;
    return constituencyLeaderboard;
  }, [activeTab, stateLeaderboard, districtLeaderboard, constituencyLeaderboard]);

  return (
    <div className="space-y-8 animate-fadeIn pt-4" id="leaderboard-page-container">
      
      {/* Page Header */}
      <div className="border-b border-stone-200 pb-5 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1.5">
          <span className="text-[9px] font-black tracking-[0.3em] text-stone-400 uppercase font-sans">
            SECURED CIVIC STANDING REGISTRY
          </span>
          <h1 className="text-3xl font-black uppercase tracking-tight text-gov-maroon-900 font-display">
            Civic Hero Leaderboards
          </h1>
          <p className="text-xs text-stone-500 uppercase tracking-wider font-sans">
            Tracking contributions, verify resolutions, and display public standing.
          </p>
        </div>
        <div className="flex gap-2">
          <span className="inline-flex items-center text-[10px] font-sans font-bold px-3 py-1.5 bg-gov-maroon-900 text-white uppercase tracking-wider border border-gov-maroon-800">
            TOTAL CONTRIBUTORS: {leaderboard.length}
          </span>
        </div>
      </div>

      {/* User Profile Standing Header Cards (Only shown if citizen is logged in) */}
      {currentUserStats && session?.role === "citizen" && (
        <section className="space-y-4" id="user-profile-standing">
          <div className="bg-white text-gov-maroon-900 p-6 border border-stone-200 rounded-sm shadow-sm">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
              
              <div className="space-y-2">
                <span className="text-[9px] font-sans text-gov-gold-700 font-bold tracking-[0.25em] uppercase block">
                  Your Community Standing Profile
                </span>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <h2 className="text-2xl font-bold tracking-tight font-display text-gov-maroon-950">
                    {currentUserStats.name}
                  </h2>
                  <div className="inline-flex items-center gap-1.5 bg-gov-gold-100 text-gov-gold-700 border border-gov-gold-500/30 px-2 py-0.5 text-[8px] font-sans font-bold uppercase tracking-widest leading-none rounded-sm">
                    <Award size={10} />
                    <span>{currentUserStats.rankTitle.toUpperCase()}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-sans text-stone-500 uppercase tracking-wide">
                  <span>Email: {currentUserStats.email}</span>
                  <span>•</span>
                  <span>District: {currentUserStats.district?.toUpperCase() || "Not Assigned"}</span>
                  <span>•</span>
                  <span>Constituency: {currentUserStats.constituency?.toUpperCase() || "Not Assigned"}</span>
                </div>
              </div>

              {/* Total points */}
              <div className="bg-gov-cream-200 border border-stone-200 p-4 min-w-[120px] text-center shrink-0 rounded-sm">
                <span className="text-[8px] font-sans text-stone-500 block uppercase tracking-widest">Reputation Points</span>
                <span className="text-2xl font-sans font-black text-gov-maroon-800">{currentUserStats.points} <span className="text-xs text-stone-500">PTS</span></span>
              </div>

            </div>

            {/* Ranks grid for Constituency, District, and State */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-6 border-t border-stone-200">
              
              {/* Constituency Rank Card */}
              <div className="bg-gov-cream-100 border border-stone-200 p-4 hover:border-gov-gold-500/40 transition-colors flex items-center justify-between rounded-sm">
                <div className="space-y-1">
                  <span className="text-[8px] font-sans text-stone-500 block uppercase tracking-wider">
                    Constituency Rank
                  </span>
                  <span className="text-[10px] font-bold uppercase text-gov-maroon-800 font-sans block truncate max-w-[180px]">
                    {currentUserStats.constituency || "My Constituency"}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xl font-sans font-black text-gov-maroon-800">
                    #{currentUserStats.constituencyRank || "N/A"}
                  </span>
                  <span className="text-[9px] font-sans text-stone-500 block uppercase">
                    out of {currentUserStats.totalInConstituency || 0}
                  </span>
                </div>
              </div>

              {/* District Rank Card */}
              <div className="bg-gov-cream-100 border border-stone-200 p-4 hover:border-gov-gold-500/40 transition-colors flex items-center justify-between rounded-sm">
                <div className="space-y-1">
                  <span className="text-[8px] font-sans text-stone-500 block uppercase tracking-wider">
                    District Rank
                  </span>
                  <span className="text-[10px] font-bold uppercase text-gov-maroon-800 font-sans block truncate max-w-[180px]">
                    {currentUserStats.district || "My District"}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xl font-sans font-black text-gov-maroon-900">
                    #{currentUserStats.districtRank || "N/A"}
                  </span>
                  <span className="text-[9px] font-sans text-stone-500 block uppercase">
                    out of {currentUserStats.totalInDistrict || 0}
                  </span>
                </div>
              </div>

              {/* State Rank Card */}
              <div className="bg-gov-cream-100 border border-stone-200 p-4 hover:border-gov-gold-500/40 transition-colors flex items-center justify-between rounded-sm">
                <div className="space-y-1">
                  <span className="text-[8px] font-sans text-stone-500 block uppercase tracking-wider">
                    Statewide Rank
                  </span>
                  <span className="text-[10px] font-bold uppercase text-gov-maroon-800 font-sans block">
                    Tamil Nadu State
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xl font-sans font-black text-gov-green-700">
                    #{currentUserStats.stateRank || "N/A"}
                  </span>
                  <span className="text-[9px] font-sans text-stone-500 block uppercase">
                    out of {currentUserStats.totalInState || 0}
                  </span>
                </div>
              </div>

            </div>
          </div>
        </section>
      )}

      {/* Main leaderboards and search/filter area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Leaderboard List & Selection (8 columns) */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Tabs header */}
          <div className="flex border-b border-stone-200">
            <button
              onClick={() => setActiveTab("state")}
              className={`px-4 sm:px-6 py-3.5 text-xs font-bold uppercase tracking-widest border-b-2 transition-all cursor-pointer ${
                activeTab === "state"
                  ? "border-gov-maroon-950 text-gov-maroon-950 bg-gov-cream-100"
                  : "border-transparent text-stone-400 hover:text-gov-maroon-950"
              }`}
            >
               तमिलनाडु State Board
            </button>
            <button
              onClick={() => setActiveTab("district")}
              className={`px-4 sm:px-6 py-3.5 text-xs font-bold uppercase tracking-widest border-b-2 transition-all cursor-pointer ${
                activeTab === "district"
                  ? "border-gov-maroon-950 text-gov-maroon-950 bg-gov-cream-100"
                  : "border-transparent text-stone-400 hover:text-gov-maroon-950"
              }`}
            >
              District Leaderboard
            </button>
            <button
              onClick={() => setActiveTab("constituency")}
              className={`px-4 sm:px-6 py-3.5 text-xs font-bold uppercase tracking-widest border-b-2 transition-all cursor-pointer ${
                activeTab === "constituency"
                  ? "border-gov-maroon-950 text-gov-maroon-950 bg-gov-cream-100"
                  : "border-transparent text-stone-400 hover:text-gov-maroon-950"
              }`}
            >
              Constituency Board
            </button>
          </div>

          {/* District or Constituency selectors based on active tab */}
          {activeTab === "district" && (
            <div className="bg-gov-cream-100 border border-stone-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <MapPin size={16} className="text-stone-500 shrink-0" />
                <span className="text-xs font-bold uppercase tracking-wider text-gov-maroon-700">Filter by District:</span>
              </div>
              <select
                value={selectedDistrict}
                onChange={(e) => setSelectedDistrict(e.target.value)}
                className="bg-white border border-stone-300 text-xs px-3 py-1.5 focus:outline-none focus:border-gov-maroon-900 rounded-sm w-full sm:w-64 font-sans font-bold"
              >
                <option value="All">ALL DISTRICTS (TAMIL NADU)</option>
                {districts.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.name.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          )}

          {activeTab === "constituency" && (
            <div className="bg-gov-cream-100 border border-stone-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Landmark size={16} className="text-stone-500 shrink-0" />
                <span className="text-xs font-bold uppercase tracking-wider text-gov-maroon-700">Filter by Constituency:</span>
              </div>
              <select
                value={selectedConstituency}
                onChange={(e) => setSelectedConstituency(e.target.value)}
                className="bg-white border border-stone-300 text-xs px-3 py-1.5 focus:outline-none focus:border-gov-maroon-900 rounded-sm w-full sm:w-64 font-sans font-bold"
              >
                <option value="All">ALL CONSTITUENCIES</option>
                {constituencies.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* List display */}
          <div className="bg-white border border-stone-200 divide-y divide-stone-200">
            
            {/* Header row */}
            <div className="bg-gov-cream-100/70 px-4 sm:px-6 py-3.5 flex items-center justify-between text-[10px] font-sans font-black text-stone-400 uppercase tracking-widest">
              <div className="flex items-center gap-4">
                <span className="w-8 text-center">RANK</span>
                <span>CITIZEN NAME</span>
              </div>
              <div className="flex items-center gap-6">
                <span className="hidden sm:inline">BADGES</span>
                <span className="w-16 text-center">REPORTS</span>
                <span className="w-20 text-right">POINTS</span>
              </div>
            </div>

            {/* List items */}
            {activeList.length === 0 ? (
              <div className="p-8 text-center text-stone-400 font-sans text-xs uppercase border-b border-stone-200">
                No active contributors found under this filter.
              </div>
            ) : (
              activeList.map((citizen, index) => {
                const isCurrentUser = session?.email === citizen.email;
                
                // Determine rank number to display based on active tab
                let displayRank = index + 1;
                if (activeTab === "district" && citizen.districtRank) displayRank = citizen.districtRank;
                if (activeTab === "constituency" && citizen.constituencyRank) displayRank = citizen.constituencyRank;

                return (
                  <div
                    key={citizen.email}
                    className={`px-4 sm:px-6 py-4 flex items-center justify-between gap-4 transition-colors ${
                      isCurrentUser ? "bg-gov-cream-100 border-l-4 border-gov-maroon-950 pl-3 sm:pl-5" : ""
                    }`}
                  >
                    
                    {/* Rank & name */}
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-8 h-8 shrink-0 flex items-center justify-center font-sans font-black text-xs text-stone-600 bg-gov-cream-200">
                        {`#${displayRank}`}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs sm:text-sm font-bold text-gov-maroon-900 truncate uppercase">
                            {citizen.name}
                          </span>
                          {isCurrentUser && (
                            <span className="bg-gov-maroon-950 text-white text-[7px] font-sans font-bold tracking-widest uppercase px-1.5 py-0.5 leading-none">
                              YOU
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[9px] font-sans text-stone-400 uppercase tracking-wider">
                          <span className="text-gov-gold-600 font-bold">{citizen.rankTitle}</span>
                          <span>•</span>
                          <span className="text-stone-500">{citizen.constituency?.toUpperCase() || "TAMIL NADU"}</span>
                          <span>•</span>
                          <span className="text-stone-400">{citizen.district?.toUpperCase()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-6 shrink-0">
                      {/* Badges list */}
                      <div className="hidden sm:flex items-center gap-1">
                        {citizen.badges.slice(0, 3).map((b) => (
                          <span
                            key={b.id}
                            title={`${b.name}: ${b.description}`}
                            className="text-[8px] font-bold tracking-wide bg-gov-cream-200 text-gov-maroon-800 border border-stone-200 px-1.5 py-0.5 rounded-sm leading-none cursor-help"
                          >
                            {b.emoji}
                          </span>
                        ))}
                        {citizen.badges.length > 3 && (
                          <span className="text-[8px] font-sans font-bold bg-gov-cream-200 text-stone-500 border border-stone-200 px-1 py-0.5 leading-none">
                            +{citizen.badges.length - 3}
                          </span>
                        )}
                      </div>

                      {/* Issues count */}
                      <div className="w-16 text-center font-sans text-xs text-stone-600">
                        <span className="font-bold text-gov-maroon-900">{citizen.issuesCount}</span>
                        <span className="text-[9px] text-stone-400 block uppercase leading-none">REPORTS</span>
                      </div>

                      {/* Points count */}
                      <div className="w-20 text-right font-sans text-xs sm:text-sm font-black text-gov-maroon-900">
                        {citizen.points} <span className="text-[9px] text-stone-400 font-normal">PTS</span>
                      </div>

                    </div>

                  </div>
                );
              })
            )}

          </div>

          <div className="p-4 bg-gov-cream-100 border border-stone-200 flex items-center gap-3">
            <HelpCircle size={16} className="text-stone-500 shrink-0" />
            <p className="text-[10px] text-stone-500 uppercase font-sans tracking-wider leading-relaxed">
              * Note: The ranking system dynamically re-evaluates all contributors in real-time. Reputation rests purely on verified issue alerts (+100 PTS) and administrative resolutions (+200 PTS).
            </p>
          </div>

        </div>

        {/* Right Column: Gamification FAQ & Info Rules (4 columns) */}
        <div className="lg:col-span-4 space-y-6">
          
          <div className="bg-white text-gov-maroon-900 p-5 border border-stone-200 space-y-4 rounded-sm shadow-sm">
            <div className="border-b border-stone-200 pb-3">
              <span className="text-[8px] font-bold tracking-widest text-gov-gold-700 block font-sans">
                The Point Accruement Model
              </span>
              <h3 className="text-xs font-bold uppercase text-gov-maroon-950 font-sans mt-0.5">
                Rules &amp; Value Mechanics
              </h3>
            </div>

            <p className="text-[10px] text-stone-500 leading-normal font-sans">
              Reputation points are calibrated to prevent click-farming and incentivize genuine neighborhood stewardship.
            </p>

            <div className="space-y-3 font-sans text-[10px]">
              <div className="flex items-start gap-2 border-b border-stone-200 pb-2.5">
                <div className="bg-gov-cream-200 text-gov-maroon-800 border border-stone-200 p-1 font-bold text-center leading-none rounded-sm">
                  +100
                </div>
                <div>
                  <div className="font-bold text-gov-maroon-900 uppercase text-[10px]">Report Grievance</div>
                  <div className="text-stone-500 text-[8px] uppercase">Submitting a verified hyperlocal alert</div>
                </div>
              </div>

              <div className="flex items-start gap-2 border-b border-stone-200 pb-2.5">
                <div className="bg-gov-cream-200 text-gov-maroon-800 border border-stone-200 p-1 font-bold text-center leading-none rounded-sm">
                  +200
                </div>
                <div>
                  <div className="font-bold text-gov-maroon-900 uppercase text-[10px]">Admin Resolution</div>
                  <div className="text-stone-500 text-[8px] uppercase">When MLAs or Collectors mark an issue as resolved</div>
                </div>
              </div>

            </div>
          </div>

          <div className="bg-white border border-stone-200 p-5 space-y-3">
            <span className="text-[8px] font-bold tracking-widest text-stone-400 uppercase block">
              CIVIC ACHIEVEMENTS REGISTRY
            </span>
            <p className="text-[10px] text-stone-500 uppercase tracking-wider leading-relaxed font-sans">
              Earn status title levels based on lifetime reputation points:
            </p>
            <div className="divide-y divide-gov-cream-200 font-sans text-[9px] uppercase">
              <div className="py-2 flex justify-between">
                <span className="text-stone-600">Level 5: Civic Legend</span>
                <span className="text-gov-maroon-950 font-black">1500+ PTS</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-stone-600">Level 4: Constituency Guardian</span>
                <span className="text-gov-maroon-950 font-black">800 - 1499 PTS</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-stone-600">Level 3: Neighborhood Sentinel</span>
                <span className="text-gov-maroon-950 font-black">400 - 799 PTS</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-stone-600">Level 2: Local Watchdog</span>
                <span className="text-gov-maroon-950 font-black">150 - 399 PTS</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-stone-600">Level 1: Civic Novice</span>
                <span className="text-gov-maroon-950 font-black">0 - 149 PTS</span>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
