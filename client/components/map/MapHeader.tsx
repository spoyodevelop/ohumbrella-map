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
        <p className="section-kicker">아 맞다 우산의 뜻밖의 비 수집</p>
        <h1>
          아니 땐{" "}
          <span>
            비<i aria-hidden="true">!</i>
          </span>
        </h1>
        <p className="hero-description">
          비 올 확률은 낮았는데,
          <br />
          정말 비가 온 순간들.
        </p>
        <a className="explore-link" href="#rain-map">
          어디에 왔을까? <span aria-hidden="true">↓</span>
        </a>
      </div>
      <section className="featured-story" aria-label="대표 관측 기록">
        <div className="featured-top">
          <span className="record-stamp">그런데, 비가 왔다.</span>
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
                  ? "다음 뜻밖의 비를 기다리는 중."
                  : "뜻밖의 비를 찾고 있어요."}
            </h2>
            <p>
              {errorMessage
                ? "잠시 후 새로고침해 주세요."
                : "낮은 강수확률의 예보와 실제 관측을 함께 모읍니다."}
            </p>
          </div>
        )}
      </section>
    </header>
  );
}
