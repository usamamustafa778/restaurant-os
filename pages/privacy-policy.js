import Link from "next/link";
import SEO from "../components/SEO";
import LegalPageShell from "../components/LegalPageShell";

export default function PrivacyPolicy() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Privacy Policy - EatsDesk",
    description: "Privacy Policy for the EatsDesk restaurant management platform",
    url: "https://eatsdesk.com/privacy-policy",
  };

  return (
    <>
      <SEO
        title="Privacy Policy - EatsDesk"
        description="Learn how EatsDesk collects, uses, and protects your data. We are committed to maintaining the privacy and security of your restaurant's information."
        structuredData={structuredData}
      />
      <LegalPageShell title="Privacy Policy" lastUpdated="March 28, 2026">
        <div className="legal-lead">
          <p>
            At Eats Desk, we take your privacy seriously. This Privacy Policy
            explains how we collect, use, disclose, and safeguard your information
            when you use our restaurant management platform. Please read this
            privacy policy carefully.
          </p>
        </div>

        <div className="legal-section">
          <h2>1. Information We Collect</h2>
          <h3>Personal Information</h3>
          <p>
            When you register for an Eats Desk account, we collect information
            such as:
          </p>
          <ul>
            <li>Restaurant name and business details</li>
            <li>Contact information (name, email address, phone number)</li>
            <li>Business address and location</li>
            <li>Payment information for subscription billing</li>
            <li>User account credentials</li>
          </ul>
          <h3>Restaurant Data</h3>
          <p>When you use our platform, we collect and store:</p>
          <ul>
            <li>Menu items, categories, and pricing information</li>
            <li>Inventory and ingredient data</li>
            <li>Order and transaction records</li>
            <li>
              Customer information (names, phone numbers, delivery addresses)
            </li>
            <li>Staff accounts and role assignments</li>
            <li>Sales reports and analytics data</li>
          </ul>
        </div>

        <div className="legal-section">
          <h2>2. How We Use Your Information</h2>
          <p>We use the information we collect to:</p>
          <ul>
            <li>
              Provide, operate, and maintain our restaurant management services
            </li>
            <li>Process transactions and manage your subscription</li>
            <li>Generate your restaurant website and enable online ordering</li>
            <li>
              Send you operational updates, technical notices, and support
              messages
            </li>
            <li>Respond to your inquiries and provide customer support</li>
            <li>
              Improve and optimize our platform&apos;s functionality and user
              experience
            </li>
            <li>Monitor usage patterns and detect potential security issues</li>
            <li>
              Send marketing communications (with your consent, which you can
              withdraw at any time)
            </li>
          </ul>
        </div>

        <div className="legal-section">
          <h2>3. Data Security</h2>
          <p>
            We implement <strong>industry-standard measures</strong> to protect
            your data:
          </p>
          <ul>
            <li>
              All data is encrypted in transit using SSL/TLS protocols
            </li>
            <li>Passwords are hashed using secure algorithms</li>
            <li>
              Multi-tenant architecture ensures complete data isolation between
              restaurants
            </li>
            <li>Access controls and role-based permissions</li>
            <li>Automated backups to prevent data loss</li>
            <li>
              Software and infrastructure updates as part of our normal
              operations
            </li>
          </ul>
          <p style={{ marginTop: "12px" }}>
            However, no method of transmission over the internet or electronic
            storage is 100% secure. While we strive to use commercially
            acceptable means to protect your data, we cannot guarantee absolute
            security.
          </p>
        </div>

        <div className="legal-section">
          <h2>4. Data Sharing and Disclosure</h2>
          <p>
            <strong>
              We do not sell, trade, or rent your personal information to third
              parties.
            </strong>{" "}
            We may share your data only in the following circumstances:
          </p>
          <ul>
            <li>
              <strong>Service Providers:</strong> We may share data with trusted
              third-party service providers who assist us in operating our
              platform (e.g., payment processors, hosting providers, email
              services). These providers are contractually obligated to protect
              your data.
            </li>
            <li>
              <strong>Legal Requirements:</strong> We may disclose your information
              if required by law, court order, or government regulation.
            </li>
            <li>
              <strong>Business Transfers:</strong> In the event of a merger,
              acquisition, or sale of assets, your information may be transferred
              to the new owner.
            </li>
            <li>
              <strong>With Your Consent:</strong> We may share your information
              for any other purpose with your explicit consent.
            </li>
          </ul>
        </div>

        <div className="legal-section">
          <h2>5. Your Rights and Choices</h2>
          <p>You have the following rights regarding your personal data:</p>
          <ul>
            <li>
              <strong>Access:</strong> You can access and review your account
              information at any time through your dashboard.
            </li>
            <li>
              <strong>Correction:</strong> You can update or correct your
              information directly in your account settings.
            </li>
            <li>
              <strong>Deletion:</strong> You can request deletion of your account
              and associated data by contacting our support team.
            </li>
            <li>
              <strong>Data Portability:</strong> You can export your restaurant
              data in standard formats.
            </li>
            <li>
              <strong>Marketing Opt-Out:</strong> You can unsubscribe from
              marketing communications at any time using the unsubscribe link in
              our emails.
            </li>
          </ul>
        </div>

        <div className="legal-section">
          <h2>6. Data Retention</h2>
          <p>
            We retain your information for as long as your account is active or as
            needed to provide you services. If you close your account, we will
            delete your data within 90 days, except where we are required to
            retain it for legal, regulatory, or security purposes.
          </p>
          <p style={{ marginTop: "12px" }}>
            Transactional records may be retained for longer periods as required by
            applicable tax and accounting regulations.
          </p>
        </div>

        <div className="legal-section">
          <h2>7. Cookies and Tracking</h2>
          <p>
            We use cookies and similar technologies that are necessary to run the
            platform. As of the date of this policy, these include:
          </p>
          <ul>
            <li>
              <strong>Essential cookies:</strong> Required for the platform to
              function (for example, session management and authentication).
            </li>
            <li>
              <strong>Preference cookies:</strong> Remember your settings and
              preferences where we offer them.
            </li>
          </ul>
          <p style={{ marginTop: "12px" }}>
            You can control cookie settings through your browser, but disabling
            certain cookies may affect platform functionality.
          </p>
        </div>

        <div className="legal-section">
          <h2>8. Third-Party Links</h2>
          <p>
            Our platform may contain links to third-party websites or services
            (e.g., payment gateways, delivery platforms). We are not responsible for
            the privacy practices of these third parties. We encourage you to
            review their privacy policies before providing any personal
            information.
          </p>
        </div>

        <div className="legal-section">
          <h2>9. Children&apos;s Privacy</h2>
          <p>
            Eats Desk is intended for business use and is not designed for
            individuals under the age of 18. We do not knowingly collect
            personal information from children. If you believe we have collected
            information from a child, please contact us immediately.
          </p>
        </div>

        <div className="legal-section">
          <h2>10. Changes to This Privacy Policy</h2>
          <p>
            We may update this Privacy Policy from time to time to reflect changes
            in our practices or legal requirements. We will notify you of
            significant changes by email or through a prominent notice on our
            platform. Your continued use of Eats Desk after changes are made
            constitutes acceptance of the updated policy.
          </p>
          <p style={{ marginTop: "16px" }}>
            For users in the <strong>European Economic Area</strong> or{" "}
            <strong>United Kingdom</strong>, you may have additional rights under{" "}
            <strong>GDPR</strong> or <strong>UK GDPR</strong>. Please contact us to
            exercise these rights.
          </p>
        </div>

        <div className="legal-section">
          <h2>11. Contact Us</h2>
          <p>
            If you have any questions, concerns, or requests regarding this Privacy
            Policy or our data practices, contact us:
          </p>
          <div className="legal-card">
            <strong>EatsDesk — Privacy</strong>
            <p>
              Email:{" "}
              <a href="mailto:support@eatsdesk.com">support@eatsdesk.com</a>{" "}
              (include &quot;Privacy&quot; in the subject line for data requests)
            </p>
            <p>
              WhatsApp:{" "}
              <a href="https://wa.me/923166222269">+92 316 6222269</a>
            </p>
            <p>Registered office: Islamabad, Pakistan</p>
          </div>
        </div>
      </LegalPageShell>
    </>
  );
}
