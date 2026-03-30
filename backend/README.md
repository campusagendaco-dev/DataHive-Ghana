# Auth Backend (OTP Forgot/Reset Password)

This folder contains a standalone Node.js + Express + MongoDB implementation for secure OTP-based forgot-password and reset-password flows.

## Endpoints

- `POST /api/forgot-password`
- `POST /api/verify-otp`
- `POST /api/reset-password`

## Security Highlights

- 6-digit OTP generation with configurable expiry (default 10 minutes).
- OTP is stored as SHA-256 hash (never plain text in DB).
- Max OTP attempts enforcement (default 5).
- OTP reuse is prevented (OTP cleared after successful verification).
- Password reset requires short-lived reset session token (hashed in DB).
- Passwords are hashed with bcrypt.
- Rate limit for OTP resend (default 60 seconds).
- No auto-login after password reset.

## Setup

1. Copy `.env.example` to `.env` and fill values.
2. Install dependencies:
   - `cd backend`
   - `npm install`
3. Start server:
   - `npm run dev`
4. Open demo page:
   - `http://localhost:3000/login.html`

## Files

- `server.js`: app bootstrap
- `models/User.js`: Mongoose schema
- `routes/auth.js`: forgot/verify/reset OTP routes
- `config/authConfig.js`: auth flow config
- `services/emailService.js`: SMTP email sender
- `services/otpService.js`: OTP/token generation + hashing helpers
- `utils/validators.js`: email/password/OTP validation
- `public/forgot-password.html`: request OTP page
- `public/verify-otp.html`: OTP verification page
- `public/reset-password.html`: final password reset page

## API Request/Response Examples

### 1) Forgot Password

`POST /api/forgot-password`

```json
{
  "email": "user@example.com"
}
```

Success:

```json
{
  "success": true,
  "message": "Verification code sent to your email.",
  "data": {
    "email": "user@example.com",
    "otpExpiresInMinutes": 10
  }
}
```

### 2) Verify OTP

`POST /api/verify-otp`

```json
{
  "email": "user@example.com",
  "otp": "123456"
}
```

Success:

```json
{
  "success": true,
  "message": "OTP verified successfully.",
  "data": {
    "resetToken": "server-generated-token",
    "resetTokenExpiresInMinutes": 15
  }
}
```

### 3) Reset Password

`POST /api/reset-password`

```json
{
  "email": "user@example.com",
  "resetToken": "server-generated-token",
  "newPassword": "StrongPass#123",
  "confirmPassword": "StrongPass#123"
}
```
