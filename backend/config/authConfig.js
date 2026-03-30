const authConfig = {
  otpLength: Number(process.env.OTP_LENGTH || 6),
  otpExpiryMinutes: Number(process.env.OTP_EXPIRY_MINUTES || 10),
  otpMaxAttempts: Number(process.env.OTP_MAX_ATTEMPTS || 5),
  otpResendCooldownSeconds: Number(process.env.OTP_RESEND_COOLDOWN_SECONDS || 60),
  resetSessionMinutes: Number(process.env.RESET_SESSION_MINUTES || 15),
  bcryptSaltRounds: Number(process.env.BCRYPT_SALT_ROUNDS || 12),
};

module.exports = authConfig;
