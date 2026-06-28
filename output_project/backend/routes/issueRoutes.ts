import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";
import { getIssues, createIssue, updateIssueStatus, toggleUpvote } from "../controllers/issueController.js";

const router = Router();

// Ensure uploads folder exists
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Set up Multer disk storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    // Generate unique name: timestamp-random-original_ext
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + "-" + uniqueSuffix + ext);
  },
});

// Filter to accept images and videos
const fileFilter = (req: any, file: any, cb: any) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp|mp4|webm|ogg|quicktime|mov|mkv/;
  const extName = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimeType = allowedTypes.test(file.mimetype);

  if (extName || mimeType) {
    cb(null, true);
  } else {
    cb(new Error("Only images (.jpg, .jpeg, .png, .gif, .webp) and videos (.mp4, .webm, .ogg, .mov, .mkv) are allowed!"), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit to accommodate video uploads
  },
});

// Routes
// GET /api/issues - Get all issues
router.get("/", getIssues);

// POST /api/issues - Create a new issue (with image upload)
router.post("/", upload.single("image"), createIssue);

// PATCH /api/issues/:id/status - Update issue status
router.patch("/:id/status", updateIssueStatus);

// POST /api/issues/:id/upvote - Toggle upvote
router.post("/:id/upvote", toggleUpvote);

// POST /api/issues/analyze - AI Based Issue Category classifier using Gemini
function getLocalIssueAnalysis(title: string, description: string) {
  const text = `${title || ""} ${description || ""}`.toLowerCase();
  
  let category = "Other";
  if (text.includes("light") || text.includes("lamp") || text.includes("dark") || text.includes("illum")) category = "Street Light Issue";
  else if (text.includes("pothole")) category = "Potholes";
  else if (text.includes("road") || text.includes("tar") || text.includes("pavement") || text.includes("crack") || text.includes("highway")) category = "Road Damage";
  else if (text.includes("water") || text.includes("pipe") || text.includes("leak") || text.includes("drink") || text.includes("borewell")) category = "Water Leakage";
  else if (text.includes("garbage") || text.includes("waste") || text.includes("trash") || text.includes("dump") || text.includes("bin") || text.includes("litter")) category = "Garbage";
  else if (text.includes("sewage") || text.includes("drain") || text.includes("gutter") || text.includes("overflow") || text.includes("clog")) category = "Sewage";
  else if (text.includes("encroach") || text.includes("illegal") || text.includes("block")) category = "Encroachment";

  const isTooShort = (description || "").trim().length < 10;
  const isValid = isTooShort ? "Needs Clarification" : "Valid Issue";
  const isValidReason = isTooShort 
    ? "The description is extremely brief, which makes it hard for local municipal departments to pinpoint the concern."
    : `The description contains relevant keywords indicating a standard ${category} report.`;

  return {
    category,
    confidence: 85,
    isValid,
    isValidReason,
    summary: `Based on local parsing heuristics, a ${category} is reported. Description states: "${description || "no description provided"}". Please verify the specific address details.`
  };
}

