import { useEffect, useState } from "react";
import { TRAVEL_HOURS, type CommutePlace } from "../../../shared/commute";
import type { useCommuteSettings } from "../../hooks/useCommuteSettings";
import { useCommuteForecast } from "../../hooks/useCommuteForecast";
import { fetchJson } from "../../lib/http";
import { CommuteForecast } from "./CommuteForecast";
import "./commute.css";

export type PlaceTarget = "home" | "work";
export function CommuteSettings({
  settings,
  activePlace,
  onActivate,
  onChoose,
}: {
  settings: ReturnType<typeof useCommuteSettings>;
  activePlace: PlaceTarget | null;
  onActivate: (target: PlaceTarget | null) => void;
  onChoose: (target: PlaceTarget, place: CommutePlace) => void;
}) {
  const { saved, draft, setDraft, save, storageError } = settings;
  const { data, loading, error } = useCommuteForecast(saved);
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
        .slice(0, 8)
    : [];
  const changed = JSON.stringify(draft) !== JSON.stringify(saved);
  return (
    <aside className="commute-panel" aria-label="외출 날씨">
      <div className="commute-controls">
        <h2>외출 날씨</h2>
        <div className="commute-travel">
          <label htmlFor="commute-travel">이동 시간</label>
          <select
            id="commute-travel"
            value={draft.travelHours}
            onChange={(e) =>
              setDraft((s) => ({ ...s, travelHours: Number(e.target.value) }))
            }
          >
            {TRAVEL_HOURS.map((hours) => (
              <option key={hours} value={hours}>
                {hours}시간
              </option>
            ))}
          </select>
        </div>
        <div className="commute-fields">
          {(["home", "work"] as const).map((key) => (
            <div
              className={`commute-row ${activePlace === key ? "is-active" : ""}`}
              key={key}
            >
              <label htmlFor={`commute-${key}`}>
                {key === "home" ? "집" : "목적지"}
              </label>
              <input
                id={`commute-${key}`}
                type="search"
                autoComplete="off"
                placeholder={draft[key]?.name ?? "지역 선택"}
                value={activePlace === key ? query : (draft[key]?.name ?? "")}
                onFocus={() => {
                  if (activePlace !== key) {
                    setQuery("");
                    setHighlight(0);
                    onActivate(key);
                  }
                }}
                onClick={() => {
                  if (activePlace !== key) {
                    setQuery("");
                    setHighlight(0);
                    onActivate(key);
                  }
                }}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setHighlight(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    onActivate(null);
                    e.currentTarget.blur();
                  }
                  if (e.key === "ArrowDown" && matches.length) {
                    e.preventDefault();
                    setHighlight((i) => (i + 1) % matches.length);
                  }
                  if (e.key === "ArrowUp" && matches.length) {
                    e.preventDefault();
                    setHighlight(
                      (i) => (i + matches.length - 1) % matches.length,
                    );
                  }
                  if (e.key === "Enter" && matches[highlight]) {
                    e.preventDefault();
                    onChoose(key, matches[highlight]);
                    e.currentTarget.blur();
                  }
                }}
              />
              <select
                aria-label={key === "home" ? "나가는 시각" : "돌아오는 시각"}
                value={key === "home" ? draft.homeHour : draft.workHour}
                onChange={(e) =>
                  setDraft((s) => ({
                    ...s,
                    [key === "home" ? "homeHour" : "workHour"]: Number(
                      e.target.value,
                    ),
                  }))
                }
              >
                {Array.from({ length: 24 }, (_, hour) => (
                  <option key={hour} value={hour}>
                    {String(hour).padStart(2, "0")}시
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
        {activePlace && (
          <div className="commute-picker">
            <div className="commute-hint">
              <span>
                {activePlace === "home" ? "집" : "목적지"} 지역을 검색하거나
                지도에서 선택하세요.
              </span>
              <button type="button" onClick={() => onActivate(null)}>
                취소
              </button>
            </div>
            {query.trim() && (
              <ul className="commute-search" aria-label="지역 검색 결과">
                {matches.map((region, index) => (
                  <li key={region.code}>
                    <button
                      type="button"
                      className={index === highlight ? "is-highlighted" : ""}
                      onClick={() => onChoose(activePlace, region)}
                    >
                      {region.name}
                    </button>
                  </li>
                ))}
                {!matches.length && (
                  <li className="commute-search-message">
                    {searchError
                      ? "검색을 불러오지 못했어요. 지도에서 선택해주세요."
                      : !regions.length
                        ? "지역을 불러오는 중…"
                        : "일치하는 지역이 없어요."}
                  </li>
                )}
              </ul>
            )}
          </div>
        )}
        <button
          className="commute-submit"
          type="button"
          disabled={!draft.home || !draft.work}
          onClick={() => {
            onActivate(null);
            save();
          }}
        >
          날씨 확인
        </button>
        {storageError && <p role="status">{storageError}</p>}
      </div>
      <div className="commute-output">
        {loading && <p role="status">예보를 확인하고 있어요…</p>}
        {error && <p role="alert">{error}</p>}
        {data && (
          <>
            {changed && (
              <p>설정이 바뀌었어요. 날씨 확인을 눌러 갱신해주세요.</p>
            )}
            <CommuteForecast key={data.fetchedAt} data={data} />
          </>
        )}
      </div>
    </aside>
  );
}
