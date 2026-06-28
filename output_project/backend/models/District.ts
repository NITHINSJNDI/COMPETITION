import mongoose, { Schema, Document } from "mongoose";
import fs from "fs";
import path from "path";
import { getIsMongoConnected } from "../config/db.js";

export interface IDistrict extends Document {
  id: string;
  name: string;
  center: number[];
  districtName?: string;
  collectorName?: string;
  mayorName?: string;
  hasMayor?: boolean;
}

const DistrictSchema: Schema = new Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  center: { type: [Number], required: true },
  districtName: { type: String },
  collectorName: { type: String },
  mayorName: { type: String },
  hasMayor: { type: Boolean, default: false },
});

let MongoDistrictModel: mongoose.Model<IDistrict> | null = null;

function getMongoModel() {
  if (!MongoDistrictModel) {
    MongoDistrictModel = mongoose.model<IDistrict>("District", DistrictSchema);
  }
  return MongoDistrictModel;
}

const MAYOR_DISTRICTS = ["chennai", "coimbatore", "madurai", "tiruchirappalli", "salem", "tiruppur", "erode", "tirunelveli", "vellore", "thoothukudi"];

function enrichDistrict(d: any) {
  if (!d) return d;
  const idLower = d.id ? d.id.toLowerCase() : "";
  const name = d.name || d.districtName || "";
  const hasMayor = MAYOR_DISTRICTS.includes(idLower) || d.hasMayor === true;
  
  // Custom names for realism
  let collectorName = d.collectorName;
  if (!collectorName) {
    if (idLower === "chennai") collectorName = "Dr. J. Radhakrishnan, IAS";
    else if (idLower === "coimbatore") collectorName = "Thiru. Kranthi Kumar Pati, IAS";
    else if (idLower === "madurai") collectorName = "Tmt. M. S. Sangeetha, IAS";
    else collectorName = `Thiru. K. P. Karthikeyan, IAS (${name})`;
  }

  let mayorName = d.mayorName;
  if (hasMayor && !mayorName) {
    if (idLower === "chennai") mayorName = "Tmt. R. Priya";
    else if (idLower === "coimbatore") mayorName = "Thiru. Kalpana Anandakumar";
    else if (idLower === "madurai") mayorName = "Thiru. Indrani Ponvasanth";
    else mayorName = `Tmt. S. Saravanan (Mayor of ${name})`;
  } else if (!hasMayor) {
    mayorName = "";
  }

  return {
    id: d.id,
    name: name,
    districtName: name,
    center: d.center || [11.1271, 78.6569],
    collectorName,
    mayorName,
    hasMayor,
  };
}

export async function getDistricts(): Promise<any[]> {
  let list: any[] = [];
  if (getIsMongoConnected()) {
    try {
      const MongoModel = getMongoModel();
      const districts = await MongoModel.find({}).sort({ name: 1 });
      if (districts && districts.length > 0) {
        list = districts.map(d => d.toObject ? d.toObject() : d);
      }
    } catch (err) {
      console.error("Mongoose getDistricts error, falling back to local JSON:", err);
    }
  }

  if (list.length === 0) {
    // Fallback to reading the seeds json
    try {
      const filePath = path.join(process.cwd(), "backend", "seeds", "districts.json");
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, "utf-8");
        list = JSON.parse(data);
      }
    } catch (err) {
      console.error("Local districts read error:", err);
    }
  }

  return list.map(enrichDistrict);
}
