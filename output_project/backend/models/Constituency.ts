import mongoose, { Schema, Document } from "mongoose";
import fs from "fs";
import path from "path";
import { getIsMongoConnected } from "../config/db.js";

export interface IConstituency extends Document {
  id: string;
  name: string;
  constituencyNo: number;
  districtId: string;
  mlaName: string;
  mlaParty: string;
  center: number[];
  population: string;
  areaSqKm: number;
  constituencyName?: string;
  districtName?: string;
}

const ConstituencySchema: Schema = new Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  constituencyNo: { type: Number, required: true, unique: true },
  districtId: { type: String, required: true },
  mlaName: { type: String, required: true },
  mlaParty: { type: String, required: true },
  center: { type: [Number], required: true },
  population: { type: String, required: true },
  areaSqKm: { type: Number, required: true },
  constituencyName: { type: String },
  districtName: { type: String },
});

let MongoConstituencyModel: mongoose.Model<IConstituency> | null = null;

function getMongoModel() {
  if (!MongoConstituencyModel) {
    MongoConstituencyModel = mongoose.model<IConstituency>("Constituency", ConstituencySchema);
  }
  return MongoConstituencyModel;
}

function enrichConstituency(c: any) {
  if (!c) return c;
  const name = c.name || c.constituencyName || "";
  const dId = c.districtId || "";
  const districtName = c.districtName || dId.charAt(0).toUpperCase() + dId.slice(1);
  return {
    id: c.id,
    name: name,
    constituencyName: name,
    constituencyNo: c.constituencyNo,
    districtId: dId,
    districtName,
    mlaName: c.mlaName,
    mlaParty: c.mlaParty,
    center: c.center || [11.1271, 78.6569],
    population: c.population || "1,50,000",
    areaSqKm: c.areaSqKm || 15.5,
  };
}

export async function getConstituencies(): Promise<any[]> {
  let list: any[] = [];
  if (getIsMongoConnected()) {
    try {
      const MongoModel = getMongoModel();
      const constituencies = await MongoModel.find({}).sort({ name: 1 });
      if (constituencies && constituencies.length > 0) {
        list = constituencies.map(c => c.toObject ? c.toObject() : c);
      }
    } catch (err) {
      console.error("Mongoose getConstituencies error, falling back to local JSON:", err);
    }
  }

  if (list.length === 0) {
    // Fallback to reading the seeds json
    try {
      const filePath = path.join(process.cwd(), "backend", "seeds", "constituencies.json");
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, "utf-8");
        list = JSON.parse(data);
      }
    } catch (err) {
      console.error("Local constituencies read error:", err);
    }
  }

  return list.map(enrichConstituency);
}
