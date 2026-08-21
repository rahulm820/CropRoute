/**
 * WeatherScene — animated CSS/SVG weather vignettes.
 *
 * API: <WeatherScene condition={...} />
 * Conditions: sunny | partly-cloudy | cloudy | rain | thunderstorm | fog | hot
 *
 * Fixed 160×120 footprint. All animations CSS-only, seamless 4-8s loops.
 * prefers-reduced-motion: reduce → static SVG frame per condition.
 * No runtime randomness (Math.random, Date) — hydration-safe.
 */

const CONDITIONS = [
  "sunny",
  "partly-cloudy",
  "cloudy",
  "rain",
  "thunderstorm",
  "fog",
  "hot",
] as const;

export type WeatherCondition = (typeof CONDITIONS)[number];

interface WeatherSceneProps {
  condition: WeatherCondition;
}

/* ---------- shared sub-components ---------- */

/** Sun disc with optional shimmer overlay */
function Sun({ shimmer = false }: { shimmer?: boolean }) {
  return (
    <g>
      {/* Warm gradient sun */}
      <circle cx="80" cy="50" r="18" className="ws-sun-disc" />
      {shimmer && <circle cx="80" cy="50" r="22" className="ws-heat-shimmer" />}
    </g>
  );
}

/** Rotating ray ring behind the sun */
function SunRays() {
  return (
    <g className="ws-sun-rays">
      {Array.from({ length: 12 }, (_, i) => {
        const angle = i * 30;
        return (
          <line
            key={i}
            x1="80"
            y1="18"
            x2="80"
            y2="8"
            className="ws-ray"
            transform={`rotate(${angle} 80 50)`}
          />
        );
      })}
    </g>
  );
}

/** A single cloud shape positioned via transform */
function Cloud({
  className,
  tx,
  ty,
  scale = 1,
}: {
  className?: string;
  tx: number;
  ty: number;
  scale?: number;
}) {
  return (
    <g
      className={className}
      transform={`translate(${tx}, ${ty}) scale(${scale})`}
    >
      <ellipse cx="0" cy="0" rx="22" ry="10" className="ws-cloud-fill" />
      <ellipse cx="-12" cy="-2" rx="12" ry="8" className="ws-cloud-fill" />
      <ellipse cx="10" cy="-3" rx="14" ry="9" className="ws-cloud-fill" />
    </g>
  );
}

/** Rain droplets — staggered by index for organic look */
function RainDrops() {
  // 8 droplets spread across the width, each with a different delay
  // derived deterministically from index (no Math.random).
  const drops = [
    { x: 24, delay: 0 },
    { x: 44, delay: 0.15 },
    { x: 62, delay: 0.35 },
    { x: 78, delay: 0.55 },
    { x: 96, delay: 0.1 },
    { x: 112, delay: 0.4 },
    { x: 132, delay: 0.25 },
    { x: 148, delay: 0.6 },
    { x: 34, delay: 0.45 },
    { x: 54, delay: 0.7 },
    { x: 86, delay: 0.3 },
    { x: 120, delay: 0.5 },
  ];

  return (
    <g>
      {drops.map((d, i) => (
        <line
          key={i}
          x1={d.x}
          y1="58"
          x2={d.x - 2}
          y2="66"
          className="ws-raindrop"
          style={{ animationDelay: `${d.delay}s` }}
        />
      ))}
    </g>
  );
}

/* ---------- scene renderers ---------- */

function SunnyScene() {
  return (
    <>
      {/* Sky gradient */}
      <rect width="160" height="120" className="ws-sky-clear" />
      <SunRays />
      <Sun />
    </>
  );
}

function PartlyCloudyScene() {
  return (
    <>
      <rect width="160" height="120" className="ws-sky-clear" />
      <SunRays />
      <Sun />
      {/* Two clouds at genuinely different speeds/depths for parallax */}
      <Cloud className="ws-cloud-drift-slow" tx={40} ty={38} scale={0.7} />
      <Cloud className="ws-cloud-drift-fast" tx={100} ty={55} scale={0.9} />
    </>
  );
}

function CloudyScene() {
  return (
    <>
      <rect width="160" height="120" className="ws-sky-overcast" />
      {/* Dense, slow-drifting clouds — more layers than partly-cloudy */}
      <Cloud className="ws-cloud-drift-dense-1" tx={30} ty={30} scale={1.0} />
      <Cloud className="ws-cloud-drift-dense-2" tx={90} ty={45} scale={1.1} />
      <Cloud className="ws-cloud-drift-dense-3" tx={55} ty={60} scale={0.85} />
      <Cloud className="ws-cloud-drift-dense-1" tx={130} ty={35} scale={0.75} />
    </>
  );
}

function RainScene() {
  return (
    <>
      <rect width="160" height="120" className="ws-sky-rain" />
      <Cloud className="ws-cloud-static" tx={50} ty={28} scale={1.0} />
      <Cloud className="ws-cloud-static" tx={110} ty={32} scale={0.9} />
      <RainDrops />
    </>
  );
}

