/* 색·시간·영상 경로·물고기 목록은 이 파일에서 수정하세요. */
window.FishConfig = {
  home: {
    fillLevel: .88,
    topColor: '#b8ffff', middleColor: '#88e9e7', bottomColor: '#4fd4d8',
    backColor: '#7adedd', wavePx: 8, waveSpeed: .7,
    springStrength: 22, damping: 9, maxTiltDeg: 100,
    bubbleCount: 7, bubbleSpeed: 10,
    pourRate: .22,             // 물이 가장자리에 닿기 시작할 때의 기본 배출 속도
    pourBoost: 1.2,              // 많이 기울여 넘치는 물이 많으면 배출이 빨라집니다.
    pourCompleteLevel: 0,      // 물이 모두 빠지고 S1_water도 끝나면 다음 영상
  },
  common: {
    revealChangeDeg: 20,       // 5_09: 안내가 뜬 순간보다 이 각도 이상 움직이면 다음 화면
    revealChangeHoldMs: 200,   // 각도 변화 확인 시간
    finishGifSrc: 'assets/phone-finish.gif', // 마지막에 한 번 재생. 물고기별 assets.finishGif로 따로 지정 가능
    finishReturnMs: 3000,      // 정지 이미지이거나 GIF를 못 불러왔을 때만 사용하는 대기 시간
    rotationSeconds: 30,        // 방사형 배경 한 바퀴 (느리고 부드럽게 계속 회전)
    levelTolerance: 12,         // 5_10: 수평 허용 오차(도)
    levelHoldMs: 900,           // 5_10: 이 시간 동안 수평이면 말풍선을 숨깁니다.
    stillTolerance: 2,          // 다른 게임의 정지 감지용 값
    stillHoldMs: 3000,          // 다른 게임용. 이번 홈 복귀 시간은 finishReturnMs에서 조정
    sensorGapMs: 700,           // 센서가 이 시간 이상 끊기면 수평·기울기 판정을 다시 시작
  },
  interactions: [
    {
      id: 'fish01', label: '1번 · 접시 / 흰동가리', videoSrc: '',
      game: {
        pickupHoldMs: 450,    // 사진을 이 시간 동안 꾹 누른 뒤, 손을 떼지 않고 끌어갑니다.
        pickupMovePx: 12,     // 꾹 누르는 동안 허용하는 손 떨림(CSS px)
        minCarryMs: 1100,      // 한 접시를 최소 1.1초 동안 천천히 옮깁니다.
        maxSpeed: .95,        // 초당 화면 높이의 0.95배. 클수록 빠른 이동을 허용합니다.
        speedGraceMs: 140,    // 잠깐의 손 떨림은 허용합니다.
        settleMs: 380, successPauseMs: 650,
        platformSurfaceY: 395/633, // 받침 이미지 윗면의 앞쪽 경계(0~1)
        platformInsetPx: 2,       // 접시를 경계보다 조금 안쪽에 놓는 거리
        // 원래 접시 번호 3→1→2 = 첨부한 layer1→layer2→layer3
        plateWidths: [.62, .48, .45],
        plateLifts: [0, .012, .062],
        plateRatios: [279/576, 265/449, 332/431],
        pickupPoints: [[.73,.61],[.25,.72],[.49,.38]],
      },
      assets: {
        introOne: 'assets/fish01/intro-1.png', introTwo: 'assets/fish01/intro-2.png',
        instruction: 'assets/fish01/instruction.png', dishes: 'assets/fish01/dishes.png',
        plates: ['assets/fish01/plate-1.png','assets/fish01/plate-2.png','assets/fish01/plate-3.png'],
        platform: 'assets/fish01/platform.png',
        rays: 'assets/fish01/rays.png', fish: 'assets/fish01/fish.png', fishName: 'assets/fish01/fish-name.png',
        awakeMessage: 'assets/web/5_03-말풍선.png', levelMessage: 'assets/web/5_09-말풍선.png',
        waitingMessage: 'assets/web/5_10-말풍선.png', bubble: 'assets/5_10-공기방울.png',
      },
    },
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
        // assets/web은 폰용으로 크기를 줄인 이미지입니다. 원본은 assets에 유지합니다.
        rays: 'assets/web/5_end_rays.png', fish: 'assets/web/5_03-물고기.png',
        fishName: 'assets/web/5_03-물고기이름.png',
        awakeMessage: 'assets/web/5_03-말풍선.png', levelMessage: 'assets/web/5_09-말풍선.png',
        waitingMessage: 'assets/web/5_10-말풍선.png', bubble: 'assets/5_10-공기방울.png',
      },
    },
    {
      id:'fish02', label:'2번 · LP / 도루묵', videoSrc:'',
      game:{
        balanceTolerance:8,       // 좌우 기울기 허용 각도
        balanceHoldMs:3000,       // 이 시간 동안 연속으로 중심을 유지하면 성공
        maxVisualTilt:28,
        smoothingSeconds:.16,
        successPauseMs:650,
      },
      assets:{
        introOne:'assets/fish02/intro-1.png', introTwo:'assets/fish02/intro-2.png',
        instruction:'assets/fish02/instruction.png', record:'assets/fish02/record.png',
        balanceBase:'assets/fish02/balance-base.png',
        rays:'assets/fish02/rays.png', fish:'assets/fish02/fish.png', fishName:'assets/fish02/fish-name.png',
        awakeMessage:'assets/web/5_03-말풍선.png', levelMessage:'assets/web/5_09-말풍선.png',
        waitingMessage:'assets/web/5_10-말풍선.png', bubble:'assets/5_10-공기방울.png',
      },
    },
    {
      id:'fish06', label:'6번 · 물건 고르기', videoSrc:'',
      game:{
        shakeThreshold:12,        // 좌우 가속도(m/s²). 작을수록 약한 흔들기에도 반응
        shakeAlternations:2,      // 좌→우→좌처럼 방향이 이 횟수만큼 바뀌어야 한 번 선택
        shakeWindowMs:1100,       // 위 방향 전환을 완료할 시간
        minPeakGapMs:80,
        shakeCooldownMs:900,      // 물건이 바뀐 후 최소 쉬는 시간
        rearmQuietMs:400,         // 잠깐 멈춘 뒤 다시 흔들어야 다음 물건으로 변경
        armDelayMs:250,
        sensorGapMs:700,
        promptFadeMs:550,         // 중앙 안내 문구가 사라지는 시간
        messageIntervalMs:3000,   // 물건 → 첫 말풍선 → 두 번째 말풍선 사이 간격
        hapticPeakMs:18,          // 흔들기 방향이 감지될 때 짧은 진동(ms)
        hapticDrawPattern:[45,30,65], // 물건을 뽑을 때 진동·쉼·진동(ms)
      },
      assets:{
        finishGif:'',
        introOne:'assets/fish06/Web page ui_S6-1_ment1.png',
        introTwo:'assets/fish06/Web page ui_S6-1_ment2.png',
        instruction:'assets/fish06/Web page ui_S6-2_ment1.png',
        frame:'assets/fish06/Web page ui_S6-2_square.png',
        items:[
          {id:'luck',label:'네잎클로버 키링',image:'assets/fish06/Web page ui_S6-2-luck.png',
            mentOne:'assets/fish06/Web page ui_S6-2-luck_ment1.png',mentTwo:'assets/fish06/Web page ui_S6-2-luck_ment2.png'},
          {id:'hairpin',label:'알록달록 색핀',image:'assets/fish06/Web page ui_S6-2-hairpin.png',
            mentOne:'assets/fish06/Web page ui_S6-2-hairpin_ment1.png',mentTwo:'assets/fish06/Web page ui_S6-2-hairpin_ment2.png'},
          {id:'squishy',label:'스퀴시',image:'assets/fish06/Web page ui_S6-2_squishy.png',
            mentOne:'assets/fish06/Web page ui_S6-2_squishy_ment1.png',mentTwo:'assets/fish06/Web page ui_S6-2_squishy_ment2.png'},
        ],
      },
    },
    // 남은 게임. 실제 작업할 때 id·label·assets를 수정하세요.
    // 해당 JS 모듈이 등록되기 전에는 실행 버튼이 비활성화됩니다.
    { id: 'extra03', label: '추가 물고기 3 · 준비 중', videoSrc: '', game: {}, assets: {} },
  ],
};
