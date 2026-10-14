# 물고기는 어디에 — 홈 + 5번 + 추가 3개를 위한 통합 코드

업로드한 최신 5번 코드와 에셋을 기준으로 통합했습니다.
하나의 `index.html`이 홈·미니게임·물고기 소개·기다림·영상을 모두 표시합니다.
화면을 바꿀 때 페이지를 새로 불러오지 않으며, 센서 권한 연결도 공유합니다.
홈의 타이포와 안내 그래픽은 아직 넣지 않았습니다.
다른 3개의 게임은 아직 제작되지 않았고 등록 자리를 준비했습니다.

## 실행하기

1. 압축을 풀고 `fish-app` 폴더를 VS Code에서 엽니다.
2. `index.html`을 우클릭해 Open with Live Server로 실행합니다.
3. 기본 주소는 청록색 물 배경 홈입니다.
4. PC 오른쪽 편집 패널에서 `5번 · 수도꼭지 / 해포리고기`를 누르면 시작합니다.
5. 3초 후 수도꼭지 화면으로 넘어갑니다.
6. 업로드한 최신 값에 맞춰 수도꼭지는 현재 **1회**입니다. 전시용 3회는 config.js의 requiredTaps를 3으로 수정하세요.
7. PC에서는 소개 화면의 `PC 미리보기 · 수평으로 들기`로 기다림 화면에 진입합니다.
8. 기다림 화면의 `PC 미리보기 · 3초 정지`를 누르면 3초 후 물고기 그림이 나옵니다.
9. 영상이 아직 등록되지 않아 임시 그림을 4.5초 표시한 후 홈으로 돌아갑니다.

휴대폰은 HTTPS 배포 주소에서 실행하고 필요하면 `기울기 연결하기`를 누르세요.
실제로는 수평을 0.9초 유지하면 기다림 화면, 기울기가 3초간 거의 변하지 않으면 엔딩으로 넘어갑니다.
기다림 단계에서는 기울어진 각도여도 3초간 고정하면 통과합니다. 잔떨림은 2도까지 허용합니다.
센서 신호가 끊긴 상태는 성공으로 보지 않습니다.
휴대폰 편집 도구는 `?debug=1`로 켤 수 있습니다. 일반 방문자 화면에는 보이지 않습니다.

## 접속 주소 / NFC

| 주소 예 | 열리는 화면 |
| --- | --- |
| `/` 또는 `/index.html` | 공통 홈 |
| `/?fish=fish05` | 5번 말풍선 → 수도꼭지 |
| `/?fish=fish05&debug=1` | 5번 + 휴대폰에서도 편집 패널 |
| `/?fish=fish05&preview=reveal&debug=1` | 편집용 물고기 소개 바로 보기 |
| `/?fish=fish05&preview=ocean&debug=1` | 편집용 기다림 화면 바로 보기 |

NFC에는 `https://서비스주소.onrender.com/?fish=fish05` 같은 주소를 넣으면 됩니다.
`?interaction=fish05`도 지원합니다. 그 외 ID는 config.js의 목록과 등록된 JS 모듈이 일치해야 합니다.
등록되지 않은 ID는 준비 중이라는 안내를 띄우고 홈에 머뭅니다.
엔딩 후에는 URL에서 물고기/미리보기 지정도 지워, 새로고침하더라도 홈을 보여줍니다.

## 파일 역할

| 파일 | 수정하는 내용 |
| --- | --- |
| index.html | 홈 콘텐츠, 각 게임 화면, 공통 소개·기다림·영상 화면 |
| style.css | 업로드한 5번의 위치·색·크기와 공통 엔딩 디자인 |
| home.css | 홈 물 배경 레이어, PC 편집 패널 |
| config.js | 물 색·양, 시간, 횟수, 각 물고기의 이미지·영상 경로 |
| app.js | 공통 화면 전환, 수평/정지 감지, 영상 종료 후 홈 복귀 |
| interactions/fish05.js | 5번 수도꼭지 미니게임의 동작 |
| water-background.js | 홈 물의 출렁임 계산과 그리기 |
| shared/motion.js | 한 번 연결한 센서를 모든 게임이 공유 |
| shared/stillness.js | 미세한 떨림을 허용하는 3초 정지 감지 |
| shared/run-scope.js | 게임을 벗어날 때 타이머와 이벤트 취소 |
| boot.js | 게임 등록 뒤 실행. script 목록 마지막에 유지 |
| examples/new-interaction.example.js | 남은 3개를 추가할 때 참고할 게임 등록 틀 |
| assets/ | 업로드한 PNG와 수도꼭지·호스 프레임. 내용 그대로 유지 |

