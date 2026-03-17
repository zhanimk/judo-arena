/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        accent: "#D4AF37",
        accentGlow: "rgba(212,175,55,0.22)",
        bg: "#050A18",
        card: "rgba(13, 21, 40, 0.72)",
        border: "rgba(30, 43, 74, 0.9)",
        textMain: "#F8FAFC",
        textMuted: "#94A3B8",
      },
      boxShadow: {
        glow: "0 15px 35px rgba(212,175,55,0.22)",
        soft: "0 30px 60px rgba(0,0,0,0.18)",
      },
      keyframes: {
        pulseGlow: {
          "0%, 100%": { transform: "scale(1)", opacity: "1" },
          "50%": { transform: "scale(1.4)", opacity: "0.6" },
        },
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(24px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        pulseGlow: "pulseGlow 2s infinite",
        fadeUp: "fadeUp .8s ease-out",
      },
      backgroundImage: {
        gold: "linear-gradient(135deg, #D4AF37 0%, #F4D03F 50%, #B8860B 100%)",
      },
    },
  },
  plugins: [],
};
