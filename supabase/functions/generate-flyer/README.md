# Reseller Flyer Generator

The Reseller Flyer Generator is an AI-powered tool that creates beautiful, professional promotional flyers for data reselling agents.

## Features

- **AI-Generated Design**: Creates clean, modern flyer designs automatically
- **Store Information**: Pulls store name, URL, and contact details from agent profile
- **Package Pricing**: Includes all enabled packages with agent-set prices for each network
- **Professional Layout**: Generates HTML flyers with responsive design
- **Download Options**: Download as HTML file or view full-size

## How It Works

1. **Data Collection**: The system collects:
   - Agent's store name and URL
   - Contact information (MoMo number)
   - All enabled data packages with pricing
   - Network information and colors

2. **Flyer Generation**: Uses AI to create a professional flyer layout with:
   - Store branding and header
   - Organized package listings by network
   - Pricing information
   - Call-to-action with store URL
   - Contact information

3. **Output**: Generates an HTML flyer that can be:
   - Viewed in-browser
   - Downloaded as HTML file
   - Printed or shared

## Technical Implementation

### Frontend (`DashboardFlyer.tsx`)
- Collects agent profile and pricing data
- Calls the `generate-flyer` Supabase Edge Function
- Displays flyer in iframe with download options

### Backend (`supabase/functions/generate-flyer/index.ts`)
- Receives store and package data
- Generates professional HTML flyer with inline CSS
- Returns HTML content for display/download

## Usage

1. Navigate to "Flyer Generator" in the agent dashboard
2. Ensure store name is set in settings
3. Click "Generate Flyer" to create the design
4. View the flyer and download as needed

## Future Enhancements

- PNG/PDF export using image generation services
- Customizable templates and themes
- QR code generation for store URLs
- Social media optimized formats