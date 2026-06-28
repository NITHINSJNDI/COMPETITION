export interface Issue {
  _id: string;
  id?: string;
  title: string;
  description: string;
  imageUrl: string;
  videoUrl?: string;
  latitude: number;
  longitude: number;
  address?: string;
  hasGps?: boolean;
  hasAddress?: boolean;
  status: "Reported" | "Verified" | "In Progress" | "Resolved";
  category?: string;
  district?: string;
  constituency?: string;
  severity?: "Low" | "Medium" | "High";
  citizenId?: string;
  reporterName?: string;
  officialResponse?: string;
  upvotes?: string[];
  reReported?: boolean;
  reReportedComment?: string;
  createdAt: string;
  updatedAt?: string;
}

export type ActiveTab = "home" | "report" | "dashboard" | "collector" | "mla" | "constituency" | "leaderboard";

export interface UserSession {
  role: "citizen" | "collector" | "mla";
  district?: string;
  constituency?: string;
  assignedDistrict?: string;
  assignedConstituency?: string;
  email?: string;
  name?: string;
  username?: string;
  age?: string;
  phone?: string;
}