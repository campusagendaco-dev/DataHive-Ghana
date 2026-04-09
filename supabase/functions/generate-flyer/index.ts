import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { storeName, storeUrl, packages, networks, contact } = await req.json();

    if (!storeName) {
      return new Response(JSON.stringify({ error: "Store name is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate flyer content using AI
    const flyerPrompt = `Create a beautiful, professional flyer for a data reselling business called "${storeName}". The flyer should include:

Store Information:
- Store Name: ${storeName}
- Website: ${storeUrl}
${contact ? `- Contact: ${contact}` : ''}

Available Data Packages:
${Object.entries(packages).map(([network, pkgs]) => {
  return `${network}:
${(pkgs as any[]).slice(0, 5).map(pkg => `  - ${pkg.size} for GH₵${pkg.price}`).join('\n')}`;
}).join('\n\n')}

Design Requirements:
- Clean, modern design
- Professional color scheme
- Easy to read text
- Include store branding
- Mobile-friendly layout
- Call-to-action to visit the website

Generate this as HTML/CSS that can be rendered as an image. Use inline styles and make it look like a professional marketing flyer.`;

    // For now, return a simple HTML flyer since we don't have OpenAI API configured
    // In production, you would call OpenAI API here to generate the flyer design

    // Get all unique package sizes across all networks
    const allSizes = new Set<string>();
    Object.values(packages).forEach((pkgs: any[]) => {
      pkgs.forEach(pkg => allSizes.add(pkg.size));
    });
    const sortedSizes = Array.from(allSizes).sort((a, b) => {
      const aNum = parseFloat(a.replace(/[^\d.]/g, ''));
      const bNum = parseFloat(b.replace(/[^\d.]/g, ''));
      return aNum - bNum;
    });

    const htmlFlyer = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${storeName} - Data Reselling</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .flyer {
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            max-width: 1200px;
            width: 100%;
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #FFCC00 0%, #FF9900 100%);
            padding: 30px 20px;
            text-align: center;
            color: white;
        }
        .header h1 {
            margin: 0;
            font-size: 32px;
            font-weight: bold;
            text-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        .header p {
            margin: 5px 0 0 0;
            opacity: 0.9;
            font-size: 16px;
        }
        .content {
            padding: 25px;
        }
        .pricing-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            border-radius: 10px;
            overflow: hidden;
        }
        .pricing-table th {
            background: #f8f9fa;
            padding: 15px 10px;
            text-align: center;
            font-weight: bold;
            font-size: 18px;
            border-bottom: 2px solid #dee2e6;
        }
        .pricing-table td {
            padding: 12px 10px;
            text-align: center;
            border-bottom: 1px solid #dee2e6;
        }
        .pricing-table tr:nth-child(even) {
            background: #f8f9fa;
        }
        .pricing-table tr:hover {
            background: #e9ecef;
        }
        .package-size {
            font-weight: 600;
            color: #333;
            font-size: 14px;
        }
        .package-price {
            font-weight: bold;
            color: #FF9900;
            font-size: 16px;
        }
        .popular-badge {
            display: inline-block;
            background: #28a745;
            color: white;
            padding: 2px 6px;
            border-radius: 8px;
            font-size: 10px;
            margin-left: 5px;
            font-weight: bold;
        }
        .network-header {
            position: relative;
        }
        .network-color-bar {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            height: 4px;
        }
        .footer {
            background: #f8f9fa;
            padding: 25px;
            text-align: center;
            border-top: 1px solid #e9ecef;
        }
        .website {
            display: inline-block;
            background: #FFCC00;
            color: white;
            padding: 15px 30px;
            border-radius: 25px;
            text-decoration: none;
            font-weight: bold;
            font-size: 16px;
            margin-bottom: 15px;
            box-shadow: 0 4px 8px rgba(255, 204, 0, 0.3);
            transition: transform 0.2s;
        }
        .website:hover {
            transform: translateY(-2px);
        }
        .contact {
            color: #666;
            font-size: 14px;
            margin: 5px 0;
        }
        .features {
            display: flex;
            justify-content: center;
            gap: 20px;
            margin-top: 15px;
            flex-wrap: wrap;
        }
        .feature {
            display: flex;
            align-items: center;
            gap: 5px;
            color: #666;
            font-size: 14px;
        }
        @media (max-width: 768px) {
            .pricing-table {
                font-size: 12px;
            }
            .pricing-table th,
            .pricing-table td {
                padding: 8px 5px;
            }
            .header h1 {
                font-size: 24px;
            }
        }
    </style>
</head>
<body>
    <div class="flyer">
        <div class="header">
            <h1>${storeName}</h1>
            <p>Ghana's Fastest Data Reselling Platform</p>
        </div>

        <div class="content">
            <table class="pricing-table">
                <thead>
                    <tr>
                        <th style="background: #f8f9fa; border-bottom: 2px solid #dee2e6;">Data Package</th>
                        ${networks.map((network: any) => {
                          const networkColor = network.color;
                          return `<th class="network-header" style="background: #f8f9fa; border-bottom: 2px solid ${networkColor};">
                                    ${network.name}
                                    <div class="network-color-bar" style="background: ${networkColor};"></div>
                                  </th>`;
                        }).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${sortedSizes.map(size => {
                      return `<tr>
                                <td class="package-size">${size}</td>
                                ${networks.map((network: any) => {
                                  const pkg = packages[network.name]?.find((p: any) => p.size === size);
                                  if (pkg) {
                                    return `<td>
                                              <span class="package-price">GH₵${pkg.price}</span>
                                              ${pkg.popular ? '<span class="popular-badge">POPULAR</span>' : ''}
                                            </td>`;
                                  } else {
                                    return `<td style="color: #ccc;">-</td>`;
                                  }
                                }).join('')}
                              </tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>

        <div class="footer">
            <a href="${storeUrl}" class="website" target="_blank">Visit Our Store</a>
            ${contact ? `<p class="contact">${contact}</p>` : ''}
            <div class="features">
                <div class="feature">⚡ Instant Delivery</div>
                <div class="feature">📱 All Networks</div>
                <div class="feature">💰 Best Prices</div>
                <div class="feature">🔒 Secure Transactions</div>
            </div>
        </div>
    </div>
</body>
</html>`;

    // For now, we'll return the HTML. In production, you'd convert this to an image
    // You could use a service like htmlcsstoimage.com or puppeteer to convert HTML to PNG

    return new Response(JSON.stringify({
      html: htmlFlyer,
      // In production, you'd generate an actual image URL here
      imageUrl: `data:text/html;charset=utf-8,${encodeURIComponent(htmlFlyer)}`
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Flyer generation error:", error);
    return new Response(JSON.stringify({ error: "Failed to generate flyer" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});