// 토스 미니앱에서만 쓰는 기능을 게임 코드(번들러 없음)에서 부를 수 있게 window.TossBridge로 노출
import { share, saveBase64Data, openURL, setClipboardText, getTossShareLink, Game, SafeArea } from '@apps-in-toss/web-framework';

// 토스 앱은 화면 맨 위(상태 표시줄)까지 그리고, 오른쪽 위에 닫기 버튼(... X)을 띄움
// 상태 표시줄 높이를 CSS 변수로 넘겨서 게임 상단을 그만큼 내림
function applySafeArea(i) {
  const s = document.documentElement.style;
  s.setProperty('--sat', (i && i.top ? i.top : 0) + 'px');
  s.setProperty('--sab', (i && i.bottom ? i.bottom : 0) + 'px');
}
document.documentElement.classList.add('in-toss');
try { applySafeArea(SafeArea.get()); SafeArea.subscribe({ onEvent: applySafeArea }); } catch (e) { applySafeArea(null); }

window.TossBridge = {
  share,
  saveBase64Data,
  openURL,
  setClipboardText,
  // 토스 앱에서 이 게임을 바로 여는 공유 링크
  // 리더보드: 엔딩까지 걸린 시간(분)을 올리고, 순위 화면 열기
  submitScore: (score) => Game.setLeaderboardScore({ score: String(score) }).catch(() => undefined),
  openRanking: () => Game.openLeaderboard().catch(() => {}),
  link: () => getTossShareLink('intoss://dev-idle').catch(() => ''),
};
