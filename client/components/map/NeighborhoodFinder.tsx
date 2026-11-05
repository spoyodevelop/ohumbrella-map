import { useEffect, useState } from "react";
import type { CommutePlace } from "../../../shared/commute";
import { fetchJson } from "../../lib/http";
import { LocateIcon } from "./MapToolbar";

export function NeighborhoodFinder({
  onSelect,
  onLocate,
  isLocating,
}: {
  onSelect: (code: string) => void;
  onLocate: () => void;
  isLocating: boolean;
}) {
  const [regions, setRegions] = useState<CommutePlace[]>([]);
  const [searchError, setSearchError] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  useEffect(() => {
    let active = true;
    fetchJson<CommutePlace[]>("/map/regions.json")
      .then((items) => {
        if (active) setRegions(items);
      })
      .catch(() => {
        if (active) setSearchError(true);
      });
    return () => {
      active = false;
    };
  }, []);
  const words = query.trim().split(/\s+/).filter(Boolean);
  const matches = words.length
    ? regions
        .filter((region) => words.every((word) => region.name.includes(word)))
        .slice(0, 6)
    : [];
  function choose(region: CommutePlace) {
    setQuery("");
    setHighlight(0);
    onSelect(region.code);
  }

  return (
    <aside className="neighborhood-finder" aria-label="내 동네 기록 찾기">
      <h3>내 동네는 어땠을까?</h3>
      <p className="finder-intro">동네 이름으로 그곳의 기록을 찾아보세요.</p>
      <input
        className="finder-input"
        type="search"
        autoComplete="off"
        aria-label="동네 검색"
        placeholder="예: 마포구, 해운대구"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setHighlight(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") setQuery("");
          if (e.key === "ArrowDown" && matches.length) {
            e.preventDefault();
            setHighlight((i) => (i + 1) % matches.length);
          }
          if (e.key === "ArrowUp" && matches.length) {
            e.preventDefault();
            setHighlight((i) => (i + matches.length - 1) % matches.length);
          }
          if (e.key === "Enter" && matches[highlight]) {
            e.preventDefault();
            choose(matches[highlight]);
            e.currentTarget.blur();
          }
        }}
      />
      {query.trim() && (
        <ul className="finder-results" aria-label="동네 검색 결과">
          {matches.map((region, index) => (
            <li key={region.code}>
              <button
                type="button"
                className={index === highlight ? "is-highlighted" : ""}
                data-umami-event="region-select"
                data-umami-event-source="search"
                onClick={() => choose(region)}
              >
                {region.name}
              </button>
            </li>
          ))}
          {!matches.length && (
            <li className="finder-message">
              {searchError
                ? "검색을 불러오지 못했어요. 지도에서 동네를 눌러 보세요."
                : !regions.length
                  ? "동네 목록을 불러오는 중…"
                  : "일치하는 동네가 없어요."}
            </li>
          )}
        </ul>
      )}
      <button
        type="button"
        className="locate-button"
        data-umami-event="region-select"
        data-umami-event-source="locate"
        onClick={onLocate}
        disabled={isLocating}
      >
        <LocateIcon
          $spinning={isLocating}
          viewBox="0 0 24 24"
          width="15"
          height="15"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3m0 14v3M2 12h3m14 0h3" />
          <circle cx="12" cy="12" r="7" />
        </LocateIcon>
        {isLocating ? "위치 찾는 중…" : "내 위치로 찾기"}
      </button>
    </aside>
  );
}
