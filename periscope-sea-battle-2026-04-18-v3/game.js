const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const scoreNode = document.getElementById("score");
const torpedoesNode = document.getElementById("torpedoes");
const targetsNode = document.getElementById("targets");
const headingNode = document.getElementById("heading");
const messageTitle = document.getElementById("message-title");
const messageText = document.getElementById("message-text");
const fireButton = document.getElementById("fire-button");
const restartButton = document.getElementById("restart-button");
const dial = document.getElementById("dial");
const dialKnob = document.getElementById("dial-knob");

const SHIP_BLUEPRINTS = [
  { id: 1, name: "escort", length: 86, height: 24, speed: 121, lane: 0, hull: "#54666b", deck: "#abb5b3", bridge: "#313c42", stacks: 1, masts: [0.22], score: 210, bowLift: 0.44, sternDrop: 0.22, cabinStart: 0.38, cabinSpan: 0.14, gunTurrets: 1, wakeWidth: 16 },
  { id: 2, name: "freighter", length: 164, height: 38, speed: 83, lane: 1, hull: "#72675c", deck: "#bcae94", bridge: "#453f38", stacks: 2, masts: [0.28], score: 120, bowLift: 0.22, sternDrop: 0.08, cabinStart: 0.58, cabinSpan: 0.18, gunTurrets: 0, wakeWidth: 25 },
  { id: 3, name: "destroyer", length: 112, height: 28, speed: 113, lane: 2, hull: "#475962", deck: "#a7b3b7", bridge: "#293238", stacks: 2, masts: [0.24, 0.62], score: 180, bowLift: 0.4, sternDrop: 0.2, cabinStart: 0.42, cabinSpan: 0.16, gunTurrets: 2, wakeWidth: 18 },
  { id: 4, name: "cargo", length: 176, height: 40, speed: 79, lane: 0, hull: "#80766a", deck: "#c2b399", bridge: "#4d453d", stacks: 2, masts: [0.2, 0.72], score: 115, bowLift: 0.18, sternDrop: 0.06, cabinStart: 0.62, cabinSpan: 0.2, gunTurrets: 0, wakeWidth: 28 },
  { id: 5, name: "patrol", length: 78, height: 22, speed: 130, lane: 1, hull: "#84544b", deck: "#d1b7a0", bridge: "#482821", stacks: 1, masts: [0.52], score: 230, bowLift: 0.48, sternDrop: 0.25, cabinStart: 0.34, cabinSpan: 0.12, gunTurrets: 1, wakeWidth: 14 },
  { id: 6, name: "cruiser", length: 142, height: 34, speed: 94, lane: 2, hull: "#4b5d65", deck: "#a3afb4", bridge: "#2d373d", stacks: 3, masts: [0.2, 0.46], score: 145, bowLift: 0.28, sternDrop: 0.12, cabinStart: 0.36, cabinSpan: 0.22, gunTurrets: 3, wakeWidth: 22 },
  { id: 7, name: "raider", length: 98, height: 24, speed: 119, lane: 0, hull: "#934d49", deck: "#d7b59c", bridge: "#552925", stacks: 1, masts: [0.3, 0.68], score: 190, bowLift: 0.42, sternDrop: 0.22, cabinStart: 0.46, cabinSpan: 0.12, gunTurrets: 2, wakeWidth: 16 },
  { id: 8, name: "gunboat", length: 72, height: 20, speed: 137, lane: 1, hull: "#4f595f", deck: "#c4c8c1", bridge: "#353a3d", stacks: 1, masts: [0.3], score: 250, bowLift: 0.5, sternDrop: 0.3, cabinStart: 0.4, cabinSpan: 0.1, gunTurrets: 1, wakeWidth: 13 },
  { id: 9, name: "transport", length: 156, height: 36, speed: 86, lane: 2, hull: "#6c625d", deck: "#c2b49a", bridge: "#403933", stacks: 2, masts: [0.22, 0.74], score: 130, bowLift: 0.2, sternDrop: 0.1, cabinStart: 0.52, cabinSpan: 0.22, gunTurrets: 0, wakeWidth: 24 },
  { id: 10, name: "torpedo", length: 90, height: 23, speed: 126, lane: 1, hull: "#5b666c", deck: "#cdd0ca", bridge: "#2d3639", stacks: 1, masts: [0.26], score: 220, bowLift: 0.46, sternDrop: 0.24, cabinStart: 0.38, cabinSpan: 0.1, gunTurrets: 2, wakeWidth: 15 }
];

