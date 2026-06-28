import mongoose from "mongoose";

let isMongoConnected = false;

export async function connectDB(): Promise<boolean> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn("⚠️ MONGODB_URI is not defined in environment variables. Falling back to local JSON database storage.");
    isMongoConnected = false;
    return false;
  }

  // Register connection error listener to prevent unhandled background connection errors from bubbling up
  mongoose.connection.on("error", (err) => {
    console.error("Mongoose background connection error:", err);
  });

  try {
    // Standard Mongoose options for robust connection with a fast 3-second timeout
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 3000,
    });
    console.log("🚀 Connected to MongoDB Atlas successfully!");
    isMongoConnected = true;
    return true;
  } catch (error) {
    console.error("❌ MongoDB Atlas connection error:", error);
    try {
      await mongoose.disconnect();
    } catch (disError) {
      console.error("Error disconnecting mongoose after failed connection:", disError);
    }
    console.warn("⚠️ Falling back to local JSON database storage due to connection failure.");
    isMongoConnected = false;
    return false;
  }
}

export function getIsMongoConnected(): boolean {
  return isMongoConnected;
}
