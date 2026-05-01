import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const lastModified = new Date();

  const languages = {
    "zh-CN": baseUrl,
    "zh-TW": baseUrl,
    en: baseUrl,
    ja: baseUrl,
    ko: baseUrl,
  };

  return [
    {
      url: baseUrl,
      lastModified,
      changeFrequency: "daily",
      priority: 1,
      alternates: { languages },
    },
  ];
}