const LANES = [
  { y: 314, bob: 2.2 },
  { y: 334, bob: 2.8 },
  { y: 352, bob: 3.1 }
];

const game = {
  width: canvas.width,
  height: canvas.height,
  heading: 0,
  score: 0,
  torpedoesLeft: 10,
  totalTorpedoes: 10,
  targetsDestroyed: 0,
  totalTargets: SHIP_BLUEPRINTS.length,
  status: "ready",
  activeShip: null,
  targetQueue: [],
  currentTargetIndex: 0,
  shipRespawnTimer: 0,
  torpedoes: [],
  explosions: [],
  splashes: [],
  smokeBursts: [],
  clouds: [],
  beamPulse: 0.5,
  audio: {
    context: null,
    master: null
  },
  dialActive: false,
  lastTime: 0
};

function createTargetQueue() {
  return SHIP_BLUEPRINTS.map((blueprint) => ({
    ...blueprint,
    destroyed: false
  }));
}

function createClouds() {
  return Array.from({ length: 8 }, (_, index) => ({
    x: 120 + index * 140 + Math.random() * 70,
    y: 84 + Math.random() * 120,
    size: 36 + Math.random() * 48
  }));
}

function createShipInstance(target) {
  const lane = LANES[target.lane % LANES.length];
  return {
    ...target,
    x: -target.length - 260,
    y: lane.y,
    bobRange: lane.bob,
    bobPhase: Math.random() * Math.PI * 2,
    flash: 0,
    wake: 0,
    state: "sailing",
    sinkTimer: 0,
    sinkOffset: 0,
    fireTrail: 0
  };
}

function spawnCurrentShip() {
  const nextTarget = game.targetQueue[game.currentTargetIndex];
  if (!nextTarget || nextTarget.destroyed) {
    game.activeShip = null;
    return;
  }
  game.activeShip = createShipInstance(nextTarget);
}

function setMessage(title, text) {
  messageTitle.textContent = title;
  messageText.textContent = text;
}

function resetGame() {
  game.heading = 0;
  game.score = 0;
  game.torpedoesLeft = game.totalTorpedoes;
  game.targetsDestroyed = 0;
  game.status = "ready";
  game.targetQueue = createTargetQueue();
  game.currentTargetIndex = 0;
  game.shipRespawnTimer = 0;
  game.torpedoes = [];
  game.explosions = [];
  game.splashes = [];
  game.smokeBursts = [];
  game.clouds = createClouds();
  game.beamPulse = 0.5;
  spawnCurrentShip();
  syncUi();
  setMessage("ГОТОВНОСТЬ", "На линии идет один корабль. У тебя десять торпед на десять целей.");
}

function syncUi() {
  scoreNode.textContent = String(game.score).padStart(4, "0");
  torpedoesNode.textContent = `${game.torpedoesLeft} / ${game.totalTorpedoes}`;
  targetsNode.textContent = `${game.targetsDestroyed} / ${game.totalTargets}`;

  const normalized = ((game.heading % 360) + 360) % 360;
  headingNode.textContent = `${String(Math.round(normalized)).padStart(3, "0")}°`;
  positionDialKnob();
}

function positionDialKnob() {
  const radius = dial.clientWidth * 0.43;
  const angle = (game.heading - 90) * (Math.PI / 180);
  const x = Math.cos(angle) * radius;
  const y = Math.sin(angle) * radius;
  dialKnob.style.left = `calc(50% + ${x}px)`;
  dialKnob.style.top = `calc(50% + ${y}px)`;
  dialKnob.style.transform = "translate(-50%, -50%)";
}

function updateHeadingFromPointer(clientX, clientY) {
  const rect = dial.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const angle = Math.atan2(clientY - centerY, clientX - centerX) * (180 / Math.PI) + 90;
  game.heading = Math.max(-42, Math.min(42, angle));
  game.beamPulse = 1;
  syncUi();
}

