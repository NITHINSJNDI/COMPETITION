import { Request, Response } from "express";
import * as IssueModel from "../models/Issue.js";
import { GoogleGenAI, Type } from "@google/genai";
import fs from "fs";

let aiClient: GoogleGenAI | null = null;

function getAIClient(): GoogleGenAI | null {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (key) {
      const isOAuthToken = key.startsWith("AQ.");
      aiClient = new GoogleGenAI({
        apiKey: isOAuthToken ? "placeholder" : key,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
            ...(isOAuthToken && { "Authorization": `Bearer ${key}` }),
          },
        },
      });
    }
  }
  return aiClient;
}

/**
 * Fallback keyword classifier when Gemini key is missing or call fails.
 */
function classifyWithKeywords(title: string, description: string): string {
  const text = `${title} ${description}`.toLowerCase();
  if (text.includes("pothole") || text.includes("road") || text.includes("cracks") || text.includes("pit")) {
    return "Pothole";
  }
  if (text.includes("garbage") || text.includes("trash") || text.includes("waste") || text.includes("litter") || text.includes("dump") || text.includes("rubbish")) {
    return "Garbage";
  }
  if (text.includes("leak") || text.includes("water") || text.includes("pipe") || text.includes("flooding") || text.includes("leakage") || text.includes("sewage") || text.includes("drain")) {
    return "Water Leakage";
  }
  if (text.includes("light") || text.includes("lamp") || text.includes("bulb") || text.includes("dark") || text.includes("street light") || text.includes("electricity") || text.includes("streetlight")) {
    return "Street Light Issue";
  }
  return "Other";
}

/**
 * Classifies the issue report using Gemini Vision (if image is available) or Gemini text analysis,
 * falling back to keyword heuristic if anything fails or API key is absent.
 */
