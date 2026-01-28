import { MainLayout } from "@/components/layout/MainLayout";
import { TemplateManager } from "@/components/templates/TemplateManager";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { MC } from "@/lib/microcopy";
import { useEffect } from "react";
import { HelpTip } from "@/components/ui/help-tip";

export default function Templates() {
  // Lightweight debug log for page mount to aid troubleshooting in dev
  useEffect(() => {
    // Safe for production; no sensitive data and minimal verbosity
    console.debug("[TemplatesPage] mounted");
  }, []);

  return (
    <MainLayout>
      <SectionHeader
        title={MC.templatesPage.header.title}
        subheader={MC.templatesPage.header.subheader}
        guide={MC.templatesPage.header.guide}
        tooltip={<HelpTip content={MC.templatesPage.header.guide} />}
        level={2}
        className="mb-8"
      />

      <TemplateManager />
    </MainLayout>
  );
}
