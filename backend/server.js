require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const cors = require("cors");
const authRoutes = require("./routes/auth");

const app = express();

const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error("Not allowed by CORS"));
  },
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.use("/api", authRoutes);
app.use("/auth", authRoutes);
app.use("/api/v1/auth", authRoutes);

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    app.listen(process.env.PORT || 3000, () => {
      console.log(`Auth backend running on http://localhost:${process.env.PORT || 3000}`);
    });
  })
  .catch((error) => {
    console.error("Mongo connection failed:", error);
    process.exit(1);
  });
