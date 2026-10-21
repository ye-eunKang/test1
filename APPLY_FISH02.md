# 2번 NFC / LP / 도루묵 흐름

압축을 푼 파일을 기존 프로젝트의 같은 경로에 덮어쓰고, assets와 interactions 폴더는 기존 폴더에 합쳐주세요.
server.js와 display.js도 함께 적용한 뒤 GitHub Desktop에서 Commit → Push하세요.
Render 배포가 끝나면 폰과 아이패드를 모두 새로고침하고, 실제 아이패드에서 '디스플레이 시작하기'를 눌러주세요.
마지막으로 시작 버튼을 누른 디스플레이가 해당 물고기의 영상 전환을 담당합니다.

## 주소

- 2번 NFC에 쓸 주소: https://test1-e3hn.onrender.com/?fish=fish02&phase=water
- 2번 아이패드 주소: https://test1-e3hn.onrender.com/display.html?fish=fish02
- 게임만 빠르게 확인: https://test1-e3hn.onrender.com/?fish=fish02
- PC 기울기 슬라이더: https://test1-e3hn.onrender.com/?fish=fish02&debug=1

## 순서

1. NFC → 폰의 물 붓기와 아이패드 water 영상 연결.
2. 물이 모두 빠지고 water 영상도 끝나면 main 영상 재생.
3. main이 실제로 끝나면 폰 LP 안내 화면. 터치로 말풍선 두 장을 넘김.
4. LP 중심 유지 게임. 폰 좌우 기울기가 ±8도 안인 상태를 연속 3초 유지하면 성공.
5. 성공 → 아이패드 ending 영상 전체 재생. 그동안 폰은 성공한 게임 화면 유지.
6. ending 종료 → 도루묵 이름·물고기·방사형 배경 등장.
7. 기존 공통 안내와 기울임·수평 유지·3초 기다림 → TouchDesigner fish02 신호 1회 → 폰·아이패드 홈 복귀.

범위를 벗어나거나 센서가 0.7초 이상 끊기거나 다른 앱으로 이동하면 중심 유지 시간이 초기화됩니다.
폰에는 별도의 기울기 연결 버튼을 추가하지 않았습니다. iOS가 권한을 요구하면 기존 화면 터치에서 요청합니다.

## 각도 / 시간 / 레이아웃 수정

config.js의 fish02.game:

```js
balanceTolerance: 8,    // 좌우 허용 각도
balanceHoldMs: 3000,    // 중심 유지 시간(ms)
successPauseMs: 650,    // 성공 문구를 보여주는 시간(ms)
```

style.css 위쪽의 '2번 LP' 영역에서 크기와 위치를 바꿀 수 있습니다.

- .lp-card: 게임 프레임 전체 위치·너비
- #lpRecord: LP 위치·너비
- #stage[data-fish="fish02"] .fish-name: 이름
- #stage[data-fish="fish02"] #fish: 도루묵
- #stage[data-fish="fish02"] .awake / .level: 말풍선
- #stage[data-fish="fish02"] #rays: 방사형 배경

첨부 원본의 디자인을 사용하며, 모바일 메모리 사용을 줄이도록 PNG 해상도를 조정했습니다.
첨부 ZIP 안의 중복 S1_game.zip은 1번 자료여서 2번 구현에는 포함하지 않았습니다.

## 2번 아이패드 전용 영상

첨부 파일과 현재 배포에는 S2_walk / S2_water / S2_main / S2_ending 영상이 없습니다.
전체 플로우를 바로 테스트할 수 있도록 지금은 2번 방에 S1 영상을 임시로 연결했습니다.
2번 전용 영상 준비 후 sync-config.js의 fish02.display 경로 네 개만 바꾸세요.
다른 물고기 방과 2번 방의 게임 진행·성공 신호는 분리되어 있습니다.

## 공통 영상 전환 문제 수정

- 종료 이벤트가 와도 실제 영상 주소·재생 시작·끝 위치가 맞는 경우에만 다음 장면으로 전환.
- 새 탭을 여는 것만으로 실제 아이패드의 재생 권한을 가져가지 않음.
- 실제 시작 버튼을 누른 디스플레이의 종료 신호만 서버에서 반영.
- main과 게임 MP4와 ending의 종료를 각각 구분. 1번은 게임 MP4 → ending → 폰 물고기 화면 순서 유지.
- 현재 교체된 S1_ending은 3840×2880, 약 90MB입니다. 웹용 1440×1080 H.264/AAC 파일(약 2.5MB)을 S1_ending_web.mp4로 포함했습니다.
- sync-config.js는 웹용 엔딩 파일을 사용합니다. 원본 영상 파일은 보관해도 됩니다.
- 파일 교체 후 예전 MP4가 남지 않도록 영상 응답의 캐시 설정도 조정했습니다.

## 검증

로컬 서버와 미디어 모의 재생으로 1번·2번·5번의 NFC부터 홈 복귀까지, LP 중심 유지와 재시작,
잘못된 종료 신호·다른 디스플레이의 신호 차단, 게임 MP4 → ending 연결, TouchDesigner 신호 1회를 확인했습니다.
수정 전 코드에서 너무 이른 종료 이벤트로 main을 건너뛰는 경로를 재현하고 수정 후 차단되는 것을 확인했습니다.
레이아웃은 첨부 이미지를 사용한 정적 합성으로 확인했습니다.
실제 버디3·아이패드의 재생 성능과 센서 사용감은 배포 후 기기에서 확인해주세요.
