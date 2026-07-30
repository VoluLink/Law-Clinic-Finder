import type { GermanOnly, Translations } from '../dictionary';

/**
 * Landing copy that is maintained in German only. Every locale is served these
 * strings unchanged, so the sections explaining the site and student legal
 * advice have exactly one wording to keep current.
 */
export const deOnly: GermanOnly = {
  searchPlaceholder:
    'Beschreibe deine Situation bitte möglichst genau. Schreibe auch, wo du wohnst oder wo sich dein Problem ergeben hat, und wer du bist (z. B. Student, Bedürftiger, Senior, Start-up-Gründer, …).',
  aiDisclaimer:
    'Deine Anfrage wird anonymisiert von einer künstlichen Intelligenz bearbeitet. Bitte schreibe keine personenbezogenen Informationen in den Chat. Die KI führt keine Rechtsberatung durch.',
  soHeading: 'So funktioniert diese Website',
  soIntro:
    'Du beschreibst dein Problem, eine KI ordnet es ein und schlägt dir die Law Clinic vor, die dir helfen kann.',
  step1Title: 'Du beschreibst dein Problem',
  step1Text:
    'Beschreibe den Sachverhalt kurz, schreib, wo du wohnst, und ein bisschen darüber, wer du bist (z. B. Student, Flüchtling, Vereinsmitglied, …).',
  step2Title: 'Die KI wertet aus, worum es bei deinem Problem rechtlich genau geht',
  step2Text:
    'Deine Nachricht wird anonymisiert an eine KI übersendet. Die KI findet dann heraus, welche Rechtsgebiete bei deinem Problem betroffen sind.',
  step3Title: 'Die KI sucht die passende Law Clinic heraus',
  step3Text: 'Deine Situation wird mit den Beratungsvoraussetzungen aller Law Clinics abgeglichen.',
  step4Title: 'Du bekommst die passende Law Clinic vorgeschlagen',
  step4Text:
    'Du bekommst von der KI einen Vorschlag, welche Law Clinic dir helfen kann. Du kannst dich dann direkt bei dieser melden, um beraten zu werden.',
  faqSub: 'Wie studentische Rechtsberatung funktioniert – und warum es sie gibt.',
  faqWhatIsQ: 'Was ist eine Law Clinic?',
  faqWhatIsA:
    'Law Clinics sind studentische Rechtsberatungen, meist an Universitäten. Fortgeschrittene Jurastudierende bearbeiten echte Fälle und beraten dich kostenlos – begleitet, geschult und geprüft von Volljurist:innen aus der Praxis.',
  faqWhoAdvisesQ: 'Wer berät mich – und wer prüft das Ergebnis?',
  faqWhoAdvisesA:
    'Beraten wirst du von geschulten Jurastudierenden. Begleitet werden sie laufend von Volljurist:innen aus der Praxis als Beirät:innen: Diese führen die Beratenden an die Fallbearbeitung und die relevanten Beratungsthemen heran, schulen sie, überprüfen die erarbeiteten Ergebnisse und stehen als Ansprechpartner:innen zur Verfügung – so gibt es das Rechtsdienstleistungsgesetz vor.',
  faqWhyStudentsQ: 'Warum beraten Studierende überhaupt?',
  faqWhyStudentsA:
    'Studentische Rechtsberatung ist eine einzigartige Möglichkeit, Rechtskenntnisse und eine Vielzahl an Soft Skills für Referendariat und Beruf zu erlernen: den Umgang mit Mandantinnen und Mandanten, die Ermittlung von Sachverhalten, das Verfassen von Schriftsätzen und das Finden praxisgerechter Lösungen im Team. Aus der Anwendung des im Studium abstrakt Gelernten auf echte Lebenssachverhalte entsteht zugleich ein vertieftes Verständnis für Möglichkeiten und Grenzen des Rechts und seine verantwortungsbewusste Anwendung.',
  faqWhoBenefitsQ: 'Wem hilft studentische Rechtsberatung?',
  faqWhoBenefitsA:
    'Studentische Rechtsberatung macht Rechtsrat den Personengruppen zugänglich, denen er andernfalls verschlossen bliebe – etwa wegen eines zu geringen Streitwerts, fehlender finanzieller Mittel oder Schwellenangst vor der Inanspruchnahme von Rechtsanwältinnen und Rechtsanwälten. Gleichzeitig wird das staatliche Beratungshilfebudget geschont. Entsprechend der Forderung des Bundesverfassungsgerichts nach mehr Rechtsschutz- und Rechtswahrnehmungsgleichheit ist sie damit ein zentrales Standbein für Rechtssicherheit und Gerechtigkeit in Deutschland.',
};