function getLocalCategorizedOverview(simplifiedIssues: any[], constituency?: string, district?: string) {
  const categories = [
    { name: "Street Light Issues", keywords: ["light", "street light", "streetlamp", "lamp", "darkness", "lumin"] },
    { name: "Potholes & Road Damage", keywords: ["pothole", "road", "tar", "pavement", "crack", "highway", "concrete", "path", "street"] },
    { name: "Water Supply & Leakage", keywords: ["water", "pipe", "leak", "contamin", "drink", "tap", "borewell", "waterlogged"] },
    { name: "Garbage & Waste Management", keywords: ["garbage", "waste", "trash", "dump", "bin", "clearing", "litter", "debris"] },
    { name: "Sewage & Drainage", keywords: ["sewage", "drain", "gutter", "overflow", "stagnant", "clog", "slum", "sink"] },
    { name: "Encroachment & Public Space", keywords: ["encroach", "illegal", "block", "shop", "footpath", "sidewalk", "park", "vendors"] },
    { name: "Electrical Grid & Power", keywords: ["wire", "cable", "power", "electricity", "transformer", "shock", "voltage", "pole"] },
    { name: "Other Municipal Concerns", keywords: [] }
  ];

  const resultCategories = categories.map(cat => ({
    name: cat.name,
    highCount: 0,
    mediumCount: 0,
    lowCount: 0,
    issues: [] as any[]
  }));

  simplifiedIssues.forEach(issue => {
    const textToSearch = `${issue.title} ${issue.description} ${issue.category}`.toLowerCase();
    
    // Find matching category
    let matchedCat = resultCategories[resultCategories.length - 1]; // Default to other
    for (let i = 0; i < categories.length - 1; i++) {
      const catDef = categories[i];
      if (catDef.keywords.some(keyword => textToSearch.includes(keyword))) {
        matchedCat = resultCategories[i];
        break;
      }
    }

    const urgency = (issue.severity === "High" || issue.severity === "Critical") ? "High" : 
                    (issue.severity === "Low") ? "Low" : "Medium";

    if (urgency === "High") matchedCat.highCount++;
    else if (urgency === "Medium") matchedCat.mediumCount++;
    else matchedCat.lowCount++;

    // Generate dynamic reasoning & preventive actions
    let reasoning = `Prioritized classification based on community reports of municipal backlog.`;
    let action = `Dispatch local engineering team to inspect and resolve this backlog immediately.`;

    if (matchedCat.name === "Street Light Issues") {
      reasoning = `Identified inadequate or broken illumination impacting community safety and visibility.`;
      action = `Replace damaged fixtures and restore grid connections.`;
    } else if (matchedCat.name === "Potholes & Road Damage") {
      reasoning = `Classified as high-hazard roadway deterioration causing vehicle damage and traffic bottlenecks.`;
      action = `Initiate cold-mix patching and schedule resurfacing for the affected segment.`;
    } else if (matchedCat.name === "Water Supply & Leakage") {
      reasoning = `Flagged water infrastructure failure or critical supply bottleneck requiring hydraulic repair.`;
      action = `Detect pipeline rupture, stop the flow, and flush the distribution network.`;
    } else if (matchedCat.name === "Garbage & Waste Management") {
      reasoning = `Debris or sanitation accumulation reported, creating hygiene hazards in public thoroughfares.`;
      action = `Deploy municipal waste disposal compactors to clear the accumulated backlog.`;
    } else if (matchedCat.name === "Sewage & Drainage") {
      reasoning = `Sewer blockage or drainage overflow creating critical public health and waterlogging risks.`;
      action = `Deploy high-pressure jetting machines to clear pipeline obstructions.`;
    } else if (matchedCat.name === "Encroachment & Public Space") {
      reasoning = `Unauthorized structures or pathway blocks hindering public mobility and access.`;
      action = `Issue removal notice and coordinate municipal clearance of the thoroughfare.`;
    } else if (matchedCat.name === "Electrical Grid & Power") {
      reasoning = `Dangling wiring or hazardous electrical setups posing severe shock and fire risks.`;
      action = `Coordinate with TANGEDCO engineers to isolate, replace, or tension grid wires.`;
    }

    matchedCat.issues.push({
      id: issue.id,
      title: issue.title,
      originalCategory: issue.category,
      urgencyLevel: urgency,
      aiReasoning: reasoning,
      preventiveAction: action
    });
  });

  const activeRegion = constituency && constituency !== "All" ? `Constituency: ${constituency}` : (district && district !== "All" ? `District: ${district}` : "Tamil Nadu");
  const summary = `Offline-resilient analysis evaluated ${simplifiedIssues.length} active civic reports in ${activeRegion}. Standardized classification sorted public works backlogs based on local safety and impact.`;

  return {
    summary,
    categories: resultCategories,
    isFallback: true
  };
}

