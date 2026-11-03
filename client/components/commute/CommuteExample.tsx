import "./commute.css";

// 출퇴근 결과 화면의 실제 문구로 만든 예시. 메인 소개 띠와 설정 전 출퇴근 화면이 같이 쓴다.
export function CommuteExample() {
  return (
    <div className="commute-example" aria-label="출퇴근 결과 예시">
      <span className="commute-example-badge">예시</span>
      <p className="commute-example-advice">우산 없이 나가도 괜찮겠어요</p>
      <p className="commute-example-line">
        <span>오는 길 강수확률 30%</span>
        <strong>비가 실제로는 10번 중 1번도 안 왔어요</strong>
      </p>
    </div>
  );
}
