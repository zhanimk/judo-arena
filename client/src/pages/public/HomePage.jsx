import HomeHeader from "../../widgets/home/HomeHeader";
import HeroSection from "../../widgets/home/HeroSection";
import AboutSection from "../../widgets/home/AboutSection";
import SkillDojoSection from "../../widgets/home/SkillDojoSection";
import AdvantagesSection from "../../widgets/home/AdvantagesSection";
import LiveShowcaseSection from "../../widgets/home/LiveShowcaseSection";

export default function HomePage() {
  return (
    <main className="bg-bg text-textMain">
      <HeroSection />
      <HomeHeader/>
      <AboutSection />
      <SkillDojoSection />
      <AdvantagesSection />
      <LiveShowcaseSection />
    </main>
  );
}
