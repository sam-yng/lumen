export const metadata = { title: "Privacy Policy — Lumen" };

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p>
        <em>Effective date: {"{{EFFECTIVE_DATE}}"}</em>
      </p>
      <p>
        This Privacy Policy explains how {"{{LEGAL_ENTITY}}"} ("Lumen", "we",
        "us") collects, uses, and protects your information when you use the
        Lumen study workspace. This document is provided for transparency and is
        not a substitute for legal advice.
      </p>

      <h2>Who this service is for</h2>
      <p>
        Lumen is a general-audience productivity tool and is{" "}
        <strong>not directed to children under 13</strong>. We do not knowingly
        collect personal information from children under 13. If you believe a
        child has provided us information, contact {"{{CONTACT_EMAIL}}"} and we
        will delete it.
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li>
          <strong>Account information.</strong> Your email address and an
          encrypted password, or, if you sign in with Google, the basic profile
          identifiers Google shares with us.
        </li>
        <li>
          <strong>Content you upload.</strong> Notes, documents, files, tags,
          folders, and audio recordings you add to your workspace.
        </li>
        <li>
          <strong>Derived content.</strong> Text transcripts we generate from
          your audio recordings using on-device speech-to-text processing.
        </li>
        <li>
          <strong>Technical data.</strong> Limited logs and error reports needed
          to operate and secure the service.
        </li>
      </ul>

      <h2>How we use your information</h2>
      <ul>
        <li>
          To provide the workspace and its features (storage, search,
          transcription).
        </li>
        <li>To authenticate you and keep your account secure.</li>
        <li>To diagnose errors and improve reliability.</li>
        <li>
          To communicate with you about your account (e.g. confirmation and
          password-reset emails).
        </li>
      </ul>
      <p>
        We do <strong>not</strong> sell your personal information, and we do not
        use your uploaded content or transcripts to train machine-learning
        models.
      </p>

      <h2>How your data is processed and stored</h2>
      <p>
        Your content is isolated per user and protected by database
        row-level-security policies so that only you can access your rows. We
        use the following service providers ("sub-processors") to operate Lumen:
      </p>
      <ul>
        <li>
          <strong>Supabase</strong> — database, authentication, and file
          storage.
        </li>
        <li>
          <strong>Vercel</strong> — application hosting.
        </li>
        <li>
          <strong>Railway</strong> — the background transcription worker.
        </li>
        <li>
          <strong>Sentry</strong> — error monitoring (does not receive your
          content).
        </li>
        <li>
          <strong>Google</strong> — optional sign-in.
        </li>
        <li>
          <strong>Resend</strong> — to deliver account emails (confirmation and
          password-reset links).
        </li>
      </ul>
      <p>
        Audio recordings are transcribed by a speech-to-text process we run
        ourselves; the audio is not sent to a third-party transcription service.
        Temporary copies created during transcription are deleted afterward.
      </p>

      <h2>The optional AI assistant</h2>
      <p>
        Lumen includes an optional in-app AI assistant. It is off until you
        enable it by adding your own Anthropic API key, which we store encrypted
        on your behalf. When you use the assistant, your question and relevant
        excerpts of your notes and transcripts are sent to{" "}
        <strong>Anthropic</strong> (the Claude API) to generate a response,
        under your own API key and Anthropic's terms. If you never enable the
        assistant, no content is sent to Anthropic. You can stop using it and
        remove your key at any time.
      </p>

      <h2>Data retention</h2>
      <p>
        We keep your content for as long as your account is active. When you
        delete content, or your account, we remove the associated data from our
        active systems; residual copies in backups are purged on our standard
        backup rotation.
      </p>

      <h2>Your rights</h2>
      <p>
        Depending on where you live (including under the EU/UK GDPR and the
        California CCPA), you may have the right to access, correct, export, or
        delete your personal information, and to restrict or object to certain
        processing. To exercise these rights, contact {"{{CONTACT_EMAIL}}"}. You
        may also delete content directly within the app.
      </p>

      <h2>Security</h2>
      <p>
        We use industry-standard measures including encrypted transport,
        per-user access controls, and row-level-security. No system is perfectly
        secure, but we work to protect your information and will notify affected
        users of a material breach as required by law.
      </p>

      <h2>International users</h2>
      <p>
        Your information may be processed in countries other than your own.
        Where required, we rely on appropriate safeguards for such transfers.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        We may update this policy. Material changes will be announced in the app
        or by email, and the effective date above will be updated.
      </p>

      <h2>Contact</h2>
      <p>
        {"{{LEGAL_ENTITY}}"}, {"{{COMPANY_ADDRESS}}"} — {"{{CONTACT_EMAIL}}"}.
      </p>
    </>
  );
}
