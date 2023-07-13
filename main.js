// ============================== SETUP ==============================

window.addEventListener("load", () => {
    const loader = document.querySelector(".loader");
    loader.classList.add("loader-hidden");
    loader.addEventListener("transitionend", () => loader.remove());
});


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

const INSTRUMENTS = {
    default: "default",
    wave: "wave",
    vibraphone: "vibraphone",
    pink_carol: "pink_carol",
    xylophone: "xylophone"
}

let settings = {
    startTime: new Date().getTime(),
    duration: 900, // Total time in seconds for all dots to realign at the starting point. 900 = 15 minutes
    maxCycles: Math.max(COLORS.length, 100),
    soundEnabled: false, // User still must interact with screen first
    pulseEnabled: true, // Pulse will only show if sound is enabled as well
    instrument: INSTRUMENTS.vibraphone,
    defaultBaseOpacity: 0.25,
    defaultMaxOpacity: 0.9,
    defaultPulseDuration: 1000
}




// ============================== TOGGLE MANAGER ==============================

function handleSoundToggle(enabled = !settings.soundEnabled) {
    settings.soundEnabled = enabled;
    TOGGLES.sound.dataset.toggled = enabled;
}

document.onvisibilitychange = () => handleSoundToggle(false);

function handleFirstInteraction() {
    handleSoundToggle();

    canvas.removeEventListener("click", handleFirstInteraction);
    canvas.onclick = () => handleSoundToggle(); // override onclick for future usage

    settings.startTime = new Date().getTime(); // reset start time for proper animation

    const soundMessage = document.querySelector(".sound-message-text");
    soundMessage.textContent = "Click anywhere to toggle sound";

    initCircles(); // reset circles for proper impact times
    render(); // start animation
}

canvas.addEventListener("click", handleFirstInteraction);

// ============================== AUDIOKEYS RETRIEVAL ==============================

function getSoundFileStem(index) {
    if (settings.instrument === "default") return `key-${index}`;

    return `${settings.instrument}-key-${index}`;
}

function getSoundPath(index) {
    if (
        settings.instrument === INSTRUMENTS.default ||
        settings.instrument === INSTRUMENTS.wave ||
        settings.instrument === INSTRUMENTS.vibraphone
    ) {
        return `https://assets.codepen.io/1468070/${getSoundFileStem(index)}.wav`; // Original Skel Audio
    }
    else {
        return `./assets/${settings.instrument}/${getSoundFileStem(index)}.mp3`;
    }
}

const audioKeys = COLORS.map((color, index) => {
    const audio = new Audio(getSoundPath(index));

    audio.volume = 0.018;

    return audio;
});

// ============================== CIRCLES ==============================

let circles = [];

function calculateAngularVelocity(index) {
    const numberOfCycles = settings.maxCycles - index;
    const angularDistancePerCycle = 2 * Math.PI;

    return (numberOfCycles * angularDistancePerCycle) / settings.duration;
}