통합하면서 수정한 동작 오류:

- 방사형 CSS의 중괄호와 회전 시간 0s를 수정했습니다. 기본은 느린 30초 회전입니다.
- 사라진 bubble.svg 대신 업로드한 5_10-공기방울.png를 사용합니다.
- 등장 말풍선은 5.1초 보여준 뒤 수평 안내로 바꿉니다. 기존 0.55초 대기는 등장 애니메이션보다 짧아 문구가 보이지 않는 문제를 일으켰습니다.
- 게임 도중 또는 엔딩에서 홈으로 돌아가면 모든 이전 대기 작업이 취소됩니다.
- 영상이 끝나면 모든 게임이 같은 홈으로 돌아갑니다.

## 나중에 영상 넣기

`config.js`에서 해당 물고기의 videoSrc만 바꾸세요.

```js
videoSrc: 'assets/fish05-swim.mp4',
```

영상은 아직 제공되지 않았습니다. 현재는 원본 물고기 그림으로 흐름을 확인하는 임시 엔딩입니다.
실제 영상 등록 후에는 그림 대신 영상을 한 번 재생하고, ended 이벤트가 오면 홈으로 복귀합니다.
영상 재생이 거절되면 재생 버튼을 표시하고, 파일 오류면 경로 확인 안내와 홈 버튼을 표시합니다.
영상의 길이, 위→아래 움직임, 폰 비율은 실제 파일을 넣은 뒤 확인하세요.

각 영상은 반복(loop)으로 재생하지 않습니다.
이 통합 앱에서는 별도 return-home.js나 home.js를 추가로 로드하지 마세요.
그 역할을 app.js가 이미 담당하므로 중복 연결할 필요가 없습니다.

## 남은 3개 게임 추가하기

config.js에 extra01, extra02, extra03을 등록 자리로 두었습니다.
정확한 물고기 번호를 아직 지정하지 않아 임의의 번호를 가정하지 않았습니다.
필요하면 ID를 fish01, fish02 등 원하는 이름으로 바꾸고 JS 등록 ID도 맞춰주세요.

1. `config.js`의 항목에 이름·게임 설정·물고기 소개 에셋·마지막 영상 경로를 넣습니다.
2. `index.html`의 `interactionScreen` 안에 게임 화면 영역을 추가합니다.
3. `examples/new-interaction.example.js`를 `interactions/extra01.js`로 복사하고 실제 게임 동작으로 수정합니다.
4. `index.html`의 script 목록에 새 파일을 추가합니다. **app.js 다음, boot.js 이전**에 둡니다.
5. 게임 성공 시 `flow.complete()`를 호출하면 공통 물고기 소개 → 수평 → 정지 → 엔딩 → 홈으로 이어집니다.

화면 영역의 최소 예시:

```html
<div id="extra01View" class="interaction-view" hidden>
  <!-- 이 부분을 실제 미니게임 UI로 바꾸세요 -->
  <button data-complete>게임 성공 확인</button>
</div>
```

스크립트 연결 예시:

```html
<script src="app.js" defer></script>
<script src="interactions/fish05.js" defer></script>
<script src="interactions/extra01.js" defer></script>
<script src="boot.js" defer></script>
```

필요한 공통 이미지:
`rays`, `fish`, `fishName`, `awakeMessage`, `levelMessage`, `waitingMessage`, `bubble`.
각 물고기에 맞는 PNG/SVG 경로를 해당 항목의 assets에 적습니다.
새 에셋 이름에는 #을 넣지 않거나, 경로에서 %23으로 인코딩하세요.

### 게임 모듈의 약속