function startBattleIfNeeded() {
  if (game.status === "ready") {
    game.status = "running";
    setMessage("БОЙ НАЧАЛСЯ", "Корабли идут по одному. Малые цели быстрее и опаснее.");
    playSound("start");
  }
}

function getAimPoint() {
  const originX = game.width / 2;
  const originY = game.height - 118;
  const horizonY = 232;
  const targetX = game.width / 2 + game.heading * 8.4;
  return {
    originX,
    originY,
    targetX,
    targetY: horizonY
  };
}

function fireTorpedo() {
  if (game.torpedoesLeft <= 0 || game.status === "won" || game.status === "lost" || !game.activeShip) {
    return;
  }

  startBattleIfNeeded();
  game.torpedoesLeft -= 1;

  const aim = getAimPoint();
  game.torpedoes.push({
    x: aim.originX,
    y: aim.originY,
    prevX: aim.originX,
    prevY: aim.originY,
    originX: aim.originX,
    originY: aim.originY,
    targetX: aim.targetX,
    targetY: aim.targetY,
    progress: 0,
    speed: 0.5,
    active: true,
    hitResolved: false
  });

  game.beamPulse = 1;
  syncUi();
  playSound("fire");

  if (game.torpedoesLeft === 0) {
    setMessage("ПОСЛЕДНЯЯ ТОРПЕДА", "Финальный выстрел ушел в цель или мимо. Следи за результатом.");
  }
}

function ensureAudio() {
  if (game.audio.context) {
    if (game.audio.context.state === "suspended") {
      game.audio.context.resume().catch(() => {});
    }
    return;
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    return;
  }

  const context = new AudioContextClass();
  const master = context.createGain();
  master.gain.value = 0.08;
  master.connect(context.destination);

  game.audio.context = context;
  game.audio.master = master;
}

function tone({ frequency, duration, type, volume, slide }) {
  if (!game.audio.context || !game.audio.master) {
    return;
  }

  const now = game.audio.context.currentTime;
  const oscillator = game.audio.context.createOscillator();
  const gain = game.audio.context.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);
  if (slide) {
    oscillator.frequency.exponentialRampToValueAtTime(slide, now + duration);
  }

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  oscillator.connect(gain);
  gain.connect(game.audio.master);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.04);
}

function noiseBurst(duration, volume) {
  if (!game.audio.context || !game.audio.master) {
    return;
  }

  const buffer = game.audio.context.createBuffer(1, game.audio.context.sampleRate * duration, game.audio.context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  }

  const source = game.audio.context.createBufferSource();
  const filter = game.audio.context.createBiquadFilter();
  const gain = game.audio.context.createGain();

  filter.type = "lowpass";
  filter.frequency.value = 700;
  gain.gain.value = volume;

  source.buffer = buffer;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(game.audio.master);
  source.start();
}

function playSound(kind) {
  ensureAudio();
  if (!game.audio.context) {
    return;
  }

  if (kind === "start") {
    tone({ frequency: 210, duration: 0.12, type: "triangle", volume: 0.18, slide: 280 });
    setTimeout(() => tone({ frequency: 280, duration: 0.14, type: "triangle", volume: 0.16, slide: 360 }), 80);
    return;
  }

  if (kind === "fire") {
    tone({ frequency: 116, duration: 0.32, type: "sawtooth", volume: 0.2, slide: 72 });
    setTimeout(() => tone({ frequency: 180, duration: 0.1, type: "triangle", volume: 0.08, slide: 120 }), 70);
    return;
  }

  if (kind === "hit") {
    noiseBurst(0.18, 0.18);
    tone({ frequency: 220, duration: 0.14, type: "square", volume: 0.2, slide: 420 });
    setTimeout(() => tone({ frequency: 360, duration: 0.18, type: "triangle", volume: 0.16, slide: 660 }), 40);
    setTimeout(() => tone({ frequency: 120, duration: 0.42, type: "sawtooth", volume: 0.1, slide: 80 }), 80);
    return;
  }

  if (kind === "miss") {
    tone({ frequency: 170, duration: 0.2, type: "triangle", volume: 0.15, slide: 110 });
    setTimeout(() => noiseBurst(0.12, 0.06), 40);
    return;
  }

  if (kind === "win") {
    tone({ frequency: 320, duration: 0.16, type: "triangle", volume: 0.18, slide: 460 });
    setTimeout(() => tone({ frequency: 460, duration: 0.22, type: "triangle", volume: 0.16, slide: 700 }), 120);
    return;
  }

  if (kind === "lose") {
    tone({ frequency: 220, duration: 0.18, type: "sawtooth", volume: 0.16, slide: 160 });
    setTimeout(() => tone({ frequency: 160, duration: 0.26, type: "sawtooth", volume: 0.14, slide: 110 }), 100);
  }
}

