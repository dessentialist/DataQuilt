import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ExampleBlock, TipBlock, CalloutBlock } from "@/components/ui/info-blocks";
import { useScrollSpy } from "@/hooks/useScrollSpy";
import {
  Upload,
  FileText,
  Braces,
  PlayCircle,
  Download,
  Eye,
  Zap,
  Link2,
  Brain,
  Key,
  ChevronUp,
  Circle,
  CheckCircle,
} from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { MC } from "@/lib/microcopy";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { HelpTip } from "@/components/ui/help-tip";

// Define sections for navigation
interface NavigationSection {
  id: string;
  label: string;
  subsections?: { id: string; label: string }[];
}

const sections: NavigationSection[] = MC.howItWorksPage.nav.sections as unknown as NavigationSection[];

// Step Card Component for displaying steps with screenshots
function StepCard({
  number,
  title,
  description,
  example,
  tip,
  screenshot,
  reverse = false,
  id,
  info,
}: {
  number: string;
  title: string;
  description: string;
  example?: { label: string; content: string };
  tip?: string;
  screenshot?: string;
  reverse?: boolean;
  id: string;
  info?: string;
}) {
  return (
    <div id={id} className="scroll-mt-24 py-12">
      <div
        className={cn(
          "flex flex-col lg:flex-row gap-12",
          reverse && "lg:flex-row-reverse",
        )}
      >
        {/* Text Content */}
        <div className="flex-1 flex items-center">
          <div className="w-full space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-xl font-bold oracle-heading">{title}</h3>
                {info ? <HelpTip content={info} /> : null}
              </div>
              <p className="oracle-muted text-base leading-relaxed">{description}</p>

              {/* Use consistent reusable components */}
              {example && <ExampleBlock label={example.label}>{example.content}</ExampleBlock>}

              {tip && <TipBlock>{tip}</TipBlock>}
            </div>
          </div>
        </div>

        {/* Screenshot/Media */}
        <div className="flex-1 lg:max-w-xl w-full flex items-center">
          {screenshot ? (
            <div className="w-full bg-gray-50 rounded-lg shadow-md overflow-hidden border border-oracle-border/50">
              <video
                src={screenshot}
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-auto object-contain"
              />
            </div>
          ) : (
            <div className="w-full bg-gray-50 rounded-lg shadow-md overflow-hidden aspect-[4/3] flex items-center justify-center border border-oracle-border/50">
              <div className="text-center p-8">
                <div className="w-20 h-20 bg-white/50 rounded-full flex items-center justify-center mx-auto mb-4">
                  {number === "1" && <Upload className="w-10 h-10 text-oracle-accent" />}
                  {number === "2" && <Braces className="w-10 h-10 text-oracle-accent" />}
                  {number === "3" && <Eye className="w-10 h-10 text-oracle-accent" />}
                  {number === "4" && <PlayCircle className="w-10 h-10 text-oracle-accent" />}
                  {number === "5" && <Download className="w-10 h-10 text-oracle-accent" />}
                </div>
                <p className="text-gray-600 font-medium">Screenshot: {title}</p>
                <p className="text-gray-500 text-sm mt-2">Interface preview will be here</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Sticky Sidebar Navigation Component
function SidebarNav({
  sections,
  activeSection,
  onSectionClick,
}: {
  sections: NavigationSection[];
  activeSection: string;
  onSectionClick: (id: string) => void;
}) {
  return (
    <nav className="hidden xl:block fixed left-8 top-1/2 -translate-y-1/2 w-56 z-10">
      <div className="bg-white/95 backdrop-blur rounded-lg shadow-md border border-oracle-border/50 p-5">
        <p className="text-xs font-semibold oracle-muted uppercase tracking-wider mb-4">
          On This Page
        </p>
        <ul className="space-y-1">
          {sections.map((section) => {
            const isActive =
              activeSection === section.id ||
              section.subsections?.some((sub) => sub.id === activeSection);
            const hasActiveSubsection = section.subsections?.some(
              (sub) => sub.id === activeSection,
            );

            return (
              <li key={section.id}>
                <button
                  onClick={() => onSectionClick(section.id)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-md text-sm transition-all duration-200",
                    "hover:bg-gray-50 hover:text-oracle-accent",
                    isActive && "bg-oracle-accent/5 font-semibold",
                    activeSection === section.id &&
                      "text-oracle-accent border-l-2 border-oracle-accent",
                  )}
                >
                  <span className="flex items-center gap-2">
                    {activeSection === section.id ? (
                      <CheckCircle className="w-3 h-3 text-oracle-accent" />
                    ) : (
                      <Circle className="w-3 h-3 text-gray-400" />
                    )}
                    {section.label}
                  </span>
                </button>

                {/* Subsections */}
                {section.subsections && isActive && (
                  <ul className="mt-1 ml-6 space-y-1">
                    {section.subsections.map((subsection) => (
                      <li key={subsection.id}>
                        <button
                          onClick={() => onSectionClick(subsection.id)}
                          className={cn(
                            "w-full text-left px-2 py-1 rounded text-xs transition-all",
                            "hover:text-oracle-accent hover:bg-gray-50",
                            activeSection === subsection.id &&
                              "text-oracle-accent font-semibold bg-oracle-accent/5",
                          )}
                        >
                          {subsection.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}

export default function HowItWorks() {
  const { activeSection, scrollToSection } = useScrollSpy(sections, 80);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const handledInitialHashRef = useRef(false);

  useEffect(() => {
    console.debug("[HowItWorks] Mounted");
    try {
      const stepsCount = MC?.howItWorksPage?.steps?.items?.length ?? 0;
      console.debug(`[HowItWorks] Steps rendered: ${stepsCount}`);
    } catch (e) {
      console.debug("[HowItWorks] Steps count log failed");
    }
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 300);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Handle deep-link anchors on initial load (e.g., /how-it-works#api-keys or #api-add-keys)
  useEffect(() => {
    const rawHash = window.location.hash ? window.location.hash.slice(1) : "";
    if (!rawHash) return;
    if (handledInitialHashRef.current) return;
    handledInitialHashRef.current = true;
    const decodedHash = decodeURIComponent(rawHash);
    console.debug("[HowItWorks] Initial hash detected", { hash: decodedHash });
    const attemptScroll = (label: string) => {
      const el = document.getElementById(label);
      if (el) {
        console.debug("[HowItWorks] Scrolling to initial hash", { hash: label });
        scrollToSection(label);
        return true;
      }
      return false;
    };
    // Try immediately after mount
    if (attemptScroll(decodedHash)) return;
    // Retry once shortly after to account for async rendering
    const t = setTimeout(() => {
      if (!attemptScroll(decodedHash)) {
        console.debug("[HowItWorks] Element for hash not found after retry", { hash: decodedHash });
      }
    }, 150);
    return () => clearTimeout(t);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <MainLayout>
      {/* Sidebar Navigation */}
      <SidebarNav
        sections={sections}
        activeSection={activeSection}
        onSectionClick={scrollToSection}
      />

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 lg:px-12 howitworks-page">
        {/* Tablet TOC (md–lg): Drawer trigger */}
        <div className="xl:hidden flex justify-end pt-6">
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                className="text-sm"
                onClick={() => console.debug("[HowItWorks] TOC drawer open")}
              >
                {MC.howItWorksPage.nav.onThisPage}
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:max-w-sm">
              <SheetHeader>
                <SheetTitle>{MC.howItWorksPage.nav.onThisPage}</SheetTitle>
              </SheetHeader>
              <ul className="mt-4 space-y-2">
                {sections.map((section) => (
                  <li key={section.id}>
                    <button
                      className="w-full text-left px-3 py-2 rounded hover:bg-gray-50"
                      onClick={() => {
                        console.debug("[HowItWorks] TOC jump", { id: section.id });
                        scrollToSection(section.id);
                      }}
                    >
                      <span className="font-medium">{section.label}</span>
                    </button>
                    {section.subsections && (
                      <ul className="mt-1 ml-4 space-y-1">
                        {section.subsections.map((sub) => (
                          <li key={sub.id}>
                            <button
                              className="w-full text-left px-3 py-1 rounded text-sm hover:bg-gray-50"
                              onClick={() => {
                                console.debug("[HowItWorks] TOC jump", { id: sub.id });
                                scrollToSection(sub.id);
                              }}
                            >
                              {sub.label}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </SheetContent>
          </Sheet>
        </div>
        {/* Hero Section */}
        <section id="intro" className="scroll-mt-24 py-16">
          <h1 className="text-2xl font-bold oracle-heading mb-8">
            {MC.howItWorksPage.hero.title}
          </h1>
          <p className="text-base oracle-muted leading-relaxed text-left">
            {MC.howItWorksPage.hero.body}
          </p>
        </section>

        {/* DataQuilt vs LLMs */}
        <section id="vs-llms" className="scroll-mt-12 py-6 text-xxl border-t border-oracle-border">
          <SectionHeader
            title={MC.howItWorksPage.vsLlms?.heading}
            level={2}
            subheader={MC.howItWorksPage.vsLlms?.intro}
            className="mb-4 lg:mb-6 mt-8 lg:mt-12"
          />
          <p className="text-base oracle-muted leading-relaxed mb-8">
            {MC.howItWorksPage.vsLlms?.p1}
          </p>
          <p className="text-base oracle-muted leading-relaxed mb-8">
            {MC.howItWorksPage.vsLlms?.p2}
          </p>
          <CalloutBlock>{MC.howItWorksPage.vsLlms?.callout}</CalloutBlock>
          <TipBlock>
            <div className="space-y-2 text-sm font-semibold oracle-muted">
              <p>{MC.howItWorksPage.vsLlms?.note}</p>
              <div>
                <p className="font-semibold text-sm">Use a file containing any data you like in 3 easy steps</p>
                <ol className="list-decimal text-sm ml-6 oracle-muted mt-2 space-y-1">
                  {MC.howItWorksPage.vsLlms?.tooltipSteps?.map((s, i) => (
                    <li key={`vsllms-tip-${i}`}>{s}</li>
                  ))}
                </ol>
              </div>
            </div>
          </TipBlock>
        </section>

        {/* Steps Section */}
        <section id="steps" className="scroll-mt-24 py-14 border-t border-oracle-border">
          <div className="mb-16">
            <SectionHeader
              title={MC.howItWorksPage.steps.heading}
              level={2}
              guide={MC.howItWorksPage.steps.intro}
            />
          </div>
          {MC.howItWorksPage.steps.items.map((item, idx) => {
            const mediaMap: Record<string, string | undefined> = {
              "step-1": undefined,
              "step-2": undefined,
              "step-3": undefined,
              "step-3-5": undefined,
              "step-4": undefined,
              "step-5": undefined,
              "step-6": undefined,
            };
            const exampleContent = (item as Record<string, unknown>)["exampleContent"] as
              | string
              | undefined;
            const tip = (item as Record<string, unknown>)["tip"] as string | undefined;
            const info = (item as Record<string, unknown>)["info"] as string | undefined;
            return (
              <StepCard
                key={item.id}
                id={item.id}
                number={item.number}
                title={item.title}
                description={item.description}
                example={exampleContent ? { label: MC.howItWorksPage.steps.exampleLabel, content: exampleContent } : undefined}
                tip={tip}
                screenshot={mediaMap[item.id]}
                info={info}
                reverse={idx % 2 === 1}
              />
            );
          })}
        </section>

        {/* Benefits Section */}
        <section id="benefits" className="scroll-mt-24 py-6 border-t border-oracle-border">
          <div className="mb-8 text-xxl">
            <SectionHeader title={MC.howItWorksPage.benefits.heading} level={2} />
          </div>

          <div className="space-y-8">
            <Card id="multiple-prompts" className="scroll-mt-24 border border-oracle-border/50 shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-oracle-accent/5 rounded-lg flex items-center justify-center">
                    <Zap className="text-oracle-accent" size={22} />
                  </div>
                  <CardTitle className="text-xl howitworks-card-title">{MC.howItWorksPage.benefits.cards[0].title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="oracle-muted text-base leading-relaxed mb-6">{MC.howItWorksPage.benefits.cards[0].body}</p>
                <CalloutBlock>{MC.howItWorksPage.benefits.cards[0].callout}</CalloutBlock>
              </CardContent>
            </Card>

            <Card id="chain-prompts" className="scroll-mt-24 border border-oracle-border/50 shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-oracle-accent/5 rounded-lg flex items-center justify-center">
                    <Link2 className="text-oracle-accent" size={22} />
                  </div>
                  <CardTitle className="text-xl howitworks-card-title">{MC.howItWorksPage.benefits.cards[1].title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="oracle-muted text-base leading-relaxed mb-6">{MC.howItWorksPage.benefits.cards[1].body}</p>
                <div className="space-y-3">
                  <ExampleBlock>
                    <ul className="space-y-1">
                      <li>{MC.howItWorksPage.benefits.cards[1].exampleList[0]}</li>
                      <li>{MC.howItWorksPage.benefits.cards[1].exampleList[1]}</li>
                      <li>{MC.howItWorksPage.benefits.cards[1].exampleList[2]}</li>
                    </ul>
                  </ExampleBlock>
                  <div className="space-y-3">
                    <CalloutBlock>{MC.howItWorksPage.benefits.cards[1].callout}</CalloutBlock>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card id="choose-models" className="scroll-mt-24 border border-oracle-border/50 shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-oracle-accent/5 rounded-lg flex items-center justify-center">
                    <Brain className="text-oracle-accent" size={22} />
                  </div>
                  <CardTitle className="text-xl howitworks-card-title">{MC.howItWorksPage.benefits.cards[2].title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="oracle-muted text-base leading-relaxed mb-6">{MC.howItWorksPage.benefits.cards[2].body}</p>
                <div className="grid md:grid-cols-3 gap-4 mt-6">
                  <div className="p-3 bg-gray-50 rounded-lg text-center">
                    <p className="font-semibold oracle-heading">{MC.howItWorksPage.benefits.cards[2].modelExamples[0].label}</p>
                    <p className="text-sm oracle-muted">{MC.howItWorksPage.benefits.cards[2].modelExamples[0].value}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg text-center">
                    <p className="font-semibold oracle-heading">{MC.howItWorksPage.benefits.cards[2].modelExamples[1].label}</p>
                    <p className="text-sm oracle-muted">{MC.howItWorksPage.benefits.cards[2].modelExamples[1].value}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg text-center">
                    <p className="font-semibold oracle-heading">{MC.howItWorksPage.benefits.cards[2].modelExamples[2].label}</p>
                    <p className="text-sm oracle-muted">{MC.howItWorksPage.benefits.cards[2].modelExamples[2].value}</p>
                  </div>
                </div>
                <CalloutBlock>{MC.howItWorksPage.benefits.cards[2].callout}</CalloutBlock>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Crafting Prompts Section */}
        <section id="prompts-guide" className="scroll-mt-24 py-14 border-t border-oracle-border">
          <SectionHeader
            title={MC.howItWorksPage.promptsGuide.heading}
            level={2}
            guide={MC.howItWorksPage.promptsGuide.intro}
            className="mb-8"
          />

          <div className="grid gap-10">
            <Card className="border border-oracle-border/50 shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl howitworks-card-title">{MC.howItWorksPage.promptsGuide.cards[0].title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="oracle-muted text-base leading-relaxed mb-6">{MC.howItWorksPage.promptsGuide.cards[0].body}</p>
                <ExampleBlock label={MC.homepage.howItWorks ? MC.homepage.howItWorks.title : "Example"}>{MC.howItWorksPage.promptsGuide.cards[0].example}</ExampleBlock>
                <CalloutBlock>{MC.howItWorksPage.promptsGuide.cards[0].callout}</CalloutBlock>
              </CardContent>
            </Card>

            <Card className="border border-oracle-border/50 shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl howitworks-card-title">{MC.howItWorksPage.promptsGuide.cards[1].title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="oracle-muted text-base leading-relaxed mb-6">{MC.howItWorksPage.promptsGuide.cards[1].intro}</p>
                <ul className="space-y-2 oracle-muted text-base mb-6">
                  <li>{MC.howItWorksPage.promptsGuide.cards[1].bullets[0]}</li>
                  <li>{MC.howItWorksPage.promptsGuide.cards[1].bullets[1]}</li>
                </ul>
                <ExampleBlock>{MC.howItWorksPage.promptsGuide.cards[1].example}</ExampleBlock>
                <CalloutBlock>{MC.howItWorksPage.promptsGuide.cards[1].callout}</CalloutBlock>
              </CardContent>
            </Card>

            <Card className="border border-oracle-border/50 shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl howitworks-card-title">{MC.howItWorksPage.promptsGuide.cards[2].title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="oracle-muted text-base leading-relaxed mb-6">{MC.howItWorksPage.promptsGuide.cards[2].intro}</p>
                <ul className="space-y-3 oracle-muted text-base">
                  <li>{MC.howItWorksPage.promptsGuide.cards[2].bullets[0]}</li>
                  <li>{MC.howItWorksPage.promptsGuide.cards[2].bullets[1]}</li>
                  <li>{MC.howItWorksPage.promptsGuide.cards[2].bullets[2]}</li>
                  <li>{MC.howItWorksPage.promptsGuide.cards[2].bullets[3]}</li>
                  <li>{MC.howItWorksPage.promptsGuide.cards[2].bullets[4]}</li>
                </ul>
                <ExampleBlock>{MC.howItWorksPage.promptsGuide.cards[2].example}</ExampleBlock>
                <CalloutBlock>{MC.howItWorksPage.promptsGuide.cards[2].callout}</CalloutBlock>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Putting It Together Section */}
        <section id="putting-together" className="scroll-mt-24 py-14 border-t border-oracle-border">
          <div>
            <SectionHeader title={MC.howItWorksPage.puttingTogether.heading} level={2} className="mb-10" />
            <div>
              <p className="text-base oracle-muted mb-8 leading-relaxed">{MC.howItWorksPage.puttingTogether.paras[0]}</p>
              <p className="text-base oracle-muted mb-8 leading-relaxed">{MC.howItWorksPage.puttingTogether.paras[1]}</p>
              <div className="p-6 bg-gradient-to-r from-oracle-accent/5 to-blue-50 rounded-lg border border-oracle-accent/20">
                <p className="text-base font-semibold oracle-heading">{MC.howItWorksPage.puttingTogether.summary}</p>
              </div>
            </div>
          </div>
        </section>

        {/* API Keys Section */}
        <section id="api-keys" className="scroll-mt-24 py-14 border-t border-oracle-border">
          <SectionHeader title={MC.howItWorksPage.apiKeys.heading} level={2} className="mb-10" />

          {/* 5.1 What is an API key */}
          <div id="api-what-is-key" className="scroll-mt-24 py-6">
            <h3 className="text-xl font-bold oracle-heading mb-3">
              {MC.howItWorksPage.apiKeys.sections.whatIsKey.title}
            </h3>
            <p className="text-base oracle-muted leading-relaxed mb-2">
              {MC.howItWorksPage.apiKeys.sections.whatIsKey.body}
            </p>
            <a
              href={MC.howItWorksPage.apiKeys.sections.whatIsKey.link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-oracle-accent underline"
            >
              {MC.howItWorksPage.apiKeys.sections.whatIsKey.link.label}
            </a>
          </div>

          {/* 5.2 How DataQuilt uses your keys */}
          <div id="api-how-uses" className="scroll-mt-24 py-6">
            <h3 className="text-xl font-bold oracle-heading mb-3">
              {MC.howItWorksPage.apiKeys.sections.howUses.title}
            </h3>
            <ul className="list-disc ml-6 oracle-muted space-y-1">
              {MC.howItWorksPage.apiKeys.sections.howUses.bullets.map((b, i) => (
                <li key={`api-how-${i}`}>{b}</li>
              ))}
            </ul>
            <CalloutBlock>{MC.howItWorksPage.apiKeys.sections.howUses.summary}</CalloutBlock>
          </div>

          {/* 5.3 Get your API keys */}
          <div id="api-get-keys" className="scroll-mt-24 py-6">
            <h3 className="text-xl font-bold oracle-heading mb-4">
              {MC.howItWorksPage.apiKeys.sections.getKeys.title}
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left oracle-muted">
                    <th className="py-2 pr-4">Provider</th>
                    <th className="py-2 pr-4">Primary</th>
                    <th className="py-2">Guide</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-oracle-border/70">
                  {MC.howItWorksPage.apiKeys.sections.getKeys.providers.map((p) => (
                    <tr key={p.name}>
                      <td className="py-2 pr-4 font-semibold oracle-heading">{p.name}</td>
                      <td className="py-2 pr-4">
                        <a href={p.primary.url} target="_blank" rel="noopener noreferrer" className="text-oracle-accent underline">
                          {p.primary.label}
                        </a>
                      </td>
                      <td className="py-2">
                        <a href={p.secondary.url} target="_blank" rel="noopener noreferrer" className="text-oracle-accent underline">
                          {p.secondary.label}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 5.4 Usage & costs */}
          <div id="api-usage-costs" className="scroll-mt-24 py-6">
            <h3 className="text-xl font-bold oracle-heading mb-3">
              {MC.howItWorksPage.apiKeys.sections.usageCosts.title}
            </h3>
            <p className="oracle-muted mb-3">{MC.howItWorksPage.apiKeys.sections.usageCosts.lead}</p>
            <a
              href={MC.howItWorksPage.apiKeys.sections.usageCosts.ref.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-oracle-accent underline"
            >
              {MC.howItWorksPage.apiKeys.sections.usageCosts.ref.label}
            </a>
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left oracle-muted">
                    <th className="py-2 pr-4">Model</th>
                    <th className="py-2 pr-4">Estimate</th>
                    <th className="py-2 pr-4">Pricing</th>
                    <th className="py-2">Ref</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-oracle-border/70">
                  {MC.howItWorksPage.apiKeys.sections.usageCosts.items.map((it) => (
                    <tr key={it.name}>
                      <td className="py-2 pr-4 font-semibold oracle-heading">{it.name}</td>
                      <td className="py-2 pr-4">{it.estimate}</td>
                      <td className="py-2 pr-4 oracle-muted">{it.details}</td>
                      <td className="py-2">
                        <a href={it.url} target="_blank" rel="noopener noreferrer" className="text-oracle-accent underline">Reference</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 4.5 Add your keys */}
          <div id="api-add-keys" className="scroll-mt-24 py-6">
            <h3 className="text-xl font-bold oracle-heading mb-3">
              {MC.howItWorksPage.apiKeys.sections.addKeys.title}
            </h3>
            <ol className="list-decimal ml-6 oracle-muted space-y-1 mb-3">
              {MC.howItWorksPage.apiKeys.sections.addKeys.steps.map((s, i) => (
                <li key={`api-add-${i}`}>{s}</li>
              ))}
            </ol>
            <CalloutBlock>{MC.howItWorksPage.apiKeys.sections.addKeys.securityNote}</CalloutBlock>
          </div>
        </section>

        {/* FAQ Section */}
        <section id="faq" className="scroll-mt-24 py-14 border-t border-oracle-border">
          <SectionHeader title={MC.howItWorksPage.faq.heading} level={2} className="mb-12" />

          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger className="text-left">
                {MC.howItWorksPage.faq.items[0].q}
              </AccordionTrigger>
              <AccordionContent>
                <p className="oracle-muted text-base">{MC.howItWorksPage.faq.items[0].a}</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2">
              <AccordionTrigger className="text-left">{MC.howItWorksPage.faq.items[1].q}</AccordionTrigger>
              <AccordionContent>
                <p className="oracle-muted text-base">{MC.howItWorksPage.faq.items[1].a}</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3">
              <AccordionTrigger className="text-left">
                {MC.howItWorksPage.faq.items[2].q}
              </AccordionTrigger>
              <AccordionContent>
                <p className="oracle-muted text-base">{MC.howItWorksPage.faq.items[2].a}</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4">
              <AccordionTrigger className="text-left">
                {MC.howItWorksPage.faq.items[3].q}
              </AccordionTrigger>
              <AccordionContent>
                <p className="oracle-muted text-base">{MC.howItWorksPage.faq.items[3].a}</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-5">
              <AccordionTrigger className="text-left">
                {MC.howItWorksPage.faq.items[4].q}
              </AccordionTrigger>
              <AccordionContent>
                <p className="oracle-muted text-base">{MC.howItWorksPage.faq.items[4].a}</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-6">
              <AccordionTrigger className="text-left">
                {MC.howItWorksPage.faq.items[5].q}
              </AccordionTrigger>
              <AccordionContent>
                <p className="oracle-muted text-base">{MC.howItWorksPage.faq.items[5].a}</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-7">
              <AccordionTrigger className="text-left">
                {MC.howItWorksPage.faq.items[6].q}
              </AccordionTrigger>
              <AccordionContent>
                <p className="oracle-muted text-base">{MC.howItWorksPage.faq.items[6].a}</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-8">
              <AccordionTrigger className="text-left">
                {MC.howItWorksPage.faq.items[7].q}
              </AccordionTrigger>
              <AccordionContent>
                <p className="oracle-muted text-base">{MC.howItWorksPage.faq.items[7].a}</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-9">
              <AccordionTrigger className="text-left">
                {MC.howItWorksPage.faq.items[8].q}
              </AccordionTrigger>
              <AccordionContent>
                <p className="oracle-muted text-base">{MC.howItWorksPage.faq.items[8].a}</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-10">
              <AccordionTrigger className="text-left">
                {MC.howItWorksPage.faq.items[9].q}
              </AccordionTrigger>
              <AccordionContent>
                <p className="oracle-muted mb-3">{MC.howItWorksPage.faq.items[9].aLead}</p>
                <ul className="space-y-1 oracle-muted">
                  <li>{MC.howItWorksPage.faq.items[9].aList[0]}</li>
                  <li>{MC.howItWorksPage.faq.items[9].aList[1]}</li>
                  <li>{MC.howItWorksPage.faq.items[9].aList[2]}</li>
                  <li>{MC.howItWorksPage.faq.items[9].aList[3]}</li>
                  <li>{MC.howItWorksPage.faq.items[9].aList[4]}</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <div className="mt-12 p-6 bg-gray-50 rounded-lg border border-oracle-border text-center">
            <p className="oracle-muted mb-2">{MC.howItWorksPage.supportCta.intro}</p>
            <p className="oracle-muted">{MC.howItWorksPage.supportCta.details}</p>
          </div>
        </section>
      </div>

      {/* Back to Top Button */}
      {showBackToTop && (
        <button
          onClick={() => {
            console.debug("[HowItWorks] Back to top clicked");
            scrollToTop();
          }}
          className="fixed bottom-8 right-8 w-12 h-12 bg-oracle-accent hover:bg-oracle-accent/90 text-white rounded-full shadow-lg flex items-center justify-center transition-all duration-200 z-50"
          aria-label={MC.howItWorksPage.a11y.backToTopAria}
          data-testid="button-back-to-top"
        >
          <ChevronUp className="w-5 h-5" />
        </button>
      )}
    </MainLayout>
  );
}
