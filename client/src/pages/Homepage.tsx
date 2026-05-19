import { useEffect } from "react";
import { Link } from "wouter";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { CalloutBlock } from "@/components/ui/info-blocks";
import { MC } from "@/lib/microcopy";
import { 
  ArrowRight, 
  TrendingUp, 
  Users, 
  Mail, 
  Zap, 
  DollarSign, 
  Link2, 
  Gauge, 
  PenTool,
  FileText,
  Upload,
  Braces,
  Workflow,
  PlayCircle,
  Table
} from "lucide-react";

export default function Homepage() {
  useEffect(() => {
    console.debug("[Homepage] Mounted");
  }, []);
  return (
    <MainLayout>
      {/* Hero Section */}
      <section className="py-16 lg:py-24">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="oracle-heading mb-6">
            {MC.homepage.hero.title}
          </h1>
          <p className="text-xl oracle-muted mb-10 leading-relaxed text-left max-w-4xl mx-auto">
            {MC.homepage.hero.subtitle}
          </p>
          <Link href="/dashboard">
            <Button 
              className="px-6 py-3 text-base"
              variant="default"
              data-testid="button-get-started"
            >
              {MC.homepage.hero.ctaText}
              <ArrowRight className="ml-2" size={20} />
            </Button>
          </Link>
        </div>
      </section>

      {/* Section 1.5 - Problem Statement (merged, left-aligned) */}
      <section className="py-16 border-t border-oracle-border">
        <div className="max-w-4xl mx-auto">
          <p className="text-xl lg:text-2xl font-bold oracle-heading font-lato mb-4">
            {MC.homepage.problem.heading}
          </p>
          <div className="bg-white rounded-lg p-8 border border-oracle-border">
            <p className="text-lg oracle-muted leading-relaxed mb-4">
              {MC.homepage.problem.p1} {MC.homepage.problem.p2}
            </p>
            <div className="mt-6">
              <Link href="/dashboard">
                <Button
                  className="px-6 py-3 text-base border-oracle-accent text-oracle-accent hover:bg-oracle-accent hover:text-white"
                  variant="outline"
                  data-testid="button-try-it-out"
                  onClick={() => console.debug("[Homepage] CTA click: Try It Out →")}
                >
                  Try It Out
                  <ArrowRight className="ml-2" size={20} />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* (Removed) Separate One Row section to avoid duplication */}

      {/* Builders Section: Experts / Tasks / Enrich */}
      <section className="py-16 border-t border-oracle-border">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h2 className="text-2xl lg:text-3xl font-bold oracle-heading font-lato">
              {MC.homepage.builders.title}
            </h2>
          </div>

          {/* AI Experts */}
          <div className="mb-10">
            <SectionHeader
              title={MC.homepage.builders.items[0].title}
              icon={<Users className="text-oracle-accent" size={20} />}
              guide={MC.homepage.builders.items[0].description}
              className="rounded-lg"
            />
            <CalloutBlock>
              <ul className="list-disc list-inside">
                <li>{MC.homepage.builders.items[0].examples[0]}</li>
                <li>{MC.homepage.builders.items[0].examples[1]}</li>
                <li>{MC.homepage.builders.items[0].examples[2]}</li>
              </ul>
            </CalloutBlock>
          </div>

          {/* Custom Tasks */}
          <div className="mb-10">
            <SectionHeader
              title={MC.homepage.builders.items[1].title}
              icon={<Braces className="text-oracle-accent" size={20} />}
              guide={MC.homepage.builders.items[1].description}
              className="rounded-lg"
            />
            <CalloutBlock>
              <ul className="list-disc list-inside">
                <li>{MC.homepage.builders.items[1].examples[0]}</li>
                <li>{MC.homepage.builders.items[1].examples[1]}</li>
                <li>{MC.homepage.builders.items[1].examples[2]}</li>
              </ul>
            </CalloutBlock>
          </div>

          {/* Enrich Table */}
          <div className="mb-6">
            <SectionHeader
              title={MC.homepage.builders.items[2].title}
              icon={<Table className="text-oracle-accent" size={20} />}
              guide={MC.homepage.builders.items[2].description}
              className="rounded-lg"
            />
            <CalloutBlock>
              <ul className="list-disc list-inside">
                <li>{MC.homepage.builders.items[2].examples[0]}</li>
                <li>{MC.homepage.builders.items[2].examples[1]}</li>
                <li>{MC.homepage.builders.items[2].examples[2]}</li>
              </ul>
            </CalloutBlock>
          </div>

          <div className="mt-8 text-center">
            <Link href="/how-it-works">
              <Button
                className="px-6 py-3 text-base border-oracle-accent text-oracle-accent hover:bg-oracle-accent hover:text-white"
                variant="outline"
                data-testid="button-how-it-works-section"
                onClick={() => console.debug("[Homepage] CTA click: How It Works")}
              >
                {"Explore How It Works."}
                <ArrowRight className="ml-2" size={20} />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="py-16 border-t border-oracle-border">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <h2 className="text-2xl lg:text-3xl font-bold oracle-heading font-lato mb-2">
              {MC.homepage.useCases.title}
            </h2>
            <p className="text-lg oracle-muted">
              {MC.homepage.useCases.subtitle}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Use Case 1 */}
            <Card className="border border-oracle-border hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 bg-oracle-accent/10 rounded-lg flex items-center justify-center mb-4 mx-auto">
                  <TrendingUp className="text-oracle-accent" size={24} />
                </div>
                <CardTitle className="text-xl font-semibold oracle-heading">
                  {MC.homepage.useCases.items[0].title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="oracle-muted mb-4">
                  {MC.homepage.useCases.items[0].description}
                </p>
                <ol className="list-decimal list-inside space-y-2 oracle-muted text-sm">
                  <li>{MC.homepage.useCases.items[0].bullets[0]}</li>
                  <li>{MC.homepage.useCases.items[0].bullets[1]}</li>
                </ol>
                <p className="text-sm font-semibold mt-4 text-oracle-accent">
                  {MC.homepage.useCases.items[0].footer}
                </p>
              </CardContent>
            </Card>

            {/* Use Case 2 */}
            <Card className="border border-oracle-border hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 bg-oracle-accent/10 rounded-lg flex items-center justify-center mb-4 mx-auto">
                  <Users className="text-oracle-accent" size={24} />
                </div>
                <CardTitle className="text-xl font-semibold oracle-heading">
                  {MC.homepage.useCases.items[1].title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="oracle-muted mb-4">
                  {MC.homepage.useCases.items[1].description}
                </p>
                <ol className="list-decimal list-inside space-y-2 oracle-muted text-sm">
                  <li>{MC.homepage.useCases.items[1].bullets[0]}</li>
                  <li>{MC.homepage.useCases.items[1].bullets[1]}</li>
                  <li>{MC.homepage.useCases.items[1].bullets[2]}</li>
                </ol>
                <p className="text-sm font-semibold mt-4 text-oracle-accent">
                  {MC.homepage.useCases.items[1].footer}
                </p>
              </CardContent>
            </Card>

            {/* Use Case 3 */}
            <Card className="border border-oracle-border hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 bg-oracle-accent/10 rounded-lg flex items-center justify-center mb-4 mx-auto">
                  <Mail className="text-oracle-accent" size={24} />
                </div>
                <CardTitle className="text-xl font-semibold oracle-heading">
                  {MC.homepage.useCases.items[2].title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="oracle-muted mb-4">
                  {MC.homepage.useCases.items[2].description}
                </p>
                <ol className="list-decimal list-inside space-y-2 oracle-muted text-sm">
                  <li>{MC.homepage.useCases.items[2].bullets[0]}</li>
                  <li>{MC.homepage.useCases.items[2].bullets[1]}</li>
                </ol>
                <p className="text-sm font-semibold mt-4 text-oracle-accent">
                  {MC.homepage.useCases.items[2].footer}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 border-t border-oracle-border bg-background">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <h2 className="text-2xl lg:text-3xl font-bold oracle-heading font-lato mb-2">
              {MC.homepage.features.title}
            </h2>
            <p className="text-lg oracle-muted">
              {MC.homepage.features.subtitle}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="bg-white p-6 rounded-lg border border-oracle-border">
              <div className="w-10 h-10 bg-oracle-accent/10 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <Zap className="text-oracle-accent" size={20} />
              </div>
              <h3 className="text-lg font-semibold oracle-heading mb-2">
                {MC.homepage.features.items[0].title}
              </h3>
              <p className="oracle-muted text-sm">
                {MC.homepage.features.items[0].description}
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white p-6 rounded-lg border border-oracle-border">
              <div className="w-10 h-10 bg-oracle-accent/10 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <DollarSign className="text-oracle-accent" size={20} />
              </div>
              <h3 className="text-lg font-semibold oracle-heading mb-2">
                {MC.homepage.features.items[1].title}
              </h3>
              <p className="oracle-muted text-sm">
                {MC.homepage.features.items[1].description}
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white p-6 rounded-lg border border-oracle-border">
              <div className="w-10 h-10 bg-oracle-accent/10 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <Link2 className="text-oracle-accent" size={20} />
              </div>
              <h3 className="text-lg font-semibold oracle-heading mb-2">
                {MC.homepage.features.items[2].title}
              </h3>
              <p className="oracle-muted text-sm">
                {MC.homepage.features.items[2].description}
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-white p-6 rounded-lg border border-oracle-border">
              <div className="w-10 h-10 bg-oracle-accent/10 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <Gauge className="text-oracle-accent" size={20} />
              </div>
              <h3 className="text-lg font-semibold oracle-heading mb-2">
                {MC.homepage.features.items[3].title}
              </h3>
              <p className="oracle-muted text-sm">
                {MC.homepage.features.items[3].description}
              </p>
            </div>

            {/* Feature 5 */}
            <div className="bg-white p-6 rounded-lg border border-oracle-border">
              <div className="w-10 h-10 bg-oracle-accent/10 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <PenTool className="text-oracle-accent" size={20} />
              </div>
              <h3 className="text-lg font-semibold oracle-heading mb-2">
                {MC.homepage.features.items[4].title}
              </h3>
              <p className="oracle-muted text-sm">
                {MC.homepage.features.items[4].description}
              </p>
            </div>

            {/* Feature 6 */}
            <div className="bg-white p-6 rounded-lg border border-oracle-border">
              <div className="w-10 h-10 bg-oracle-accent/10 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <FileText className="text-oracle-accent" size={20} />
              </div>
              <h3 className="text-lg font-semibold oracle-heading mb-2">
                {MC.homepage.features.items[5].title}
              </h3>
              <p className="oracle-muted text-sm">
                {MC.homepage.features.items[5].description}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 border-t border-oracle-border">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <h2 className="text-2xl lg:text-3xl font-bold oracle-heading font-lato mb-2">
              {MC.homepage.howItWorks.title}
            </h2>
            <p className="text-lg oracle-muted">
              {MC.homepage.howItWorks.subtitle}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            {/* Step 1 */}
            <div className="flex flex-col text-left">
              <div className="flex justify-center mb-3">
                <div className="w-12 h-12 bg-oracle-accent/10 rounded-lg flex items-center justify-center">
                  <Upload className="text-oracle-accent" size={24} />
                </div>
              </div>
              <div className="flex items-start gap-2 mb-2 min-h-14">
                <div className="w-8 h-8 rounded-full bg-oracle-accent/10 text-oracle-accent text-sm font-semibold flex items-center justify-center">
                  1
                </div>
                <h3 className="text-base font-semibold oracle-heading">
                  {MC.homepage.howItWorks.steps[0].title}
                </h3>
              </div>
              <p className="oracle-muted text-sm">{MC.homepage.howItWorks.steps[0].description}</p>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col text-left">
              <div className="flex justify-center mb-3">
                <div className="w-12 h-12 bg-oracle-accent/10 rounded-lg flex items-center justify-center">
                  <Braces className="text-oracle-accent" size={24} />
                </div>
              </div>
              <div className="flex items-start gap-2 mb-2 min-h-14">
                <div className="w-8 h-8 rounded-full bg-oracle-accent/10 text-oracle-accent text-sm font-semibold flex items-center justify-center">
                  2
                </div>
                <h3 className="text-base font-semibold oracle-heading">
                  {MC.homepage.howItWorks.steps[1].title}
                </h3>
              </div>
              <p className="oracle-muted text-sm">{MC.homepage.howItWorks.steps[1].description}</p>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col text-left">
              <div className="flex justify-center mb-3">
                <div className="w-12 h-12 bg-oracle-accent/10 rounded-lg flex items-center justify-center">
                  <Workflow className="text-oracle-accent" size={24} />
                </div>
              </div>
              <div className="flex items-start gap-2 mb-2 min-h-14">
                <div className="w-8 h-8 rounded-full bg-oracle-accent/10 text-oracle-accent text-sm font-semibold flex items-center justify-center">
                  3
                </div>
                <h3 className="text-base font-semibold oracle-heading">
                  {MC.homepage.howItWorks.steps[2].title}
                </h3>
              </div>
              <p className="oracle-muted text-sm">{MC.homepage.howItWorks.steps[2].description}</p>
            </div>

            {/* Step 4 */}
            <div className="flex flex-col text-left">
              <div className="flex justify-center mb-3">
                <div className="w-12 h-12 bg-oracle-accent/10 rounded-lg flex items-center justify-center">
                  <PlayCircle className="text-oracle-accent" size={24} />
                </div>
              </div>
              <div className="flex items-start gap-2 mb-2 min-h-14">
                <div className="w-8 h-8 rounded-full bg-oracle-accent/10 text-oracle-accent text-sm font-semibold flex items-center justify-center">
                  4
                </div>
                <h3 className="text-base font-semibold oracle-heading">
                  {MC.homepage.howItWorks.steps[3].title}
                </h3>
              </div>
              <p className="oracle-muted text-sm">{MC.homepage.howItWorks.steps[3].description}</p>
            </div>

            {/* Step 5 */}
            <div className="flex flex-col text-left">
              <div className="flex justify-center mb-3">
                <div className="w-12 h-12 bg-oracle-accent/10 rounded-lg flex items-center justify-center">
                  <Table className="text-oracle-accent" size={24} />
                </div>
              </div>
              <div className="flex items-start gap-2 mb-2 min-h-14">
                <div className="w-8 h-8 rounded-full bg-oracle-accent/10 text-oracle-accent text-sm font-semibold flex items-center justify-center">
                  5
                </div>
                <h3 className="text-base font-semibold oracle-heading">
                  {MC.homepage.howItWorks.steps[4].title}
                </h3>
              </div>
              <p className="oracle-muted text-sm">{MC.homepage.howItWorks.steps[4].description}</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 border-t border-oracle-border">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl lg:text-3xl font-bold oracle-heading font-lato mb-4">
            {MC.homepage.cta.title}
          </h2>
          <p className="text-lg oracle-muted mb-8">
            {MC.homepage.cta.description}
          </p>
          <Link href="/dashboard">
            <Button 
              className="px-6 py-3 text-base border-oracle-accent text-oracle-accent hover:bg-oracle-accent hover:text-white"
              variant="outline"
              data-testid="button-start-reducing-effort"
              onClick={() => console.debug("[Homepage] CTA click: Start Reducing Your Effort")}
            >
              {MC.homepage.cta.ctaText}
              <ArrowRight className="ml-2" size={20} />
            </Button>
          </Link>
        </div>
      </section>
    </MainLayout>
  );
}