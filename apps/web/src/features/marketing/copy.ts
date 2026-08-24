import { contactEmail, sectionIds } from "#/domain-ui/brand/links.ts";

/**
 * Every word on the landing page, in one place.
 *
 * The three design variants exist to be compared against each other, so they have to say the same
 * thing. Keeping the copy here means a comparison measures the design and not the wording, and it
 * gives one file to iterate on when the wording is what needs work.
 */
export const copy = {
  meta: {
    title: "Studienbuch — das digitale Studienbuch für die Schule",
    description:
      "Stundenplan, Vertretungen, Noten, Fehlzeiten und Hausaufgaben in einer App. Für Schülerinnen und Schüler, Eltern und Schulen, die ihr Papier-Studienbuch loswerden wollen.",
  },

  nav: [
    { href: `#${sectionIds.features}`, label: "Funktionen" },
    { href: `#${sectionIds.offline}`, label: "Offline" },
    { href: `#${sectionIds.schools}`, label: "Für Schulen" },
  ],

  hero: {
    headline: ["Das digitale", "Studienbuch"],
    lead: "Stundenplan, Noten, Fehlzeiten und Hausaufgaben. Auf dem Handy, auch wenn im Fachraum kein Netz ist.",
    downloadPrompt: "Jetzt als Download für Android und iOS:",
  },

  features: {
    title: "Der Schultag auf einen Blick",
    lead: "Das Papier-Studienbuch kann eine Sache richtig gut: alles an einem Ort sammeln. Genau das macht die App, nur dass sie mitdenkt.",
    items: [
      {
        title: "Stundenplan und Vertretungen",
        body: "Der Wochenplan kommt aus dem System deiner Schule. Was ausfällt, verlegt oder vertreten wird, steht morgens in der Übersicht, mit Grund und Lehrkraft.",
      },
      {
        title: "Noten",
        body: "Mündlich und schriftlich getrennt, in Punkten, mit Datum und Durchschnitt. Lehrkraft und Eltern unterschreiben direkt in der App.",
      },
      {
        title: "Fehlzeiten",
        body: "Du siehst, welche Entschuldigung noch aussteht. Kein loser Zettel, kein Stempel im Heft, keine Diskussion am Ende des Halbjahres.",
      },
      {
        title: "Hausaufgaben",
        body: "Hängen am Kurs, haben ein Fälligkeitsdatum und dürfen auch einfach ein Foto vom Tafelbild sein.",
      },
    ],
  },

  offline: {
    title: "Funktioniert auch ohne Empfang",
    body: "Studienbuch speichert zuerst auf dem Gerät und gleicht ab, sobald wieder Netz da ist. Die App startet mit deinen Daten statt mit einem Ladebalken. Was du im Fachraum einträgst, ist auch dann noch da, wenn das WLAN es nie erfahren hat.",
  },

  schools: {
    title: "Für Schulen",
    body: "Studienbuch löst das Papier-Studienbuch ab, inklusive Stundenplan-Import, Noten und der Unterschriften von Eltern und Lehrkräften. Wenn das für Ihre Schule interessant klingt, schreiben Sie uns.",
    cta: "Schreiben Sie uns",
    href: `mailto:${contactEmail}`,
  },

  footer: {
    credit: "Eine Hauke Schnau Produktion",
    legal: [
      { href: "/impressum", label: "Impressum" },
      { href: "/datenschutz", label: "Datenschutz" },
    ],
  },
} as const;
