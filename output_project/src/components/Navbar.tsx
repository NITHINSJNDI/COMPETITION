import React from "react";
import { ShieldAlert, PlusCircle, LayoutDashboard, Home, AlertCircle, Award } from "lucide-react";
import { ActiveTab, UserSession, Issue } from "../types.ts";
import { calculateCitizenStats } from "../utils/gamification.ts";

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  issuesCount: number;
  userRole?: "citizen" | "collector" | "mla" | null;
  session?: UserSession | null;
  issues?: Issue[];
}

export default function Navbar({ activeTab, setActiveTab, issuesCount, userRole, session, issues = [] }: NavbarProps) {
  // Calculate gamification stats if citizen is logged in
  const gamification = React.useMemo(() => {
    if (userRole === "citizen" && session) {
      return calculateCitizenStats(issues, session);
    }
    return null;
  }, [issues, session, userRole]);

  return (
    <header className="sticky top-0 z-50 shadow-sm">
      {/* Letterhead identity band */}
      <div className="bg-gov-cream-100 border-b border-gov-gold-500/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-center sm:justify-start gap-3">
          <div className="w-9 h-9 shrink-0 flex items-center justify-center">
            <img
              src="/tn-govt-emblem.png"
              alt="Government of Tamil Nadu Emblem"
              className="w-9 h-9 object-contain"
            />
          </div>
          <button
            onClick={() => (userRole ? setActiveTab("home") : undefined)}
            className="flex flex-col items-start focus:outline-none"
            id="nav-logo"
            disabled={!userRole}
          >
            <span className="font-tamil text-[13px] text-gov-maroon-800 leading-tight">சமூக மாவீரன் - குடிமக்கள் குறை தீர்வு மையம்</span>
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-lg tracking-tight text-gov-maroon-900">
                Community <span className="text-gov-gold-700 font-serif italic font-normal">Hero</span>
              </span>
              <span className="hidden sm:inline text-[9px] font-semibold tracking-[0.2em] uppercase text-stone-500 border-l border-stone-300 pl-2">
                Hyperlocal Civic Response Portal
              </span>
              {gamification?.currentUserStats && (
                <div className="flex items-center gap-1 bg-gov-maroon-900 text-white border border-gov-gold-600 px-2 py-0.5 text-[8px] font-sans font-bold uppercase tracking-widest leading-none rounded-sm">
                  <Award size={10} className="text-gov-gold-400" />
                  <span>{gamification.currentUserStats.points} PTS · {gamification.currentUserStats.rankTitle.toUpperCase()}</span>
                </div>
              )}
            </div>
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 bg-gov-maroon-900">
        <div className="flex flex-col sm:flex-row justify-center sm:justify-start sm:h-14 py-2 sm:py-0 items-center gap-1">

          {/* Official navigation tab bar */}
          {userRole && (
            <nav className="flex items-center flex-wrap justify-center sm:justify-start gap-x-1">
              <button
                onClick={() => setActiveTab("home")}
                className={`group flex items-center space-x-2 px-4 h-14 text-xs font-semibold uppercase tracking-wide transition-all duration-150 border-b-[3px] ${
                  activeTab === "home" ? "text-white border-gov-gold-500 bg-gov-maroon-800" : "text-gov-gold-100/80 border-transparent hover:text-white hover:bg-gov-maroon-800"
                }`}
                id="nav-btn-home"
              >
                <span>Home</span>
              </button>

              {userRole === "citizen" && (
                <button
                  onClick={() => setActiveTab("report")}
                  className={`group flex items-center space-x-2 px-4 h-14 text-xs font-semibold uppercase tracking-wide transition-all duration-150 border-b-[3px] ${
                    activeTab === "report" ? "text-white border-gov-gold-500 bg-gov-maroon-800" : "text-gov-gold-100/80 border-transparent hover:text-white hover:bg-gov-maroon-800"
                  }`}
                  id="nav-btn-report"
                >
                  <span>Report</span>
                </button>
              )}

              {userRole === "collector" && (
                <button
                  onClick={() => setActiveTab("collector")}
                  className={`group flex items-center space-x-2 px-4 h-14 text-xs font-semibold uppercase tracking-wide transition-all duration-150 border-b-[3px] ${
                    activeTab === "collector" ? "text-white border-gov-gold-500 bg-gov-maroon-800" : "text-gov-gold-100/80 border-transparent hover:text-white hover:bg-gov-maroon-800"
                  }`}
                  id="nav-btn-collector"
                >
                  <span>Collector Room</span>
                </button>
              )}

              {userRole === "mla" && (
                <button
                  onClick={() => setActiveTab("mla")}
                  className={`group flex items-center space-x-2 px-4 h-14 text-xs font-semibold uppercase tracking-wide transition-all duration-150 border-b-[3px] ${
                    activeTab === "mla" ? "text-white border-gov-gold-500 bg-gov-maroon-800" : "text-gov-gold-100/80 border-transparent hover:text-white hover:bg-gov-maroon-800"
                  }`}
                  id="nav-btn-mla"
                >
                  <span>MLA Room</span>
                </button>
              )}

              {/* Authority roles already get the dashboard view inside their own
                  Room (Collector/MLA), so the generic Dashboard tab is only
                  shown to citizens to avoid showing the same issue list twice. */}
              {userRole === "citizen" && (
                <button
                  onClick={() => setActiveTab("dashboard")}
                  className={`group flex items-center space-x-2 px-4 h-14 text-xs font-semibold uppercase tracking-wide transition-all duration-150 border-b-[3px] ${
                    activeTab === "dashboard" ? "text-white border-gov-gold-500 bg-gov-maroon-800" : "text-gov-gold-100/80 border-transparent hover:text-white hover:bg-gov-maroon-800"
                  }`}
                  id="nav-btn-dashboard"
                >
                  <span>Dashboard</span>
                  {issuesCount > 0 ? (
                    <span className="ml-1 px-1.5 py-0.5 text-[10px] font-sans font-bold bg-gov-gold-500 text-gov-maroon-950 rounded-sm">
                      {issuesCount}
                    </span>
                  ) : (
                    <span className="ml-1 px-1.5 py-0.5 text-[10px] font-sans font-bold bg-gov-maroon-800 text-gov-gold-100/70 border border-gov-maroon-700 rounded-sm">
                      0
                    </span>
                  )}
                </button>
              )}

              <button
                onClick={() => setActiveTab("leaderboard")}
                className={`group flex items-center space-x-2 px-4 h-14 text-xs font-semibold uppercase tracking-wide transition-all duration-150 border-b-[3px] ${
                  activeTab === "leaderboard" ? "text-white border-gov-gold-500 bg-gov-maroon-800" : "text-gov-gold-100/80 border-transparent hover:text-white hover:bg-gov-maroon-800"
                }`}
                id="nav-btn-leaderboard"
              >
                <span>Leaderboard</span>
              </button>


            </nav>
          )}
        </div>
      </div>
    </header>
  );
}