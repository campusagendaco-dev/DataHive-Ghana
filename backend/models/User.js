const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    passwordReset: {
      otpHash: { type: String, default: null },
      otpExpiresAt: { type: Date, default: null },
      otpAttempts: { type: Number, default: 0 },
      otpVerifiedAt: { type: Date, default: null },
      resetSessionHash: { type: String, default: null },
      resetSessionExpiresAt: { type: Date, default: null },
      lastOtpSentAt: { type: Date, default: null },
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("User", userSchema);
