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

const game = {
  width: canvas.width,
  height: canvas.height,
  heading: 0,
  score: 0,
  torpedoesLeft: 10,
  totalTorpedoes: 10,
  targetsDestroyed: 0,
  totalTargets: 10,
  status: "ready",
  ships: [],
  torpedoes: [],
  explosions: [],
  splashes: [],
  clouds: [],
  audio: {
    context: null,
    master: null
  },
  dialActive: false,
  lastTime: 0
};

function createShips() {
  const templates = [
    { length: 128, height: 34, speed: 16, lane: 0.10, tone: "#7b6e62", bridge: 0.25, score: 130 },
    { length: 160, height: 38, speed: 12, lane: 0.15, tone: "#44535e", bridge: 0.48, score: 160 },
    { length: 118, height: 28, speed: 18, lane: 0.18, tone: "#9a4b48", bridge: 0.2, score: 120 },
    { length: 154, height: 36, speed: 14, lane: 0.22, tone: "#59656b", bridge: 0.58, score: 170 },
    { length: 102, height: 25, speed: 20, lane: 0.28, tone: "#8d7a57", bridge: 0.35, score: 110 },
    { length: 140, height: 34, speed: 15, lane: 0.35, tone: "#4f5f63", bridge: 0.43, score: 150 },
    { length: 168, height: 42, speed: 11, lane: 0.42, tone: "#6f6660", bridge: 0.52, score: 180 },
    { length: 126, height: 30, speed: 17, lane: 0.48, tone: "#7b4242", bridge: 0.29, score: 140 },
    { length: 150, height: 33, speed: 13, lane: 0.54, tone: "#49545d", bridge: 0.61, score: 165 },
    { length: 112, height: 26, speed: 19, lane: 0.60, tone: "#8d7560", bridge: 0.26, score: 125 }
  ];

  return templates.map((template, index) => ({
    id: index + 1,
    x: -460 + index * 220,
    y: 260 + template.lane * 260,
    ...template,
    destroyed: false,
    flash: 0,
    smoke: Math.random() * Math.PI * 2
  }));
}

function resetGame() {
  game.heading = 0;
  game.score = 0;
  game.torpedoesLeft = game.totalTorpedoes;
  game.targetsDestroyed = 0;
  game.status = "ready";
  game.ships = createShips();
  game.torpedoes = [];
  game.explosions = [];
  game.splashes = [];
  game.clouds = createClouds();
  syncUi();
  setMessage("ГОТОВНОСТЬ", "Поверни перископ и нажми центр круга, чтобы выпустить торпеду.");
}

function createClouds() {
  return Array.from({ length: 8 }, (_, index) => ({
    x: 120 + index * 140 + Math.random() * 70,
    y: 84 + Math.random() * 120,
    size: 36 + Math.random() * 48
  }));
}

function setMessage(title, text) {
  messageTitle.textContent = title;
  messageText.textContent = text;
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
  game.heading = Math.max(-40, Math.min(40, angle));
  syncUi();
}

function startBattleIfNeeded() {
  if (game.status === "ready") {
    game.status = "running";
    setMessage("БОЙ НАЧАЛСЯ", "Поворачивай перископ, веди цель и экономь торпеды.");
    playSound("start");
  }
}