export const de: Translations = {
  navSo: "So funktioniert's",
  navFaq: 'Häufige Fragen',
  navCta: 'Deine Law Clinic anmelden',
  langLabel: 'Sprache',
  heroTitle: 'Finde die Law Clinic, die zu deinem Anliegen passt.',
  heroSub:
    'Beschreibe dein rechtliches Problem in deinen eigenen Worten. Wir finden die passende studentische Rechtsberatung für dich – kostenlos und vertraulich.',
  searchLabel: 'Worum geht es bei dir?',
  searchBtn: 'Passende Law Clinic finden',
  faqHeading: 'Häufige Fragen',
  faqCostQ: 'Was kostet die Beratung?',
  faqCostA:
    'Nichts. Die Beratung in einer Law Clinic ist immer kostenlos – unabhängig von deinem Einkommen oder deiner Situation.',
  faqConfidentialQ: 'Sind meine Angaben vertraulich?',
  faqConfidentialA:
    'Ja. Alle Beteiligten einer Law Clinic sind zur Vertraulichkeit verpflichtet. Deine Angaben werden nur für deine Beratung verwendet.',
  faqCourtQ: 'Können Law Clinics mich vor Gericht vertreten?',
  faqCourtA:
    'In der Regel nicht. Law Clinics geben dir eine rechtliche Ersteinschätzung und helfen dir, dein Anliegen einzuordnen. Brauchst du eine Vertretung vor Gericht, unterstützen sie dich dabei, die nächsten Schritte zu finden.',
  footerPrivacy: 'Datenschutz',
  footerImprint: 'Impressum',
  footerAccount: 'Account',
  cooperation: 'Ein Kooperationsprojekt von',
  assistantName: 'Clinic-Finder Assistent',
  assistantTag: 'ASSISTENT',
  chatYou: 'Du',
  whyFits: 'Warum das passt:',
  toWebsite: 'Zur Website',
  recFooter:
    'Wende dich direkt per E-Mail oder über die Website an die Law Clinic. Die Beratung ist kostenlos und vertraulich.',
  saveRecommendations: 'Empfehlungen sichern',
  saveRecommendationsDescription: 'Speichere deine Angaben und Empfehlungen aus diesem Chat.',
  downloadPdf: 'Als PDF',
  copyText: 'Text kopieren',
  copiedText: 'Text kopiert',
  pdfPreparing: 'PDF wird erstellt…',
  exportError: 'Das Speichern hat nicht funktioniert. Bitte versuche es erneut.',
  exportTitle: 'Law Clinic Finder Empfehlung',
  exportConcern: 'Angaben aus dem Chat',
  exportGeneratedOn: 'Erstellt am',
  exportAreas: 'Rechtsgebiete',
  exportWebsite: 'Website',
  exportEmail: 'E-Mail',
  exportFindMore: 'Neue Empfehlungen finden',
  chatPlaceholder: 'Nachricht eingeben…',
  chatSend: 'Senden',
  chatError: 'Etwas ist schiefgelaufen. Bitte versuche es erneut.',
  chatDisabled: 'Der Assistent ist zurzeit nicht verfügbar. Bitte versuche es später erneut.',
  chatUnavailableTitle: 'Assistent zurzeit nicht verfügbar',
  limitMinuteTitle: 'Anfragelimit erreicht',
  limitMinuteBody:
    'Zu viele Anfragen. Bitte warte einen Moment. Um Missbrauch und Kosten zu begrenzen, sind kurzfristig nur wenige Nachrichten möglich.',
  limitDailyTitle: 'Anfragelimit erreicht',
  limitDailyBody:
    'Du hast das Tageslimit an Nachrichten erreicht. Dieser kostenlose Dienst begrenzt die Anfragen pro Tag, um die Kosten der KI-Beratung für alle tragbar zu halten. Bitte versuche es morgen erneut oder wende dich direkt an eine Law Clinic.',
  charWarn: 'Maximale Länge erreicht (4.000 Zeichen).',
  chatCompletedTitle: 'Dieser Chat ist abgeschlossen',
  chatCompletedDescription:
    'Für ein neues Anliegen kannst du jederzeit einen frischen Chat starten.',
  chatCompletedBtnRestart: 'Neuen Chat starten',
  noMatchResultTitle: 'Keine Law Clinic gefunden',
  noMatchTitle: 'Wie es trotzdem weitergeht',
  noMatchStep1:
    'Erweitere deine Suche: Viele Law Clinics beraten bundesweit per Telefon oder Video – unabhängig von deinem Wohnort.',
  noMatchStep2:
    'Starte den Chat mit anderen Angaben neu – eine andere Region, ein breiter gefasstes Rechtsgebiet oder eine andere Sprache führt manchmal doch zu einem Treffer.',
  noMatchStep3:
    'Beantrage Beratungshilfe beim Amtsgericht: Für eine anwaltliche Erstberatung zahlst du damit nur einen geringen Eigenanteil.',
  noMatchBtnDirectory: 'Alle Law Clinics ansehen',
  noMatchBtnRestart: 'Chat neu starten',
};