router.post("/analyze", upload.single("image"), async (req, res) => {
  const { title, description, imageUrl } = req.body;
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY is not configured. Falling back to local classifier.");
      const fallbackResult = getLocalIssueAnalysis(title, description);
      return res.json({
        success: true,
        data: fallbackResult,
        isFallback: true
      });
    }

    let imageBuffer: Buffer | null = null;
    let mimeType: string = "image/jpeg";

    if (req.file) {
      imageBuffer = fs.readFileSync(req.file.path);
      mimeType = req.file.mimetype;
    } else if (imageUrl) {
      const cleanPath = imageUrl.replace(/^\//, "");
      const absolutePath = path.join(process.cwd(), cleanPath);
      if (fs.existsSync(absolutePath)) {
        imageBuffer = fs.readFileSync(absolutePath);
        const ext = path.extname(absolutePath).toLowerCase();
        if (ext === ".png") mimeType = "image/png";
        else if (ext === ".webp") mimeType = "image/webp";
        else if (ext === ".gif") mimeType = "image/gif";
        else mimeType = "image/jpeg";
      }
    }

    const isOAuthToken = apiKey.startsWith("AQ.");
    const ai = new GoogleGenAI({
      apiKey: isOAuthToken ? "placeholder" : apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
          ...(isOAuthToken && { "Authorization": `Bearer ${apiKey}` }),
        }
      }
    });

    const parts: any[] = [];

    if (imageBuffer) {
      parts.push({
        inlineData: {
          mimeType: mimeType,
          data: imageBuffer.toString("base64")
        }
      });
    }

    const prompt = `You are a professional civic issue classifier system.
Analyze the following civic issue details and classify it into one of the key categories: "Potholes", "Garbage", "Water Leakage", "Street Light Issue", "Sewage", "Encroachment", "Road Damage", or "Other".

Title: ${title || "No Title"}
Description: ${description || "No Description"}

${imageBuffer ? "An image photograph of the reported issue has also been attached and is included in this multimodal analysis request." : "No photograph has been attached for this issue."}

Provide a JSON response with the following keys and values:
{
  "category": "The classified category (one of: Potholes, Garbage, Water Leakage, Street Light Issue, Sewage, Encroachment, Road Damage, Other)",
  "confidence": A number from 0 to 100 representing your classification confidence,
  "isValid": "A string: either 'Valid Issue' or 'Needs Clarification'. Evaluate if the user entered the information in a clear manner (including checking the image photograph if attached).",
  "isValidReason": "A 1-sentence explanation of why it is valid or why the information is unclear.",
  "summary": "A 2-3 sentence clear summary of the issue. If an image is attached, describe the visual evidence in the image and synthesize it into the summary."
}

Do not include any Markdown tags or code block formatting like \`\`\`json. Return only the raw JSON string.`;

    parts.push({ text: prompt });

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: { parts },
      config: {
        responseMimeType: "application/json"
      }
    });

    const textResult = response.text || "{}";
    let jsonResult;
    try {
      jsonResult = JSON.parse(textResult);
    } catch (parseErr) {
      const cleaned = textResult.replace(/```json/g, "").replace(/```/g, "").trim();
      jsonResult = JSON.parse(cleaned);
    }

    res.json({
      success: true,
      data: jsonResult
    });

  } catch (error: any) {
    console.log("Gemini AI Analysis: using local fallback classifier.");
    const fallbackResult = getLocalIssueAnalysis(title, description);
    res.json({
      success: true,
      data: fallbackResult,
      isFallback: true
    });
  }
});