```js
FishApp.registerInteraction('extra01', {
  viewId: 'extra01View',
  mount(root, flow) {
    // DOM은 root.querySelector(...)로 찾습니다.
    // 다른 게임과 동일한 id를 중복 작성하지 말고, data-role 또는 고유 id를 사용하세요.
    return {
      start() { /* 시작 */ },
      stop() { /* 타이머·이벤트·루프 취소 */ },
      reset() { /* 점수·아이템·위치·선택·영상 초기화 */ },
    };
  },
});
```

- `flow.complete()` — 게임 성공, 공통 소개 화면으로 진행
- `flow.returnHome()` — 즉시 공통 홈 복귀
- `flow.announce('문구')` — 화면 읽기용 상태 안내
- `flow.config` — 이 게임의 config.js 항목
- `flow.motion.subscribe(callback)` — 공유 센서 받기. 반드시 stop 때 해제

센서·이벤트·타이머를 안전하게 사용하려면:

```js
const scope = new RunScope();
scope.listen(button, 'click', handler);
scope.cleanup(flow.motion.subscribe(onTilt));
if (await scope.delay(1000)) { /* 아직 같은 게임이면 실행 */ }
// stop에서는 scope.abort();
```

게임별 CSS는 `#extra01View ...`처럼 자기 영역에 한정합니다.
소개 화면의 물고기 크기를 각기 다르게 하려면 다음처럼 지정할 수 있습니다.

```css
#stage[data-fish="extra01"] #fish { width: 50%; }
```

현재 3개 버튼은 비활성 상태입니다. 실제 JS 모듈을 등록하면 자동으로 활성화됩니다.
없는 게임을 임의의 공통 게임으로 실행하지 않습니다.

## 디자인 수정 / 빠른 미리보기

말풍선·물고기 위치는 기존 선택자 `.intro-one`, `.intro-two`, `.fish`, `.awake`, `.level`, `.waiting`에서 수정합니다.
현재 변경한 PNG 파일명·좌표·물방울 색은 유지했습니다.
홈 물 높이와 색은 config.js의 home 항목에서 수정합니다.
타이포와 안내 페이지를 만들 때는 `index.html`의 `homeContent`에 추가하세요.

PC 편집 패널의 `물고기 소개`, `기다림 화면` 버튼을 누르면 해당 장면으로 바로 이동합니다.
편집 장면의 URL 지정이 남아 Live Server 새로고침 후에도 해당 장면을 볼 수 있습니다.
`홈`을 누르면 지정이 초기화됩니다.

## GitHub / Render

압축 안의 `fish-app` 폴더 **내용물**을 저장소에 올리세요.
`index.html`, `config.js`, `app.js`, `style.css`, `home.css`와 assets/shared/interactions 폴더가 같은 프로젝트 안에 있어야 합니다.
저장소 최상위에 index.html을 두었다면 기존 Static Site의 Publish Directory `./`를 그대로 씁니다.
폴더 자체를 통째로 올려 fish-app/index.html 구조가 됐다면 Root Directory를 fish-app으로 설정해야 합니다.

이 코드는 브라우저 화면을 담당합니다.
Render의 Node.js 통신 서버나 TouchDesigner로 실제 메시지를 보내는 연결은 아직 하지 않았습니다.
`fish:waiting`, `fish:finished`, `fishhome:show`는 같은 웹페이지 내부 이벤트입니다.

## 검증 범위

코드 수준에서 다음을 확인했습니다:
기본 홈 진입, 3초 안내, 중복 터치 방지, 소개 문구 표시,
수평 유지, 3초 정지(움직임·센서 끊김 시 재측정), 임시 엔딩과 실제 영상 종료 이벤트 후 복귀,
도중 취소와 반복 시작, 오래된 타이머/영상 이벤트 제거, 다른 게임 등록, 준비 중 주소 처리.
에셋 바이트 유지, 파일 경로, 중복 id, HTML 구조, CSS 중괄호도 확인했습니다.
실제 아이폰 센서, 최신 브라우저에서의 화면 배치와 실제 물고기 영상은 실기기에서 확인이 필요합니다.
