import mongoose, { Schema, Document } from "mongoose";
import fs from "fs";
import path from "path";
import { getIsMongoConnected } from "../config/db.js";

// 1. MongoDB Mongoose Schema & Interface
export interface IIssue extends Document {
  title: string;
  description: string;
  imageUrl: string;
  videoUrl?: string;
  latitude: number;
  longitude: number;
  address?: string;
  hasGps?: boolean;
  hasAddress?: boolean;
  status: string;
  category: string;
  district: string;
  constituency: string;
  severity: string;
  citizenId?: string;
  reporterName?: string;
  officialResponse?: string;
  upvotes?: string[];
  reReported?: boolean;
  reReportedComment?: string;
  createdAt: Date;
  updatedAt?: Date;
}

const IssueSchema: Schema = new Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  imageUrl: { type: String, default: "" },
  videoUrl: { type: String, default: "" },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  address: { type: String, default: "" },
  hasGps: { type: Boolean, default: false },
  hasAddress: { type: Boolean, default: false },
  status: { type: String, default: "Reported" },
  category: { type: String, default: "Other" },
  district: { type: String, default: "" },
  constituency: { type: String, default: "" },
  severity: { type: String, default: "Medium" },
  citizenId: { type: String, default: "" },
  reporterName: { type: String, default: "" },
  officialResponse: { type: String, default: "" },
  upvotes: { type: [String], default: [] },
  reReported: { type: Boolean, default: false },
  reReportedComment: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Create Mongoose model lazily so it doesn't cause errors if not connected or compile issues
let MongoIssueModel: mongoose.Model<IIssue> | null = null;

function getMongoModel() {
  if (!MongoIssueModel) {
    MongoIssueModel = mongoose.model<IIssue>("Issue", IssueSchema);
  }
  return MongoIssueModel;
}

// 2. Local Fallback Database Store (JSON file)
const LOCAL_DB_DIR = path.join(process.cwd(), "data");
const LOCAL_DB_PATH = path.join(LOCAL_DB_DIR, "issues.json");

export interface ILocalIssue {
  _id: string;
  title: string;
  description: string;
  imageUrl: string;
  videoUrl?: string;
  latitude: number;
  longitude: number;
  address?: string;
  hasGps?: boolean;
  hasAddress?: boolean;
  status: string;
  category?: string;
  district?: string;
  constituency?: string;
  severity?: string;
  citizenId?: string;
  reporterName?: string;
  officialResponse?: string;
  upvotes?: string[];
  reReported?: boolean;
  reReportedComment?: string;
  createdAt: string;
  updatedAt?: string;
}

// Ensure the local database file exists
function ensureLocalDbFile() {
  if (!fs.existsSync(LOCAL_DB_DIR)) {
    fs.mkdirSync(LOCAL_DB_DIR, { recursive: true });
  }
  if (!fs.existsSync(LOCAL_DB_PATH)) {
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify([], null, 2), "utf-8");
  }
}

// Read from local database
function readLocalIssues(): ILocalIssue[] {
  ensureLocalDbFile();
  try {
    const content = fs.readFileSync(LOCAL_DB_PATH, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    console.error("Error reading local issues JSON file:", error);
    return [];
  }
}

// Write to local database
function writeLocalIssues(issues: ILocalIssue[]) {
  ensureLocalDbFile();
  try {
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(issues, null, 2), "utf-8");
  } catch (error) {
    console.error("Error writing local issues JSON file:", error);
  }
}

