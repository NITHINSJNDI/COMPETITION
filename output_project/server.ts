import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectDB } from "./backend/config/db.js";
import issueRoutes from "./backend/routes/issueRoutes.js";
import { getDistricts } from "./backend/models/District.js";
import { getConstituencies } from "./backend/models/Constituency.js";

// Load environment variables
dotenv.config();

async function seedDatabaseIfNeeded() {
  try {
    if (mongoose.connection.readyState !== 1) return;
    
    const District = mongoose.models.District || mongoose.model("District", new mongoose.Schema({
      id: { type: String, required: true, unique: true },
      name: { type: String, required: true },
      center: { type: [Number], required: true },
    }));

    const Constituency = mongoose.models.Constituency || mongoose.model("Constituency", new mongoose.Schema({
      id: { type: String, required: true, unique: true },
      name: { type: String, required: true },
      constituencyNo: { type: Number, required: true },
      districtId: { type: String, required: true },
      mlaName: { type: String, required: true },
      mlaParty: { type: String, required: true },
      center: { type: [Number], required: true },
      population: { type: String, required: true },
      areaSqKm: { type: Number, required: true },
    }));

    const dCount = await District.countDocuments();
    if (dCount === 0) {
      console.log("📥 Seeding Districts into MongoDB...");
      const districtsPath = path.join(process.cwd(), "backend", "seeds", "districts.json");
      if (fs.existsSync(districtsPath)) {
        const districtsData = JSON.parse(fs.readFileSync(districtsPath, "utf-8"));
        await District.insertMany(districtsData);
        console.log(`✅ Successfully seeded ${districtsData.length} Districts!`);
      }
    }

    const cCount = await Constituency.countDocuments();
    if (cCount === 0) {
      console.log("📥 Seeding Constituencies into MongoDB...");
      const constituenciesPath = path.join(process.cwd(), "backend", "seeds", "constituencies.json");
      if (fs.existsSync(constituenciesPath)) {
        const constituenciesData = JSON.parse(fs.readFileSync(constituenciesPath, "utf-8"));
        await Constituency.insertMany(constituenciesData);
        console.log(`✅ Successfully seeded ${constituenciesData.length} Constituencies!`);
      }
    }
  } catch (err) {
    console.error("⚠️ Error auto-seeding database:", err);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Connect to Database
  await connectDB();
  await seedDatabaseIfNeeded();

  // Create uploads folder if not exists
  const uploadsDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Middleware for parsing JSON and form bodies
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Serve uploaded images statically
  app.use("/uploads", express.static(uploadsDir));

  // Serve districts and constituencies dynamically from MongoDB or seeds fallback
  app.get("/api/districts", async (req, res) => {
    try {
      const districts = await getDistricts();
      res.json({ success: true, data: districts });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/api/constituencies", async (req, res) => {
    try {
      const constituencies = await getConstituencies();
      res.json({ success: true, data: constituencies });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Backend API Routes
  app.use("/api/issues", issueRoutes);

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({
      status: "healthy",
      timestamp: new Date(),
    });
  });

  // JSON Error Handling Middleware for API routes
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("💥 Express API Error:", err);
    res.status(err.status || err.statusCode || 500).json({
      success: false,
      message: err.message || "An internal server error occurred.",
    });
  });

  // Integration of Vite development server / production builds
  if (process.env.NODE_ENV !== "production") {
    console.log("🛠️ Starting server in DEVELOPMENT mode (Vite Middleware active)");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("📦 Starting server in PRODUCTION mode");
    const distPath = path.join(process.cwd(), "dist");
    
    // Serve production assets
    app.use(express.static(distPath));
    
    // Fallback all SPA routes to index.html (Express v4 format)
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Community Hero Server listening at http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("💥 Server failed to start:", error);
});
