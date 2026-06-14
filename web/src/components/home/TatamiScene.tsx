export function TatamiScene() {
  const svg = `<svg viewBox="0 0 560 340" xmlns="http://www.w3.org/2000/svg" style="width:90%;max-width:520px;animation:tatamiGlow 4s ease-in-out infinite">
    <defs>
      <linearGradient id="tgTop" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#1a3a2a"/>
        <stop offset="50%" stop-color="#1e4530"/>
        <stop offset="100%" stop-color="#152e22"/>
      </linearGradient>
      <linearGradient id="tgLeft" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#0f2218"/>
        <stop offset="100%" stop-color="#081510"/>
      </linearGradient>
      <linearGradient id="tgRight" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#162a1e"/>
        <stop offset="100%" stop-color="#0b1a12"/>
      </linearGradient>
      <linearGradient id="tgDanger" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#7f1d1d" stop-opacity="0.7"/>
        <stop offset="50%" stop-color="#991b1b" stop-opacity="0.85"/>
        <stop offset="100%" stop-color="#7f1d1d" stop-opacity="0.7"/>
      </linearGradient>
      <filter id="tgGlow">
        <feGaussianBlur stdDeviation="3" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>

    <!-- shadow -->
    <ellipse cx="280" cy="315" rx="230" ry="18" fill="black" opacity="0.55"/>

    <!-- left face -->
    <polygon points="48,165 48,197 280,330 280,298" fill="url(#tgLeft)"/>
    <!-- right face -->
    <polygon points="512,165 512,197 280,330 280,298" fill="url(#tgRight)"/>
    <!-- top danger zone -->
    <polygon points="280,60 512,165 280,270 48,165" fill="url(#tgDanger)"/>
    <!-- inner safe zone -->
    <polygon points="280,88 472,175 280,242 88,175" fill="url(#tgTop)"/>

    <!-- grid h1 -->
    <line x1="235" y1="153" x2="326" y2="153" stroke="#4ade80" stroke-width="0.6" opacity="0.25"/>
    <line x1="235" y1="197" x2="326" y2="197" stroke="#4ade80" stroke-width="0.6" opacity="0.25"/>
    <!-- grid h2 -->
    <line x1="190" y1="131" x2="370" y2="131" stroke="#4ade80" stroke-width="0.5" opacity="0.15"/>
    <line x1="190" y1="219" x2="370" y2="219" stroke="#4ade80" stroke-width="0.5" opacity="0.15"/>
    <!-- grid v -->
    <line x1="164" y1="110" x2="164" y2="240" stroke="#4ade80" stroke-width="0.5" opacity="0.15"/>
    <line x1="396" y1="110" x2="396" y2="240" stroke="#4ade80" stroke-width="0.5" opacity="0.15"/>
    <line x1="235" y1="95"  x2="235" y2="255" stroke="#4ade80" stroke-width="0.5" opacity="0.18"/>
    <line x1="325" y1="95"  x2="325" y2="255" stroke="#4ade80" stroke-width="0.5" opacity="0.18"/>

    <!-- center circle -->
    <ellipse cx="280" cy="175" rx="48" ry="28" fill="none" stroke="#c8922a" stroke-width="2.2" opacity="0.7" style="animation:tatamiPulse 3s ease-in-out infinite"/>
    <ellipse cx="280" cy="175" rx="48" ry="28" fill="#c8922a" opacity="0.06" style="animation:tatamiPulse 3s ease-in-out infinite"/>
    <line x1="268" y1="175" x2="292" y2="175" stroke="#c8922a" stroke-width="2" opacity="0.6"/>
    <line x1="280" y1="169" x2="280" y2="181" stroke="#c8922a" stroke-width="2" opacity="0.6"/>

    <!-- RED fighter -->
    <g style="animation:fighterRed 2.4s ease-in-out infinite;transform-origin:232px 168px">
      <ellipse cx="232" cy="178" rx="10" ry="6" fill="#dc2626" opacity="0.35"/>
      <rect x="224" y="152" width="16" height="20" rx="4" fill="#dc2626" opacity="0.9" filter="url(#tgGlow)"/>
      <rect x="224" y="163" width="16" height="3" rx="1" fill="#991b1b"/>
      <circle cx="232" cy="148" r="7" fill="#fde68a" opacity="0.9"/>
      <line x1="224" y1="158" x2="214" y2="162" stroke="#dc2626" stroke-width="5" stroke-linecap="round" opacity="0.85"/>
      <line x1="240" y1="158" x2="248" y2="165" stroke="#dc2626" stroke-width="5" stroke-linecap="round" opacity="0.85"/>
      <line x1="228" y1="172" x2="224" y2="182" stroke="#dc2626" stroke-width="5" stroke-linecap="round" opacity="0.85"/>
      <line x1="236" y1="172" x2="240" y2="182" stroke="#dc2626" stroke-width="5" stroke-linecap="round" opacity="0.85"/>
      <text x="232" y="198" text-anchor="middle" fill="#dc2626" font-size="9" font-weight="bold" opacity="0.8">АК</text>
    </g>

    <!-- BLUE fighter -->
    <g style="animation:fighterBlue 2.4s ease-in-out 1.2s infinite;transform-origin:328px 168px">
      <ellipse cx="328" cy="178" rx="10" ry="6" fill="#2563eb" opacity="0.35"/>
      <rect x="320" y="152" width="16" height="20" rx="4" fill="#2563eb" opacity="0.9" filter="url(#tgGlow)"/>
      <rect x="320" y="163" width="16" height="3" rx="1" fill="#1d4ed8"/>
      <circle cx="328" cy="148" r="7" fill="#fde68a" opacity="0.9"/>
      <line x1="320" y1="158" x2="312" y2="165" stroke="#2563eb" stroke-width="5" stroke-linecap="round" opacity="0.85"/>
      <line x1="336" y1="158" x2="346" y2="162" stroke="#2563eb" stroke-width="5" stroke-linecap="round" opacity="0.85"/>
      <line x1="324" y1="172" x2="320" y2="182" stroke="#2563eb" stroke-width="5" stroke-linecap="round" opacity="0.85"/>
      <line x1="332" y1="172" x2="336" y2="182" stroke="#2563eb" stroke-width="5" stroke-linecap="round" opacity="0.85"/>
      <text x="328" y="198" text-anchor="middle" fill="#2563eb" font-size="9" font-weight="bold" opacity="0.8">КҚ</text>
    </g>

    <!-- score HUD -->
    <rect x="58" y="100" width="72" height="44" rx="8" fill="#7f1d1d" opacity="0.85"/>
    <rect x="58" y="100" width="72" height="44" rx="8" fill="none" stroke="#dc2626" stroke-width="1.2" opacity="0.6"/>
    <text x="94" y="120" text-anchor="middle" fill="#fca5a5" font-size="8" font-weight="600" letter-spacing="1">АК</text>
    <text x="94" y="138" text-anchor="middle" fill="white" font-size="20" font-weight="900" font-family="monospace">1</text>

    <rect x="224" y="28" width="112" height="38" rx="8" fill="#111827" opacity="0.92"/>
    <rect x="224" y="28" width="112" height="38" rx="8" fill="none" stroke="#c8922a" stroke-width="1.2" opacity="0.5"/>
    <text x="280" y="43" text-anchor="middle" fill="#c8922a" font-size="8" font-weight="600" letter-spacing="2">УАҚЫТ</text>
    <text x="280" y="60" text-anchor="middle" fill="#f5c842" font-size="16" font-weight="900" font-family="monospace">02:34</text>

    <rect x="430" y="100" width="72" height="44" rx="8" fill="#1e3a5f" opacity="0.85"/>
    <rect x="430" y="100" width="72" height="44" rx="8" fill="none" stroke="#2563eb" stroke-width="1.2" opacity="0.6"/>
    <text x="466" y="120" text-anchor="middle" fill="#93c5fd" font-size="8" font-weight="600" letter-spacing="1">КҚ</text>
    <text x="466" y="138" text-anchor="middle" fill="white" font-size="20" font-weight="900" font-family="monospace">0</text>

    <rect x="246" y="72" width="68" height="20" rx="5" fill="#dc2626" opacity="0.9"/>
    <circle cx="258" cy="82" r="3.5" fill="white" opacity="0.9">
      <animate attributeName="opacity" values="1;0.3;1" dur="1s" repeatCount="indefinite"/>
    </circle>
    <text x="280" y="86" text-anchor="middle" fill="white" font-size="9" font-weight="800" letter-spacing="2">LIVE</text>

    <text x="280" y="304" text-anchor="middle" fill="#c8922a" font-size="10" font-weight="700" letter-spacing="3" opacity="0.6">ТАТАМИ №1</text>
  </svg>`;

  return (
    <div
      className="w-full flex items-center justify-center"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
