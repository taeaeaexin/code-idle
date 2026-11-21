// 토스 미니앱에서만 쓰는 기능을 게임 코드(번들러 없음)에서 부를 수 있게 window.TossBridge로 노출
import { share, saveBase64Data, openURL, setClipboardText, getTossShareLink } from '@apps-in-toss/web-framework';

window.TossBridge = {
  share,
  saveBase64Data,
  openURL,
  setClipboardText,
  // 토스 앱에서 이 게임을 바로 여는 공유 링크
  link: () => getTossShareLink('intoss://dev-idle').catch(() => ''),
};
