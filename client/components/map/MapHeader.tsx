import type { SurpriseRainResponse } from "../../api/surpriseRain";
import { StoryNumbers, type RainStory } from "./RainStories";

export function MapHeader({
  story,
  data,
  errorMessage,
  onSelect,
}: {
  story?: RainStory;
  data: SurpriseRainResponse | null;
  errorMessage: string;
  onSelect: (code: string) => void;
}) {
  return (
    <header className="rain-hero">
      <div className="hero-copy">
        <h1>
          아 맞다 <span>우산</span>
        </h1>
        <p className="hero-description">
          강수확률 {data?.maxPop ?? 20}% 이하였는데
          <br />
          비가 온 기록을 모았어요.
        </p>
        <a className="explore-link" href="#rain-map">
          지도에서 보기 <span aria-hidden="true">↓</span>
        </a>
      </div>
      <section className="featured-story" aria-label="대표 관측 기록">
        <div className="featured-top">
          <span className="record-stamp">예보와 실제 강수량</span>
          <span className="rain-mark" aria-hidden="true">
            ☂
          </span>
        </div>
        {story ? (
          <>
            <p className="featured-place">{story.name}</p>
            <p className="featured-time">
              <time>{story.time}</time> · KST 관측
            </p>
            <StoryNumbers story={story} />
            <button
              className="featured-link"
              onClick={() => onSelect(story.code)}
            >
              이 동네 기록 보기 <span aria-hidden="true">↗</span>
            </button>
            <p className="featured-caption">
              {/^(11|31)/.test(story.code) ? "서울·경기" : "전국"}의 최근 관측
              시각 기록 중 강수량이 큰 사례예요.
            </p>
          </>
        ) : (
          <div className="featured-empty" role="status">
            <h2>
              {errorMessage
                ? "기록을 잠시 불러올 수 없어요."
                : data
                  ? "이 기간에는 해당 기록이 없어요."
                  : "기록을 불러오는 중이에요."}
            </h2>
            <p>
              {errorMessage
                ? "잠시 후 새로고침해 주세요."
                : "기상청 예보와 시간별 강수 관측을 비교합니다."}
            </p>
          </div>
        )}
      </section>
    </header>
  );
}
