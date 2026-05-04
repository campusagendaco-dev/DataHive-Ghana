import { useEffect } from "react";

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  url?: string;
  image?: string;
  type?: string;
  canonical?: string;
}

const SEO = ({
  title,
  description,
  keywords,
  url = "https://swiftdatagh.com",
  image = "https://swiftdatagh.com/og-image.png",
  type = "website",
  canonical
}: SEOProps) => {
  useEffect(() => {
    if (title) {
      document.title = title.includes("SwiftData Ghana") 
        ? title 
        : `${title} | SwiftData Ghana`;
    }

    const updateMeta = (name: string, content: string, attr: "name" | "property" = "name") => {
      let element = document.querySelector(`meta[${attr}="${name}"]`);
      if (!element) {
        element = document.createElement("meta");
        element.setAttribute(attr, name);
        document.head.appendChild(element);
      }
      element.setAttribute("content", content);
    };

    if (description) {
      updateMeta("description", description);
      updateMeta("og:description", description, "property");
      updateMeta("twitter:description", description);
    }

    if (keywords) {
      updateMeta("keywords", keywords);
    }

    if (title) {
      updateMeta("og:title", title, "property");
      updateMeta("twitter:title", title);
    }

    updateMeta("og:url", url, "property");
    updateMeta("og:type", type, "property");
    updateMeta("og:image", image, "property");
    updateMeta("twitter:image", image);
    updateMeta("twitter:card", "summary_large_image");

    if (canonical) {
      let link = document.querySelector('link[rel="canonical"]');
      if (!link) {
        link = document.createElement("link");
        link.setAttribute("rel", "canonical");
        document.head.appendChild(link);
      }
      link.setAttribute("href", canonical);
    }
  }, [title, description, keywords, url, image, type, canonical]);

  return null;
};

export default SEO;
