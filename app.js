(() => {
  'use strict';

  const root = document.querySelector('#app');
  const toast = document.querySelector('#toast');
  const STORE_KEY = 'ryoppy-encounter-v0.2';
  const CHARACTER_ID = 'christian-moerlein';
  const SPOT_ID = 'findlay-market';
  const POSES = {
    idle: './assets/characters/christian/idle.png',
    talk: './assets/characters/christian/talk.png',
    celebrate: './assets/characters/christian/celebrate.png',
  };

  const saved = loadSaved();
  const state = {
    data: null,
    character: null,
    spot: null,
    view: 'boot',
    revealed: false,
    storyIndex: 0,
    selectedQuestion: null,
    mode: saved.mode || 'demo',
    demoSpotId: saved.demoSpotId || SPOT_ID,
    selectedSpotId: saved.selectedSpotId || SPOT_ID,
    location: null,
    locationBusy: false,
    error: '',
    unlocked: Array.isArray(saved.unlocked) ? saved.unlocked : [],
    nodes: Array.isArray(saved.nodes) ? saved.nodes : [],
    revealTimer: 0,
  };

  const storyBeats = [
    'ようこそ、相棒！ 私はクリスチャン・モーライン。',
    'バイエルンからシンシナティへ渡り、鍛冶の腕と商売勘を元手に醸造所を始めた。',
    '私の成功には、この街の移民、鉄道、そして大勢の乾いた喉が詰まっている。さあ、街の続きを見よう！',
  ];

  const shortAnswers = {
    'moerlein-money': '鍛冶で働いて腕と評判をつくり、1853年に自分の醸造所を始めた。職人技、量産、流通。この三つで樽を大きな商売へ育てたのさ！',
    'moerlein-otr': 'Over-the-Rhineには働き手も客も仲間もいた。私はドイツ系移民が集まる街の熱気を、そのまま醸造所の勢いへ変えた。',
    'moerlein-collapse': '禁酒法で市場そのものが止まり、ビール帝国も動けなくなった。それでも名前と物語は街に残り、後の時代にブランドが復活した！',
  };

  const nodeLabels = {
    'brewing-industry': 'シンシナティの醸造産業',
    'immigrant-enterprise': '移民技能からの起業',
    'german-otr': 'ドイツ系移民のOTR',
    'findlay-market-node': 'Findlay Market',
    prohibition: '禁酒法',
    'brand-revival': '歴史ブランドの復活',
  };

  function loadSaved() {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
    } catch {
      return {};
    }
  }

  function save() {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      mode: state.mode,
      demoSpotId: state.demoSpotId,
      selectedSpotId: state.spot?.id || state.selectedSpotId,
      unlocked: state.unlocked,
      nodes: state.nodes,
    }));
  }

  function esc(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function radians(value) {
    return value * Math.PI / 180;
  }

  function distanceMeters(a, b) {
    if (!a || !b) return null;
    const radius = 6371000;
    const dLat = radians(b.latitude - a.latitude);
    const dLon = radians(b.longitude - a.longitude);
    const h = Math.sin(dLat / 2) ** 2
      + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(dLon / 2) ** 2;
    return 2 * radius * Math.asin(Math.sqrt(h));
  }

  function currentDistance() {
    return distanceMeters(currentMapLocation(), state.spot);
  }

  function formatDistance(value) {
    if (value == null) return '距離を測定していません';
    if (value < 1000) return `約${Math.max(1, Math.round(value / 10) * 10)}m`;
    return `約${(value / 1000).toFixed(1)}km`;
  }

  function signalStatus() {
    const distance = currentDistance();
    const character = characterAtSpot(state.spot);
    const available = character?.id === CHARACTER_ID;
    const ready = available && distance != null && distance <= state.spot.radiusM;
    const strength = ready ? 96 : distance == null ? 18 : clamp(Math.round(100 - distance / 35), 8, 88);
    return { distance, ready, strength, available, character };
  }

  function isUnlocked(characterId = CHARACTER_ID) {
    return state.unlocked.includes(characterId);
  }

  function characterAtSpot(spot) {
    const characterId = spot?.characterIds?.[0];
    return state.data?.characters.find(item => item.id === characterId) || null;
  }

  function demoLocation() {
    const spot = state.data?.spots.find(item => item.id === state.demoSpotId)
      || state.data?.spots.find(item => item.id === SPOT_ID);
    if (!spot) return null;
    return {
      latitude: spot.latitude + 0.00011,
      longitude: spot.longitude - 0.00004,
    };
  }

  function currentMapLocation() {
    return state.mode === 'demo' ? demoLocation() : state.location;
  }

  function mapBounds() {
    const latitudes = state.data.spots.map(spot => spot.latitude);
    const longitudes = state.data.spots.map(spot => spot.longitude);
    return {
      minLatitude: Math.min(...latitudes) - 0.00135,
      maxLatitude: Math.max(...latitudes) + 0.00135,
      minLongitude: Math.min(...longitudes) - 0.00145,
      maxLongitude: Math.max(...longitudes) + 0.00145,
    };
  }

  function mapPoint(location) {
    const bounds = mapBounds();
    const xRatio = (location.longitude - bounds.minLongitude)
      / (bounds.maxLongitude - bounds.minLongitude);
    const yRatio = (bounds.maxLatitude - location.latitude)
      / (bounds.maxLatitude - bounds.minLatitude);
    return {
      x: 65 + clamp(xRatio, 0, 1) * 770,
      y: 48 + clamp(yRatio, 0, 1) * 452,
      inBounds: xRatio >= 0 && xRatio <= 1 && yRatio >= 0 && yRatio <= 1,
    };
  }

  function shortSpotName(spot) {
    return ({
      'rhinegeist': 'Rhinegeist',
      'findlay-market': 'Findlay Market',
      'music-hall': 'Music Hall',
      'city-hall': 'City Hall',
      'freedom-center': 'Freedom Center',
      'ohio-river-view': 'Ohio River',
    })[spot.id] || spot.name;
  }

  function topbar(back = false) {
    return `
      <header class="topbar">
        ${back
          ? '<button class="round-button" data-action="back-to-scan" aria-label="探索へ戻る">←</button>'
          : '<span class="brand">RYOPPY<span>!</span></span>'}
        <span class="scene-location">${esc(back ? state.spot?.name : 'Cincinnati Streetcar')}</span>
        <span class="collection-count" aria-label="図鑑登録数">${isUnlocked() ? '1' : '0'} / 3</span>
      </header>`;
  }

  function particles() {
    return Array.from({ length: 14 }, (_, index) => {
      const x = 5 + ((index * 17) % 91);
      const y = 8 + ((index * 29) % 78);
      const delay = ((index * 7) % 19) / 10;
      const size = 5 + (index % 4) * 3;
      return `<i style="--x:${x}%;--y:${y}%;--delay:${delay}s;--size:${size}px"></i>`;
    }).join('');
  }

  function mapTemplate() {
    const routePoints = state.data.spots
      .map(spot => {
        const point = mapPoint(spot);
        return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
      })
      .join(' ');
    const current = currentMapLocation();
    const currentPoint = current ? mapPoint(current) : null;
    const markers = state.data.spots.map((spot, index) => {
      const point = mapPoint(spot);
      const character = characterAtSpot(spot);
      const known = isUnlocked(character?.id);
      const selected = state.spot.id === spot.id;
      const characterName = character?.nameJa || '未知の人物';
      const mapCharacterName = characterName.split('・')[0];
      return `
        <button
          class="map-signal ${known ? 'is-known' : 'is-unknown'} ${selected ? 'is-selected' : ''}"
          style="--map-x:${(point.x / 9).toFixed(2)}%;--map-y:${(point.y / 5.6).toFixed(2)}%;--signal-delay:-${(index * 0.37).toFixed(2)}s"
          data-action="select-signal"
          data-spot="${esc(spot.id)}"
          aria-label="${known ? esc(characterName) : '未知の人物信号'}・${esc(spot.name)}"
        >
          <span class="signal-wave" aria-hidden="true"></span>
          ${known
            ? `<span class="signal-portrait"><img src="${POSES.idle}" alt=""></span>
               <span class="signal-name">${esc(mapCharacterName)}</span>`
            : `<span class="signal-mystery" aria-hidden="true">?</span>
               ${selected ? `<span class="signal-place">${esc(shortSpotName(spot))}</span>` : ''}`}
        </button>`;
    }).join('');

    return `
      <div class="explore-map" aria-label="Cincinnati Streetcar沿線の探索地図">
        <svg class="map-canvas" viewBox="0 0 900 560" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="riverGlow" x1="0" x2="1">
              <stop offset="0" stop-color="#276c80" />
              <stop offset=".55" stop-color="#3b98a5" />
              <stop offset="1" stop-color="#235e76" />
            </linearGradient>
          </defs>
          <path class="map-river" d="M-30 504 C120 470 220 530 345 503 S610 475 930 508 L930 590 L-30 590 Z" />
          <g class="map-blocks">
            <path d="M18 75H880M18 150H880M18 225H880M18 300H880M18 375H880M18 450H880" />
            <path d="M105 20V505M230 20V505M355 20V505M480 20V505M605 20V505M730 20V505" />
            <path d="M35 430L790 40M175 520L900 135M0 250L480 0" />
          </g>
          <polyline class="streetcar-route route-glow" points="${routePoints}" />
          <polyline class="streetcar-route" points="${routePoints}" />
        </svg>
        <div class="map-neighborhood north">OVER-THE-RHINE</div>
        <div class="map-neighborhood south">THE BANKS</div>
        ${currentPoint ? `
          <div class="map-fog" style="--map-x:${(currentPoint.x / 9).toFixed(2)}%;--map-y:${(currentPoint.y / 5.6).toFixed(2)}%"></div>
          ${currentPoint.inBounds ? `
            <div class="current-marker" style="--map-x:${(currentPoint.x / 9).toFixed(2)}%;--map-y:${(currentPoint.y / 5.6).toFixed(2)}%">
              <span></span><strong>${state.mode === 'demo' ? 'デモ位置' : '現在地'}</strong>
            </div>` : '<div class="map-away">現在地はこの地図の外</div>'}
        ` : '<div class="map-fog no-location"></div>'}
        ${markers}
      </div>`;
  }

  function scanTemplate() {
    const status = signalStatus();
    const returning = status.character && isUnlocked(status.character.id);
    const unknownCount = state.data.characters.filter(character => !isUnlocked(character.id)).length;
    const distanceLabel = status.distance == null ? '距離を測定していません' : formatDistance(status.distance);
    const signalTitle = returning ? status.character.nameJa : '未知の人物信号';
    let guidance = '現在地を取得すると、信号までの距離がわかる。';
    let mainAction = '<button class="primary-action" disabled>現在地を待っています</button>';

    if (!status.available) {
      guidance = '強い気配がある。この人物の遭遇編は、次のAlphaで開放。';
      mainAction = '<button class="primary-action" disabled>まだ解析できない信号</button>';
    } else if (status.ready) {
      guidance = returning ? '知っている顔だ。もう一度、話しかけられる。' : 'すぐ近くにいる。ここで遭遇できる。';
      mainAction = `<button class="primary-action" data-action="start-encounter">${returning ? 'もう一度、会う' : '遭遇する'}</button>`;
    } else if (state.mode === 'demo') {
      guidance = `${distanceLabel}先から反応している。デモ位置を移動して近づける。`;
      mainAction = '<button class="primary-action" data-action="move-demo">この地点へデモ移動</button>';
    } else if (status.distance != null) {
      guidance = `${distanceLabel}先から反応している。近づくほど信号が強くなる。`;
      mainAction = '<button class="primary-action" disabled>もっと近づく</button>';
    }

    return `
      <section class="experience scan-experience">
        ${topbar(false)}

        <main class="scan-main">
          <div class="map-hud">
            <div>
              <p>街に残る信号</p>
              <h1>${unknownCount}人の気配を追跡中</h1>
            </div>
            <span><i></i> 6地点</span>
          </div>

          ${mapTemplate()}

          <section class="scan-panel">
            <div class="signal-readout">
              <span class="signal-strength"><b style="--strength:${status.strength}%"></b></span>
              <div>
                <span>${esc(shortSpotName(state.spot))} · ${esc(distanceLabel)}</span>
                <strong>${esc(signalTitle)}</strong>
              </div>
            </div>
            <p class="signal-guidance">${esc(guidance)}</p>
            ${mainAction}
            <button class="text-action" data-action="use-gps" ${state.locationBusy ? 'disabled' : ''}>
              ${state.locationBusy ? '現在地を取得中…' : state.mode === 'gps' ? '現在地を更新' : '実際の現在地で探す'}
            </button>
            ${state.mode === 'gps' ? '<button class="text-action quiet" data-action="use-demo">位置デモへ戻る</button>' : ''}
            ${state.error ? `<p class="error-message">${esc(state.error)}</p>` : ''}
          </section>
        </main>
      </section>`;
  }

  function poseForView() {
    if (state.view === 'reward') return 'celebrate';
    if (['story', 'questions', 'answer'].includes(state.view)) return 'talk';
    return 'idle';
  }

  function revealPanel() {
    if (!state.revealed) {
      return `
        <section class="dialogue-panel compact-panel analyzing" aria-live="assertive">
          <p class="panel-kicker">古い通信を復元中</p>
          <h1>人物の輪郭が見えてきた…</h1>
          <div class="loading-line"><span></span></div>
        </section>`;
    }
    return `
      <section class="dialogue-panel compact-panel reveal-panel">
        <p class="panel-kicker">初遭遇</p>
        <h1>${esc(state.character.nameJa)}</h1>
        <p class="character-years">${esc(state.character.years)} · ${esc(state.character.subtitle)}</p>
        <blockquote>「${esc(state.character.voice.catchphrase)}」</blockquote>
        <button class="primary-action" data-action="start-story">話しかける</button>
      </section>`;
  }

  function storyPanel() {
    const last = state.storyIndex === storyBeats.length - 1;
    const dots = storyBeats.map((_, index) => `<span class="${index === state.storyIndex ? 'active' : ''}"></span>`).join('');
    return `
      <section class="dialogue-panel story-panel">
        <div class="story-head">
          <div>
            <p class="panel-kicker">クリスチャン</p>
            <div class="story-progress" aria-label="${state.storyIndex + 1} / ${storyBeats.length}">${dots}</div>
          </div>
          <button class="voice-button" data-action="speak" aria-label="この台詞を読み上げる">▶ 聞く</button>
        </div>
        <p class="story-text">${esc(storyBeats[state.storyIndex])}</p>
        <button class="primary-action" data-action="next-story">${last ? 'もっと聞いてみる' : '次の話へ'}</button>
      </section>`;
  }

  function questionsPanel() {
    return `
      <section class="dialogue-panel question-panel">
        <p class="panel-kicker">本人へ質問する</p>
        <h1>何を聞いてみる？</h1>
        <div class="question-list">
          ${state.character.questions.map((question, index) => `
            <button data-action="choose-question" data-question="${esc(question.id)}">
              <span>0${index + 1}</span>${esc(question.question)}
            </button>`).join('')}
        </div>
      </section>`;
  }

  function answerPanel() {
    const question = state.character.questions.find(item => item.id === state.selectedQuestion);
    const unlockedNodes = question.unlockNodeIds
      .map(id => state.data.relationNodes.find(node => node.id === id))
      .filter(Boolean);
    return `
      <section class="dialogue-panel answer-panel">
        <div class="story-head">
          <p class="panel-kicker">${esc(question.question)}</p>
          <button class="voice-button" data-action="speak" aria-label="答えを読み上げる">▶ 聞く</button>
        </div>
        <p class="answer-text">${esc(shortAnswers[question.id] || question.answer)}</p>
        <div class="connection-preview">
          <span>つながりを発見</span>
          ${unlockedNodes.map(node => `<strong>${esc(nodeLabels[node.id] || node.title)}</strong>`).join('')}
        </div>
        <button class="primary-action" data-action="unlock-character">図鑑に記録する</button>
      </section>`;
  }

  function rewardPanel() {
    const question = state.character.questions.find(item => item.id === state.selectedQuestion)
      || state.character.questions[0];
    const node = state.data.relationNodes.find(item => item.id === question.unlockNodeIds[0]);
    return `
      <section class="dialogue-panel reward-panel">
        <p class="panel-kicker">図鑑に新しく記録</p>
        <h1>${esc(state.character.nameJa)}</h1>
        <p>街をつくった人物と、ひとつの歴史がつながった。</p>
        <div class="reward-chip"><span>獲得</span>${esc(nodeLabels[node?.id] || node?.title || 'Cincinnatiの歴史')}</div>
        <button class="primary-action" data-action="back-to-scan">次の信号を探す</button>
      </section>`;
  }

  function panelForView() {
    if (state.view === 'reveal') return revealPanel();
    if (state.view === 'story') return storyPanel();
    if (state.view === 'questions') return questionsPanel();
    if (state.view === 'answer') return answerPanel();
    return rewardPanel();
  }

  function encounterTemplate() {
    const pose = poseForView();
    const silhouette = state.view === 'reveal' && !state.revealed;
    return `
      <section class="experience encounter-experience view-${state.view} ${state.revealed ? 'is-revealed' : ''}">
        <div class="encounter-burst" aria-hidden="true"></div>
        <div class="particle-field" aria-hidden="true">${particles()}</div>
        ${topbar(true)}
        <p class="encounter-signal">SIGNAL 01 · ${esc(state.spot.name)}</p>

        <main class="character-stage">
          <div class="character-drift ${state.view === 'reward' ? 'reward-drift' : ''}">
            <div class="character-breathe">
              <img class="character-image ${silhouette ? 'silhouette' : ''}" src="${POSES[pose]}" alt="${silhouette ? 'まだ正体の分からない人物' : esc(state.character.nameJa)}">
            </div>
          </div>
          <div class="character-shadow" aria-hidden="true"></div>
        </main>

        ${panelForView()}
      </section>`;
  }

  function render() {
    root.innerHTML = state.view === 'scan' ? scanTemplate() : encounterTemplate();
    document.body.dataset.view = state.view;
    requestAnimationFrame(() => {
      startCharacterDrift();
      if (state.view !== 'scan') {
        root.querySelector('.dialogue-panel button:not([disabled])')?.focus({ preventScroll: true });
      }
    });
  }

  function startCharacterDrift() {
    const element = root.querySelector('.character-drift');
    if (!element || matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const drift = () => {
      if (!element.isConnected) return;
      const x = Math.round((Math.random() - 0.5) * 28);
      const y = Math.round((Math.random() - 0.5) * 34);
      const rotate = (Math.random() - 0.5) * 3.4;
      const duration = 3800 + Math.random() * 2800;
      const currentTransform = getComputedStyle(element).transform;
      const animation = element.animate([
        { transform: currentTransform === 'none' ? 'translate3d(0,0,0)' : currentTransform },
        { transform: `translate3d(${x}px, ${y}px, 0) rotate(${rotate}deg)` },
      ], {
        duration,
        easing: 'ease-in-out',
        fill: 'forwards',
      });
      animation.finished.then(drift).catch(() => {});
    };
    drift();
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove('show'), 2600);
  }

  function startEncounter() {
    const character = characterAtSpot(state.spot);
    if (character?.id !== CHARACTER_ID || !signalStatus().ready) return;
    state.character = character;
    clearTimeout(state.revealTimer);
    state.view = 'reveal';
    state.revealed = false;
    state.storyIndex = 0;
    state.selectedQuestion = null;
    navigator.vibrate?.([35, 65, 55]);
    render();
    state.revealTimer = setTimeout(() => {
      if (state.view !== 'reveal') return;
      state.revealed = true;
      render();
    }, 1250);
  }

  function speakCurrent() {
    if (!window.speechSynthesis) {
      showToast('このブラウザは読み上げに対応していません。');
      return;
    }
    let text = storyBeats[state.storyIndex];
    if (state.view === 'answer') {
      const question = state.character.questions.find(item => item.id === state.selectedQuestion);
      text = shortAnswers[question?.id] || question?.answer || text;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ja-JP';
    utterance.rate = state.character.voice.ttsRate;
    utterance.pitch = state.character.voice.ttsPitch;
    const voice = window.speechSynthesis.getVoices().find(item => item.lang.toLowerCase().startsWith('ja'));
    if (voice) utterance.voice = voice;
    window.speechSynthesis.speak(utterance);
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      state.error = 'この端末では現在地を取得できません。';
      render();
      return;
    }
    if (!window.isSecureContext && location.hostname !== 'localhost') {
      state.error = '現在地の利用にはHTTPSが必要です。';
      render();
      return;
    }
    state.locationBusy = true;
    state.error = '';
    render();
    navigator.geolocation.getCurrentPosition(position => {
      state.location = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      state.mode = 'gps';
      state.spot = state.data.spots.reduce((nearest, spot) => {
        const candidateDistance = distanceMeters(state.location, spot);
        const nearestDistance = distanceMeters(state.location, nearest);
        return candidateDistance < nearestDistance ? spot : nearest;
      }, state.data.spots[0]);
      state.selectedSpotId = state.spot.id;
      state.locationBusy = false;
      save();
      render();
    }, error => {
      state.locationBusy = false;
      state.error = error.code === 1
        ? '現在地が許可されていません。位置デモならすぐ試せます。'
        : '現在地を取得できませんでした。';
      render();
    }, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 10000,
    });
  }

  function unlockCharacter() {
    const question = state.character.questions.find(item => item.id === state.selectedQuestion)
      || state.character.questions[0];
    if (!state.unlocked.includes(CHARACTER_ID)) state.unlocked.push(CHARACTER_ID);
    for (const node of question.unlockNodeIds) {
      if (!state.nodes.includes(node)) state.nodes.push(node);
    }
    save();
    state.view = 'reward';
    navigator.vibrate?.([55, 45, 90]);
    render();
  }

  async function handleAction(button) {
    const action = button.dataset.action;
    if (action === 'select-signal') {
      const spot = state.data.spots.find(item => item.id === button.dataset.spot);
      if (!spot) return;
      state.spot = spot;
      state.selectedSpotId = spot.id;
      state.error = '';
      save();
      navigator.vibrate?.(18);
      render();
    } else if (action === 'move-demo') {
      state.demoSpotId = state.spot.id;
      state.mode = 'demo';
      state.location = null;
      state.error = '';
      save();
      navigator.vibrate?.([24, 35, 24]);
      render();
    } else if (action === 'start-encounter') startEncounter();
    else if (action === 'start-story') {
      state.view = 'story';
      state.storyIndex = 0;
      render();
    } else if (action === 'next-story') {
      if (state.storyIndex < storyBeats.length - 1) state.storyIndex += 1;
      else state.view = 'questions';
      render();
    } else if (action === 'choose-question') {
      state.selectedQuestion = button.dataset.question;
      state.view = 'answer';
      render();
    } else if (action === 'unlock-character') unlockCharacter();
    else if (action === 'back-to-scan') {
      clearTimeout(state.revealTimer);
      window.speechSynthesis?.cancel();
      state.view = 'scan';
      render();
    } else if (action === 'speak') speakCurrent();
    else if (action === 'use-gps') useCurrentLocation();
    else if (action === 'use-demo') {
      state.mode = 'demo';
      state.location = null;
      state.error = '';
      save();
      render();
    }
  }

  root.addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (button && !button.disabled) void handleAction(button);
  });

  async function init() {
    try {
      const response = await fetch('./data/cincinnati-alpha.json');
      if (!response.ok) throw new Error(`data ${response.status}`);
      state.data = await response.json();
      state.character = state.data.characters.find(item => item.id === CHARACTER_ID);
      state.spot = state.data.spots.find(item => item.id === state.selectedSpotId)
        || state.data.spots.find(item => item.id === SPOT_ID);
      if (!state.character || !state.spot) throw new Error('encounter data missing');
      state.view = 'scan';
      render();
      if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(console.warn);
    } catch (error) {
      console.error(error);
      root.innerHTML = `
        <section class="fatal-error">
          <strong>街の信号を読み込めませんでした。</strong>
          <button class="primary-action" onclick="location.reload()">もう一度試す</button>
        </section>`;
    }
  }

  void init();
})();
