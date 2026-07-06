"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Search, BookOpen, ChevronLeft, Info, AlertTriangle } from "lucide-react";
import { HELP_ARTICLES, HELP_CATEGORIES, type HelpArticle, type HelpBlock } from "@/lib/help/articles";

// Renders **bold** spans inside article text.
function InlineText({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <strong key={i} className="font-semibold text-foreground">{part}</strong>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

function BlockView({ block }: { block: HelpBlock }) {
  switch (block.type) {
    case "h2":
      return <h2 className="font-serif text-xl font-semibold text-foreground mt-6 mb-2">{block.text}</h2>;
    case "p":
      return <p className="text-sm text-muted-foreground leading-relaxed mb-3"><InlineText text={block.text} /></p>;
    case "list":
      return (
        <ul className="space-y-1.5 mb-3">
          {block.items.map((item, i) => (
            <li key={i} className="text-sm text-muted-foreground leading-relaxed flex gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary/60 mt-1.5 shrink-0" />
              <span><InlineText text={item} /></span>
            </li>
          ))}
        </ul>
      );
    case "steps":
      return (
        <ol className="space-y-2 mb-3">
          {block.items.map((item, i) => (
            <li key={i} className="text-sm text-muted-foreground leading-relaxed flex gap-3">
              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5">
                {i + 1}
              </span>
              <span><InlineText text={item} /></span>
            </li>
          ))}
        </ol>
      );
    case "table":
      return (
        <div className="overflow-x-auto mb-3 rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                {block.headers.map((h, i) => (
                  <th key={i} className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {block.rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-2 align-top text-muted-foreground">
                      <InlineText text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "code":
      return (
        <pre className="rounded-lg border border-border bg-muted/30 p-3 text-xs font-mono text-foreground overflow-x-auto mb-3 whitespace-pre">
          {block.text}
        </pre>
      );
    case "callout": {
      const warning = block.tone === "warning";
      return (
        <div className={`rounded-lg border p-3 mb-3 flex gap-2 ${warning ? "border-amber-300 bg-amber-50" : "border-[#C2D2E2] bg-[#DDE7F0]/50"}`}>
          {warning
            ? <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            : <Info className="w-4 h-4 text-[#3A5F82] shrink-0 mt-0.5" />}
          <p className={`text-sm leading-relaxed ${warning ? "text-amber-800" : "text-[#3A5F82]"}`}>
            <InlineText text={block.text} />
          </p>
        </div>
      );
    }
  }
}

// Flattens an article's searchable text once.
function articleText(a: HelpArticle): string {
  const body = a.blocks
    .map((b) => {
      switch (b.type) {
        case "p": case "h2": case "code": case "callout": return b.text;
        case "list": case "steps": return b.items.join(" ");
        case "table": return [...b.headers, ...b.rows.flat()].join(" ");
      }
    })
    .join(" ");
  return `${a.title} ${a.summary} ${a.keywords.join(" ")} ${body}`.toLowerCase();
}

export default function HelpClient() {
  const t = useTranslations("help");
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [openSlug, setOpenSlug] = useState<string | null>(null);

  const searchIndex = useMemo(
    () => HELP_ARTICLES.map((a) => ({ article: a, text: articleText(a) })),
    []
  );

  const results = useMemo(() => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    return searchIndex
      .filter(({ article, text }) => {
        if (activeCategory && article.category !== activeCategory) return false;
        return terms.every((term) => text.includes(term));
      })
      .map(({ article }) => article);
  }, [searchIndex, query, activeCategory]);

  const openArticle = openSlug ? HELP_ARTICLES.find((a) => a.slug === openSlug) : null;
  const categoryLabel = (id: string) => HELP_CATEGORIES.find((c) => c.id === id)?.label ?? id;

  if (openArticle) {
    return (
      <div className="p-6 md:p-8 max-w-3xl">
        <button
          onClick={() => setOpenSlug(null)}
          className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 font-medium mb-4"
        >
          <ChevronLeft className="w-4 h-4" /> {t("backToHelp")}
        </button>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
          {categoryLabel(openArticle.category)}
        </p>
        <h1 className="font-serif text-3xl font-semibold text-foreground mb-2">{openArticle.title}</h1>
        <p className="text-sm text-muted-foreground mb-6">{openArticle.summary}</p>
        <div>
          {openArticle.blocks.map((block, i) => <BlockView key={i} block={block} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-3xl space-y-5">
      <div>
        <h1 className="font-serif text-3xl font-semibold" style={{ color: "hsl(var(--text))" }}>{t("title")}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{t("subtitle")}</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchPlaceholder")}
          autoFocus
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-surface text-foreground text-sm focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 transition-all"
        />
      </div>

      {/* Category chips */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveCategory(null)}
          className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
            activeCategory === null ? "bg-primary text-primary-foreground" : "bg-muted text-foreground/85 hover:bg-muted/80"
          }`}
        >
          {t("allCategories")}
        </button>
        {HELP_CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveCategory(activeCategory === c.id ? null : c.id)}
            className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
              activeCategory === c.id ? "bg-primary text-primary-foreground" : "bg-muted text-foreground/85 hover:bg-muted/80"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Results */}
      {results.length === 0 ? (
        <div className="text-center py-12 rounded-xl border border-dashed border-border">
          <BookOpen className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">{t("noResults")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {results.map((a) => (
            <button
              key={a.slug}
              onClick={() => setOpenSlug(a.slug)}
              className="w-full text-left rounded-xl border border-border bg-surface p-4 hover:bg-muted/30 transition-colors"
            >
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-0.5">
                {categoryLabel(a.category)}
              </p>
              <p className="text-sm font-semibold text-foreground">{a.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{a.summary}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