// GET /api/issues/ai-categorized-overview - AI-driven classification of issues by category and high/medium/low severity
router.get("/ai-categorized-overview", async (req, res) => {
  const constituency = req.query.constituency as string;
  const district = req.query.district as string;
  let simplifiedIssues: any[] = [];

  try {
    const { getAllIssues } = await import("../models/Issue.js");
    const issues = await getAllIssues();

    let filtered = issues;
    if (constituency && constituency !== "All") {
      filtered = filtered.filter(i => i.constituency && i.constituency.toLowerCase() === constituency.toLowerCase());
    } else if (district && district !== "All") {
      filtered = filtered.filter(i => i.district && i.district.toLowerCase() === district.toLowerCase());
    }

    simplifiedIssues = filtered.slice(0, 100).map(issue => ({
      id: issue._id,
      title: issue.title || "Untitled",
      description: issue.description || "No description provided",
      category: issue.category || "Other",
      severity: issue.severity || "Medium",
      status: issue.status || "Reported",
      district: issue.district || "Unknown",
      constituency: issue.constituency || "Unknown",
    }));

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY not found. Performing local rule-based fallback.");
      const fallbackData = getLocalCategorizedOverview(simplifiedIssues, constituency, district);
      return res.json({
        success: true,
        data: fallbackData,
        isFallback: true
      });
    }

    const isOAuthToken = apiKey.startsWith("AQ.");
    const ai = new GoogleGenAI({
      apiKey: isOAuthToken ? "placeholder" : apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
          ...(isOAuthToken && { "Authorization": `Bearer ${apiKey}` }),
        }
      }
    });

    const prompt = `You are an AI Civic Analyst.
Your task is to analyze the following list of local community issues for the selected region (${constituency ? "Constituency: " + constituency : "District: " + district}) and group them into standardized categories.
Each category MUST have its issues grouped or flagged with their AI-determined urgency level: "High", "Medium", or "Low".

Standard categories to group into:
1. "Street Light Issues" (e.g., non-functioning lights, broken poles)
2. "Potholes & Road Damage" (e.g., broken roads, road laying delays)
3. "Water Supply & Leakage" (e.g., pipeline leaks, contamination, drinking water supply)
4. "Garbage & Waste Management" (e.g., dumped trash, clearing backlog)
5. "Sewage & Drainage" (e.g., overflowing gutters, blocked drains)
6. "Encroachment & Public Space" (e.g., pathway blocks, illegal structures)
7. "Electrical Grid & Power" (e.g., dangling wires, transformer faults)
8. "Other Municipal Concerns"

For each issue, classify its correct standard category and assign an AI urgency level (High, Medium, or Low) based on safety hazard, impact, and description details.

Issues to analyze (Total: ${simplifiedIssues.length}):
${JSON.stringify(simplifiedIssues)}

Provide a JSON response with the following structure:
{
  "summary": "A 2-sentence analytical summary of the issues and overall state in this region.",
  "categories": [
    {
      "name": "Street Light Issues",
      "highCount": number,
      "mediumCount": number,
      "lowCount": number,
      "issues": [
        {
          "id": "matching issue id",
          "title": "issue title",
          "originalCategory": "original category name",
          "urgencyLevel": "High" | "Medium" | "Low",
          "aiReasoning": "1-sentence explanation of why it was categorized this way and given this urgency",
          "preventiveAction": "1-sentence action recommendation for local engineers"
        }
      ]
    }
  ]
}

Note: If there are no issues provided in the input, return an empty structure with categories empty, but set a friendly summary stating that the constituency currently has no reported complaints.
Do not include markdown headers like \`\`\`json. Return only raw JSON.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: { parts: [{ text: prompt }] },
      config: {
        responseMimeType: "application/json"
      }
    });

    const textResult = response.text || "{}";
    let jsonResult;
    try {
      jsonResult = JSON.parse(textResult);
    } catch (parseErr) {
      const cleaned = textResult.replace(/```json/g, "").replace(/```/g, "").trim();
      jsonResult = JSON.parse(cleaned);
    }

    res.json({
      success: true,
      data: jsonResult
    });

  } catch (error: any) {
    console.log("AI Categorization: using robust fallback classifier.");
    const fallbackData = getLocalCategorizedOverview(simplifiedIssues, constituency, district);
    res.json({
      success: true,
      data: fallbackData,
      isFallback: true
    });
  }
});

export default router;