export async function autoClassifyIssue(
  title: string,
  description: string,
  imageBuffer?: Buffer,
  mimeType?: string
): Promise<string> {
  const ai = getAIClient();
  if (!ai) {
    console.log("⚠️ No GEMINI_API_KEY found. Falling back to keyword classification.");
    return classifyWithKeywords(title, description);
  }

  const categories = ["Pothole", "Garbage", "Water Leakage", "Street Light Issue"];
  const maxRetries = 3;
  let delayMs = 1500;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (imageBuffer && mimeType) {
        console.log(`🧠 Classifying uploaded issue image via Gemini Vision (${mimeType}) (Attempt ${attempt}/${maxRetries})...`);
        
        const imagePart = {
          inlineData: {
            mimeType,
            data: imageBuffer.toString("base64"),
          },
        };

        const promptPart = {
          text: `Analyze this image of a municipal/community problem. Classify it into exactly one of the following categories:\n- Pothole\n- Garbage\n- Water Leakage\n- Street Light Issue\n\nIf it doesn't fit any of those 4 categories, classify it as "Other".\nContext:\nTitle: "${title}"\nDescription: "${description}"\n\nRespond in JSON format with a "category" field.`,
        };

        const response = await ai.models.generateContent({
          model: "gemini-2.0-flash",
          contents: { parts: [imagePart, promptPart] },
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                category: {
                  type: Type.STRING,
                  description: "The classified category. Must be one of: Pothole, Garbage, Water Leakage, Street Light Issue, or Other.",
                }
              },
              required: ["category"],
            },
          },
        });

        if (response && typeof response.text === "string") {
          const textStr = response.text.trim();
          const result = JSON.parse(textStr);
          if (result.category && (categories.includes(result.category) || result.category === "Other")) {
            console.log(`✅ Gemini Vision classified category: ${result.category}`);
            return result.category;
          }
        }
      } else {
        console.log(`🧠 Classifying issue text via Gemini Content API (Attempt ${attempt}/${maxRetries})...`);
        const textPrompt = `Analyze this civic issue report.\nTitle: "${title}"\nDescription: "${description}"\n\nClassify it into exactly one of the following categories:\n- Pothole\n- Garbage\n- Water Leakage\n- Street Light Issue\n\nIf it doesn't fit any of those 4 categories, classify it as "Other".\n\nRespond in JSON format with a "category" field.`;

        const response = await ai.models.generateContent({
          model: "gemini-2.0-flash",
          contents: textPrompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                category: {
                  type: Type.STRING,
                  description: "The classified category. Must be one of: Pothole, Garbage, Water Leakage, Street Light Issue, or Other.",
                }
              },
              required: ["category"],
            },
          },
        });

        if (response && typeof response.text === "string") {
          const textStr = response.text.trim();
          const result = JSON.parse(textStr);
          if (result.category && (categories.includes(result.category) || result.category === "Other")) {
            console.log(`✅ Gemini Text classified category: ${result.category}`);
            return result.category;
          }
        }
      }
      
      break;
    } catch (error: any) {
      const errMsg = error?.message || String(error);
      console.log(`❌ Gemini API error (Attempt ${attempt}/${maxRetries}): ${errMsg.substring(0, 300)}`);

      const is503 = errMsg.includes("503") || errMsg.toLowerCase().includes("high demand") || errMsg.toLowerCase().includes("unavailable");
      
      if (is503 && attempt < maxRetries) {
        console.log(`⚠️ Gemini API experiencing high demand (503/Unavailable). Retrying in ${delayMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        delayMs *= 2;
        continue;
      }
      
      console.log(`ℹ️ Note: Gemini API classification failed. Utilizing keyword-based heuristic fallback.`);
      break;
    }
  }

  return classifyWithKeywords(title, description);
}

// @desc    Get all issues
// @route   GET /api/issues
// @access  Public
export async function getIssues(req: Request, res: Response): Promise<void> {
  try {
    const issues = await IssueModel.getAllIssues();
    res.status(200).json({
      success: true,
      count: issues.length,
      data: issues,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Server Error fetching issues",
      error: error.message,
    });
  }
}

// @desc    Create a new issue report
// @route   POST /api/issues
// @access  Public
export async function createIssue(req: Request, res: Response): Promise<void> {
  try {
    const { title, description, latitude, longitude, address, district, constituency, severity, citizenId, reporterName } = req.body;

    if (!title || !description) {
      res.status(400).json({
        success: false,
        message: "Please provide all required fields: title and description.",
      });
      return;
    }

    const hasGps = latitude !== undefined && latitude !== null && String(latitude).trim() !== "" && longitude !== undefined && longitude !== null && String(longitude).trim() !== "";
    const hasAddress = address !== undefined && address !== null && String(address).trim() !== "";

    let latNum = Number(latitude);
    let lngNum = Number(longitude);

    if (!hasGps) {
      if (hasAddress) {
        latNum = 13.0827;
        lngNum = 80.2707;
      } else {
        res.status(400).json({
          success: false,
          message: "Please provide either coordinates (latitude/longitude) or a physical address.",
        });
        return;
      }
    } else {
      if (isNaN(latNum) || isNaN(lngNum)) {
        res.status(400).json({
          success: false,
          message: "Latitude and Longitude must be valid numbers.",
        });
        return;
      }
    }

    let imageUrl = "";
    let videoUrl = "";
    let category = "Other";
    let imageBuffer: Buffer | undefined;

    if (req.file) {
      const isVideo = req.file.mimetype.startsWith("video/");
      if (isVideo) {
        videoUrl = `/uploads/${req.file.filename}`;
      } else {
        imageUrl = `/uploads/${req.file.filename}`;
        try {
          imageBuffer = await fs.promises.readFile(req.file.path);
        } catch (err) {
          console.error("Failed to read uploaded image file buffer:", err);
        }
      }
    }

    category = await autoClassifyIssue(title, description, imageBuffer, req.file?.mimetype);

    const newIssue = await IssueModel.createIssue({
      title,
      description,
      imageUrl,
      videoUrl,
      latitude: latNum,
      longitude: lngNum,
      address,
      hasGps,
      hasAddress,
      category,
      district,
      constituency,
      severity,
      citizenId,
      reporterName,
    });

    res.status(201).json({
      success: true,
      data: newIssue,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Server Error creating issue",
      error: error.message,
    });
  }
}

// @desc    Update status and officialResponse of an issue
// @route   PATCH /api/issues/:id/status
// @access  Public
export async function updateIssueStatus(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { status, officialResponse, reReported, reReportedComment } = req.body;

    if (!status) {
      res.status(400).json({
        success: false,
        message: "Please provide a status.",
      });
      return;
    }

    const updated = await IssueModel.updateIssueStatus(id, status, officialResponse, reReported, reReportedComment);

    if (!updated) {
      res.status(404).json({
        success: false,
        message: `Issue with ID ${id} not found.`,
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Server Error updating issue status",
      error: error.message,
    });
  }
}

// @desc    Toggle upvote for an issue
// @route   POST /api/issues/:id/upvote
// @access  Public
export async function toggleUpvote(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { citizenEmail } = req.body;

    if (!citizenEmail) {
      res.status(400).json({
        success: false,
        message: "Please provide citizenEmail.",
      });
      return;
    }

    const updated = await IssueModel.toggleUpvoteIssue(id, citizenEmail);

    if (!updated) {
      res.status(404).json({
        success: false,
        message: `Issue with ID ${id} not found.`,
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Server Error toggling upvote",
      error: error.message,
    });
  }
}
