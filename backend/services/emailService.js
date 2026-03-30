const nodemailer = require("nodemailer");
const authConfig = require("../config/authConfig");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendOtpEmail = async ({ to, otp }) => {
  const minutes = authConfig.otpExpiryMinutes;

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: "Your QuickData password reset code",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6">
        <h2>Password Reset Verification</h2>
        <p>Use this code to reset your password:</p>
        <p style="font-size: 28px; font-weight: 700; letter-spacing: 4px">${otp}</p>
        <p>This code expires in ${minutes} minutes.</p>
        <p>If you did not request this, ignore this email.</p>
      </div>
    `,
    text: `Your QuickData password reset code is ${otp}. It expires in ${minutes} minutes.`,
  });
};

module.exports = {
  sendOtpEmail,
};
