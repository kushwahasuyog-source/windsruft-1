import { LegalPage } from '../components/LegalPage';

export function Privacy() {
  return (
    <LegalPage title="Privacy Policy">
      <h2>1. What this site currently processes</h2>
      <p>PDFForge is a browser-based document processing service. When you use a tool, files and the settings needed to perform the requested operation are sent to the service. The application does not request unnecessary profile information from the document tools.</p>

      <h2>2. Uploaded files</h2>
      <p>Uploaded files are placed in a temporary server workspace so the requested conversion or PDF operation can run. The current server sweeps temporary workspaces after 30 minutes by default (the deployment can configure this value with <code>TMP_TTL_MINUTES</code>). This is an implementation detail, not a guarantee of deletion from every infrastructure backup or log, and the deployment owner must verify its production storage and backup configuration.</p>

      <h2>3. Browser storage</h2>
      <p>The current client uses <code>localStorage</code>, not cookies, for theme preference, favourites, and local processing history. History can contain a file name, tool name, status, date, download URL and expiry time, and is capped at 50 entries. This data remains in the browser until cleared by the user or the application.</p>

      <h2>4. Analytics and tracking</h2>
      <p>The audited codebase contains no Google Analytics, Google Tag Manager, Meta Pixel, Hotjar, Microsoft Clarity, Plausible, or equivalent analytics/tracking script. The server currently logs request method and request path for operational purposes. Hosting/CDN infrastructure may create additional logs; those are outside this application repository and must be documented by the deployment operator.</p>

      <h2>5. Accounts</h2>
      <p>Account endpoints exist in the codebase but currently return a not-configured response. If account functionality is enabled, the privacy notice must be updated to describe the actual authentication provider, account data, retention, security controls and any data processors used.</p>

      <h2>6. Third parties</h2>
      <p>The audited frontend contains no third-party maps, video embeds, advertising widgets or remote tracking embeds. Google sign-in is represented by a currently disabled server endpoint rather than an active third-party sign-in integration.</p>

      <h2>7. Your requests</h2>
      <p>For access, correction, deletion, privacy questions or complaints, use the contact details that the site operator publishes on this page before launch. The actual operator name, contact email and address have intentionally not been guessed.</p>

      <h2>8. Operator information</h2>
      <p><strong>Data controller / site operator:</strong> TO BE PROVIDED BY SITE OWNER.</p>
      <p><strong>Contact email:</strong> TO BE PROVIDED BY SITE OWNER.</p>
      <p><strong>Business/registration address:</strong> TO BE PROVIDED BY SITE OWNER.</p>
    </LegalPage>
  );
}
