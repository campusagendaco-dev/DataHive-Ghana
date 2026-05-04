import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import { Skeleton } from "@/components/ui/skeleton";
import Autoplay from "embla-carousel-autoplay";

interface PromoBanner {
  id: string;
  banner_type: "image" | "text";
  image_url: string | null;
  content: string | null;
  background_color: string;
  text_color: string;
  target_url: string | null;
  title: string | null;
}

const PromoCarousel = () => {
  const [banners, setBanners] = useState<PromoBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchBanners = async () => {
      try {
        const { data, error } = await supabase
          .from("promo_banners")
          .select("*")
          .eq("is_active", true)
          .order("priority", { ascending: false });

        if (error) throw error;
        setBanners(data || []);
      } catch (err) {
        console.error("Error fetching banners:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchBanners();
  }, []);

  useEffect(() => {
    if (!api) return;

    setCurrent(api.selectedScrollSnap());
    api.on("select", () => {
      setCurrent(api.selectedScrollSnap());
    });
  }, [api]);

  if (loading) {
    return <Skeleton className="w-full aspect-[21/9] sm:aspect-[3/1] rounded-2xl" />;
  }

  if (banners.length === 0) return null;

  return (
    <div className="relative group">
      <Carousel
        setApi={setApi}
        plugins={[
          Autoplay({
            delay: 5000,
          }),
        ]}
        className="w-full"
      >
        <CarouselContent className="-ml-0">
          {banners.map((banner) => (
            <CarouselItem 
              key={banner.id} 
              className="pl-0 cursor-pointer"
              onClick={() => banner.target_url && navigate(banner.target_url)}
            >
              <div className="relative aspect-[21/9] sm:aspect-[3/1] overflow-hidden rounded-2xl border border-white/5">
                {banner.banner_type === "text" ? (
                  <div 
                    className="w-full h-full flex flex-col items-center justify-center p-8 text-center transition-transform duration-700 group-hover:scale-105"
                    style={{ backgroundColor: banner.background_color, color: banner.text_color }}
                  >
                    <p className="font-black text-lg sm:text-2xl md:text-3xl leading-tight max-w-[80%] drop-shadow-sm">
                      {banner.content}
                    </p>
                  </div>
                ) : (
                  <img
                    src={banner.image_url || ""}
                    alt={banner.title || "Promotion"}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                )}
                {/* Subtle overlay for better contrast if needed */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-40 pointer-events-none" />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>

      {/* Indicators */}
      {banners.length > 1 && (
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 flex gap-1.5 py-2">
          {banners.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                current === i ? "w-6 bg-amber-500" : "w-1.5 bg-white/20"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default PromoCarousel;