// 3. Unified Database Abstraction Layer
export async function getAllIssues(): Promise<any[]> {
  if (getIsMongoConnected()) {
    try {
      const MongoModel = getMongoModel();
      return await MongoModel.find().sort({ createdAt: -1 });
    } catch (err) {
      console.error("Mongoose query error, falling back to local file read:", err);
      return readLocalIssues();
    }
  } else {
    // Return sorted local issues (newest first)
    const issues = readLocalIssues();
    return issues.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
}

export async function createIssue(data: {
  title: string;
  description: string;
  imageUrl: string;
  videoUrl?: string;
  latitude: number;
  longitude: number;
  address?: string;
  hasGps?: boolean;
  hasAddress?: boolean;
  category?: string;
  district?: string;
  constituency?: string;
  severity?: string;
  citizenId?: string;
  reporterName?: string;
}): Promise<any> {
  const issueData = {
    title: data.title,
    description: data.description,
    imageUrl: data.imageUrl,
    videoUrl: data.videoUrl || "",
    latitude: Number(data.latitude),
    longitude: Number(data.longitude),
    address: data.address || "",
    hasGps: !!data.hasGps,
    hasAddress: !!data.hasAddress,
    status: "Reported",
    category: data.category || "Other",
    district: data.district || "",
    constituency: data.constituency || "",
    severity: data.severity || "Medium",
    citizenId: data.citizenId || "",
    reporterName: data.reporterName || "",
    officialResponse: "",
    upvotes: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  if (getIsMongoConnected()) {
    try {
      const MongoModel = getMongoModel();
      const newIssue = new MongoModel(issueData);
      return await newIssue.save();
    } catch (err) {
      console.error("Mongoose save error, falling back to local file save:", err);
    }
  }

  // Fallback to saving in local JSON file
  const localIssues = readLocalIssues();
  const newLocalIssue: ILocalIssue = {
    _id: "local_" + Math.random().toString(36).substr(2, 9),
    ...issueData,
    createdAt: issueData.createdAt.toISOString(),
    updatedAt: issueData.updatedAt.toISOString(),
  };
  localIssues.push(newLocalIssue);
  writeLocalIssues(localIssues);
  return newLocalIssue;
}

export async function updateIssueStatus(
  id: string,
  status: string,
  officialResponse?: string,
  reReported?: boolean,
  reReportedComment?: string
): Promise<any> {
  const updateObj: any = { status, updatedAt: new Date() };
  if (officialResponse !== undefined) {
    updateObj.officialResponse = officialResponse;
  }
  if (reReported !== undefined) {
    updateObj.reReported = reReported;
  }
  if (reReportedComment !== undefined) {
    updateObj.reReportedComment = reReportedComment;
  }

  if (getIsMongoConnected() && !id.startsWith("local_")) {
    try {
      const MongoModel = getMongoModel();
      const mongoResult = await MongoModel.findByIdAndUpdate(id, updateObj, { new: true });
      if (mongoResult) {
        return mongoResult;
      }
      // No document found in Mongo for this id — fall through and try the
      // local JSON store instead of returning null (which the controller
      // turns into a 404, causing the UI to show a failure alert and
      // force a full re-fetch even though the issue may still exist locally).
      console.warn(`Issue ${id} not found in MongoDB; checking local fallback store.`);
    } catch (err) {
      console.error("Mongoose update error, trying local update:", err);
    }
  }

  // Fallback or direct local update
  const localIssues = readLocalIssues();
  const issueIndex = localIssues.findIndex((item) => item._id === id);
  if (issueIndex !== -1) {
    localIssues[issueIndex].status = status;
    if (officialResponse !== undefined) {
      localIssues[issueIndex].officialResponse = officialResponse;
    }
    if (reReported !== undefined) {
      localIssues[issueIndex].reReported = reReported;
    }
    if (reReportedComment !== undefined) {
      localIssues[issueIndex].reReportedComment = reReportedComment;
    }
    localIssues[issueIndex].updatedAt = new Date().toISOString();
    writeLocalIssues(localIssues);
    return localIssues[issueIndex];
  }
  return null;
}

export async function toggleUpvoteIssue(id: string, citizenEmail: string): Promise<any> {
  if (getIsMongoConnected() && !id.startsWith("local_")) {
    try {
      const MongoModel = getMongoModel();
      const issue = await MongoModel.findById(id);
      if (issue) {
        const upvotes = issue.upvotes || [];
        const index = upvotes.indexOf(citizenEmail);
        if (index > -1) {
          upvotes.splice(index, 1);
        } else {
          upvotes.push(citizenEmail);
        }
        issue.upvotes = upvotes;
        issue.updatedAt = new Date();
        return await issue.save();
      }
    } catch (err) {
      console.error("Mongoose upvote toggle error, trying local update:", err);
    }
  }

  // Fallback or direct local upvote
  const localIssues = readLocalIssues();
  const issueIndex = localIssues.findIndex((item) => item._id === id);
  if (issueIndex !== -1) {
    const issue = localIssues[issueIndex];
    const upvotes = issue.upvotes || [];
    const index = upvotes.indexOf(citizenEmail);
    if (index > -1) {
      upvotes.splice(index, 1);
    } else {
      upvotes.push(citizenEmail);
    }
    issue.upvotes = upvotes;
    issue.updatedAt = new Date().toISOString();
    writeLocalIssues(localIssues);
    return issue;
  }
  return null;
}
