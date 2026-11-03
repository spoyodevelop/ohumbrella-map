import { Link } from "react-router";
import { CommuteExample } from "../commute/CommuteExample";

// 출퇴근 페이지가 지금 보여주는 결과 모양을 그대로 예시로 보여주고 넘겨준다.
export function CommuteTeaser() {
  return (
    <section
      className="commute-teaser"
      aria-labelledby="commute-teaser-heading"
    >
      <div className="teaser-copy">
        <h2 id="commute-teaser-heading">내 출퇴근길은 어떨까요?</h2>
        <p>
          집과 목적지, 나가고 돌아오는 시각을 정하면 오늘·내일 가는 길과 오는
          길의 강수확률을 보여드려요. 그 확률일 때 그 동네에 실제로 비가 온
          기록도 함께요.
        </p>
        <Link className="teaser-link" to="/commute">
          출퇴근길 우산 보기 <span aria-hidden="true">→</span>
        </Link>
      </div>
      <CommuteExample />
    </section>
  );
}
