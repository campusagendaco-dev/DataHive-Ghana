import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { basePackages, networks, getPublicPrice } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { FileText, Download, Sparkles, Loader2 } from "lucide-react";
import html2canvas from "html2canvas";

interface AgentPrices {
  [network: string]: {
    [size: string]: string;
  };
}

interface DisabledPackages {
  [network: string]: string[];
}

const DashboardFlyer = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);
  const [flyerData, setFlyerData] = useState<any>(null);
  const [agentPrices, setAgentPrices] = useState<AgentPrices>({});
  const [disabledPackages, setDisabledPackages] = useState<DisabledPackages>({});

  useEffect(() => {
    if (profile) {
      setAgentPrices((profile.agent_prices as AgentPrices) || {});
      setDisabledPackages((profile.disabled_packages as DisabledPackages) || {});
    }
  }, [profile]);

  const getAgentPrice = (network: string, size: string): number => {
    const price = agentPrices[network]?.[size];
    if (price && !isNaN(Number(price))) {
      return Number(price);
    }
    // Fallback to base price + markup
    const basePkg = basePackages[network]?.find(p => p.size === size);
    return basePkg ? getPublicPrice(basePkg.price) : 0;
  };

  const isPackageEnabled = (network: string, size: string): boolean => {
    return !disabledPackages[network]?.includes(size);
  };

  const generateFlyerLocally = (flyerInfo: any): string => {
    const { storeName, storeUrl, packages, networks, contact } = flyerInfo;

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

    return `
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
                        ${networks.map(network => {
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
                                ${networks.map(network => {
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
  };

  const generateFlyer = async () => {
    if (!profile?.store_name) {
      toast({
        title: "Store name required",
        description: "Please set up your store name in settings first.",
        variant: "destructive",
      });
      return;
    }

    setGenerating(true);

    try {
      // Collect all enabled packages with prices
      const packages = [];
      for (const network of networks) {
        const networkPackages = basePackages[network.name] || [];
        for (const pkg of networkPackages) {
          if (isPackageEnabled(network.name, pkg.size)) {
            packages.push({
              network: network.name,
              size: pkg.size,
              price: getAgentPrice(network.name, pkg.size),
              validity: pkg.validity,
              popular: pkg.popular,
            });
          }
        }
      }

      // Group packages by network
      const packagesByNetwork = packages.reduce((acc, pkg) => {
        if (!acc[pkg.network]) acc[pkg.network] = [];
        acc[pkg.network].push(pkg);
        return acc;
      }, {} as Record<string, typeof packages>);

      const flyerInfo = {
        storeName: profile.store_name,
        storeUrl: profile.slug ? `https://datahiveghana.com/store/${profile.slug}` : 'https://datahiveghana.com',
        packages: packagesByNetwork,
        networks: networks,
        contact: profile.momo_number ? `Contact: ${profile.momo_number}` : '',
      };

      // Generate flyer using AI
      let data;
      try {
        const result = await supabase.functions.invoke('generate-flyer', {
          body: flyerInfo,
        });

        if (result.error) {
          console.error('Supabase function error:', result.error);
          throw new Error(result.error.message || 'Function invocation failed');
        }

        data = result.data;
      } catch (funcError) {
        console.warn('Supabase function not available, generating flyer locally:', funcError);

        // Fallback: Generate flyer locally
        const htmlFlyer = generateFlyerLocally(flyerInfo);
        data = {
          html: htmlFlyer,
          generatedLocally: true
        };
      }

      if (!data) {
        throw new Error('No data returned from flyer generation');
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setFlyerData(data);
      toast({
        title: "Flyer generated!",
        description: data.generatedLocally ? "Flyer generated locally (function not deployed)" : "Your custom reseller flyer is ready.",
      });
    } catch (error) {
      console.error('Flyer generation error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast({
        title: "Generation failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const downloadFlyer = async () => {
    if (!flyerData?.html) return;

    try {
      // Create a temporary container for the HTML
      const container = document.createElement('div');
      container.innerHTML = flyerData.html;
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.top = '-9999px';
      container.style.width = '1200px'; // Match the flyer max-width
      document.body.appendChild(container);

      // Use html2canvas to convert to PNG
      const canvas = await html2canvas(container, {
        width: 1200,
        height: container.scrollHeight,
        scale: 2, // Higher resolution
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
      });

      // Remove temporary container
      document.body.removeChild(container);

      // Convert canvas to blob and download
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${profile?.store_name || 'store'}-flyer.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);

          toast({
            title: "Download complete!",
            description: "Your flyer has been downloaded as a PNG image.",
          });
        }
      }, 'image/png', 0.9);

    } catch (error) {
      console.error('PNG generation error:', error);
      toast({
        title: "Download failed",
        description: "Failed to generate PNG. Please try again.",
        variant: "destructive",
      });
    }
  };

  const openFlyer = () => {
    if (!flyerData?.html) return;

    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write(flyerData.html);
      newWindow.document.close();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <FileText className="w-6 h-6 text-primary" />
        <div>
          <h1 className="font-display text-2xl font-bold">Reseller Flyer Generator</h1>
          <p className="text-muted-foreground text-sm">Create beautiful promotional flyers for your data reselling business</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            AI Flyer Generator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h3 className="font-medium">Store Information</h3>
              <div className="text-sm text-muted-foreground space-y-1">
                <p><strong>Name:</strong> {profile?.store_name || 'Not set'}</p>
                <p><strong>URL:</strong> {profile?.slug ? `datahiveghana.com/store/${profile.slug}` : 'Not set'}</p>
                <p><strong>Contact:</strong> {profile?.momo_number || 'Not set'}</p>
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="font-medium">Package Summary</h3>
              <div className="text-sm text-muted-foreground space-y-1">
                {networks.map(network => {
                  const enabledCount = basePackages[network.name]?.filter(pkg =>
                    isPackageEnabled(network.name, pkg.size)
                  ).length || 0;
                  return (
                    <p key={network.name}>
                      <Badge variant="outline" className="mr-2" style={{ borderColor: network.color }}>
                        {network.name}
                      </Badge>
                      {enabledCount} packages
                    </p>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t">
            <Button
              onClick={generateFlyer}
              disabled={generating || !profile?.store_name}
              className="gap-2"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Flyer
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {flyerData && (
        <Card>
          <CardHeader>
            <CardTitle>Your Generated Flyer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center">
              <div className="border rounded-lg overflow-hidden max-w-md bg-white">
                <iframe
                  srcDoc={flyerData.html}
                  className="w-full h-96 border-0"
                  title="Generated flyer"
                />
              </div>
            </div>
            <div className="flex justify-center gap-2">
              <Button onClick={openFlyer} variant="outline" className="gap-2">
                <FileText className="w-4 h-4" />
                View Full Size
              </Button>
              <Button onClick={downloadFlyer} variant="outline" className="gap-2">
                <Download className="w-4 h-4" />
                Download PNG
              </Button>
              <Button onClick={generateFlyer} variant="outline" disabled={generating}>
                Generate New
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DashboardFlyer;