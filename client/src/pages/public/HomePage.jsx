import Hero from "../../widgets/home/Hero";
import About from "../../widgets/home/About";
import SkillDojo from "../../widgets/home/SkillDojo";
import Advantages from "../../widgets/home/Advantages";
import LiveShowcase from "../../widgets/home/LiveShowcase";
import Partners from "../../widgets/home/Partners";
import BeltDivider from "../../widgets/home/BeltDivider";

export default function HomePage() {
  return (
    <main className="bg-[#060B18] text-white">
      <Hero />
      <About />
      <BeltDivider color="from-yellow-300 to-yellow-500" rank="Yellow Belt Level" />
      <SkillDojo />
      <BeltDivider color="from-blue-400 to-blue-600" rank="Blue Belt Level" />
      <Advantages />
      <BeltDivider color="from-green-400 to-green-600" rank="Green Belt Level" />
      <LiveShowcase />
      <BeltDivider color="from-amber-500 to-stone-600" rank="Brown Belt Level" />
      <Partners />
    </main>
  );
}