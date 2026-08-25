import { entity } from "./entity.ts";
import { DetailBlock, LegalPage } from "./legal-page.tsx";

/**
 * Anbieterkennzeichnung under §5 DDG, the successor to §5 TMG since May 2024.
 *
 * There is deliberately no link to the EU ODR platform: Regulation (EU) 2024/3228 repealed the ODR
 * Regulation and the platform was shut down on 20 July 2025, so the link most Impressum templates
 * still carry now points at nothing.
 *
 * §18(2) MStV is not covered either. It applies to journalistic-editorial offerings, which a
 * product site is not.
 */
export const Impressum = () => (
  <LegalPage title="Impressum">
    <h2>Angaben gemäß §&nbsp;5 DDG</h2>

    <DetailBlock label="Anbieterin">
      {entity.legalName}
      <br />
      {entity.street}
      <br />
      {entity.postalCode} {entity.city}
      <br />
      {entity.country}
    </DetailBlock>

    <DetailBlock label="Vertreten durch">{entity.representative}, Geschäftsführer</DetailBlock>

    <DetailBlock label="Kontakt">
      E-Mail: <a href={`mailto:${entity.email}`}>{entity.email}</a>
    </DetailBlock>

    <DetailBlock label="Registereintrag">
      Eingetragen im Handelsregister
      <br />
      Registergericht: {entity.registerCourt}
      <br />
      Registernummer: {entity.registerNumber}
    </DetailBlock>

    <DetailBlock label="Umsatzsteuer-Identifikationsnummer gemäß §&nbsp;27a UStG">
      {entity.vatId}
    </DetailBlock>

    <h2>Kleinunternehmerregelung</h2>
    <p>
      Als Kleinunternehmerin im Sinne von §&nbsp;19 UStG wird keine Umsatzsteuer berechnet und
      dementsprechend keine Umsatzsteuer ausgewiesen.
    </p>

    <h2>Verbraucherstreitbeilegung</h2>
    <p>
      Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer
      Verbraucherschlichtungsstelle teilzunehmen.
    </p>

    <h2>Haftung für Links</h2>
    <p>
      Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen
      Einfluss haben. Für diese fremden Inhalte kann daher keine Gewähr übernommen werden. Für die
      Inhalte der verlinkten Seiten ist stets die jeweilige Anbieterin oder der jeweilige Anbieter
      verantwortlich. Bei Bekanntwerden von Rechtsverletzungen entfernen wir derartige Links
      umgehend.
    </p>
  </LegalPage>
);
