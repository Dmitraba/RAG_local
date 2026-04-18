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
  { id: 1, name: "escort", length: 86, height: 24, speed: 134, lane: 0, hull: "#59666c", deck: "#8b9594", bridge: "#353f45", stacks: 1, masts: 1, score: 210, bowLift: 0.34, sternDrop: 0.2 },
  { id: 2, name: "freighter", length: 164, height: 38, speed: 92, lane: 1, hull: "#6b6257", deck: "#a79a83", bridge: "#413d39", stacks: 2, masts: 1, score: 120, bowLift: 0.26, sternDrop: 0.12 },
  { id: 3, name: "destroyer", length: 112, height: 28, speed: 126, lane: 2, hull: "#465861", deck: "#9ba8ae", bridge: "#293238", stacks: 2, masts: 1, score: 180, bowLift: 0.38, sternDrop: 0.18 },
  { id: 4, name: "cargo", length: 176, height: 40, speed: 88, lane: 0, hull: "#7c7267", deck: "#b6ab92", bridge: "#474036", stacks: 2, masts: 2, score: 115, bowLift: 0.22, sternDrop: 0.1 },
  { id: 5, name: "patrol", length: 78, height: 22, speed: 144, lane: 1, hull: "#7b5651", deck: "#c4b39e", bridge: "#412925", stacks: 1, masts: 1, score: 230, bowLift: 0.42, sternDrop: 0.24 },
  { id: 6, name: "cruiser", length: 142, height: 34, speed: 104, lane: 2, hull: "#4d5b63", deck: "#9da7ab", bridge: "#313a3f", stacks: 2, masts: 2, score: 145, bowLift: 0.3, sternDrop: 0.14 },
  { id: 7, name: "raider", length: 98, height: 24, speed: 132, lane: 0, hull: "#8d4f49", deck: "#cfb29a", bridge: "#542824", stacks: 1, masts: 2, score: 190, bowLift: 0.4, sternDrop: 0.22 },
  { id: 8, name: "gunboat", length: 72, height: 20, speed: 152, lane: 1, hull: "#50595f", deck: "#b7bbb4", bridge: "#34393d", stacks: 1, masts: 1, score: 250, bowLift: 0.46, sternDrop: 0.28 },
  { id: 9, name: "transport", length: 156, height: 36, speed: 96, lane: 2, hull: "#6a6059", deck: "#b8ab94", bridge: "#3d3832", stacks: 2, masts: 2, score: 130, bowLift: 0.24, sternDrop: 0.12 },
  { id: 10, name: "torpedo", length: 90, height: 23, speed: 140, lane: 1, hull: "#566167", deck: "#c2c3bf", bridge: "#2e3538", stacks: 1, masts: 1, score: 220, bowLift: 0.44, sternDrop: 0.24 }
];

const LANES = [
  { y: 314, bob: 2.4 },
  { y: 334, bob: 2.8 },
  { y: 352, bob: 3.2 }
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

function createShipInstance(target, returning = false) {
  const lane = LANES[target.lane % LANES.length];
  return {
    ...target,
    x: returning ? -target.length - 120 : -target.length - 260,
    y: lane.y,
    bobRange: lane.bob,
    bobPhase: Math.random() * Math.PI * 2,
    flash: 0,
    wake: 0,
    returning
  };
}

function spawnCurrentShip(returning = false) {
  const nextTarget = game.targetQueue[game.currentTargetIndex];
  if (!nextTarget || nextTarget.destroyed) {
    game.activeShip = null;
    return;
  }
  game.activeShip = createShipInstance(nextTarget, returning);
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
  game.clouds = createClouds();
  game.beamPulse = 0.5;
  spawnCurrentShip(false);
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
  const horizonY = 332;
  const targetX = game.width / 2 + game.heading * 8.2;
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
    originX: aim.originX,
    originY: aim.originY,
    targetX: aim.targetX,
    targetY: aim.targetY,
    progress: 0,
    speed: 0.62,
    active: true
  });

  game.beamPulse = 1;
  syncUi();
  playSound("fire");

  if (game.torpedoesLeft === 0) {
    setMessage("ПОСЛЕДНЯЯ ТОРПЕДА", "Финальный выстрел ушел в море. Смотри, будет ли попадание.");
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
  master.gain.value = 0.05;
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
  oscillator.stop(now + duration + 0.03);
}

