import { buttonClasses } from '@/components/ui/Button';
import type { ClinicRecommendation } from '@/lib/chat/stream-protocol';
import type { Dictionary } from '@/lib/i18n/dictionary';

const ICON_PROPS = {
  width: 15,
  height: 15,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

const GlobeIcon = (
  <svg {...ICON_PROPS} aria-hidden>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18" />
    <path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z" />
  </svg>
);

const MailIcon = (
  <svg {...ICON_PROPS} aria-hidden>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3 7 9 6 9-6" />
  </svg>
);

/**
 * The clinic cards the assistant renders through the `recommend_clinics` tool.
 * Every field except `reason` comes from the directory, so the model chooses
 * which clinics appear and why — never what the card claims about them.
 */
export function ClinicRecommendations({
  dict,
  items,
}: {
  dict: Dictionary;
  items: ClinicRecommendation[];
}) {
  if (items.length === 0) return null;
  return (
    <div className="flex animate-[chat-in_0.35s_ease] flex-col gap-3.5">
      <ul className="flex flex-col gap-3.5">
        {items.map((clinic) => (
          <RecommendationCard key={`${clinic.rank}-${clinic.name}`} dict={dict} clinic={clinic} />
        ))}
      </ul>
      <p className="mx-1 text-[13px] leading-relaxed text-muted-soft">{dict.recFooter}</p>
    </div>
  );
}

function RecommendationCard({ dict, clinic }: { dict: Dictionary; clinic: ClinicRecommendation }) {
  return (
    <li className="flex items-start gap-3.5 rounded-xl border border-border bg-surface p-5">
      <span
        aria-hidden
        className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-primary text-[15px] font-extrabold text-primary-foreground"
      >
        {clinic.rank}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <h3 className="text-[18px] font-extrabold text-primary">{clinic.name}</h3>
          {clinic.region && <span className="text-sm text-muted-soft">{clinic.region}</span>}
        </div>
        {clinic.areas.length > 0 && (
          <ul className="mt-2.5 flex flex-wrap gap-1.5">
            {clinic.areas.map((area) => (
              <li
                key={area}
                className="rounded-sm bg-chip px-2.5 py-1 text-[13px] font-semibold text-primary"
              >
                {area}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-[15px] leading-relaxed text-foreground">
          <span className="font-bold text-primary">{dict.whyFits} </span>
          {clinic.reason}
        </p>
        <CardActions dict={dict} clinic={clinic} />
      </div>
    </li>
  );
}

function CardActions({ dict, clinic }: { dict: Dictionary; clinic: ClinicRecommendation }) {
  if (!clinic.website && !clinic.email) return null;
  const action = 'gap-2 px-4 py-2.5 text-sm font-bold';
  return (
    <div className="mt-4 flex flex-wrap gap-2.5 border-t border-border pt-3.5">
      {clinic.website && (
        <a
          href={clinic.website}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClasses('primary', 'default', action)}
        >
          {GlobeIcon}
          {dict.toWebsite}
        </a>
      )}
      {clinic.email && (
        <a
          href={`mailto:${clinic.email}`}
          className={buttonClasses('accent', 'default', `${action} break-all`)}
        >
          {MailIcon}
          {clinic.email}
        </a>
      )}
    </div>
  );
}
