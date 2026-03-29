import Link from "next/link";
import SEO from "../components/SEO";
import LegalPageShell from "../components/LegalPageShell";

export default function TermsAndConditions() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Terms and Conditions - EatsDesk",
    description:
      "Terms and Conditions for using the EatsDesk restaurant management platform",
    url: "https://eatsdesk.com/terms-and-conditions",
  };

  return (
    <>
      <SEO
        title="Terms and Conditions - EatsDesk"
        description="Read the Terms and Conditions for using EatsDesk. Understand your rights and responsibilities when using our restaurant OS."
        structuredData={structuredData}
      />
      <LegalPageShell title="Terms and Conditions" lastUpdated="March 28, 2026">
        <div className="legal-lead">
          <p>
            Welcome to EatsDesk. These Terms and Conditions (&quot;Terms&quot;)
            govern your access to and use of the EatsDesk platform, including our
            website, applications, and related services (collectively, the
            &quot;Service&quot;). By creating an account or using our Service, you
            agree to be bound by these Terms. If you do not agree, please do not
            use our Service.
          </p>
          <p style={{ marginTop: "16px", marginBottom: 0 }}>
            We process personal and business data as described in our{" "}
            <Link href="/privacy-policy">Privacy Policy</Link>. Read it before you
            use the Service or submit customer or restaurant data.
                </p>
              </div>

        <div className="legal-section">
          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing or using EatsDesk, you acknowledge that you have read,
            understood, and agree to be bound by these Terms, as well as our{" "}
            <Link href="/privacy-policy">Privacy Policy</Link>. These Terms
            constitute a legally binding agreement between you (the
            &quot;User,&quot; &quot;you,&quot; or &quot;your&quot;) and EatsDesk
            (the &quot;Company,&quot; &quot;we,&quot; &quot;us,&quot; or
            &quot;our&quot;).
          </p>
          <p style={{ marginTop: "12px" }}>
            If you are using the Service on behalf of a business or organization,
            you represent and warrant that you have the authority to bind that
            entity to these Terms.
          </p>
              </div>

        <div className="legal-section">
          <h2>2. Service Description</h2>
          <p>
            EatsDesk provides a cloud-based restaurant operating system. Depending
            on your subscription plan, the Service may include all or a subset of
            the following (as described on our website at the time you subscribe):
          </p>
          <ul>
            <li>Point of Sale (POS) for taking and managing orders</li>
            <li>Kitchen Display System (KDS) for kitchen workflows</li>
            <li>Riders or delivery staff app for delivery operations</li>
            <li>Inventory management</li>
            <li>Restaurant website and online ordering (where included in your plan)</li>
            <li>Staff management, roles, and permissions</li>
            <li>Analytics, dashboards, and reporting</li>
            <li>Customer database and order history tied to your business</li>
            <li>Deals, discounts, and related checkout features</li>
                  </ul>
          <p style={{ marginTop: "12px" }}>
            Features vary by plan. What is included in your subscription is the
            combination shown on your plan at signup or renewal. If a feature is
            not included in your plan, it is not part of the Service for your
            account unless we agree otherwise in writing.
          </p>
              </div>

        <div className="legal-section">
          <h2>3. User Account and Eligibility</h2>
          <h3>3.1 Account Creation</h3>
          <p>
            To use our Service, you must create an account by providing accurate,
            current, and complete information. You are responsible for maintaining
            the confidentiality of your account credentials and for all activities
            that occur under your account.
          </p>
          <h3>3.2 Eligibility</h3>
          <p>
            You must be at least 18 years old and legally capable of entering into
            binding contracts to use our Service. By using EatsDesk, you
            represent that you meet these requirements.
          </p>
          <h3>3.3 Account Security</h3>
          <p>
            You agree to immediately notify us of any unauthorized use of your
            account or any other breach of security. We are not liable for any loss
            or damage arising from your failure to protect your account
            credentials.
          </p>
              </div>

        <div className="legal-section">
          <h2>4. Subscription, Billing, and Payment</h2>
          <h3>4.1 Free trial</h3>
          <p>
            New subscribers may be eligible for a <strong>30-day free trial</strong>{" "}
            as offered on our website. During the trial, <strong>no subscription fees</strong>{" "}
            are charged and <strong>no credit card is required</strong> unless we
            explicitly state otherwise for a specific promotion.
          </p>
          <p style={{ marginTop: "12px" }}>
            The trial <strong>does not automatically convert</strong> into a paid
            subscription without your action. To continue after the trial, you must
            select a paid plan and complete payment (or confirm billing with us)
            as we direct in the product or by email. If you do not subscribe by
            the end of the trial, we may suspend or limit access to the Service
            until a valid subscription is in place.
          </p>
          <h3>4.2 Plans and how prices are shown</h3>
          <p>
            We offer multiple subscription plans. Prices may be displayed as a{" "}
            <strong>per-day rate</strong> for clarity (for example, to compare
            tiers). <strong>Fees are billed in advance</strong> on a{" "}
            <strong>monthly</strong> or <strong>yearly</strong> basis according to
            the billing interval you choose. Your invoice amount is the monthly or
            yearly total for that period (calculated from the published daily rate ×
            the number of days in the billing period, or as otherwise shown at
            checkout or in your agreement). All amounts and currency are as shown
            on our website or in your order confirmation at the time of purchase.
          </p>
          <h3>4.3 Billing and payment methods</h3>
          <ul>
            <li>
              Subscription fees are charged <strong>upfront</strong> for each
              billing period (monthly or yearly).
            </li>
            <li>
              We currently accept payment by <strong>bank transfer</strong>,{" "}
              <strong>Easypaisa</strong>, and <strong>JazzCash</strong>, and any
              other methods we list in the product or on your invoice.
            </li>
            <li>
              You authorize us to issue invoices and, where applicable, to
              continue billing each renewal period until you cancel in accordance
              with these Terms.
            </li>
            <li>
              Fees are exclusive of applicable taxes unless stated otherwise; you
              are responsible for any taxes imposed on your use of the Service.
            </li>
                  </ul>
          <h3>4.4 Late or failed payment</h3>
          <p>
            If payment is not received by the due date on your invoice, we may
            send reminders. We may <strong>suspend or restrict access</strong> to
            the Service if payment remains outstanding, typically after at least{" "}
            <strong>7 days</strong> from the due date and after notice to your
            account email, unless a shorter period is required for fraud or abuse.
            Access may be restored promptly after we receive full payment of
            amounts due.
          </p>
          <h3>4.5 Price changes</h3>
          <p>
            We may change our prices. We will give you at least{" "}
            <strong>30 days&apos; notice</strong> before new prices apply to your
            subscription, communicated by email or in-product notice. Changes
            take effect at the start of your next billing period after the notice
            period unless applicable law requires otherwise.
          </p>
          <h3>4.6 Refund policy</h3>
          <p>
            <strong>During the free trial:</strong> no fees are charged; there is
            nothing to refund for that period.
          </p>
          <p style={{ marginTop: "12px" }}>
            <strong>After you become a paying customer:</strong> subscription fees
            are <strong>non-refundable</strong> except where required by applicable
            law. If you cancel, you retain access until the end of the{" "}
            <strong>current paid billing period</strong>; we do not refund
            partial periods or unused time. This policy applies to monthly and
            yearly plans (including any yearly plan described as offering
            &quot;months free&quot; as a discount, which is not a cash refund).
          </p>
          <h3>4.7 Cancellation</h3>
          <p>
            You may cancel your subscription in accordance with the cancellation
            flow in your account or by contacting support. Cancellation takes
            effect at the end of the <strong>current billing period</strong> unless
            we agree otherwise. You remain responsible for all fees accrued before
            cancellation.
          </p>
              </div>

        <div className="legal-section">
          <h2>5. User Responsibilities</h2>
          <p>As a user of EatsDesk, you agree to:</p>
          <ul>
            <li>
              Provide accurate, current, and complete information about your
              restaurant and menu items
            </li>
            <li>
              Use the Service only for lawful purposes and in compliance with all
              applicable laws and regulations
            </li>
            <li>
              Not use the Service to engage in fraudulent, abusive, or harmful
              activities
            </li>
            <li>
              Not attempt to gain unauthorized access to any part of the Service
              or other users&apos; accounts
            </li>
            <li>
              Not distribute malware, viruses, or any harmful code through the
              Service
            </li>
            <li>
              Not reverse engineer, decompile, or disassemble any part of the Service
              except to the extent permitted by law
            </li>
            <li>
              Not scrape, copy, or extract data from the Service using automated
              means without our written consent
            </li>
            <li>
              Comply with food safety, business licensing, and tax regulations
              applicable to your restaurant
            </li>
                  </ul>
              </div>

        <div className="legal-section">
          <h2>6. Data Ownership, Use, and Security</h2>
          <h3>6.1 Your data</h3>
          <p>
            You retain all ownership rights to the data you input into the Service,
            including menu information, customer data, inventory records, sales and
            revenue data, rider or staff-related operational data, and transaction
            history (&quot;Your Data&quot;). By using the Service, you grant us a
            limited, non-exclusive license to use, store, and process Your Data
            solely to provide, secure, and improve the Service and as described in
            our <Link href="/privacy-policy">Privacy Policy</Link>.
          </p>
          <h3>6.2 We do not sell your data</h3>
          <p>
            We <strong>do not sell</strong> Your Data or your customers&apos;
            personal information to third parties for their marketing purposes.
          </p>
          <h3>6.3 Multi-tenant isolation</h3>
          <p>
            EatsDesk operates as a multi-tenant platform. Your Data is logically
            isolated and is not made available to other customers for their use. We
            implement technical and organizational measures intended to maintain
            this separation.
          </p>
          <h3>6.4 Export when you leave</h3>
          <p>
            You may request a <strong>reasonable export</strong> of Your Data in a
            common electronic format where technically practicable. We will
            cooperate with such requests for an active account, or within{" "}
            <strong>30 days</strong> after termination or expiry of your subscription,
            subject to identity verification and legal retention obligations.
          </p>
          <h3>6.5 Security</h3>
          <p>
            We implement administrative, technical, and organizational safeguards
            designed to protect Your Data against unauthorized access, loss, or
            misuse. No method of transmission or storage is 100% secure; you use
            the Service understanding that residual risk remains.
          </p>
          <h3>6.6 Backups</h3>
          <p>
            We perform automated backups as part of operating the Service. You
            should also maintain your own backups of business-critical information.
            We are not liable for data loss except in cases of our gross negligence
            or willful misconduct, subject to applicable law.
          </p>
              </div>

        <div className="legal-section">
          <h2>7. Intellectual Property</h2>
          <h3>7.1 Our property</h3>
          <p>
            The Service, including its software, design, features, trademarks,
            logos, and content (excluding Your Data), is owned by EatsDesk and is
            protected by copyright, trademark, and other intellectual property
            laws. You may not copy, modify, distribute, sell, or lease any part of
            the Service without our express written permission.
          </p>
          <h3>7.2 Feedback</h3>
          <p>
            If you provide feedback, suggestions, or ideas about the Service, you
            grant us a perpetual, irrevocable, worldwide, royalty-free license to
            use, modify, and incorporate such feedback without obligation to you.
          </p>
              </div>

        <div className="legal-section">
          <h2>8. Service Availability and Modifications</h2>
          <h3>8.1 Uptime</h3>
          <p>
            We strive for high availability but do not guarantee uninterrupted
            access. Downtime may occur due to maintenance, updates, technical
            issues, or events beyond our reasonable control.
          </p>
          <h3>8.2 Modifications</h3>
          <p>
            We may modify, suspend, or discontinue any part of the Service. Where
            material, we will use reasonable efforts to notify you. We are not
            liable for any modification, suspension, or discontinuation except as
            required by law.
          </p>
          <h3>8.3 Maintenance</h3>
          <p>
            Scheduled maintenance may make the Service temporarily unavailable. We
            will try to give advance notice when practicable.
          </p>
              </div>

        <div className="legal-section">
          <h2>9. Third-Party Integrations</h2>
          <p>
            The Service may integrate with third-party services (e.g., payment
            providers, delivery platforms). Your use of those services is subject to
            their terms. We are not responsible for third-party performance,
            availability, or practices.
          </p>
          <p style={{ marginTop: "12px" }}>
            Disputes between you and a third party are solely between you and that
            provider.
          </p>
              </div>

        <div className="legal-section">
          <h2>10. Disclaimer of Warranties</h2>
          <p>
            THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot;
            WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING
            BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
            PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
          </p>
          <p style={{ marginTop: "12px" }}>
            We do not warrant that the Service will be error-free, secure, or
            uninterrupted. You use the Service at your own risk.
          </p>
              </div>

        <div className="legal-section">
          <h2>11. Limitation of Liability</h2>
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, EATSDESK SHALL NOT BE LIABLE FOR
            ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR
            ANY LOSS OF PROFITS, REVENUE, DATA, OR USE, ARISING OUT OF OR RELATED TO
            YOUR USE OF THE SERVICE, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY
            OF SUCH DAMAGES.
          </p>
          <p style={{ marginTop: "12px" }}>
            OUR TOTAL LIABILITY FOR ALL CLAIMS ARISING OUT OF OR RELATED TO THESE
            TERMS OR THE SERVICE SHALL NOT EXCEED THE AMOUNT YOU PAID US IN FEES FOR
            THE SERVICE IN THE TWELVE (12) MONTHS PRECEDING THE EVENT GIVING RISE TO
            THE CLAIM.
          </p>
              </div>

        <div className="legal-section">
          <h2>12. Indemnification</h2>
          <p>
            You agree to indemnify, defend, and hold harmless EatsDesk, its
            affiliates, officers, directors, employees, and agents from and against
            any claims, liabilities, damages, losses, costs, or expenses (including
            reasonable attorneys&apos; fees) arising out of or related to: your use
            of the Service; your breach of these Terms; your violation of
            third-party rights; Your Data or content you submit; and your
            restaurant&apos;s operations (including food safety, licensing, or
            employment matters).
          </p>
              </div>

        <div className="legal-section">
          <h2>13. Termination</h2>
          <h3>13.1 By you</h3>
          <p>
            You may terminate your account by canceling your subscription and/or
            contacting support, subject to Section 4.
          </p>
          <h3>13.2 By us</h3>
          <p>We may suspend or terminate access if, for example:</p>
          <ul>
            <li>You materially violate these Terms</li>
            <li>Your account is inactive for an extended period and we give notice</li>
            <li>You fail to pay amounts due</li>
            <li>We reasonably believe continued access poses a security or legal risk</li>
                  </ul>
          <h3>13.3 Effect of termination</h3>
          <p>
            Upon termination, access to the Service may cease. We may delete or
            archive Your Data after a reasonable period (for example,{" "}
            <strong>90 days</strong>) except where we must retain it by law. You may
            request export of Your Data as set out in Section 6.4 before or shortly
            after termination. You remain responsible for fees accrued through the
            termination date.
          </p>
              </div>

        <div className="legal-section">
          <h2>14. Governing Law and Dispute Resolution</h2>
          <p>
            These Terms shall be governed by and construed in accordance with the{" "}
            <strong>laws of Pakistan</strong>, without regard to its conflict-of-law
            rules that would require another jurisdiction&apos;s laws to apply.
          </p>
          <p style={{ marginTop: "12px" }}>
            Any dispute arising out of or relating to these Terms or the Service
            shall first be addressed through <strong>good-faith negotiation</strong>.
            If not resolved within a reasonable period, the parties submit to the{" "}
            <strong>exclusive jurisdiction of the courts of Islamabad, Pakistan</strong>
            , subject to any non-waivable rights you may have under applicable
            consumer law.
          </p>
              </div>

        <div className="legal-section">
          <h2>15. Changes to Terms</h2>
          <p>
            We may update these Terms. We will update the &quot;Last updated&quot;
            date on this page and, where changes are material, notify you by email
            or in-product notice.
          </p>
          <p style={{ marginTop: "12px" }}>
            Continued use after the effective date constitutes acceptance. If you
            disagree, you must stop using the Service and cancel your account.
          </p>
              </div>

        <div className="legal-section">
          <h2>16. General Provisions</h2>
          <h3>16.1 Entire agreement</h3>
          <p>
            These Terms, together with our <Link href="/privacy-policy">Privacy Policy</Link>, constitute the entire agreement regarding the Service and supersede prior
            agreements on the same subject.
          </p>
          <h3>16.2 Severability</h3>
          <p>
            If any provision is held invalid, the remaining provisions remain in
            effect.
          </p>
          <h3>16.3 Waiver</h3>
          <p>
            Failure to enforce a provision is not a waiver of our right to enforce it
            later.
          </p>
          <h3>16.4 Assignment</h3>
          <p>
            You may not assign these Terms without our consent. We may assign them
            in connection with a merger, acquisition, or sale of assets.
          </p>
              </div>

        <div className="legal-section">
          <h2>17. Contact Information</h2>
          <p>
            For questions about these Terms, billing, or the Service:
          </p>
          <div className="legal-card">
            <strong>EatsDesk</strong>
            <p>Email: support@eatsdesk.com</p>
            <p>
              WhatsApp:{" "}
              <a href="https://wa.me/923166222269">+92 316 6222269</a>
            </p>
            <p>Registered office: Islamabad, Pakistan</p>
          </div>
              </div>

        <div className="legal-ack">
          <p>
            By using EatsDesk, you acknowledge that you have read, understood, and
            agree to be bound by these Terms and Conditions.
          </p>
          <p>Thank you for choosing EatsDesk.</p>
              </div>
      </LegalPageShell>
    </>
  );
}