function ThunderstormScene() {
  return (
    <>
      <rect width="160" height="120" className="ws-sky-storm" />
      <Cloud className="ws-cloud-static" tx={50} ty={24} scale={1.1} />
      <Cloud className="ws-cloud-static" tx={115} ty={28} scale={0.95} />
      <RainDrops />
      {/* Lightning bolt — flashes at a natural interval within the loop */}
      <polygon
        points="78,38 72,58 79,56 74,78 86,50 79,52 84,38"
        className="ws-lightning"
      />
      {/* Full-scene flash overlay for the lightning moment */}
      <rect width="160" height="120" className="ws-thunder-flash" />
    </>
  );
}

function FogScene() {
  return (
    <>
      <rect width="160" height="120" className="ws-sky-fog" />
      {/* Layered translucent fog bands drifting at different rates */}
      <rect
        x="-40"
        y="20"
        width="240"
        height="30"
        rx="15"
        className="ws-fog-layer ws-fog-layer-1"
      />
      <rect
        x="-60"
        y="50"
        width="280"
        height="35"
        rx="17"
        className="ws-fog-layer ws-fog-layer-2"
      />
      <rect
        x="-30"
        y="75"
        width="220"
        height="28"
        rx="14"
        className="ws-fog-layer ws-fog-layer-3"
      />
    </>
  );
}

function HotScene() {
  return (
    <>
      <rect width="160" height="120" className="ws-sky-hot" />
      <SunRays />
      <Sun shimmer />
      {/* Heat shimmer waves across the bottom */}
      <path
        d="M0,95 Q20,88 40,95 T80,95 T120,95 T160,95"
        className="ws-heat-wave ws-heat-wave-1"
      />
      <path
        d="M0,102 Q20,96 40,102 T80,102 T120,102 T160,102"
        className="ws-heat-wave ws-heat-wave-2"
      />
      <path
        d="M0,110 Q20,104 40,110 T80,110 T120,110 T160,110"
        className="ws-heat-wave ws-heat-wave-3"
      />
    </>
  );
}

/* ---------- static frames for reduced-motion ---------- */

function StaticSunny() {
  return (
    <>
      <rect width="160" height="120" className="ws-sky-clear" />
      {/* Static rays — no rotation class */}
      <g>
        {Array.from({ length: 12 }, (_, i) => (
          <line
            key={i}
            x1="80"
            y1="18"
            x2="80"
            y2="8"
            className="ws-ray"
            transform={`rotate(${i * 30} 80 50)`}
          />
        ))}
      </g>
      <Sun />
    </>
  );
}

function StaticPartlyCloudy() {
  return (
    <>
      <rect width="160" height="120" className="ws-sky-clear" />
      <g>
        {Array.from({ length: 12 }, (_, i) => (
          <line
            key={i}
            x1="80"
            y1="18"
            x2="80"
            y2="8"
            className="ws-ray"
            transform={`rotate(${i * 30} 80 50)`}
          />
        ))}
      </g>
      <Sun />
      <Cloud tx={40} ty={38} scale={0.7} />
      <Cloud tx={100} ty={55} scale={0.9} />
    </>
  );
}

function StaticCloudy() {
  return (
    <>
      <rect width="160" height="120" className="ws-sky-overcast" />
      <Cloud tx={30} ty={30} scale={1.0} />
      <Cloud tx={90} ty={45} scale={1.1} />
      <Cloud tx={55} ty={60} scale={0.85} />
      <Cloud tx={130} ty={35} scale={0.75} />
    </>
  );
}

function StaticRain() {
  return (
    <>
      <rect width="160" height="120" className="ws-sky-rain" />
      <Cloud tx={50} ty={28} scale={1.0} />
      <Cloud tx={110} ty={32} scale={0.9} />
      {/* Static droplets — visible but not falling */}
      {[24, 44, 62, 78, 96, 112, 132].map((x, i) => (
        <line
          key={i}
          x1={x}
          y1="58"
          x2={x - 2}
          y2="66"
          className="ws-raindrop-static"
        />
      ))}
    </>
  );
}

function StaticThunderstorm() {
  return (
    <>
      <rect width="160" height="120" className="ws-sky-storm" />
      <Cloud tx={50} ty={24} scale={1.1} />
      <Cloud tx={115} ty={28} scale={0.95} />
      {[24, 44, 62, 78, 96, 112, 132].map((x, i) => (
        <line
          key={i}
          x1={x}
          y1="58"
          x2={x - 2}
          y2="66"
          className="ws-raindrop-static"
        />
      ))}
      {/* Static lightning bolt visible */}
      <polygon
        points="78,38 72,58 79,56 74,78 86,50 79,52 84,38"
        className="ws-lightning-static"
      />
    </>
  );
}

function StaticFog() {
  return (
    <>
      <rect width="160" height="120" className="ws-sky-fog" />
      <rect
        x="-40"
        y="20"
        width="240"
        height="30"
        rx="15"
        className="ws-fog-layer-static"
        style={{ opacity: 0.25 }}
      />
      <rect
        x="-60"
        y="50"
        width="280"
        height="35"
        rx="17"
        className="ws-fog-layer-static"
        style={{ opacity: 0.3 }}
      />
      <rect
        x="-30"
        y="75"
        width="220"
        height="28"
        rx="14"
        className="ws-fog-layer-static"
        style={{ opacity: 0.2 }}
      />
    </>
  );
}

