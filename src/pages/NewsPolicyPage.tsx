import { FileText, Globe2, Loader2, Newspaper, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useEstimate } from "../context/EstimateContext";
import {
  buildRegionalScope,
  fallbackRegionalNews,
  fetchLiveRegionalNews,
  getPolicyItems,
  type RegionalContentItem,
} from "../services/newsPolicy";

const CACHE_TTL_MS = 30 * 60 * 1000;

const readNewsCache = (key: string): RegionalContentItem[] | undefined => {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { savedAt: number; items: RegionalContentItem[] };
    if (Date.now() - parsed.savedAt > CACHE_TTL_MS) return undefined;
    return parsed.items;
  } catch {
    return undefined;
  }
};

const writeNewsCache = (key: string, items: RegionalContentItem[]) => {
  try {
    sessionStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), items }));
  } catch {
    // Session cache is optional.
  }
};

const sortByDateDesc = (items: RegionalContentItem[]) =>
  [...items].sort((a, b) => b.date.localeCompare(a.date));

const ContentCard = ({ item, onOpen }: { item: RegionalContentItem; onOpen: (item: RegionalContentItem) => void }) => (
  <article className={`regional-content-card ${item.kind}`}>
    <button type="button" onClick={() => onOpen(item)} className="regional-content-title">
      <span>{item.kind === "news" ? "NEWS" : "POLICY"}</span>
      <strong>{item.title}</strong>
    </button>
    <p>{item.summary}</p>
    <div className="regional-content-meta">
      <span>{item.date}</span>
      <span>{item.source}</span>
      <span>{item.scope}</span>
    </div>
    <div className="regional-tag-row">
      {item.tags.slice(0, 4).map((tag) => (
        <span key={`${item.id}-${tag}`}>{tag}</span>
      ))}
      {item.isLive && <span className="live-tag">即時搜尋</span>}
    </div>
  </article>
);

const ReaderModal = ({ item, onClose }: { item: RegionalContentItem; onClose: () => void }) => (
  <div className="article-modal-backdrop" role="presentation" onClick={onClose}>
    <article className="article-reader-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
      <header>
        <div>
          <span>{item.source}</span>
          <h2>{item.title}</h2>
          <p>{item.kind === "news" ? "不動產新聞" : "不動產政策"} · {item.date} · {item.scope}</p>
        </div>
        <button type="button" aria-label="關閉視窗" onClick={onClose}>
          <X size={20} />
        </button>
      </header>
      <div className="article-summary-strip">
        <strong>重點摘要</strong>
        <p>{item.summary}</p>
      </div>
      <section className="article-body-content">
        <div className="article-body-head">
          <span>{item.kind === "news" ? "新聞內容" : "政策內容"}</span>
          <small>{item.source}</small>
        </div>
        {item.content.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </section>
    </article>
  </div>
);

export const NewsPolicyPage = () => {
  const { propertyInput } = useEstimate();
  const [news, setNews] = useState<RegionalContentItem[]>(() =>
    fallbackRegionalNews(propertyInput.city, propertyInput.district),
  );
  const [newsStatus, setNewsStatus] = useState<"loading" | "ready" | "fallback">("loading");
  const [activeItem, setActiveItem] = useState<RegionalContentItem | undefined>();
  const regionLabel = buildRegionalScope(propertyInput.city, propertyInput.district);
  const policies = useMemo(
    () => sortByDateDesc(getPolicyItems(propertyInput.city, propertyInput.district)),
    [propertyInput.city, propertyInput.district],
  );

  useEffect(() => {
    let cancelled = false;
    const cacheKey = `regional-news:${propertyInput.city}:${propertyInput.district}`;
    const cached = readNewsCache(cacheKey);
    if (cached?.length) {
      setNews(sortByDateDesc(cached));
      setNewsStatus("ready");
      return;
    }
    setNewsStatus("loading");
    fetchLiveRegionalNews(propertyInput.city, propertyInput.district)
      .then((items) => {
        if (cancelled) return;
        const next = items.length ? sortByDateDesc(items) : sortByDateDesc(fallbackRegionalNews(propertyInput.city, propertyInput.district));
        setNews(next);
        setNewsStatus(items.length ? "ready" : "fallback");
        writeNewsCache(cacheKey, next);
      })
      .catch(() => {
        if (cancelled) return;
        setNews(sortByDateDesc(fallbackRegionalNews(propertyInput.city, propertyInput.district)));
        setNewsStatus("fallback");
      });
    return () => {
      cancelled = true;
    };
  }, [propertyInput.city, propertyInput.district]);

  return (
    <div className="page regional-news-page">
      <section className="section-heading regional-news-hero">
        <div className="regional-news-hero-copy">
          <span className="eyebrow">區域新聞 / 政策雷達</span>
          <h1>房產新聞與政策</h1>
          <p>依目前標的所在地區、縣市與全國範圍整理房地產新聞與政策，最新資訊排在最上方。</p>
        </div>
        <div className="regional-subject-card">
          <Globe2 size={22} />
          <div>
            <span>目前標的地區</span>
            <strong>{regionLabel}</strong>
          </div>
        </div>
      </section>

      <section className="regional-content-layout">
        <article className="regional-content-column news">
          <div className="regional-column-head">
            <Newspaper size={22} />
            <div>
              <span>區域新聞</span>
              <h2>{regionLabel}不動產新聞</h2>
            </div>
            {newsStatus === "loading" && <Loader2 className="spin-icon" size={20} />}
          </div>
          <div className="regional-card-list">
            {news.map((item) => <ContentCard key={item.id} item={item} onOpen={setActiveItem} />)}
          </div>
        </article>

        <article className="regional-content-column policy">
          <div className="regional-column-head">
            <FileText size={22} />
            <div>
              <span>政策資料</span>
              <h2>{regionLabel}不動產政策</h2>
            </div>
          </div>
          <div className="regional-card-list">
            {policies.map((item) => <ContentCard key={item.id} item={item} onOpen={setActiveItem} />)}
          </div>
        </article>
      </section>

      {activeItem && <ReaderModal item={activeItem} onClose={() => setActiveItem(undefined)} />}
    </div>
  );
};