function scheduleNextShip() {
  game.currentTargetIndex += 1;
  if (game.currentTargetIndex >= game.targetQueue.length) {
    game.activeShip = null;
    return;
  }
  game.shipRespawnTimer = 0.765;
  game.activeShip = null;
}

function hitActiveShip(hitX, hitY) {
  if (!game.activeShip || game.activeShip.state !== "sailing") {
    return;
  }

  game.targetQueue[game.currentTargetIndex].destroyed = true;
  game.targetsDestroyed += 1;
  game.score += game.activeShip.score;
  game.activeShip.state = "sinking";
  game.activeShip.sinkTimer = 1.15;
  game.activeShip.flash = 1;
  game.activeShip.fireTrail = 1;
  createExplosion(hitX, hitY);
  createSmoke(hitX, hitY - 16);
  playSound("hit");
}

function updateShip(dt) {
  if (!game.activeShip) {
    if (game.shipRespawnTimer > 0) {
      game.shipRespawnTimer = Math.max(0, game.shipRespawnTimer - dt);
      if (game.shipRespawnTimer === 0) {
        spawnCurrentShip();
      }
    }
    return;
  }

  game.activeShip.bobPhase += dt * 2.2;
  game.activeShip.wake += dt * 3.1;
  game.activeShip.flash = Math.max(0, game.activeShip.flash - dt * 1.7);
  game.activeShip.fireTrail = Math.max(0, game.activeShip.fireTrail - dt * 0.7);

  if (game.activeShip.state === "sailing") {
    game.activeShip.x += game.activeShip.speed * dt;
    if (game.activeShip.x > game.width + game.activeShip.length + 180) {
      game.activeShip = null;
      game.shipRespawnTimer = 0.765;
    }
    return;
  }

  game.activeShip.sinkTimer = Math.max(0, game.activeShip.sinkTimer - dt);
  game.activeShip.sinkOffset += dt * 16;
  game.activeShip.x += game.activeShip.speed * 0.18 * dt;

  if (Math.random() < 0.08) {
    createSmoke(worldToViewportX(game.activeShip.x) + game.activeShip.length * 0.56, game.activeShip.y - game.activeShip.height * 0.76 - game.activeShip.sinkOffset);
  }

  if (game.activeShip.sinkTimer === 0) {
    scheduleNextShip();
  }
}

function getShipHitbox(ship) {
  const visibleX = worldToViewportX(ship.x);
  const bob = Math.sin(ship.bobPhase) * ship.bobRange;
  const y = ship.y + bob - ship.sinkOffset;
  return {
    left: visibleX,
    right: visibleX + ship.length,
    top: y - ship.height * 0.84,
    bottom: y + ship.height * 0.28,
    hitY: y - ship.height * 0.28
  };
}

function detectTorpedoHit(torpedo) {
  if (!game.activeShip || game.activeShip.state !== "sailing") {
    return false;
  }

  const hitbox = getShipHitbox(game.activeShip);
  const hitPadding = Math.max(4, 18 - game.activeShip.length * 0.075);
  const lineLeft = Math.min(torpedo.prevX, torpedo.x);
  const lineRight = Math.max(torpedo.prevX, torpedo.x);
  const lineTop = Math.min(torpedo.prevY, torpedo.y);
  const lineBottom = Math.max(torpedo.prevY, torpedo.y);

  const overlaps =
    lineRight >= hitbox.left - hitPadding &&
    lineLeft <= hitbox.right + hitPadding &&
    lineBottom >= hitbox.top &&
    lineTop <= hitbox.bottom;

  if (!overlaps) {
    return false;
  }

  const hitX = Math.min(hitbox.right - 10, Math.max(hitbox.left + 10, torpedo.x));
  hitActiveShip(hitX, hitbox.hitY);
  return true;
}

