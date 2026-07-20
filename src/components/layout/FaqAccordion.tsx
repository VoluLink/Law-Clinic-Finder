'use client';

import { useState } from 'react';

export type FaqItem = { question: string; answer: string };

/** Single-open accordion: opening one item closes the others (design behavior). */
export function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <div>
      {items.map((item, index) => {
        const isOpen = index === openIndex;
        return (
          <div key={item.question} className="border-b border-primary/15">
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpenIndex(isOpen ? -1 : index)}
              className="flex w-full items-center justify-between gap-5 py-6 text-start text-lg font-bold text-primary sm:text-[19px]"
            >
              <span>{item.question}</span>
              <span aria-hidden className="shrink-0 text-[28px] leading-none font-normal">
                {isOpen ? '–' : '+'}
              </span>
            </button>
            {isOpen && (
              <p className="max-w-2xl pb-6 text-base leading-relaxed text-muted animate-[chat-in_0.25s_ease]">
                {item.answer}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
