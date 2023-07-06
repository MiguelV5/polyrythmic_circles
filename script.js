// ============================== SETUP ==============================

let canvas = document.getElementById("canvas")
let plotter = canvas.getContext("2d");

function getSelector(selector) {
    return document.querySelector(selector);
}

const TOGGLES = {
    sound: getSelector("#sound-toggle"),
}

const COLORS = [
    "#D0E7F5",
    "#D9E7F4",
    "#D6E3F4",
    "#C3D4F0",
    "#BCDFF5",
    "#B7D9F4",
    "#9DC1F3",
    "#9AA9F4",
    "#8D83EF",
    "#889AD5",
    "#7C92D1",
    "#6985CB",
    "#81A2EE",
    "#78A1F6",
    "#6DA0D7",
    "#7AB2DF",
    "#87BDF2",
    "#91CFEF",
    "#90CFEC",
    "#96D5EE",
    "#BEE6F5",
];

let settings = {
    startTime: new Date().getTime(),
    duration: 900, // Total time in seconds for all dots to realign at the starting point. 900 = 15 minutes
    maxCycles: Math.max(COLORS.length, 100),
    soundEnabled: false, // User still must interact with screen first
    pulseEnabled: true, // Pulse will only show if sound is enabled as well
    instrument: "vibraphone" // "default" | "wave" | "vibraphone"
}



// ============================== TOGGLE MANAGER ==============================

function handleSoundToggle(enabled = !settings.soundEnabled) {
    settings.soundEnabled = enabled;
    TOGGLES.sound.dataset.toggled = enabled;
}

document.onvisibilitychange = () => handleSoundToggle(false);

canvas.onclick = () => handleSoundToggle();

// ============================== AUDIOKEYS RETRIEVAL ==============================

function getFileName(index) {
    if (settings.instrument === "default") return `key-${index}`;

    return `${settings.instrument}-key-${index}`;
}

function getUrl(index) {
    return `https://assets.codepen.io/1468070/${getFileName(index)}.wav`;
}

const audioKeys = COLORS.map((color, index) => {
    const audio = new Audio(getUrl(index));

    audio.volume = 0.012;

    return audio;
});

// ============================== CIRCLES ==============================

let circles = [];

function calculateVelocity(index) {
    const numberOfCycles = settings.maxCycles - index;
    const distancePerCycle = 2 * Math.PI;

    return (numberOfCycles * distancePerCycle) / settings.duration;
}

function calculateNextImpactTime(currentImpactTime, velocity) {
    return currentImpactTime + (Math.PI / velocity) * 1000;
}

function calculateDynamicOpacity(currentTime, lastImpactTime, baseOpacity, maxOpacity, duration) {
    const timeSinceImpact = currentTime - lastImpactTime;
    const percentage = Math.min(timeSinceImpact / duration, 1);
    const opacityDelta = maxOpacity - baseOpacity;

    return maxOpacity - (opacityDelta * percentage);
}

function determineOpacity(currentTime, lastImpactTime, baseOpacity, maxOpacity, duration) {
    if (!settings.pulseEnabled) return baseOpacity;

    return calculateDynamicOpacity(currentTime, lastImpactTime, baseOpacity, maxOpacity, duration);
}

function calculatePositionOnArc(center, radius, angle) {
    return {
        x: center.x + radius * Math.cos(angle),
        y: center.y + radius * Math.sin(angle)
    };
}

function playKey(index) { audioKeys[index].play(); }

function init() {
    plotter.lineCap = "round";

    circles = COLORS.map(
        (color, index) => {
            const velocity = calculateVelocity(index);
            const lastImpactTime = 0;
            const nextImpactTime = calculateNextImpactTime(settings.startTime, velocity);

            return {
                color,
                velocity,
                lastImpactTime,
                nextImpactTime
            }
        });
}



// ============================== RENDER SETUP ==============================
function renderSetup() {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;

    const length = Math.min(canvas.width, canvas.height) * 0.9;
    const offset = (canvas.width - length) / 2;

    const start = {
        x: offset,
        y: canvas.height / 2
    }

    const end = {
        x: canvas.width - offset,
        y: canvas.height / 2
    }

    const center = {
        x: canvas.width / 2,
        y: canvas.height / 2
    }

    const base = {
        length: end.x - start.x,
        minAngle: 0,
        startAngle: 0,
        maxAngle: 2 * Math.PI
    }

    base.initialRadius = base.length * 0.05;
    base.circleRadius = base.length * 0.006;
    base.clearance = base.length * 0.03;
    base.spacing = (base.length - base.initialRadius - base.clearance) / 2 / COLORS.length;

    return {
        center,
        base
    }
}

// ============================== SMALL RENDERING ==============================

function drawArc(x, y, radius, start, end, action = "stroke") {
    plotter.beginPath();

    plotter.arc(x, y, radius, start, end);

    if (action === "stroke") plotter.stroke();
    else plotter.fill();
}

function drawDotOnArc(center, arcRadius, dotRadius, angle) {
    const position = calculatePositionOnArc(center, arcRadius, angle);

    drawArc(position.x, position.y, dotRadius, 0, 2 * Math.PI, "fill");
}

// ============================== COMPOSED RENDERING ==============================

function renderBgCircle(center, radius, color, currentTime, lastImpactTime, baseRadius, baseLength) {
    plotter.globalAlpha = determineOpacity(currentTime, lastImpactTime, 0.15, 0.65, 1000);
    plotter.lineWidth = baseLength * 0.002;
    plotter.strokeStyle = color;

    const offset = baseRadius * (5 / 3) / radius;

    drawArc(center.x, center.y, radius, Math.PI + offset, (2 * Math.PI) - offset);
    drawArc(center.x, center.y, radius, offset, Math.PI - offset);
}

function renderBgImpactPoints(center, radius, color, currentTime, lastImpactTime, baseRadius) {
    plotter.globalAlpha = determineOpacity(currentTime, lastImpactTime, 0.15, 0.85, 1000);
    plotter.fillStyle = color;

    drawDotOnArc(center, radius, baseRadius * 0.75, Math.PI);
    drawDotOnArc(center, radius, baseRadius * 0.75, 2 * Math.PI);
}

function renderMovingDot(center, radius, index, currentTime, circle, elapsedTime, baseRadius, baseMaxAngle) {
    plotter.globalAlpha = 1;
    plotter.fillStyle = circle.color;

    if (currentTime >= circle.nextImpactTime) {
        if (settings.soundEnabled) {
            playKey(index);
            circle.lastImpactTime = circle.nextImpactTime;
        }

        circle.nextImpactTime = calculateNextImpactTime(circle.nextImpactTime, circle.velocity);
    }

    const distance = elapsedTime >= 0 ? (elapsedTime * circle.velocity) : 0;
    const angle = (Math.PI + distance) % baseMaxAngle;

    drawDotOnArc(center, radius, baseRadius, angle);
}

function render() {

    const currentTime = new Date().getTime();
    const elapsedTime = (currentTime - settings.startTime) / 1000;

    const { center, base } = renderSetup();


    circles.forEach((circle, index) => {
        const radius = base.initialRadius + (base.spacing * index);

        renderBgCircle(center, radius, circle.color, currentTime, circle.lastImpactTime, base.circleRadius, base.length);

        renderBgImpactPoints(center, radius, circle.color, currentTime, circle.lastImpactTime, base.circleRadius);

        renderMovingDot(center, radius, index, currentTime, circle, elapsedTime, base.circleRadius, base.maxAngle);
    });

    requestAnimationFrame(render);
}

init();

render();
