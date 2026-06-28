import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

// Establish __dirname equivalents in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

const DISTRICTS_PATH = path.resolve(__dirname, "backend", "seeds", "districts.json");
const CONSTITUENCIES_PATH = path.resolve(__dirname, "backend", "seeds", "constituencies.json");

// Define Mongoose Schema for Districts
const DistrictSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  center: { type: [Number], required: true },
}, { timestamps: true });

// Define Mongoose Schema for Constituencies
const ConstituencySchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  constituencyNo: { type: Number, required: true, unique: true },
  districtId: { type: String, required: true }, // References District's 'id' field
  mlaName: { type: String, required: true },
  mlaParty: { type: String, required: true },
  center: { type: [Number], required: true },
  population: { type: String, required: true },
  areaSqKm: { type: Number, required: true },
}, { timestamps: true });

// Create models
const District = mongoose.models.District || mongoose.model("District", DistrictSchema);
const Constituency = mongoose.models.Constituency || mongoose.model("Constituency", ConstituencySchema);

async function runSeed() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error("\n❌ MONGODB_URI is not defined in your environment variables!");
    console.error("💡 Please add MONGODB_URI to your environment variables (via Settings or .env file) to connect and seed MongoDB Atlas.\n");
    process.exit(1);
  }

  // Verify that the seed files exist
  if (!fs.existsSync(DISTRICTS_PATH) || !fs.existsSync(CONSTITUENCIES_PATH)) {
    console.error("❌ Generated seed files not found! Please run the generation script first:");
    console.error("👉 npx tsx generateSeeds.cjs\n");
    process.exit(1);
  }

  // Load datasets
  const districtsData = JSON.parse(fs.readFileSync(DISTRICTS_PATH, "utf-8"));
  const constituenciesData = JSON.parse(fs.readFileSync(CONSTITUENCIES_PATH, "utf-8"));

  console.log("-----------------------------------------------------------------");
  console.log(`📂 Loaded ${districtsData.length} districts and ${constituenciesData.length} constituencies from JSON seeds.`);
  console.log("-----------------------------------------------------------------");

  try {
    console.log("🔌 Connecting to MongoDB Atlas...");
    await mongoose.connect(uri);
    console.log("🚀 Connection successful!");

    // Seed Districts
    console.log("\n🧹 Clearing existing Districts collection...");
    await District.deleteMany({});
    console.log(`📥 Inserting ${districtsData.length} Districts...`);
    const insertedDistricts = await District.insertMany(districtsData);
    console.log(`✅ Successfully seeded ${insertedDistricts.length} Districts!`);

    // Seed Constituencies
    console.log("\n🧹 Clearing existing Constituencies collection...");
    await Constituency.deleteMany({});
    console.log(`📥 Inserting ${constituenciesData.length} Constituencies...`);
    const insertedConstituencies = await Constituency.insertMany(constituenciesData);
    console.log(`✅ Successfully seeded ${insertedConstituencies.length} Constituencies!`);

    console.log("\n⭐️ Database seeding completed successfully!");
    console.log("-----------------------------------------------------------------");
  } catch (error) {
    console.error("\n❌ Database seeding failed with an error:");
    console.error(error);
  } finally {
    // Terminate connection cleanly
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB Atlas.");
    process.exit(0);
  }
}

runSeed();
