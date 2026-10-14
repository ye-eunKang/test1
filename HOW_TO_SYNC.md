# 폰 + 아이패드 연동 적용

이 압축에는 바뀐 코드와 새 코드만 있습니다. 기존 assets와 CSS, 미니게임 파일은 그대로 두세요.
압축을 풀어 기존 프로젝트 최상위 폴더에 복사하고 같은 이름의 파일을 덮어쓰세요.
shared 폴더의 두 파일도 기존 shared 폴더 안으로 복사하세요.

## 연결된 순서

| 단계 | 폰 | 아이패드 |
|---|---|---|
| 기본 | 로고 + 안내 | S1_walk 반복 재생 |
| NFC 태그 | 물 주기 안내 | S1_water 첫 프레임에서 정지 |
| 기울임 감지 | GIF·안내 숨기고 물만 표시 | S1_water 재생, 기울임을 풀면 그 위치에서 정지 |
| 물 주기 성공 | 물 화면 유지 | S1_main 재생 |
| S1_main 종료 | 수도꼭지 미니게임 시작 | S1_ending 첫 프레임에서 정지 |
| 미니게임 성공 | 현재 화면에서 영상 종료 대기 | S1_ending 재생 |
| S1_ending 종료 | 물고기 등장 + 수평 안내 | S1_ending 마지막 프레임 유지 |
| 1차 수평 조건 | 기다림 화면 | 마지막 프레임 유지 |
| 수평 + 3초 정지 | 폰의 수영 영상 재생 | 마지막 프레임 유지 |
| 폰 수영 영상 종료 | 4초 후 홈 복귀 | TD 신호 중계 후 4초 후 S1_walk 복귀 |

물 주기 성공은 우선 **안내에 진입한 자세에서 45도 이상 기울여 1초 유지**로 설정했습니다.
S1_main이 끝나는 순간 미니게임을 시작합니다. 영상 길이를 타이머로 추정하지 않습니다.
수평은 화면이 위를 향하는 자세이며 beta/gamma가 각각 12도 이내인 조건입니다.
기다림에서는 수평과 3초 정지를 함께 충족해야 합니다. 신호가 끊기거나 화면을 이탈하면 측정이 초기화됩니다.

## 1. 영상 파일 넣기

assets 폴더에 아래 다섯 파일을 넣으세요. 영상은 이 압축에 포함하지 않았습니다.

- S1_walk.mp4
- S1_water.mp4
- S1_main.mp4
- S1_ending.mp4
- fish05-swim.mp4 — 폰의 물고기 수영 영상

실제 파일명이나 확장자가 다르면 바꾸는 곳은 다음과 같습니다.

| 바꿀 항목 | 수정할 파일 |
|---|---|
| 아이패드 영상 4개 경로 | sync-config.js → fish.fish05.display |
| 폰 수영 영상 경로 | config.js → fish05.videoSrc |
| 물 주기 시작/성공 각도와 유지 시간 | sync-config.js → pourStartDeg / pourSuccessDeg / pourHoldMs |
| 홈 복귀 시간 | sync-config.js → returnHomeMs |
| 수평 허용 각도, 수평 유지 및 정지 시간 | config.js → common.levelTolerance / levelHoldMs / stillHoldMs |
| 아이패드 영상 화면 맞춤 | display.css → object-fit (기본 contain, 화면을 채우려면 cover) |

파일명은 대소문자와 확장자가 모두 일치해야 합니다. iPad 영상은 기본 음소거입니다.
영상이 없거나 재생이 차단되면 종료 신호를 자동으로 만들지 않고 화면에서 대기합니다.

## 2. 현재 폰 주소를 유지하며 서버 배포

1. 이 코드와 영상을 기존 GitHub 저장소에 업로드하세요.
2. Render에서 같은 저장소로 **New → Web Service**를 만드세요. 기존 Static Site는 유지합니다.
3. 설정:
   - Language: Node
   - Root Directory: 기존 index.html이 저장소 최상위에 있으면 빈칸
   - Build Command: `npm ci`
   - Start Command: `npm start`
   - Health Check Path: `/health`
4. 새 서버의 배포가 끝나면 sync-config.js에서 serverUrl 한 곳에 **새 Web Service 주소**를 입력하세요.

```js
serverUrl: 'https://새서버주소.onrender.com',
```

