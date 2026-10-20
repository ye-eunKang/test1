/* 색·시간·영상 경로·물고기 목록은 이 파일에서 수정하세요. */
window.FishConfig = {
  home: {
    fillLevel: .88,
    topColor: '#b8ffff', middleColor: '#88e9e7', bottomColor: '#4fd4d8',
    backColor: '#7adedd', wavePx: 8, waveSpeed: .7,
    springStrength: 25, damping: 6, maxTiltDeg: 100,
    bubbleCount: 7, bubbleSpeed: 10,
    pourRate: .22,             // 넘칠 때 초당 빠져나가는 물의 양(화면 전체 = 1)
    pourCompleteLevel: .35,    // 이 양 이하까지 줄고 S1_water가 끝나면 다음 영상
  },
  common: {
    finishWithButton: true,     // 시연용: 마지막 수평 감지 대신 물고기 보내기 버튼
    rotationSeconds: 30,        // 방사형 배경 한 바퀴 (느리고 부드럽게 계속 회전)
    levelTolerance: 12,         // 처음 수평 안내 단계의 허용 오차(도)
    levelHoldMs: 900,           // 수평을 유지하면 기다림 화면으로 진입
    stillTolerance: 2,          // 마지막 기다림: 이 범위 안의 잔떨림은 무시
    stillHoldMs: 3000,          // 기울기 변화가 없으면 영상 표시
    sensorGapMs: 700,           // 센서 신호가 끊기면 3초 측정 초기화
  },
  interactions: [
    {
      id: 'fish05', label: '5번 · 수도꼭지 / 해포리고기',
      videoSrc: 'assets/fish05-swim.mp4', // 폰의 물고기 수영 영상. 실제 파일명으로 변경
      game: {
        requiredTaps: 1,        // 업로드한 코드의 값 유지. 전시용 3회는 여기서 변경
        fillPauseMs: 650,
        tapTimes: [140,140,140,140,140,140,140,140],
        hoseTimes: [220,220,220,220,220,220,220,220,220],
      },
      assets: {
        introOne: 'assets/5_01-1.png', introTwo: 'assets/5_01-2.png',
        instruction: 'assets/5_02-멘트.png',
        rays: 'assets/5_back.png', fish: 'assets/5_03-물고기.png',
        fishName: 'assets/5_03-물고기이름.png',
        awakeMessage: 'assets/5_03-말풍선.png', levelMessage: 'assets/5_09-말풍선.png',
        waitingMessage: 'assets/5_10-말풍선.png', bubble: 'assets/5_10-공기방울.png',
      },
    },
    // 아직 이름/번호가 정해지지 않은 3개. 실제 작업할 때 id·label·assets를 수정하세요.
    // 해당 JS 모듈이 등록되기 전에는 실행 버튼이 비활성화됩니다.
    { id: 'extra01', label: '추가 물고기 1 · 준비 중', videoSrc: '', game: {}, assets: {} },
    { id: 'extra02', label: '추가 물고기 2 · 준비 중', videoSrc: '', game: {}, assets: {} },
    { id: 'extra03', label: '추가 물고기 3 · 준비 중', videoSrc: '', game: {}, assets: {} },
  ],
};
