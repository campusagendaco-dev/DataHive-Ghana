const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ""));

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

const isOtpCode = (value, otpLength) => new RegExp(`^\\d{${otpLength}}$`).test(String(value || "").trim());

const passwordRuleChecks = (password) => {
  const value = String(password || "");
  return {
    minLength: value.length >= 8,
    hasUpper: /[A-Z]/.test(value),
    hasLower: /[a-z]/.test(value),
    hasNumber: /\d/.test(value),
    hasSpecial: /[^A-Za-z0-9]/.test(value),
  };
};

const isStrongPassword = (password) => {
  const checks = passwordRuleChecks(password);
  return Object.values(checks).every(Boolean);
};

module.exports = {
  isEmail,
  normalizeEmail,
  isOtpCode,
  passwordRuleChecks,
  isStrongPassword,
};