function StaticHot() {
  return (
    <>
      <rect width="160" height="120" className="ws-sky-hot" />
      <g>
        {Array.from({ length: 12 }, (_, i) => (
          <line
            key={i}
            x1="80"
            y1="18"
            x2="80"
            y2="8"
            className="ws-ray"
            transform={`rotate(${i * 30} 80 50)`}
          />
        ))}
      </g>
      <Sun shimmer={false} />
      {/* Static heat shimmer haze */}
      <rect x="0" y="88" width="160" height="32" className="ws-heat-haze-static" />
    </>
  );
}

/* ---------- scene map ---------- */

const animatedScenes: Record<WeatherCondition, () => JSX.Element> = {
  sunny: SunnyScene,
  "partly-cloudy": PartlyCloudyScene,
  cloudy: CloudyScene,
  rain: RainScene,
  thunderstorm: ThunderstormScene,
  fog: FogScene,
  hot: HotScene,
};

const staticScenes: Record<WeatherCondition, () => JSX.Element> = {
  sunny: StaticSunny,
  "partly-cloudy": StaticPartlyCloudy,
  cloudy: StaticCloudy,
  rain: StaticRain,
  thunderstorm: StaticThunderstorm,
  fog: StaticFog,
  hot: StaticHot,
};

const conditionLabels: Record<WeatherCondition, string> = {
  sunny: "Sunny",
  "partly-cloudy": "Partly cloudy",
  cloudy: "Cloudy",
  rain: "Rain",
  thunderstorm: "Thunderstorm",
  fog: "Fog",
  hot: "Extreme heat",
};

/* ---------- main component ---------- */

export default function WeatherScene({ condition }: WeatherSceneProps) {
  const AnimatedScene = animatedScenes[condition];
  const StaticScene = staticScenes[condition];

  return (
    <div
      className="ws-container"
      role="img"
      aria-label={`Weather: ${conditionLabels[condition]}`}
    >
      {/* Animated version — hidden by CSS under prefers-reduced-motion */}
      <svg
        className="ws-animated"
        viewBox="0 0 160 120"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="ws-sky-clear-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#87CEEB" />
            <stop offset="100%" stopColor="#B5E3F5" />
          </linearGradient>
          <linearGradient id="ws-sky-overcast-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#9EAAB4" />
            <stop offset="100%" stopColor="#BCC5CC" />
          </linearGradient>
          <linearGradient id="ws-sky-rain-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6B7D8E" />
            <stop offset="100%" stopColor="#8A9DAD" />
          </linearGradient>
          <linearGradient id="ws-sky-storm-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3D4956" />
            <stop offset="100%" stopColor="#5A6A78" />
          </linearGradient>
          <linearGradient id="ws-sky-fog-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#C8CED4" />
            <stop offset="100%" stopColor="#D8DDE2" />
          </linearGradient>
          <linearGradient id="ws-sky-hot-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F5A623" />
            <stop offset="60%" stopColor="#FCCF5A" />
            <stop offset="100%" stopColor="#FDE8A0" />
          </linearGradient>
          <radialGradient id="ws-sun-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFDD44" />
            <stop offset="60%" stopColor="#FFB800" />
            <stop offset="100%" stopColor="#FF9500" />
          </radialGradient>
        </defs>
        <AnimatedScene />
      </svg>

      {/* Static version — shown only under prefers-reduced-motion */}
      <svg
        className="ws-static"
        viewBox="0 0 160 120"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="ws-sky-clear-grad-s" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#87CEEB" />
            <stop offset="100%" stopColor="#B5E3F5" />
          </linearGradient>
          <linearGradient id="ws-sky-overcast-grad-s" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#9EAAB4" />
            <stop offset="100%" stopColor="#BCC5CC" />
          </linearGradient>
          <linearGradient id="ws-sky-rain-grad-s" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6B7D8E" />
            <stop offset="100%" stopColor="#8A9DAD" />
          </linearGradient>
          <linearGradient id="ws-sky-storm-grad-s" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3D4956" />
            <stop offset="100%" stopColor="#5A6A78" />
          </linearGradient>
          <linearGradient id="ws-sky-fog-grad-s" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#C8CED4" />
            <stop offset="100%" stopColor="#D8DDE2" />
          </linearGradient>
          <linearGradient id="ws-sky-hot-grad-s" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F5A623" />
            <stop offset="60%" stopColor="#FCCF5A" />
            <stop offset="100%" stopColor="#FDE8A0" />
          </linearGradient>
          <radialGradient id="ws-sun-grad-s" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFDD44" />
            <stop offset="60%" stopColor="#FFB800" />
            <stop offset="100%" stopColor="#FF9500" />
          </radialGradient>
        </defs>
        <StaticScene />
      </svg>
    </div>
  );
}
