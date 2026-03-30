const crypto = require("crypto");

const generateNumericOtp = (length = 6) => {
  const max = 10 ** length;
  const value = crypto.randomInt(0, max);
  return String(value).padStart(length, "0");
};

const sha256 = (value) => crypto.createHash("sha256").update(String(value)).digest("hex");

const createResetSessionToken = () => crypto.randomBytes(32).toString("base64url");

module.exports = {
  generateNumericOtp,
  sha256,
  createResetSessionToken,
};
