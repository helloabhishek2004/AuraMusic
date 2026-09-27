"use client";

import { useState, useRef, useEffect, useId } from "react";
import { ChevronDown } from "lucide-react";

interface FaqItem {
  q: string;
  a: string;
}

export default function FaqAccordion({ faqs }: { faqs: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="space-y-4">
      {faqs.map((faq, i) => (
        <AccordionItem
          key={faq.q}
          faq={faq}
          index={i}
          isOpen={openIndex === i}
          onToggle={() => setOpenIndex(openIndex === i ? null : i)}
        />
      ))}
    </div>
  );
}

function AccordionItem({
  faq,
  index,
  isOpen,
  onToggle,
}: {
  faq: FaqItem;
  index: number;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const baseId = useId();
  const buttonId = `faq-btn-${baseId}-${index}`;
  const contentId = `faq-panel-${baseId}-${index}`;

  useEffect(() => {
    if (contentRef.current) {
      setHeight(isOpen ? contentRef.current.scrollHeight : 0);
    }
  }, [isOpen]);

  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 transition-all">
      <h3 className="m-0 text-base font-semibold">
        <button
          type="button"
          id={buttonId}
          aria-expanded={isOpen}
          aria-controls={contentId}
          onClick={onToggle}
          className="flex items-center justify-between w-full p-6 text-left rounded-2xl focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:outline-none"
        >
          <span className="font-semibold pr-4 text-zinc-900 dark:text-zinc-50">{faq.q}</span>
          <ChevronDown
            aria-hidden="true"
            className={`w-5 h-5 flex-shrink-0 text-zinc-400 transition-transform duration-300 motion-reduce:transition-none ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </button>
      </h3>
      <div
        id={contentId}
        role="region"
        aria-labelledby={buttonId}
        style={{ height }}
        className="overflow-hidden transition-[height] duration-300 ease-in-out motion-reduce:transition-none"
      >
        <div ref={contentRef} className="px-6 pb-6">
          <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
            {faq.a}
          </p>
        </div>
      </div>
    </div>
  );
}
