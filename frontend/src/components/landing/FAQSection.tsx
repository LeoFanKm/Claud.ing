import { useTranslation } from "react-i18next";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const FAQ_KEYS = [
  "codeSecurity",
  "supportedAgents",
  "isFree",
  "parallelExecution",
  "vscodeSupport",
  "whatIsMcp",
] as const;

export function FAQSection() {
  const { t } = useTranslation("landing");

  return (
    <section className="py-16 sm:py-24" id="faq">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h2 className="mb-12 text-center font-bold text-3xl tracking-tight sm:text-4xl">
          {t("faq.title")}
        </h2>

        <Accordion className="w-full" collapsible type="single">
          {FAQ_KEYS.map((key, index) => (
            <AccordionItem key={key} value={`item-${index}`}>
              <AccordionTrigger className="text-left">
                {t(`faq.items.${key}.question`)}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {t(`faq.items.${key}.answer`)}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