function calculateNextImpactTime(currentImpactTime, angularVelocity) {
    return currentImpactTime + (Math.PI / angularVelocity) * 1000;
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

function initCircles() {
    plotter.lineCap = "round";

    circles = COLORS.map(
        (color, index) => {
            const angularVelocity = calculateAngularVelocity(index);
            const lastImpactTime = 0;
            const nextImpactTime = calculateNextImpactTime(settings.startTime, angularVelocity);

            return {
                color,
                angularVelocity,
                lastImpactTime,
                nextImpactTime
            }
        });
}



// ============================== RENDER SETUP ==============================

function setupForRenderer() {
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
    base.clearance = base.length * 0.02;
    base.spacing = (base.length - base.initialRadius - base.clearance) / 2 / COLORS.length;

    return {
        center,
        base
    }
}

// ============================== SMALL RENDERING ==============================

function renderArc(x, y, radius, start, end, action = "stroke") {
    plotter.beginPath();

    plotter.arc(x, y, radius, start, end);

    if (action === "stroke") plotter.stroke();
    else plotter.fill();
}

function renderDotOnArc(center, arcRadius, dotRadius, angle) {
    const position = calculatePositionOnArc(center, arcRadius, angle);

    renderArc(position.x, position.y, dotRadius, 0, 2 * Math.PI, "fill");
}

// ============================== COMPOSED RENDERING ==============================

function renderBgCircle(center, radiusFromCenter, color, currentTime, lastImpactTime, baseRadius, baseLength) {
    plotter.globalAlpha = determineOpacity(
        currentTime,
        lastImpactTime,
        settings.defaultBaseOpacity,
        settings.defaultMaxOpacity,
        settings.defaultPulseDuration
    );
    plotter.lineWidth = baseLength * 0.002;
    plotter.strokeStyle = color;

    const offset = baseRadius * (5 / 3) / radiusFromCenter;

    renderArc(center.x, center.y, radiusFromCenter, Math.PI + offset, (2 * Math.PI) - offset);
    renderArc(center.x, center.y, radiusFromCenter, offset, Math.PI - offset);
}

function renderBgImpactPoints(center, radiusFromCenter, color, currentTime, lastImpactTime, baseRadius) {
    plotter.globalAlpha = determineOpacity(
        currentTime,
        lastImpactTime,
        settings.defaultBaseOpacity,
        settings.defaultMaxOpacity,
        settings.defaultPulseDuration
    );
    plotter.fillStyle = color;

    renderDotOnArc(center, radiusFromCenter, baseRadius * 0.75, Math.PI);
    renderDotOnArc(center, radiusFromCenter, baseRadius * 0.75, 2 * Math.PI);
}

function renderMovingDot(center, radiusFromCenter, index, currentTime, circle, elapsedTime, baseRadius, baseMaxAngle) {
    plotter.globalAlpha = 1;
    plotter.fillStyle = circle.color;

    if (currentTime >= circle.nextImpactTime) {
        if (settings.soundEnabled) {
            playKey(index);
            circle.lastImpactTime = circle.nextImpactTime;
        }

        circle.nextImpactTime = calculateNextImpactTime(circle.nextImpactTime, circle.angularVelocity);
    }

    const angularDistance = elapsedTime >= 0 ? (elapsedTime * circle.angularVelocity) : 0;
    const angle = (Math.PI + angularDistance) % baseMaxAngle;

    renderDotOnArc(center, radiusFromCenter, baseRadius, angle);
}

// ============================== (STATIC) COMPOSED RENDERING ==============================

function renderStaticBgCircle(center, radiusFromCenter, color, baseRadius, baseLength) {
    plotter.globalAlpha = settings.defaultBaseOpacity;
    plotter.lineWidth = baseLength * 0.002;
    plotter.strokeStyle = color;

    renderArc(center.x, center.y, radiusFromCenter, Math.PI, 2 * Math.PI);
    renderArc(center.x, center.y, radiusFromCenter, 0, Math.PI);
}

function renderStaticBgImpactPoints(center, radiusFromCenter, color, baseRadius) {
    plotter.globalAlpha = settings.defaultBaseOpacity;
    plotter.fillStyle = color;

    renderDotOnArc(center, radiusFromCenter, baseRadius * 0.75, Math.PI);
    renderDotOnArc(center, radiusFromCenter, baseRadius * 0.75, 2 * Math.PI);
}

function renderStaticStartingDot(center, radiusFromCenter, color, angle, baseRadius) {
    plotter.globalAlpha = 1;
    plotter.fillStyle = color;

    renderDotOnArc(center, radiusFromCenter, baseRadius, angle);
}

function preAnimationRenders() {
    const currentTime = new Date().getTime();
    const { center, base } = setupForRenderer();

    circles.forEach((circle, index) => {
        const radiusFromCenter = base.initialRadius + (base.spacing * index);

        renderStaticBgCircle(center, radiusFromCenter, circle.color, base.circleRadius, base.length);

        renderStaticBgImpactPoints(center, radiusFromCenter, circle.color, base.circleRadius);

        renderStaticStartingDot(center, radiusFromCenter, circle.color, Math.PI, base.circleRadius);

    });

}

// ============================== MAIN ANIMATION ==============================

function render() {

    const currentTime = new Date().getTime();
    const elapsedTime = (currentTime - settings.startTime) / 1000;

    const { center, base } = setupForRenderer();


    circles.forEach((circle, index) => {
        const radiusFromCenter = base.initialRadius + (base.spacing * index);

        renderBgCircle(center, radiusFromCenter, circle.color, currentTime, circle.lastImpactTime, base.circleRadius, base.length);

        renderBgImpactPoints(center, radiusFromCenter, circle.color, currentTime, circle.lastImpactTime, base.circleRadius);

        renderMovingDot(center, radiusFromCenter, index, currentTime, circle, elapsedTime, base.circleRadius, base.maxAngle);

    });

    requestAnimationFrame(render);
}

// for first static render only (while waiting for user interaction)
initCircles();
preAnimationRenders();