function updateTorpedoes(dt) {
  game.torpedoes.forEach((torpedo) => {
    if (!torpedo.active) {
      return;
    }

    torpedo.prevX = torpedo.x;
    torpedo.prevY = torpedo.y;
    torpedo.progress += dt * torpedo.speed;

    const eased = Math.min(1, 1 - Math.pow(1 - torpedo.progress, 1.45));
    torpedo.x = torpedo.originX + (torpedo.targetX - torpedo.originX) * eased;
    torpedo.y = torpedo.originY + (torpedo.targetY - torpedo.originY) * eased;

    if (!torpedo.hitResolved && detectTorpedoHit(torpedo)) {
      torpedo.hitResolved = true;
      torpedo.active = false;
      return;
    }

    if (torpedo.progress >= 1) {
      createSplash(torpedo.x, torpedo.y + 10);
      playSound("miss");
      torpedo.active = false;
    }
  });

  game.torpedoes = game.torpedoes.filter((torpedo) => torpedo.active);
}

function update(dt) {
  if (game.status === "won" || game.status === "lost") {
    animateEffects(dt);
    return;
  }

  game.beamPulse = Math.max(0.3, game.beamPulse - dt * 0.7);
  updateShip(dt);
  updateTorpedoes(dt);
  animateEffects(dt);
  syncUi();

  if (game.targetsDestroyed === game.totalTargets && !game.activeShip) {
    game.status = "won";
    setMessage("ПОБЕДА", "Все десять кораблей поражены. Боекомплект израсходован образцово.");
    playSound("win");
  } else if (game.torpedoesLeft === 0 && game.torpedoes.length === 0 && (!game.activeShip || game.activeShip.state === "sailing")) {
    game.status = "lost";
    setMessage("БОЕКОМПЛЕКТ ИСЧЕРПАН", "Десять торпед закончились. Нужно точнее вести цель.");
    playSound("lose");
  }
}

function animateEffects(dt) {
  game.explosions.forEach((explosion) => {
    explosion.life -= dt;
    explosion.radius += dt * 120;
  });
  game.explosions = game.explosions.filter((explosion) => explosion.life > 0);

  game.splashes.forEach((splash) => {
    splash.life -= dt;
    splash.radius += dt * 70;
  });
  game.splashes = game.splashes.filter((splash) => splash.life > 0);

  game.smokeBursts.forEach((smoke) => {
    smoke.life -= dt;
    smoke.radius += dt * 22;
    smoke.y -= dt * 14;
  });
  game.smokeBursts = game.smokeBursts.filter((smoke) => smoke.life > 0);
}

function createExplosion(x, y) {
  game.explosions.push({
    x,
    y,
    radius: 24,
    life: 0.95
  });
}

function createSplash(x, y) {
  game.splashes.push({
    x,
    y,
    radius: 14,
    life: 0.65
  });
}

function createSmoke(x, y) {
  game.smokeBursts.push({
    x,
    y,
    radius: 14 + Math.random() * 8,
    life: 0.8
  });
}

function worldToViewportX(worldX) {
  return worldX - game.heading * 9.4;
}

function draw() {
  ctx.clearRect(0, 0, game.width, game.height);
  drawSky();
  drawSea();
  drawShore();
  drawAimBeam();
  drawShip();
  drawTorpedoes();
  drawSplashes();
  drawSmoke();
  drawExplosions();
  drawPeriscopeMask();
}

function drawSky() {
  const gradient = ctx.createLinearGradient(0, 0, 0, game.height);
  gradient.addColorStop(0, "#b4bfab");
  gradient.addColorStop(0.34, "#7a9486");
  gradient.addColorStop(0.66, "#41594d");
  gradient.addColorStop(1, "#112019");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, game.width, game.height);

  ctx.fillStyle = "rgba(255, 248, 217, 0.24)";
  game.clouds.forEach((cloud) => {
    drawCloud(cloud.x - game.heading * 3, cloud.y, cloud.size);
  });
}

