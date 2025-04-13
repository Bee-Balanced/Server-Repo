// beeAnimation.js

const canvas = document.getElementById("bee-animation-canvas");
const ctx = canvas.getContext("2d");
canvas.width = canvas.offsetWidth;
canvas.height = canvas.offsetHeight;

// Load all images
const images = {
  bee: new Image(),
  sky: new Image(),
  sun: new Image(),
  house: new Image(),
  tree: new Image(),
  hive: new Image()
};

images.bee.src = "/images/bee.png";
images.sky.src = "/images/sky.png";
images.sun.src = "/images/sun.png";
images.house.src = "/images/house.png";
images.tree.src = "/images/tree.png";
images.hive.src = "/images/bee_hive.png";

// Wait for all images to load before animating
let loadedImages = 0;
const totalImages = Object.keys(images).length;

for (const key in images) {
  images[key].onload = () => {
    loadedImages++;
    if (loadedImages === totalImages) {
      startAnimation();
    }
  };
}

// Prepare bee data
const bees = [];

const wellnessScores = [
  ...(<%- JSON.stringify(overallData || []) %>),
  ...(<%- JSON.stringify(mentalData || []) %>),
  ...(<%- JSON.stringify(physicalData || []) %>)
];
const validScores = wellnessScores.filter(s => typeof s === "number");
const averageScore = validScores.length
  ? validScores.reduce((sum, val) => sum + val, 0) / validScores.length
  : 5;
const numBees = Math.min(10, Math.max(1, Math.round(averageScore)));

for (let i = 0; i < numBees; i++) {
  bees.push({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    dx: Math.random() * 2 - 1,
    dy: Math.random() * 2 - 1,
    angle: Math.random() * Math.PI * 2
  });
}

function updateBee(bee) {
  bee.x += bee.dx;
  bee.y += bee.dy;
  bee.angle += 0.05;
  if (bee.x < 0 || bee.x > canvas.width) bee.dx *= -1;
  if (bee.y < 0 || bee.y > canvas.height) bee.dy *= -1;
}

function drawBee(bee) {
  ctx.save();
  ctx.translate(bee.x, bee.y);
  ctx.rotate(bee.angle);
  ctx.drawImage(images.bee, -12, -12, 24, 24);
  ctx.restore();
}

function drawBackground() {
  // Draw sky (already includes clouds and grass)
  ctx.drawImage(images.sky, 0, 0, canvas.width, canvas.height);

  // Draw sun in top right
  ctx.drawImage(images.sun, canvas.width - 100, 20, 80, 80);

  // Draw house on the left
  ctx.drawImage(images.house, 30, canvas.height - 160, 140, 140);

  // Draw tree with hive on the right
  ctx.drawImage(images.tree, canvas.width - 180, canvas.height - 220, 160, 200);
  ctx.drawImage(images.hive, canvas.width - 120, canvas.height - 180, 40, 50);
}

function animateBees() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground();
  bees.forEach(bee => {
    updateBee(bee);
    drawBee(bee);
  });
  requestAnimationFrame(animateBees);
}

function startAnimation() {
  animateBees();
}
