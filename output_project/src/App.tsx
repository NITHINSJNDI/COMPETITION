import React, { useState, useEffect } from "react";
import { HashRouter, Routes, Route, Link, useLocation, useNavigate, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar.tsx";
import Home from "./components/Home.tsx";
import ReportIssue from "./components/ReportIssue.tsx";
import Dashboard from "./components/Dashboard.tsx";
import CollectorDashboard from "./components/CollectorDashboard.tsx";
import MlaDashboard from "./components/MlaDashboard.tsx";
import ConstituencyPage from "./components/ConstituencyPage.tsx";
import DistrictPage from "./components/DistrictPage.tsx";
import Login from "./components/Login.tsx";
import AccessRestricted from "./components/AccessRestricted.tsx";
import LeaderboardPage from "./components/LeaderboardPage.tsx";
import { Issue, ActiveTab, UserSession } from "./types.ts";
import { ShieldAlert, Users, Award, Landmark, GraduationCap, LogOut, KeyRound } from "lucide-react";

function AppContent() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;

  // Scroll to top of the page on route/path change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [currentPath]);

  // Mock Authentication State
  const [session, setSession] = useState<UserSession | null>(() => {
    const saved = sessionStorage.getItem("userSession");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });

  const userRole = session?.role || null;

  const handleLogin = (newSession: UserSession) => {
    setSession(newSession);
    sessionStorage.setItem("userSession", JSON.stringify(newSession));
    navigate("/home");
  };

  const handleLogout = () => {
    setSession(null);
    sessionStorage.removeItem("userSession");
    navigate("/login");
  };

  const handleSwitchRole = (role: "citizen" | "collector" | "mla") => {
    setSession(null);
    sessionStorage.removeItem("userSession");
    navigate("/login");
  };

  const handleToggleUpvote = async (id: string) => {
    if (!session?.email) {
      alert("Please login first to support this issue.");
      return;
    }
    try {
      const res = await fetch(`/api/issues/${id}/upvote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ citizenEmail: session.email }),
      });
      const data = await res.json();
      if (data.success) {
        fetchIssues();
      } else {
        console.error("Failed to toggle upvote:", data.message);
      }
    } catch (err) {
      console.error("Error toggling upvote:", err);
    }
  };

  // Protect unauthenticated routes
  useEffect(() => {
    if (!userRole && currentPath !== "/login") {
      navigate("/login");
    } else if (userRole && currentPath === "/login") {
      navigate("/home");
    }
  }, [userRole, currentPath, navigate]);

  // Determine active tab for navbar compatibility
  const getActiveTab = (): ActiveTab => {
    if (currentPath === "/" || currentPath === "/home") return "home";
    if (currentPath === "/report") return "report";
    if (currentPath === "/dashboard") return "dashboard";
    if (currentPath === "/collector") return "collector";
    if (currentPath === "/mla") return "mla";
    if (currentPath === "/leaderboard") return "leaderboard";
    return "constituency";
  };

  // Authority roles (collector/mayor/mla) have their own all-in-one Room
  // that already includes the dashboard view, stats, and case workbench.
  // Redirect them away from the generic "/dashboard" route so the same
  // issue list + status controls aren't shown twice under two tabs.
  useEffect(() => {
    if (userRole === "collector" && currentPath === "/dashboard") {
      navigate("/collector", { replace: true });
    } else if (userRole === "mla" && currentPath === "/dashboard") {
      navigate("/mla", { replace: true });
    }
  }, [userRole, currentPath, navigate]);

  const activeTab = getActiveTab();

  // Navigation click dispatcher
  const handleTabClick = (tab: ActiveTab) => {
    if (tab === "home") {
      navigate("/");
    } else {
      navigate(`/${tab}`);
    }
  };

  // Fetch all issues from backend
  const fetchIssues = async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const response = await fetch("/api/issues");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const json = await response.json();
      if (json.success && Array.isArray(json.data)) {
        setIssues(json.data);
      } else {
        throw new Error("Invalid response format received from server");
      }
    } catch (err: any) {
      console.error("Failed to fetch issues:", err);
      setErrorMessage("Could not connect to the backend server. Make sure it is running.");
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch on mount
  useEffect(() => {
    fetchIssues();
  }, []);

  // Update status handler
  const handleUpdateStatus = async (
    id: string,
    newStatus: string,
    officialResponse?: string,
    reReported?: boolean,
    reReportedComment?: string
  ) => {
    if (id === "demo_redirect") {
      navigate("/report");
      return;
    }

    // Snapshot of the single issue being changed, so we can roll back just
    // that card on failure instead of refetching (and visually resetting)
    // the entire issues list.
    const previousIssue = issues.find((issue) => issue._id === id);

    // Optimistic state update in UI
    setIssues((prev) =>
      prev.map((issue) =>
        issue._id === id
          ? {
              ...issue,
              status: newStatus as any,
              ...(officialResponse !== undefined ? { officialResponse } : {}),
              ...(reReported !== undefined ? { reReported } : {}),
              ...(reReportedComment !== undefined ? { reReportedComment } : {}),
            }
          : issue
      )
    );

    try {
      const response = await fetch(`/api/issues/${id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus, officialResponse, reReported, reReportedComment }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update status on server (HTTP ${response.status})`);
      }
      // Optimistic update already applied — no full re-fetch needed
    } catch (error) {
      console.error("Error updating issue status:", error);
      setErrorMessage("Couldn't save that update — it's been reverted. Please try again.");
      window.setTimeout(() => setErrorMessage(""), 5000);
      // Roll back only the one issue we optimistically changed, rather than
      // refetching (and visually resetting/flashing) the whole list.
      if (previousIssue) {
        setIssues((prev) =>
          prev.map((issue) => (issue._id === id ? previousIssue : issue))
        );
      } else {
        fetchIssues();
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gov-cream-100 text-gov-maroon-900 font-sans">

      {/* Dynamic Session Bar at top */}
      {userRole ? (
        <div className="bg-gov-maroon-950 text-white border-b border-gov-gold-600 shrink-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center py-2.5 gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-gov-green-600 animate-pulse"></span>
              <span className="text-[10px] font-sans font-semibold tracking-widest text-gov-gold-100 uppercase">
                Active Session: <strong className="text-white font-bold">{userRole.toUpperCase()}</strong>
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleLogout}
                className="bg-gov-maroon-900 border border-gov-gold-700 hover:border-gov-gold-400 text-gov-gold-100 hover:text-white px-3 py-1.5 text-[10px] font-sans font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all rounded-sm cursor-pointer"
              >
                <LogOut size={11} />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-gov-maroon-950 text-white border-b border-gov-gold-600 shrink-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 text-center">
            <span className="text-[10px] font-sans font-semibold tracking-widest text-gov-gold-100 uppercase">
              Official Civic Grievance Portal · Authentication Required
            </span>
          </div>
        </div>
      )}
      <div className="gov-tricolor-strip shrink-0" />

      {/* Navigation Header */}
      <Navbar activeTab={activeTab} setActiveTab={handleTabClick} issuesCount={issues.length} userRole={userRole} session={session} issues={issues} />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        {errorMessage && (
          <div className="mt-8 bg-gov-maroon-900 text-white border border-gov-maroon-800 p-5 rounded-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fadeIn">
            <div className="flex items-center gap-3">
              <ShieldAlert className="text-stone-400 shrink-0" size={18} />
              <span className="text-xs font-bold uppercase tracking-widest">{errorMessage}</span>
            </div>
            <button
              onClick={fetchIssues}
              className="border border-white bg-white hover:bg-gov-cream-200 text-gov-maroon-900 px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-all rounded-sm cursor-pointer shrink-0"
            >
              Retry Sync
            </button>
          </div>
        )}

        {/* Declarative Routes mapping */}
        <Routes>
          <Route path="/login" element={<Login onLogin={handleLogin} />} />
          <Route path="/" element={<Home setActiveTab={handleTabClick} issues={issues} session={session} />} />
          <Route path="/home" element={<Home setActiveTab={handleTabClick} issues={issues} session={session} />} />
          <Route path="/report" element={<ReportIssue onIssueReported={fetchIssues} setActiveTab={handleTabClick} session={session} />} />
          <Route
            path="/dashboard"
            element={
              <Dashboard
                issues={issues}
                isLoading={isLoading}
                onUpdateStatus={handleUpdateStatus}
                onRefresh={fetchIssues}
                session={session}
                onToggleUpvote={handleToggleUpvote}
              />
            }
          />
          <Route
            path="/collector"
            element={
              userRole === "collector" ? (
                <CollectorDashboard issues={issues} session={session} onUpdateStatus={handleUpdateStatus} />
              ) : (
                <AccessRestricted requiredRole="collector" currentRole={userRole || "citizen"} onSwitchRole={handleSwitchRole} />
              )
            }
          />
          <Route
            path="/mla"
            element={
              userRole === "mla" ? (
                <MlaDashboard issues={issues} onUpdateStatus={handleUpdateStatus} session={session} />
              ) : (
                <AccessRestricted requiredRole="mla" currentRole={userRole || "citizen"} onSwitchRole={handleSwitchRole} />
              )
            }
          />

          <Route path="/leaderboard" element={<LeaderboardPage issues={issues} session={session} />} />
          <Route path="/district/:districtName" element={<DistrictPage issues={issues} />} />
          <Route path="/constituency/:constituencyId" element={<ConstituencyPage issues={issues} />} />
          <Route path="/constituency/:constituencyName" element={<ConstituencyPage issues={issues} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* Footer */}
      <footer className="bg-gov-maroon-950 text-stone-300 border-t-4 border-gov-gold-600 shrink-0 mt-auto">
        <div className="gov-tricolor-strip" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col md:flex-row justify-between items-center gap-6 text-center md:text-left">
          <div className="space-y-1.5">
            <span className="font-display font-bold text-xl tracking-tight text-white">
              Community<span className="text-gov-gold-400 font-serif italic font-normal"> Hero</span>
            </span>
            <p className="text-[11px] uppercase tracking-widest text-stone-400">Hyperlocal Civic Grievance Registry &amp; Redressal Portal</p>
          </div>
          <div className="text-[11px] font-sans text-stone-400 space-y-1 md:text-right">
            <p>&copy; {new Date().getFullYear()} Community Hero Civic Initiative. All grievance records are maintained for public accountability.</p>
            <p className="text-stone-500">Site best viewed in latest browsers · Content owned and maintained by the Community Hero portal administration</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AppContent />
    </HashRouter>
  );
}