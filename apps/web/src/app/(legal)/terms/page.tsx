export const metadata = { title: "Terms of Service — Lumen" };

export default function TermsPage() {
  return (
    <>
      <h1>Terms of Service</h1>
      <p>
        <em>Effective date: {"{{EFFECTIVE_DATE}}"}</em>
      </p>
      <p>
        These Terms govern your use of Lumen, provided by {"{{LEGAL_ENTITY}}"}.
        By creating an account or using the service, you agree to these Terms.
        If you do not agree, do not use Lumen.
      </p>

      <h2>Eligibility</h2>
      <p>
        You must be at least 13 years old (or 16 in the European Union) to use
        Lumen. By using the service you represent that you meet this
        requirement.
      </p>

      <h2>Your account</h2>
      <p>
        You are responsible for the activity under your account and for keeping
        your credentials secure. Notify {"{{CONTACT_EMAIL}}"} of any
        unauthorized use.
      </p>

      <h2>Your content</h2>
      <p>
        You retain ownership of the notes, files, audio, and other content you
        upload ("Your Content"). You grant us a limited license to store,
        process, and display Your Content solely to operate the service for you
        — including generating transcripts from your audio. We do not claim
        ownership of Your Content and do not use it to train machine-learning
        models.
      </p>
      <p>
        You are responsible for ensuring you have the right to upload Your
        Content, including any recordings of other people, and for complying
        with applicable recording-consent laws.
      </p>

      <h2>The optional AI assistant</h2>
      <p>
        If you enable the in-app AI assistant, you must supply your own
        Anthropic API key, and relevant excerpts of Your Content are sent to
        Anthropic to generate responses under your key and Anthropic's terms.
        Assistant responses are generated automatically, may be inaccurate, and
        are provided "as is".
      </p>

      <h2>Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>
          upload unlawful content or content that infringes others' rights;
        </li>
        <li>
          attempt to access other users' data or breach the service's security;
        </li>
        <li>
          abuse, overload, or disrupt the service or its transcription
          resources;
        </li>
        <li>use the service to violate any applicable law.</li>
      </ul>

      <h2>Transcription accuracy</h2>
      <p>
        Automated transcripts are provided "as is" and may contain errors. Do
        not rely on them for any purpose requiring verified accuracy.
      </p>

      <h2>Service availability</h2>
      <p>
        We aim to keep Lumen available but do not guarantee uninterrupted
        service, and we may modify or discontinue features.
      </p>

      <h2>Termination</h2>
      <p>
        You may stop using Lumen and delete your account at any time. We may
        suspend or terminate accounts that violate these Terms.
      </p>

      <h2>Disclaimers</h2>
      <p>
        The service is provided "as is" and "as available" without warranties of
        any kind, to the fullest extent permitted by law.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the fullest extent permitted by law, {"{{LEGAL_ENTITY}}"} will not be
        liable for indirect, incidental, or consequential damages, or for loss
        of data, arising from your use of the service.
      </p>

      <h2>Governing law</h2>
      <p>These Terms are governed by the laws of {"{{JURISDICTION}}"}.</p>

      <h2>Changes to these Terms</h2>
      <p>
        We may update these Terms; material changes will be announced in the app
        or by email, and continued use after changes means you accept them.
      </p>

      <h2>Contact</h2>
      <p>
        {"{{LEGAL_ENTITY}}"} — {"{{CONTACT_EMAIL}}"}.
      </p>
    </>
  );
}
