# API Authentication Requirements

## Overview
All API requests to the DataHive data provider require authentication via the **X-API-Key** header.

## Header Format
```
X-API-Key: api_e3ffd9c06949b6e7a731057888b3848b2dd536386ee8b7fb818a311f10c075fe
```

## Configuration
The API key is configured via the environment variable:
```
DATA_PROVIDER_API_KEY=api_e3ffd9c06949b6e7a731057888b3848b2dd536386ee8b7fb818a311f10c075fe
```

This value is used in the following Supabase Edge Functions:
- `verify-payment` - For fulfilling data orders and AFA registrations
- `wallet-buy-data` - For processing wallet-based data purchases

## Implementation Details

### Verify Payment Function
The `verify-payment` function uses the X-API-Key header when calling the data provider's endpoints:
- **POST** `/api/order` - For data fulfillment
- **POST** `/api/afa-registration` - For AFA registration

### Wallet Buy Data Function
The `wallet-buy-data` function uses the X-API-Key header when calling:
- **POST** `/api/order` - For processing data orders from wallet

## Error Handling
If the API key is missing or invalid, the data provider may return HTTP errors. The system handles Cloudflare challenges and HTML responses by detecting them and returning a user-friendly error message: "Provider blocked server request (Cloudflare challenge). Contact support."

## Testing
When testing API integrations, ensure the `DATA_PROVIDER_API_KEY` environment variable is properly configured in your `.env.local` file or Supabase project settings.