function fireTorpedo() {
  if (game.torpedoesLeft <= 0 || game.status === "won" || game.status === "lost") {
    return;
  }

  startBattleIfNeeded();
  game.torpedoesLeft -= 1;

  const baseX = game.width / 2 + game.heading * 4.8;
  const baseY = game.height - 118;
  const aimX = game.width / 2 + game.heading * 8.4;
  const aimY = 286 + Math.abs(game.heading) * 0.9;

  game.torpedoes.push({
    x: baseX,
    y: baseY,
    originX: baseX,
    originY: baseY,
    targetX: aimX,
    targetY: aimY,
    progress: 0,
    speed: 0.42 + Math.random() * 0.05,
    active: true,
    hitTargetId: null
  });

  syncUi();
  playSound("fire");

  if (game.torpedoesLeft === 0) {
    setMessage("ПОСЛЕДНЯЯ ТОРПЕДА", "Это был твой последний шанс. Смотри, будет ли попадание.");
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

function update(dt) {
  if (game.status === "won" || game.status === "lost") {
    animateEffects(dt);
    return;
  }

  game.ships.forEach((ship) => {
    if (ship.destroyed) {
      ship.flash = Math.max(0, ship.flash - dt * 2.5);
      return;
    }

    ship.x += ship.speed * dt;
    ship.smoke += dt;

    if (ship.x > game.width + 220) {
      ship.x = -240 - Math.random() * 240;
    }
  });

  game.torpedoes.forEach((torpedo) => {
    if (!torpedo.active) {
      return;
    }

    torpedo.progress += dt * torpedo.speed;
    const eased = Math.min(1, torpedo.progress);
    torpedo.x = torpedo.originX + (torpedo.targetX - torpedo.originX) * eased;
    torpedo.y = torpedo.originY + (torpedo.targetY - torpedo.originY) * eased;

    if (torpedo.progress >= 1) {
      const visibleShips = game.ships.filter((ship) => !ship.destroyed);
      const target = visibleShips.find((ship) => {
        const visibleX = worldToViewportX(ship.x);
        return (
          torpedo.x > visibleX &&
          torpedo.x < visibleX + ship.length &&
          torpedo.y > ship.y - 12 &&
          torpedo.y < ship.y + ship.height + 18
        );
      });

      if (target) {
        target.destroyed = true;
        target.flash = 1;
        game.targetsDestroyed += 1;
        game.score += target.score;
        createExplosion(worldToViewportX(target.x) + target.length * 0.5, target.y + target.height * 0.4);
        playSound("hit");
      } else {
        createSplash(torpedo.x, torpedo.y);
        playSound("miss");
      }

      torpedo.active = false;
    }
  });

  game.torpedoes = game.torpedoes.filter((torpedo) => torpedo.active);
  animateEffects(dt);
  syncUi();

  if (game.targetsDestroyed === game.totalTargets) {
    game.status = "won";
    setMessage("ПОБЕДА", "Все десять кораблей поражены. Лодка возвращается на базу.");
    playSound("win");
  } else if (game.torpedoesLeft === 0 && game.torpedoes.length === 0) {
    game.status = "lost";
    setMessage("БОЕКОМПЛЕКТ ИСЧЕРПАН", "Торпеды закончились. Начни новый бой и скорректируй огонь.");
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
  return worldX - game.heading * 10.5;
}

function draw() {
  ctx.clearRect(0, 0, game.width, game.height);
  drawSky();
  drawSea();
  drawShore();
  drawShips();
  drawTorpedoes();
  drawSplashes();
  drawExplosions();
  drawPeriscopeMask();
}

function drawSky() {
  const gradient = ctx.createLinearGradient(0, 0, 0, game.height);
  gradient.addColorStop(0, "#a8b59a");
  gradient.addColorStop(0.38, "#6f8d7b");
  gradient.addColorStop(0.72, "#32453a");
  gradient.addColorStop(1, "#0d1713");
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
  const horizon = 370;
  const gradient = ctx.createLinearGradient(0, horizon, 0, game.height);
  gradient.addColorStop(0, "#4a735f");
  gradient.addColorStop(0.45, "#193227");
  gradient.addColorStop(1, "#08100d");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, horizon, game.width, game.height - horizon);

  for (let i = 0; i < 22; i += 1) {
    const y = horizon + i * 16;
    ctx.strokeStyle = `rgba(207, 236, 181, ${0.22 - i * 0.007})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = -120; x <= game.width + 120; x += 46) {
      const waveX = x + ((i % 2) * 18);
      const waveY = y + Math.sin((waveX + game.heading * 18 + i * 12) * 0.014) * (4 + i * 0.08);
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
  ctx.moveTo(-80 - game.heading * 1.5, 376);
  ctx.lineTo(26 - game.heading * 1.5, 270);
  ctx.lineTo(92 - game.heading * 1.5, 376);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#253424";
  ctx.beginPath();
  ctx.moveTo(40 - game.heading * 1.5, 376);
  ctx.lineTo(78 - game.heading * 1.5, 312);
  ctx.lineTo(124 - game.heading * 1.5, 376);
  ctx.closePath();
  ctx.fill();
}

function drawShips() {
  game.ships.forEach((ship) => {
    if (ship.destroyed && ship.flash <= 0) {
      return;
    }

    const x = worldToViewportX(ship.x);
    if (x > game.width + 200 || x < -220) {
      return;
    }

    const y = ship.y;
    const bob = Math.sin((ship.x + ship.smoke * 40) * 0.02) * 4;
    const flashAlpha = ship.flash > 0 ? ship.flash * 0.85 : 0;

    ctx.fillStyle = ship.tone;
    ctx.fillRect(x, y + bob, ship.length, ship.height * 0.5);

    ctx.beginPath();
    ctx.moveTo(x + ship.length * 0.12, y + bob);
    ctx.lineTo(x + ship.length * 0.26, y - ship.height * 0.34 + bob);
    ctx.lineTo(x + ship.length * 0.74, y - ship.height * 0.34 + bob);
    ctx.lineTo(x + ship.length * 0.88, y + bob);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#2e3333";
    ctx.fillRect(x + ship.length * ship.bridge, y - ship.height * 0.52 + bob, ship.length * 0.12, ship.height * 0.28);

    ctx.fillStyle = "rgba(250, 241, 202, 0.25)";
    ctx.fillRect(x + 10, y + bob + 3, ship.length * 0.35, 4);

    if (flashAlpha > 0) {
      ctx.fillStyle = `rgba(255, 206, 122, ${flashAlpha})`;
      ctx.fillRect(x - 4, y - ship.height * 0.5 + bob, ship.length + 8, ship.height + 14);
    }
  });
}

function drawTorpedoes() {
  game.torpedoes.forEach((torpedo) => {
    ctx.strokeStyle = "rgba(244, 236, 207, 0.38)";
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
    game.heading = Math.max(-40, game.heading - 2.5);
    syncUi();
  }

  if (event.code === "ArrowRight") {
    game.heading = Math.min(40, game.heading + 2.5);
    syncUi();
  }

  if (event.code === "Space") {
    fireTorpedo();
  }
});

window.addEventListener("resize", positionDialKnob);

resetGame();
requestAnimationFrame(loop);