function drawCloud(x, y, size) {
  ctx.beginPath();
  ctx.arc(x, y, size * 0.34, Math.PI, Math.PI * 2);
  ctx.arc(x + size * 0.24, y - size * 0.08, size * 0.28, Math.PI, Math.PI * 2);
  ctx.arc(x + size * 0.52, y, size * 0.34, Math.PI, Math.PI * 2);
  ctx.arc(x + size * 0.78, y + size * 0.02, size * 0.24, Math.PI, Math.PI * 2);
  ctx.closePath();
  ctx.fill();
}

function drawSea() {
  const horizon = 350;
  const gradient = ctx.createLinearGradient(0, horizon, 0, game.height);
  gradient.addColorStop(0, "#4e7364");
  gradient.addColorStop(0.42, "#213e31");
  gradient.addColorStop(1, "#09120f");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, horizon, game.width, game.height - horizon);

  ctx.strokeStyle = "rgba(215, 237, 190, 0.18)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, horizon + 10);
  ctx.lineTo(game.width, horizon + 4);
  ctx.stroke();

  for (let i = 0; i < 21; i += 1) {
    const y = horizon + i * 16;
    ctx.strokeStyle = `rgba(207, 236, 181, ${0.2 - i * 0.006})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = -120; x <= game.width + 120; x += 46) {
      const waveX = x + ((i % 2) * 18);
      const waveY = y + Math.sin((waveX + game.heading * 15 + i * 12) * 0.015) * (3 + i * 0.08);
      if (x === -120) {
        ctx.moveTo(waveX, waveY);
      } else {
        ctx.lineTo(waveX, waveY);
      }
    }
    ctx.stroke();
  }
}

function drawShore() {
  ctx.fillStyle = "#2e3f2d";
  ctx.beginPath();
  ctx.moveTo(-90 - game.heading * 1.3, 352);
  ctx.lineTo(24 - game.heading * 1.3, 266);
  ctx.lineTo(92 - game.heading * 1.3, 352);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#253424";
  ctx.beginPath();
  ctx.moveTo(36 - game.heading * 1.3, 352);
  ctx.lineTo(74 - game.heading * 1.3, 304);
  ctx.lineTo(118 - game.heading * 1.3, 352);
  ctx.closePath();
  ctx.fill();
}

function drawAimBeam() {
  const aim = getAimPoint();
  const beamAlpha = 0.2 + game.beamPulse * 0.22;
  const glow = 10 + game.beamPulse * 12;

  ctx.save();
  ctx.strokeStyle = `rgba(198, 255, 218, ${beamAlpha})`;
  ctx.lineWidth = 2;
  ctx.shadowBlur = glow;
  ctx.shadowColor = "rgba(131, 255, 207, 0.45)";
  ctx.beginPath();
  ctx.moveTo(aim.originX, aim.originY);
  ctx.lineTo(aim.targetX, aim.targetY);
  ctx.stroke();

  ctx.fillStyle = `rgba(219, 255, 231, ${0.14 + game.beamPulse * 0.16})`;
  ctx.beginPath();
  ctx.arc(aim.targetX, aim.targetY, 9 + game.beamPulse * 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawShip() {
  if (!game.activeShip) {
    return;
  }

  const ship = game.activeShip;
  const x = worldToViewportX(ship.x);
  if (x > game.width + ship.length + 120 || x < -ship.length - 140) {
    return;
  }

  const bob = Math.sin(ship.bobPhase) * ship.bobRange;
  const y = ship.y + bob - ship.sinkOffset;
  const hullTop = y - ship.height * 0.7;
  const deckTop = y - ship.height * 0.34;
  const flashAlpha = ship.flash > 0 ? ship.flash * 0.95 : 0;

  ctx.save();

  ctx.strokeStyle = "rgba(241, 242, 228, 0.18)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - ship.wakeWidth, y + 8);
  ctx.quadraticCurveTo(x - 2, y + 4, x + ship.wakeWidth * 0.9, y + 6);
  ctx.stroke();

  const hullGradient = ctx.createLinearGradient(x, hullTop, x, y + ship.height * 0.2);
  hullGradient.addColorStop(0, ship.hull);
  hullGradient.addColorStop(1, shadeColor(ship.hull, -26));
  ctx.fillStyle = hullGradient;
  ctx.beginPath();
  ctx.moveTo(x + ship.length * 0.03, y);
  ctx.lineTo(x + ship.length * 0.18, hullTop + ship.height * 0.18);
  ctx.lineTo(x + ship.length * (1 - ship.sternDrop * 0.45), hullTop + ship.height * 0.18);
  ctx.lineTo(x + ship.length, y - ship.height * ship.sternDrop);
  ctx.lineTo(x + ship.length * 0.92, y + ship.height * 0.18);
  ctx.lineTo(x + ship.length * 0.08, y + ship.height * 0.18);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = ship.deck;
  ctx.beginPath();
  ctx.moveTo(x + ship.length * 0.14, deckTop);
  ctx.lineTo(x + ship.length * (0.28 + ship.bowLift * 0.2), hullTop);
  ctx.lineTo(x + ship.length * 0.72, hullTop);
  ctx.lineTo(x + ship.length * 0.88, deckTop);
  ctx.closePath();
  ctx.fill();

  const cabinX = x + ship.length * ship.cabinStart;
  const cabinWidth = ship.length * ship.cabinSpan;
  const cabinHeight = ship.height * 0.26;
  ctx.fillStyle = shadeColor(ship.deck, -16);
  ctx.fillRect(cabinX, hullTop - cabinHeight * 0.38, cabinWidth, cabinHeight);

  const bridgeWidth = ship.length * 0.11;
  const bridgeHeight = ship.height * 0.32;
  ctx.fillStyle = ship.bridge;
  ctx.fillRect(cabinX + cabinWidth * 0.36, hullTop - bridgeHeight * 0.62, bridgeWidth, bridgeHeight);

  for (let i = 0; i < ship.gunTurrets; i += 1) {
    const turretX = x + ship.length * (0.14 + i * (0.58 / Math.max(1, ship.gunTurrets)));
    ctx.fillStyle = "#232729";
    ctx.fillRect(turretX, hullTop - 2, ship.length * 0.04, ship.height * 0.06);
  }

  for (let i = 0; i < ship.stacks; i += 1) {
    const stackX = x + ship.length * (0.28 + i * 0.12);
    const stackWidth = ship.length * 0.05;
    const stackHeight = ship.height * (0.28 + i * 0.03);
    ctx.fillStyle = "#252a2d";
    ctx.fillRect(stackX, hullTop - stackHeight * 0.38, stackWidth, stackHeight);
  }

  ship.masts.forEach((mastRatio) => {
    const mastX = x + ship.length * mastRatio;
    const mastHeight = ship.height * 0.82;
    ctx.strokeStyle = "rgba(22, 26, 28, 0.75)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(mastX, hullTop + 2);
    ctx.lineTo(mastX, hullTop - mastHeight * 0.36);
    ctx.stroke();
  });

  for (let i = 0; i < Math.max(2, Math.floor(ship.length / 28)); i += 1) {
    const portX = x + ship.length * 0.16 + i * (ship.length * 0.07);
    ctx.fillStyle = "rgba(241, 235, 209, 0.45)";
    ctx.fillRect(portX, y - ship.height * 0.06, ship.length * 0.035, 2);
  }

  ctx.strokeStyle = "rgba(242, 236, 216, 0.22)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + ship.length * 0.15, deckTop + 2);
  ctx.lineTo(x + ship.length * 0.84, deckTop + 2);
  ctx.stroke();

  ctx.strokeStyle = "rgba(212, 236, 198, 0.18)";
  ctx.beginPath();
  ctx.moveTo(x + ship.length * 0.84, y + 10);
  ctx.quadraticCurveTo(x + ship.length * 0.98, y + 6, x + ship.length * 1.14, y + 11);
  ctx.stroke();

  if (ship.fireTrail > 0) {
    ctx.fillStyle = `rgba(255, 162, 78, ${ship.fireTrail * 0.55})`;
    ctx.beginPath();
    ctx.arc(x + ship.length * 0.58, hullTop - ship.height * 0.18, ship.length * 0.06, 0, Math.PI * 2);
    ctx.fill();
  }

  if (flashAlpha > 0) {
    ctx.fillStyle = `rgba(255, 208, 116, ${flashAlpha})`;
    ctx.beginPath();
    ctx.arc(x + ship.length * 0.54, hullTop + ship.height * 0.16, ship.length * 0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgba(255, 138, 70, ${flashAlpha * 0.85})`;
    ctx.beginPath();
    ctx.arc(x + ship.length * 0.54, hullTop + ship.height * 0.16, ship.length * 0.11, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawTorpedoes() {
  game.torpedoes.forEach((torpedo) => {
    ctx.strokeStyle = "rgba(244, 236, 207, 0.34)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(torpedo.originX, torpedo.originY);
    ctx.lineTo(torpedo.x, torpedo.y);
    ctx.stroke();

    ctx.fillStyle = "#f7ead0";
    ctx.beginPath();
    ctx.arc(torpedo.x, torpedo.y, 6.5, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawExplosions() {
  game.explosions.forEach((explosion) => {
    const alpha = Math.max(0, explosion.life / 0.95);
    ctx.fillStyle = `rgba(255, 209, 131, ${alpha})`;
    ctx.beginPath();
    ctx.arc(explosion.x, explosion.y, explosion.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgba(255, 128, 64, ${alpha * 0.82})`;
    ctx.beginPath();
    ctx.arc(explosion.x, explosion.y, explosion.radius * 0.58, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawSplashes() {
  game.splashes.forEach((splash) => {
    const alpha = Math.max(0, splash.life / 0.65);
    ctx.strokeStyle = `rgba(232, 247, 215, ${alpha})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(splash.x, splash.y, splash.radius, Math.PI, Math.PI * 2);
    ctx.stroke();
  });
}

function drawSmoke() {
  game.smokeBursts.forEach((smoke) => {
    const alpha = Math.max(0, smoke.life / 0.8);
    ctx.fillStyle = `rgba(65, 65, 65, ${alpha * 0.38})`;
    ctx.beginPath();
    ctx.arc(smoke.x, smoke.y, smoke.radius, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawPeriscopeMask() {
  const radiusX = game.width * 0.49;
  const radiusY = game.height * 0.455;
  const centerX = game.width / 2;
  const centerY = game.height / 2 + 8;

  ctx.save();
  ctx.globalCompositeOperation = "destination-in";
  ctx.beginPath();
  ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = "destination-over";
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, game.width, game.height);
  ctx.restore();
}

function shadeColor(hex, amount) {
  const value = hex.replace("#", "");
  const num = Number.parseInt(value, 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0xff) + amount));
  return `rgb(${r}, ${g}, ${b})`;
}

function loop(timestamp) {
  if (!game.lastTime) {
    game.lastTime = timestamp;
  }

  const dt = Math.min(0.033, (timestamp - game.lastTime) / 1000);
  game.lastTime = timestamp;

  update(dt);
  draw();
  requestAnimationFrame(loop);
}

function handleDialPointerDown(event) {
  if (event.target === fireButton) {
    return;
  }

  event.preventDefault();
  ensureAudio();
  game.dialActive = true;
  updateHeadingFromPointer(event.clientX, event.clientY);
  dial.setPointerCapture?.(event.pointerId);
}

function handleDialPointerMove(event) {
  if (!game.dialActive) {
    return;
  }
  event.preventDefault();
  updateHeadingFromPointer(event.clientX, event.clientY);
}

function handleDialPointerUp(event) {
  game.dialActive = false;
  dial.releasePointerCapture?.(event.pointerId);
}

dial.addEventListener("pointerdown", handleDialPointerDown);
dial.addEventListener("pointermove", handleDialPointerMove);
dial.addEventListener("pointerup", handleDialPointerUp);
dial.addEventListener("pointercancel", handleDialPointerUp);

fireButton.addEventListener("click", () => {
  ensureAudio();
  fireTorpedo();
});

restartButton.addEventListener("click", () => {
  ensureAudio();
  resetGame();
});

document.addEventListener("keydown", (event) => {
  if (["ArrowLeft", "ArrowRight", "Space"].includes(event.code)) {
    event.preventDefault();
  }

  if (event.code === "ArrowLeft") {
    game.heading = Math.max(-42, game.heading - 2.5);
    game.beamPulse = 1;
    syncUi();
  }

  if (event.code === "ArrowRight") {
    game.heading = Math.min(42, game.heading + 2.5);
    game.beamPulse = 1;
    syncUi();
  }

  if (event.code === "Space") {
    fireTorpedo();
  }
});

window.addEventListener("resize", positionDialKnob);

resetGame();
requestAnimationFrame(loop);
