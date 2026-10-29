import type { MetadataRoute } from "next";
import { getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { siteUrl } from "@/lib/site";

const PAGES = ["/", "/meta", "/legends", "/events", "/players", "/decks", "/cards", "/cards/syntax", "/builder", "/about/methodology", "/about/privacy", "/about/terms"];

/** Só as páginas fixas, nos dois idiomas; lendas, eventos e cartas são achados pelos links. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const url = (href: string, locale: (typeof routing.locales)[number]) => base + getPathname({ href, locale });
  return PAGES.map((href) => ({
    url: url(href, routing.defaultLocale),
    alternates: { languages: Object.fromEntries(routing.locales.map((l) => [l, url(href, l)])) },
  }));
}
