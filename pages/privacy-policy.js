import Link from "next/link";
import { ArrowLeft, Shield, Lock, Eye, Database, Bell, Globe2 } from "lucide-react";
import SEO from "../components/SEO";

export default function PrivacyPolicy() {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Privacy Policy - Eats Desk',
    description: 'Privacy Policy for Eats Desk restaurant management platform',
    url: 'https://eatsdesk.com/privacy-policy',
  };

  return (
    <>
      <SEO
        title="Privacy Policy - Eats Desk"
        description="Learn how Eats Desk collects, uses, and protects your data. We are committed to maintaining the privacy and security of your restaurant's information."
        structuredData={structuredData}
      />
      <div className="min-h-screen bg-white text-gray-900">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <Link href="/" className="flex items-center gap-2.5">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white font-bold text-sm">
                  ED
                </span>
                <div>
                  <div className="text-sm font-bold tracking-tight text-gray-900">Eats Desk</div>
                  <div className="text-[10px] text-gray-500 -mt-0.5">Restaurant & Cafe Operations Desk</div>
                </div>
              </Link>

              <div className="flex items-center gap-3">
                <Link href="/login" className="hidden md:inline-flex text-sm font-medium text-gray-700 hover:text-primary transition-colors">
                  Sign in
                </Link>
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-all shadow-lg shadow-primary/25"
                >
                  Start Free Trial
                </Link>
              </div>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <section className="relative overflow-hidden bg-gradient-to-b from-gray-50 to-white py-16 border-b border-gray-100">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <Link href="/" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-primary transition-colors mb-6">
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Link>
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/5 text-primary mb-6">
              <Shield className="w-8 h-8" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              Privacy Policy
            </h1>
            <p className="text-lg text-gray-600">
              Last updated: February 13, 2026
            </p>
          </div>
        </section>

        {/* Content */}
        <section className="py-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="prose prose-gray max-w-none">
              {/* Introduction */}
              <div className="mb-12">
                <p className="text-lg text-gray-700 leading-relaxed">
                  At Eats Desk, we take your privacy seriously. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our restaurant management platform. Please read this privacy policy carefully.
                </p>
              </div>

              {/* Section 1 */}
              <div className="mb-10 pb-10 border-b border-gray-200">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/5 flex items-center justify-center text-primary shrink-0 mt-1">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-3">1. Information We Collect</h2>
                  </div>
                </div>
                <div className="ml-14">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Personal Information</h3>
                  <p className="text-gray-700 mb-4">
                    When you register for an Eats Desk account, we collect information such as:
                  </p>
                  <ul className="space-y-2 text-gray-700 mb-6">
                    <li>• Restaurant name and business details</li>
                    <li>• Contact information (name, email address, phone number)</li>
                    <li>• Business address and location</li>
                    <li>• Payment information for subscription billing</li>
                    <li>• User account credentials</li>
                  </ul>

                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Restaurant Data</h3>
                  <p className="text-gray-700 mb-4">
                    When you use our platform, we collect and store:
                  </p>
                  <ul className="space-y-2 text-gray-700">
                    <li>• Menu items, categories, and pricing information</li>
                    <li>• Inventory and ingredient data</li>
                    <li>• Order and transaction records</li>
                    <li>• Customer information (names, phone numbers, delivery addresses)</li>
                    <li>• Staff accounts and role assignments</li>
                    <li>• Sales reports and analytics data</li>
                  </ul>
                </div>
              </div>

              {/* Section 2 */}
              <div className="mb-10 pb-10 border-b border-gray-200">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/5 flex items-center justify-center text-primary shrink-0 mt-1">
                    <Eye className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-3">2. How We Use Your Information</h2>
                  </div>
                </div>
                <div className="ml-14">
                  <p className="text-gray-700 mb-4">
                    We use the information we collect to:
                  </p>
                  <ul className="space-y-2 text-gray-700">
                    <li>• Provide, operate, and maintain our restaurant management services</li>
                    <li>• Process transactions and manage your subscription</li>
                    <li>• Generate your restaurant website and enable online ordering</li>
                    <li>• Send you operational updates, technical notices, and support messages</li>
                    <li>• Respond to your inquiries and provide customer support</li>
                    <li>• Improve and optimize our platform's functionality and user experience</li>
                    <li>• Monitor usage patterns and detect potential security issues</li>
                    <li>• Send marketing communications (with your consent, which you can withdraw at any time)</li>
                  </ul>
                </div>
              </div>

              {/* Section 3 */}
              <div className="mb-10 pb-10 border-b border-gray-200">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/5 flex items-center justify-center text-primary shrink-0 mt-1">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-3">3. Data Security</h2>
                  </div>
                </div>
                <div className="ml-14">
                  <p className="text-gray-700 mb-4">
                    We implement industry-standard security measures to protect your data:
                  </p>
                  <ul className="space-y-2 text-gray-700 mb-4">
                    <li>• All data is encrypted in transit using SSL/TLS protocols</li>
                    <li>• Passwords are hashed using secure algorithms</li>
                    <li>• Multi-tenant architecture ensures complete data isolation between restaurants</li>
                    <li>• Regular security audits and updates</li>
                    <li>• Access controls and role-based permissions</li>
                    <li>• Automated backups to prevent data loss</li>
                  </ul>
                  <p className="text-gray-700">
                    However, no method of transmission over the internet or electronic storage is 100% secure. While we strive to use commercially acceptable means to protect your data, we cannot guarantee absolute security.
                  </p>
                </div>
              </div>

              {/* Section 4 */}
              <div className="mb-10 pb-10 border-b border-gray-200">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/5 flex items-center justify-center text-primary shrink-0 mt-1">
                    <Globe2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-3">4. Data Sharing and Disclosure</h2>
                  </div>
                </div>
                <div className="ml-14">
                  <p className="text-gray-700 mb-4">
                    We do not sell, trade, or rent your personal information to third parties. We may share your data only in the following circumstances:
                  </p>
                  <ul className="space-y-2 text-gray-700">
                    <li>• <strong>Service Providers:</strong> We may share data with trusted third-party service providers who assist us in operating our platform (e.g., payment processors, hosting providers, email services). These providers are contractually obligated to protect your data.</li>
                    <li>• <strong>Legal Requirements:</strong> We may disclose your information if required by law, court order, or government regulation.</li>
                    <li>• <strong>Business Transfers:</strong> In the event of a merger, acquisition, or sale of assets, your information may be transferred to the new owner.</li>
                    <li>• <strong>With Your Consent:</strong> We may share your information for any other purpose with your explicit consent.</li>
                  </ul>
                </div>
              </div>

              {/* Section 5 */}
              <div className="mb-10 pb-10 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900 mb-3">5. Your Rights and Choices</h2>
                <div className="ml-0">
                  <p className="text-gray-700 mb-4">
                    You have the following rights regarding your personal data:
                  </p>
                  <ul className="space-y-2 text-gray-700">
                    <li>• <strong>Access:</strong> You can access and review your account information at any time through your dashboard.</li>
                    <li>• <strong>Correction:</strong> You can update or correct your information directly in your account settings.</li>
                    <li>• <strong>Deletion:</strong> You can request deletion of your account and associated data by contacting our support team.</li>
                    <li>• <strong>Data Portability:</strong> You can export your restaurant data in standard formats.</li>
                    <li>• <strong>Marketing Opt-Out:</strong> You can unsubscribe from marketing communications at any time using the unsubscribe link in our emails.</li>
                  </ul>
                </div>
              </div>

              {/* Section 6 */}
              <div className="mb-10 pb-10 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900 mb-3">6. Data Retention</h2>
                <div className="ml-0">
                  <p className="text-gray-700 mb-4">
                    We retain your information for as long as your account is active or as needed to provide you services. If you close your account, we will delete your data within 90 days, except where we are required to retain it for legal, regulatory, or security purposes.
                  </p>
                  <p className="text-gray-700">
                    Transactional records may be retained for longer periods as required by tax and accounting regulations in Pakistan.
                  </p>
                </div>
              </div>

              {/* Section 7 */}
              <div className="mb-10 pb-10 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900 mb-3">7. Cookies and Tracking</h2>
                <div className="ml-0">
                  <p className="text-gray-700 mb-4">
                    We use cookies and similar tracking technologies to enhance your experience:
                  </p>
                  <ul className="space-y-2 text-gray-700 mb-4">
                    <li>• <strong>Essential Cookies:</strong> Required for the platform to function properly (e.g., session management, authentication).</li>
                    <li>• <strong>Analytics Cookies:</strong> Help us understand how users interact with our platform to improve functionality.</li>
                    <li>• <strong>Preference Cookies:</strong> Remember your settings and preferences.</li>
                  </ul>
                  <p className="text-gray-700">
                    You can control cookie settings through your browser, but disabling certain cookies may affect platform functionality.
                  </p>
                </div>
              </div>

              {/* Section 8 */}
              <div className="mb-10 pb-10 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900 mb-3">8. Third-Party Links</h2>
                <div className="ml-0">
                  <p className="text-gray-700">
                    Our platform may contain links to third-party websites or services (e.g., payment gateways, delivery platforms). We are not responsible for the privacy practices of these third parties. We encourage you to review their privacy policies before providing any personal information.
                  </p>
                </div>
              </div>

              {/* Section 9 */}
              <div className="mb-10 pb-10 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900 mb-3">9. Children's Privacy</h2>
                <div className="ml-0">
                  <p className="text-gray-700">
                    Eats Desk is intended for business use and is not designed for individuals under the age of 18. We do not knowingly collect personal information from children. If you believe we have collected information from a child, please contact us immediately.
                  </p>
                </div>
              </div>

              {/* Section 10 */}
              <div className="mb-10 pb-10 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900 mb-3">10. Changes to This Privacy Policy</h2>
                <div className="ml-0">
                  <p className="text-gray-700">
                    We may update this Privacy Policy from time to time to reflect changes in our practices or legal requirements. We will notify you of significant changes by email or through a prominent notice on our platform. Your continued use of Eats Desk after changes are made constitutes acceptance of the updated policy.
                  </p>
                </div>
              </div>

              {/* Contact Section */}
              <div className="mb-10">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/5 flex items-center justify-center text-primary shrink-0 mt-1">
                    <Bell className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-3">11. Contact Us</h2>
                  </div>
                </div>
                <div className="ml-14">
                  <p className="text-gray-700 mb-4">
                    If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us:
                  </p>
                  <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                    <p className="text-gray-900 font-semibold mb-2">Eats Desk Privacy Team</p>
                    <p className="text-gray-700 text-sm mb-1">Email: support@eatsdesk.com</p>
                    <p className="text-gray-700 text-sm mb-1">Phone / WhatsApp: +92 316 622 269</p>
                    <p className="text-gray-700 text-sm">Address: Islamabad, Pakistan</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 bg-gray-50 border-t border-gray-100">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
              Ready to get started?
            </h2>
            <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
              Join hundreds of restaurant owners who trust Eats Desk with their business operations.
            </p>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-white text-base font-semibold hover:bg-primary/90 transition-all shadow-lg shadow-primary/25"
            >
              Start Free Trial
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-gray-900 text-white py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid gap-8 md:grid-cols-4 mb-8">
              <div>
                <div className="flex items-center gap-2.5 mb-4">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white font-bold text-sm">
                    ED
                  </span>
                  <div className="text-sm font-bold">Eats Desk</div>
                </div>
                <p className="text-sm text-gray-400 leading-relaxed">
                  The all-in-one restaurant management platform for Pakistan.
                </p>
              </div>

              <div>
                <h4 className="text-sm font-bold mb-4">Product</h4>
                <ul className="space-y-2.5 text-sm text-gray-400">
                  <li><Link href="/#features" className="hover:text-white transition-colors">Features</Link></li>
                  <li><Link href="/#pricing" className="hover:text-white transition-colors">Pricing</Link></li>
                  <li><Link href="/#how-it-works" className="hover:text-white transition-colors">How it works</Link></li>
                </ul>
              </div>

              <div>
                <h4 className="text-sm font-bold mb-4">Legal</h4>
                <ul className="space-y-2.5 text-sm text-gray-400">
                  <li><Link href="/privacy-policy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
                  <li><Link href="/terms-and-conditions" className="hover:text-white transition-colors">Terms & Conditions</Link></li>
                </ul>
              </div>

              <div>
                <h4 className="text-sm font-bold mb-4">Get Started</h4>
                <ul className="space-y-2.5 text-sm text-gray-400">
                  <li><Link href="/signup" className="hover:text-white transition-colors">Start free trial</Link></li>
                  <li><Link href="/login" className="hover:text-white transition-colors">Sign in</Link></li>
                </ul>
              </div>
            </div>

            <div className="pt-8 border-t border-gray-800 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-500">
              <p>&copy; {new Date().getFullYear()} Eats Desk. All rights reserved.</p>
              <p>powered by at <Link href="https://reddev.us" target="_blank" rel="noopener noreferrer">Reddev.us</Link></p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
