// beeAnimation.js

const canvas = document.getElementById("bee-animation-canvas");
const ctx = canvas.getContext("2d");
canvas.width = canvas.offsetWidth;
canvas.height = canvas.offsetHeight;

// Load bee image
const beeImg = new Image();
beeImg.src = "/images/bee.png";

// Create bee objects
const bees = [];
const numBees = 5; // You can make this dynamic based on survey data

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
  bee.angle += 0.1;

  // Bounce off edges
  if (bee.x < 0 || bee.x > canvas.width) bee.dx *= -1;
  if (bee.y < 0 || bee.y > canvas.height) bee.dy *= -1;
}

function drawBee(bee) {
  ctx.save();
  ctx.translate(bee.x, bee.y);
  ctx.rotate(bee.angle);
  ctx.drawImage(beeImg, -12, -12, 24, 24);
  ctx.restore();
}

function animateBees() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  bees.forEach(bee => {
    updateBee(bee);
    drawBee(bee);
  });
  requestAnimationFrame(animateBees);
}

beeImg.onload = () => {
  animateBees();
};
