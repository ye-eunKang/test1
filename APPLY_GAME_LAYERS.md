# 1번 아이패드 게임 화면 수정

## 적용

압축을 푼 뒤 아래 4개 파일을 프로젝트의 같은 위치에 덮어쓰세요.

- display.html
- display.css
- display.js
- sync-config.js

assets 폴더는 기존 폴더에 합치고 아래 3개 파일을 추가하세요.

- assets/S1_game_back.gif
- assets/S1_gamevideo_downgrade.mp4
- assets/S1_game_back_graphic.gif

GitHub Desktop에서 Commit → Push하고 Render 배포가 끝나면 아이패드 페이지를 새로고침하세요.

1번 아이패드 주소: https://test1-e3hn.onrender.com/display.html?fish=fish01

폰에서 전체 흐름 시작: https://test1-e3hn.onrender.com/?fish=fish01&phase=water

## 동작

기존 S1_walk → S1_water → S1_main 순서는 그대로입니다.

S1_main 종료 후 폰에서 접시 게임이 시작되면 아이패드는 다음 순서로 합성됩니다.

1. 맨 아래: S1_game_back.gif
2. 중앙: S1_gamevideo_downgrade.mp4
3. 맨 위: S1_game_back_graphic.gif

GIF는 반복 재생하며, MP4는 첫 프레임에서 대기합니다.
폰에서 접시 3개를 쌓으면 MP4를 정상 속도로 한 번 재생합니다.
실제 영상 종료 이벤트가 발생한 뒤 기존 다음 단계인 폰의 물고기 등장 장면으로 넘어갑니다.
별도의 S1_ending 영상을 한 번 더 재생하지 않습니다.
그 뒤 기존 기울임·수평 유지·홈 복귀 흐름이 이어집니다.

아이패드는 물고기 안내 중에도 GIF와 MP4의 마지막 화면을 유지하고, 완료하면 S1_walk로 돌아갑니다.
5번 물고기는 기존 S1_ending.mp4를 사용하는 설정을 유지합니다.

## 중앙 영상 크기

display.css의 다음 두 값을 같은 비율로 바꾸면 됩니다.

```css
#displayStage[data-layered="true"] {
  --game-video-width:72%;
  --game-video-height:72%;
}
```

전체 합성은 원본의 4:3 비율을 유지하고 화면 가운데 배치합니다.
GIF 두 장은 상태가 바뀔 때마다 src를 다시 설정하거나 요소를 새로 만들지 않습니다.
첨부 에셋은 재인코딩하지 않고 그대로 포함했습니다.
두 원본 GIF의 첫 프레임은 완전히 투명하므로 반복 경계에서 배경·장식이 0.04초 비어 보이는 부분은 원본에 포함되어 있습니다.

## 확인한 항목

로컬 중계 서버와 미디어 모의 재생으로 전체 NFC 흐름, 접시 3개 성공 전 MP4 정지,
성공 시 1회 재생, 영상 종료 후 폰 물고기 전환, 자동 홈 복귀, 1번·5번 방 분리를 확인했습니다.
실제 iPad Safari에서의 재생 성능은 배포 후 기기에서 확인해야 합니다.