function playSound(kind) {
  ensureAudio();
  if (!game.audio.context) {
    return;
  }

  if (kind === "start") {
    tone({ frequency: 210, duration: 0.12, type: "triangle", volume: 0.16, slide: 280 });
    setTimeout(() => tone({ frequency: 280, duration: 0.14, type: "triangle", volume: 0.13, slide: 360 }), 80);
    return;
  }

  if (kind === "fire") {
    tone({ frequency: 120, duration: 0.28, type: "sawtooth", volume: 0.18, slide: 80 });
    return;
  }

  if (kind === "hit") {
    tone({ frequency: 280, duration: 0.12, type: "square", volume: 0.18, slide: 480 });
    setTimeout(() => tone({ frequency: 440, duration: 0.16, type: "triangle", volume: 0.16, slide: 720 }), 60);
    return;
  }

  if (kind === "miss") {
    tone({ frequency: 170, duration: 0.2, type: "triangle", volume: 0.13, slide: 110 });
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

function advanceToNextShip() {
  game.currentTargetIndex += 1;
  if (game.currentTargetIndex >= game.targetQueue.length) {
    game.activeShip = null;
    return;
  }
  game.shipRespawnTimer = 0.85;
  game.activeShip = null;
}

function hitActiveShip() {
  if (!game.activeShip) {
    return;
  }

  game.targetQueue[game.currentTargetIndex].destroyed = true;
  game.activeShip.flash = 1;
  game.targetsDestroyed += 1;
  game.score += game.activeShip.score;
  createExplosion(worldToViewportX(game.activeShip.x) + game.activeShip.length * 0.52, game.activeShip.y - game.activeShip.height * 0.2);
  playSound("hit");
  advanceToNextShip();
}

function updateShip(dt) {
  if (!game.activeShip) {
    if (game.shipRespawnTimer > 0) {
      game.shipRespawnTimer = Math.max(0, game.shipRespawnTimer - dt);
      if (game.shipRespawnTimer === 0) {
        spawnCurrentShip(false);
      }
    }
    return;
  }

  game.activeShip.x += game.activeShip.speed * dt;
  game.activeShip.bobPhase += dt * 2.2;
  game.activeShip.wake += dt * 3.1;
  game.activeShip.flash = Math.max(0, game.activeShip.flash - dt * 2.8);

  if (game.activeShip.x > game.width + game.activeShip.length + 180) {
    spawnCurrentShip(true);
  }
}

function resolveTorpedo(torpedo) {
  if (game.activeShip) {
    const visibleX = worldToViewportX(game.activeShip.x);
    const hullTop = game.activeShip.y - game.activeShip.height * 0.78;
    const hullBottom = game.activeShip.y + game.activeShip.height * 0.26;
    const hitPadding = Math.max(4, 20 - game.activeShip.length * 0.08);
    const hit =
      torpedo.x > visibleX - hitPadding &&
      torpedo.x < visibleX + game.activeShip.length + hitPadding &&
      torpedo.y > hullTop &&
      torpedo.y < hullBottom;

    if (hit) {
      hitActiveShip();
      torpedo.active = false;
      return;
    }
  }

  createSplash(torpedo.x, torpedo.y);
  playSound("miss");
  torpedo.active = false;
}

function updateTorpedoes(dt) {
  game.torpedoes.forEach((torpedo) => {
    if (!torpedo.active) {
      return;
    }

    torpedo.progress += dt * torpedo.speed;
    const eased = Math.min(1, 1 - Math.pow(1 - torpedo.progress, 1.6));
    torpedo.x = torpedo.originX + (torpedo.targetX - torpedo.originX) * eased;
    torpedo.y = torpedo.originY + (torpedo.targetY - torpedo.originY) * eased;

    if (torpedo.progress >= 1) {
      resolveTorpedo(torpedo);
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

  if (game.targetsDestroyed === game.totalTargets) {
    game.status = "won";
    setMessage("ПОБЕДА", "Все десять кораблей поражены. Боекомплект израсходован образцово.");
    playSound("win");
  } else if (game.torpedoesLeft === 0 && game.torpedoes.length === 0) {
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
}

function createExplosion(x, y) {
  game.explosions.push({
    x,
    y,
    radius: 24,
    life: 0.8
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
  const y = ship.y + bob;
  const hullTop = y - ship.height * 0.7;
  const deckTop = y - ship.height * 0.34;
  const flashAlpha = ship.flash > 0 ? ship.flash * 0.9 : 0;

  ctx.save();

  ctx.strokeStyle = "rgba(241, 242, 228, 0.18)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 20, y + 8);
  ctx.quadraticCurveTo(x - 2, y + 4, x + 18, y + 6);
  ctx.stroke();

  const hullGradient = ctx.createLinearGradient(x, hullTop, x, y + ship.height * 0.2);
  hullGradient.addColorStop(0, ship.hull);
  hullGradient.addColorStop(1, shadeColor(ship.hull, -22));
  ctx.fillStyle = hullGradient;
  ctx.beginPath();
  ctx.moveTo(x + ship.length * 0.03, y);
  ctx.lineTo(x + ship.length * 0.18, hullTop + ship.height * 0.18);
  ctx.lineTo(x + ship.length * (1 - ship.sternDrop * 0.55), hullTop + ship.height * 0.18);
  ctx.lineTo(x + ship.length, y - ship.height * ship.sternDrop);
  ctx.lineTo(x + ship.length * 0.92, y + ship.height * 0.18);
  ctx.lineTo(x + ship.length * 0.08, y + ship.height * 0.18);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = ship.deck;
  ctx.beginPath();
  ctx.moveTo(x + ship.length * 0.16, deckTop);
  ctx.lineTo(x + ship.length * (0.3 + ship.bowLift * 0.18), hullTop);
  ctx.lineTo(x + ship.length * 0.72, hullTop);
  ctx.lineTo(x + ship.length * 0.88, deckTop);
  ctx.lineTo(x + ship.length * 0.16, deckTop);
  ctx.fill();

  const cabinX = x + ship.length * 0.4;
  const cabinWidth = ship.length * 0.18;
  const cabinHeight = ship.height * 0.24;
  ctx.fillStyle = shadeColor(ship.deck, -14);
  ctx.fillRect(cabinX, hullTop - cabinHeight * 0.42, cabinWidth, cabinHeight);

  ctx.fillStyle = ship.bridge;
  const bridgeWidth = ship.length * 0.12;
  const bridgeHeight = ship.height * 0.3;
  ctx.fillRect(x + ship.length * 0.55, hullTop - bridgeHeight * 0.58, bridgeWidth, bridgeHeight);

  for (let i = 0; i < ship.stacks; i += 1) {
    const stackX = x + ship.length * (0.35 + i * 0.13);
    const stackWidth = ship.length * 0.05;
    const stackHeight = ship.height * (0.28 + i * 0.04);
    ctx.fillStyle = "#252a2d";
    ctx.fillRect(stackX, hullTop - stackHeight * 0.38, stackWidth, stackHeight);
  }

  for (let i = 0; i < ship.masts; i += 1) {
    const mastX = x + ship.length * (0.22 + i * 0.34);
    const mastHeight = ship.height * 0.82;
    ctx.strokeStyle = "rgba(22, 26, 28, 0.75)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(mastX, hullTop + 2);
    ctx.lineTo(mastX, hullTop - mastHeight * 0.36);
    ctx.stroke();
  }

  for (let i = 0; i < Math.max(2, Math.floor(ship.length / 30)); i += 1) {
    const portX = x + ship.length * 0.18 + i * (ship.length * 0.08);
    ctx.fillStyle = "rgba(241, 235, 209, 0.4)";
    ctx.fillRect(portX, y - ship.height * 0.06, ship.length * 0.04, 2);
  }

  ctx.strokeStyle = "rgba(242, 236, 216, 0.22)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + ship.length * 0.18, deckTop + 2);
  ctx.lineTo(x + ship.length * 0.82, deckTop + 2);
  ctx.stroke();

  ctx.strokeStyle = "rgba(212, 236, 198, 0.18)";
  ctx.beginPath();
  ctx.moveTo(x + ship.length * 0.84, y + 10);
  ctx.quadraticCurveTo(x + ship.length * 0.96, y + 6, x + ship.length * 1.1, y + 11);
  ctx.stroke();

  if (flashAlpha > 0) {
    ctx.fillStyle = `rgba(255, 208, 116, ${flashAlpha})`;
    ctx.beginPath();
    ctx.arc(x + ship.length * 0.54, hullTop + ship.height * 0.18, ship.length * 0.18, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgba(255, 138, 70, ${flashAlpha * 0.82})`;
    ctx.beginPath();
    ctx.arc(x + ship.length * 0.54, hullTop + ship.height * 0.18, ship.length * 0.1, 0, Math.PI * 2);
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
    ctx.arc(torpedo.x, torpedo.y, 7, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawExplosions() {
  game.explosions.forEach((explosion) => {
    const alpha = Math.max(0, explosion.life / 0.8);
    ctx.fillStyle = `rgba(255, 209, 131, ${alpha})`;
    ctx.beginPath();
    ctx.arc(explosion.x, explosion.y, explosion.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgba(255, 128, 64, ${alpha * 0.8})`;
    ctx.beginPath();
    ctx.arc(explosion.x, explosion.y, explosion.radius * 0.56, 0, Math.PI * 2);
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