5. 설정 파일을 GitHub에 반영해서 기존 Static Site와 새 Web Service를 모두 최신 상태로 배포하세요.
6. 기존 주소에서 폰·아이패드 페이지를 여세요. 두 페이지가 같은 serverUrl을 읽어야 합니다.

- 폰 기본 화면: https://phone-test-j8cg.onrender.com/
- NFC 기록 주소: https://phone-test-j8cg.onrender.com/?fish=fish05&phase=water
- 5번 아이패드: https://phone-test-j8cg.onrender.com/display.html?fish=fish05

아이패드에서는 전시 준비 때 **디스플레이 시작하기**를 한 번 누르세요.
폰에서는 **기울기 연결하기 → 허용** 후 테스트하세요.
현재 Static Site에 이 코드만 업로드하면 폰과 아이패드가 서로 연결되지 않습니다. 위 중계 서버까지 배포해야 합니다.

### 모든 페이지를 새 서버 한 곳에서 제공할 수도 있습니다

sync-config.js의 serverUrl을 빈 문자열로 유지하면 Node 서버가 페이지와 연결을 함께 제공합니다.
그 경우 위 접속 주소들의 도메인을 새 Web Service 도메인으로 바꾸세요. NFC도 새 주소로 다시 기록해야 합니다.

## 3. TouchDesigner 수신 연결

1. 바다 네트워크가 있는 COMP 안에 **WebSocket DAT**와 **Table DAT**를 추가하세요.
2. Table DAT 이름을 `fish_signal`로 바꾸세요.
3. WebSocket DAT의 Network Address에 `wss://새중계서버주소.onrender.com/exhibit`를 입력하고,
   Network Port를 `443`, Active를 On으로 설정하세요.
4. WebSocket DAT의 Callbacks DAT에 touchdesigner_callbacks.py의 내용을 붙여 넣으세요.
5. 폰 수영 영상 종료 시 fish_signal 표의 두 번째 행에 fish / signal / event_id / received_at 값이 들어옵니다.
   fish05는 기본 `fish05` 신호입니다. 기존 TD 물고기 등장 로직을 이 표의 변화에 연결하세요.

같은 완료 신호가 재연결 때문에 다시 오면 callback이 중복 실행을 막습니다.
TD가 잠시 끊긴 경우 서버는 60초 동안 완료 신호를 보관하며 재접속 때 전달합니다.
실제 TouchDesigner 프로젝트는 첨부되지 않았으므로 기존 물고기 노드와의 연결은 위 표에서 이어야 합니다.

## 4. 다음 물고기 추가

기존 구조대로 config.js에 해당 물고기를 등록하고 interactions/에 미니게임 모듈을 추가하세요.
모듈은 완료 시 `flow.complete()`를 호출합니다.
sync-config.js의 fish에 **같은 id**로 영상 네 개와 tdSignal을 추가하세요.
아이패드는 display.html?fish=그id, NFC는 ?fish=그id&phase=water를 사용합니다.
신호는 같은 id끼리 전달됩니다. 아이패드 하나만 한 id에 연결하세요.

## PC에서 확인

프로젝트 폴더에서 `npm ci` 후 `npm start`를 실행합니다.
serverUrl은 빈 문자열로 둡니다. http://localhost:3000/와
http://localhost:3000/display.html?fish=fish05를 각각 열 수 있습니다.
폰의 편집 패널에 있는 NFC 태그 미리보기로 태그 안내를 확인할 수 있습니다.
실제 각도는 HTTPS로 배포한 사이트를 아이폰 Safari에서 테스트하세요.

## 검증 범위

자동 검증: 폰·아이패드 전체 상태 전환, 영상 종료 전 대기, 수평 정지,
방별 분리, 잘못된 순서 및 이전 세션 신호 차단, 연결 복구,
TD 신호 중복 방지·수신 확인, 4초 복귀, Safari용 영상 Range 응답.
자동 검증에서는 센서 값과 HTML 영상 종료 이벤트를 모의 입력했습니다.
실제 영상·아이폰·아이패드·TouchDesigner 설치 환경의 재생 검증은 아직 수행하지 않았습니다.
Render 서버가 재시작되면 메모리의 진행 상태는 기본 화면으로 초기화됩니다.

참고: [Render WebSockets](https://render.com/docs/websocket),
[Safari 영상 재생](https://developer.apple.com/documentation/webkit/delivering-video-content-for-safari),
[TouchDesigner WebSocket DAT](https://derivative.ca/UserGuide/WebSocket_DAT).
