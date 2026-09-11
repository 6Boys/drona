import { HeroSection } from "@/components/ui/artificial-hero";
import Example from "@/components/ui/image-gallery";
import { HeroSection2 } from "@/components/ui/animated-hero";

export default function Home() {
  return (
    <div className="flex flex-col bg-black text-white min-h-screen">
      <HeroSection />
      <div className="flex flex-col items-center py-15">
        <Example />
      </div>
      <HeroSection2 />
    </div>
  );
}
