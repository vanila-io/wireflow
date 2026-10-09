import Header from "@/components/landing/header";
import Hero from "@/components/landing/hero";
import Features from "@/components/landing/features";
import Gallery from "@/components/landing/gallery";
import OpenSource from "@/components/landing/open-source";
import Sponsors from "@/components/landing/sponsors";
import Footer from "@/components/landing/footer";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <Hero />
        <Features />
        <OpenSource />
        <Sponsors />
        <Gallery />
      </main>
      <Footer />
    </div>
  );
}
