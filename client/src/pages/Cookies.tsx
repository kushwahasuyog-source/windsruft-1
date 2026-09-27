import { LegalPage } from '../components/LegalPage';

export function Cookies() {
  return (
    <LegalPage title="Cookies Policy">
      <h2>1. Current cookie status</h2>
      <p>The audited PDFForge frontend does not set or read browser cookies. No cookie-consent script, advertising pixel or analytics cookie was found in the repository.</p>

      <h2>2. Local browser storage</h2>
      <p>The application uses <code>localStorage</code> for theme preference, favourites and local processing history. Local storage is technically different from cookies, but it is still described here for transparency.</p>

      <h2>3. Third-party technologies</h2>
      <p>No third-party maps, video players, advertising widgets or analytics embeds were found in the audited frontend. Hosting providers, CDNs or future integrations may introduce their own technologies; those must be reviewed before being enabled.</p>

      <h2>4. Consent</h2>
      <p>Because the current application has no non-essential cookies or tracking technologies requiring consent, a cookie-consent banner is not currently necessary. If non-essential cookies or tracking are added later, they must be blocked until the applicable consent choice is recorded and this policy must be updated.</p>

      <h2>5. Questions</h2>
      <p><strong>Contact email:</strong> TO BE PROVIDED BY SITE OWNER.</p>
    </LegalPage>
  );
}
