// 토스 미니앱에서만 쓰는 기능을 게임 코드(번들러 없음)에서 부를 수 있게 window.TossBridge로 노출
import { share, saveBase64Data, openURL, setClipboardText, getTossShareLink, Game } from '@apps-in-toss/web-framework';

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
