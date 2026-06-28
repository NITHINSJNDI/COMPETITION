import { Issue, UserSession } from "../types.ts";

export interface Badge {
  id: string;
  name: string;
  description: string;
  emoji: string;
  color: string;
}

export interface CitizenStats {
  email: string;
  name: string;
  points: number;
  rankTitle: string;
  rankLevel: number;
  badges: Badge[];
  issuesCount: number;
  resolvedCount: number;
  upvotesCount: number;
  hasVideo: boolean;
  district?: string;
  constituency?: string;
  constituencyRank?: number;
  districtRank?: number;
  stateRank?: number;
  totalInConstituency?: number;
  totalInDistrict?: number;
  totalInState?: number;
}

export const BADGES_LIST: Badge[] = [
  {
    id: "first_alert",
    name: "First Alert",
    description: "Reported the first civic grievance",
    emoji: "FA",
    color: "bg-blue-50 text-blue-800 border-blue-200",
  },
  {
    id: "eyes_on_street",
    name: "Eyes on Street",
    description: "Submitted evidence photographs/videos",
    emoji: "ES",
    color: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
  {
    id: "video_journalist",
    name: "Video Journalist",
    description: "Captured crucial issues in high-fidelity video",
    emoji: "VJ",
    color: "bg-pink-50 text-pink-700 border-pink-200",
  },
  {
    id: "popular_voice",
    name: "Popular Voice",
    description: "Received 3 or more support upvotes from neighbors",
    emoji: "PV",
    color: "bg-gov-gold-100 text-gov-gold-700 border-amber-200",
  },
  {
    id: "problem_solver",
    name: "Problem Solver",
    description: "Had at least one reported issue successfully resolved",
    emoji: "PS",
    color: "bg-green-50 text-gov-green-700 border-emerald-200",
  },
  {
    id: "super_hero",
    name: "Civic Champion",
    description: "Earned more than 500 lifetime reputation points",
    emoji: "CC",
    color: "bg-red-50 text-red-700 border-red-200",
  },
];

export function getRank(points: number): { title: string; level: number } {
  if (points >= 1500) return { title: "Civic Legend", level: 5 };
  if (points >= 800) return { title: "Constituency Guardian", level: 4 };
  if (points >= 400) return { title: "Neighborhood Sentinel", level: 3 };
  if (points >= 150) return { title: "Local Watchdog", level: 2 };
  return { title: "Civic Novice", level: 1 };
}

// Predefined set of seed/simulated citizens to populate leaderboards
export const SIMULATED_CITIZENS: CitizenStats[] = [
  {
    email: "anjali.devi@tncivic.in",
    name: "Anjali Devi",
    points: 1250,
    rankTitle: "Constituency Guardian",
    rankLevel: 4,
    badges: [BADGES_LIST[0], BADGES_LIST[1], BADGES_LIST[3], BADGES_LIST[4]],
    issuesCount: 8,
    resolvedCount: 5,
    upvotesCount: 14,
    hasVideo: false,
    district: "Chennai",
    constituency: "Kolathur",
  },
  {
    email: "karthik.r@tncivic.in",
    name: "Karthik R",
    points: 820,
    rankTitle: "Constituency Guardian",
    rankLevel: 4,
    badges: [BADGES_LIST[0], BADGES_LIST[1], BADGES_LIST[2], BADGES_LIST[4]],
    issuesCount: 5,
    resolvedCount: 3,
    upvotesCount: 8,
    hasVideo: true,
    district: "Coimbatore",
    constituency: "Singanallur",
  },
  {
    email: "selvam.m@tncivic.in",
    name: "Selvam M",
    points: 480,
    rankTitle: "Neighborhood Sentinel",
    rankLevel: 3,
    badges: [BADGES_LIST[0], BADGES_LIST[1], BADGES_LIST[3]],
    issuesCount: 3,
    resolvedCount: 1,
    upvotesCount: 6,
    hasVideo: false,
    district: "Madurai",
    constituency: "Madurai Central",
  },
  {
    email: "priya.n@tncivic.in",
    name: "Priya N",
    points: 320,
    rankTitle: "Local Watchdog",
    rankLevel: 2,
    badges: [BADGES_LIST[0], BADGES_LIST[1]],
    issuesCount: 2,
    resolvedCount: 1,
    upvotesCount: 4,
    hasVideo: false,
    district: "Chennai",
    constituency: "Chepauk-Thiruvallikeni",
  },
  {
    email: "saravanan.s@tncivic.in",
    name: "Saravanan S",
    points: 160,
    rankTitle: "Local Watchdog",
    rankLevel: 2,
    badges: [BADGES_LIST[0], BADGES_LIST[1]],
    issuesCount: 2,
    resolvedCount: 0,
    upvotesCount: 2,
    hasVideo: false,
    district: "Salem",
    constituency: "Salem-I",
  },
];

export function calculateCitizenStats(issues: Issue[], currentSession: UserSession | null): {
  currentUserStats: CitizenStats | null;
  leaderboard: CitizenStats[];
} {
  const statsMap: Record<string, CitizenStats> = {};

  // Initialize statsMap with simulated citizens to keep them alive
  SIMULATED_CITIZENS.forEach((sc) => {
    statsMap[sc.email] = { ...sc, badges: [...sc.badges] };
  });

  // Calculate points from actual issues in MongoDB
  issues.forEach((issue) => {
    const email = issue.citizenId || "";
    if (!email) return;

    const name = issue.reporterName || "Anonymous Citizen";
    const isResolved = issue.status === "Resolved";
    const upvotes = issue.upvotes?.length || 0;
    const hasMedia = !!(issue.imageUrl || issue.videoUrl);
    const hasVideo = !!issue.videoUrl;

    // Calculate points:
    // +100 for submitting
    // +200 for resolved status
    let points = 100 + (isResolved ? 200 : 0);

    if (statsMap[email]) {
      // Aggregate with existing
      const existing = statsMap[email];
      existing.points += points;
      existing.issuesCount += 1;
      existing.upvotesCount += upvotes;
      if (isResolved) existing.resolvedCount += 1;
      if (hasVideo) existing.hasVideo = true;
    } else {
      // Create new
      statsMap[email] = {
        email,
        name,
        points,
        rankTitle: "",
        rankLevel: 1,
        badges: [],
        issuesCount: 1,
        resolvedCount: isResolved ? 1 : 0,
        upvotesCount: upvotes,
        hasVideo,
        district: issue.district || currentSession?.district,
        constituency: issue.constituency || currentSession?.constituency,
      };
    }
  });

  // Re-calculate ranks and badges dynamically based on final point tallies
  Object.keys(statsMap).forEach((email) => {
    const stat = statsMap[email];
    const rank = getRank(stat.points);
    stat.rankTitle = rank.title;
    stat.rankLevel = rank.level;

    const badges: Badge[] = [];
    if (stat.issuesCount >= 1) badges.push(BADGES_LIST[0]); // First Alert
    if (stat.issuesCount >= 1 && (stat.hasVideo || stat.points > 100)) badges.push(BADGES_LIST[1]); // Eyes on Street
    if (stat.hasVideo) badges.push(BADGES_LIST[2]); // Video Journalist
    if (stat.upvotesCount >= 3) badges.push(BADGES_LIST[3]); // Popular Voice
    if (stat.resolvedCount >= 1) badges.push(BADGES_LIST[4]); // Problem Solver
    if (stat.points >= 500) badges.push(BADGES_LIST[5]); // Civic Champion

    // De-duplicate badges by ID
    stat.badges = Array.from(new Map(badges.map((b) => [b.id, b])).values());
  });

  // Ensure current user exists in statsMap if they are a citizen
  let currentUserStats: CitizenStats | null = null;
  if (currentSession && currentSession.role === "citizen" && currentSession.email) {
    const userEmail = currentSession.email;
    if (!statsMap[userEmail]) {
      statsMap[userEmail] = {
        email: userEmail,
        name: currentSession.name || "Citizen User",
        points: 0,
        rankTitle: "Civic Novice",
        rankLevel: 1,
        badges: [],
        issuesCount: 0,
        resolvedCount: 0,
        upvotesCount: 0,
        hasVideo: false,
        district: currentSession.district,
        constituency: currentSession.constituency,
      };
    }
    currentUserStats = statsMap[userEmail];
  }

  // Generate sorted leaderboard
  const leaderboard = Object.values(statsMap).sort((a, b) => b.points - a.points);

  // Compute state/statewide ranks
  leaderboard.forEach((c, index) => {
    c.stateRank = index + 1;
    c.totalInState = leaderboard.length;
  });

  // Compute district-level ranks
  const districtsMap: Record<string, CitizenStats[]> = {};
  leaderboard.forEach((c) => {
    if (c.district) {
      const distKey = c.district.toLowerCase();
      if (!districtsMap[distKey]) districtsMap[distKey] = [];
      districtsMap[distKey].push(c);
    }
  });
  Object.keys(districtsMap).forEach((distKey) => {
    const list = districtsMap[distKey];
    list.forEach((c, index) => {
      c.districtRank = index + 1;
      c.totalInDistrict = list.length;
    });
  });

  // Compute constituency-level ranks
  const constituenciesMap: Record<string, CitizenStats[]> = {};
  leaderboard.forEach((c) => {
    if (c.constituency) {
      const constKey = c.constituency.toLowerCase();
      if (!constituenciesMap[constKey]) constituenciesMap[constKey] = [];
      constituenciesMap[constKey].push(c);
    }
  });
  Object.keys(constituenciesMap).forEach((constKey) => {
    const list = constituenciesMap[constKey];
    list.forEach((c, index) => {
      c.constituencyRank = index + 1;
      c.totalInConstituency = list.length;
    });
  });

  // Refresh current user reference with computed ranks if citizen
  if (currentSession && currentSession.role === "citizen" && currentSession.email) {
    currentUserStats = statsMap[currentSession.email] || null;
  }

  return {
    currentUserStats,
    leaderboard,
  };
}
