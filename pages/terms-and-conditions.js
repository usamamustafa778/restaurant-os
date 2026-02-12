import Link from "next/link";
import { ArrowLeft, FileText, CheckCircle2, AlertCircle, Scale, UserCheck, CreditCard } from "lucide-react";
import SEO from "../components/SEO";

export default function TermsAndConditions() {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Terms and Conditions - Eats Desk',
    description: 'Terms and Conditions for using Eats Desk restaurant management platform',
    url: 'https://eatsdesk.com/terms-and-conditions',
  };

  return (
    <>
      <SEO
        title="Terms and Conditions - Eats Desk"
        description="Read the Terms and Conditions for using Eats Desk restaurant management platform. Understand your rights and responsibilities when using our services."
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
              <FileText className="w-8 h-8" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              Terms and Conditions
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
                  Welcome to Eats Desk. These Terms and Conditions ("Terms") govern your access to and use of the Eats Desk platform, including our website, mobile applications, and related services (collectively, the "Service"). By creating an account or using our Service, you agree to be bound by these Terms. If you do not agree, please do not use our Service.
                </p>
              </div>

              {/* Section 1 */}
              <div className="mb-10 pb-10 border-b border-gray-200">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/5 flex items-center justify-center text-primary shrink-0 mt-1">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-3">1. Acceptance of Terms</h2>
                  </div>
                </div>
                <div className="ml-14">
                  <p className="text-gray-700 mb-4">
                    By accessing or using Eats Desk, you acknowledge that you have read, understood, and agree to be bound by these Terms, as well as our Privacy Policy. These Terms constitute a legally binding agreement between you (the "User," "you," or "your") and Eats Desk (the "Company," "we," "us," or "our").
                  </p>
                  <p className="text-gray-700">
                    If you are using the Service on behalf of a business or organization, you represent and warrant that you have the authority to bind that entity to these Terms.
                  </p>
                </div>
              </div>

              {/* Section 2 */}
              <div className="mb-10 pb-10 border-b border-gray-200">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/5 flex items-center justify-center text-primary shrink-0 mt-1">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-3">2. Service Description</h2>
                  </div>
                </div>
                <div className="ml-14">
                  <p className="text-gray-700 mb-4">
                    Eats Desk provides a cloud-based restaurant management platform that includes:
                  </p>
                  <ul className="space-y-2 text-gray-700">
                    <li>• Point of Sale (POS) system for order processing</li>
                    <li>• Inventory management and stock tracking</li>
                    <li>• Menu management and customization</li>
                    <li>• Auto-generated restaurant website with online ordering capabilities</li>
                    <li>• Sales analytics and reporting</li>
                    <li>• Multi-user access with role-based permissions</li>
                    <li>• Customer database and order history</li>
                  </ul>
                </div>
              </div>

              {/* Section 3 */}
              <div className="mb-10 pb-10 border-b border-gray-200">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/5 flex items-center justify-center text-primary shrink-0 mt-1">
                    <Scale className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-3">3. User Account and Eligibility</h2>
                  </div>
                </div>
                <div className="ml-14">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">3.1 Account Creation</h3>
                  <p className="text-gray-700 mb-4">
                    To use our Service, you must create an account by providing accurate, current, and complete information. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.
                  </p>

                  <h3 className="text-lg font-semibold text-gray-900 mb-2">3.2 Eligibility</h3>
                  <p className="text-gray-700 mb-4">
                    You must be at least 18 years old and legally capable of entering into binding contracts to use our Service. By using Eats Desk, you represent that you meet these requirements.
                  </p>

                  <h3 className="text-lg font-semibold text-gray-900 mb-2">3.3 Account Security</h3>
                  <p className="text-gray-700">
                    You agree to immediately notify us of any unauthorized use of your account or any other breach of security. We are not liable for any loss or damage arising from your failure to protect your account credentials.
                  </p>
                </div>
              </div>

              {/* Section 4 */}
              <div className="mb-10 pb-10 border-b border-gray-200">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/5 flex items-center justify-center text-primary shrink-0 mt-1">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-3">4. Subscription and Payment</h2>
                  </div>
                </div>
                <div className="ml-14">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">4.1 Free Trial</h3>
                  <p className="text-gray-700 mb-4">
                    New users are eligible for a 14-day free trial with full access to all features. No credit card is required to start the trial. After the trial period, you must subscribe to a paid plan to continue using the Service.
                  </p>

                  <h3 className="text-lg font-semibold text-gray-900 mb-2">4.2 Subscription Plans</h3>
                  <p className="text-gray-700 mb-4">
                    We offer multiple subscription plans with different features and pricing tiers. Current plans and pricing are available on our website. All prices are in USD unless otherwise stated.
                  </p>

                  <h3 className="text-lg font-semibold text-gray-900 mb-2">4.3 Billing</h3>
                  <ul className="space-y-2 text-gray-700 mb-4">
                    <li>• Subscription fees are billed in advance on a monthly or quarterly basis, depending on your selected plan.</li>
                    <li>• Payment must be made via credit card, debit card, or other approved payment methods.</li>
                    <li>• All fees are non-refundable except as required by law or as explicitly stated in these Terms.</li>
                    <li>• You authorize us to charge your payment method automatically for recurring subscription fees.</li>
                  </ul>

                  <h3 className="text-lg font-semibold text-gray-900 mb-2">4.4 Price Changes</h3>
                  <p className="text-gray-700 mb-4">
                    We reserve the right to change our pricing at any time. Price changes will be communicated to you at least 30 days in advance and will take effect at the start of your next billing cycle.
                  </p>

                  <h3 className="text-lg font-semibold text-gray-900 mb-2">4.5 Cancellation</h3>
                  <p className="text-gray-700">
                    You may cancel your subscription at any time through your account settings. Cancellation will take effect at the end of your current billing period. You will retain access to the Service until that date, but no refunds will be issued for partial months.
                  </p>
                </div>
              </div>

              {/* Section 5 */}
              <div className="mb-10 pb-10 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900 mb-3">5. User Responsibilities</h2>
                <div className="ml-0">
                  <p className="text-gray-700 mb-4">
                    As a user of Eats Desk, you agree to:
                  </p>
                  <ul className="space-y-2 text-gray-700">
                    <li>• Provide accurate, current, and complete information about your restaurant and menu items</li>
                    <li>• Use the Service only for lawful purposes and in compliance with all applicable laws and regulations</li>
                    <li>• Not use the Service to engage in fraudulent, abusive, or harmful activities</li>
                    <li>• Not attempt to gain unauthorized access to any part of the Service or other users' accounts</li>
                    <li>• Not distribute malware, viruses, or any harmful code through the Service</li>
                    <li>• Not reverse engineer, decompile, or disassemble any part of the Service</li>
                    <li>• Not scrape, copy, or extract data from the Service using automated means</li>
                    <li>• Comply with all food safety, business licensing, and tax regulations applicable to your restaurant</li>
                  </ul>
                </div>
              </div>

              {/* Section 6 */}
              <div className="mb-10 pb-10 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900 mb-3">6. Data Ownership and License</h2>
                <div className="ml-0">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">6.1 Your Data</h3>
                  <p className="text-gray-700 mb-4">
                    You retain all ownership rights to the data you input into the Service, including menu information, customer data, inventory records, and transaction history ("Your Data"). By using the Service, you grant us a limited, non-exclusive license to use, store, and process Your Data solely for the purpose of providing and improving the Service.
                  </p>

                  <h3 className="text-lg font-semibold text-gray-900 mb-2">6.2 Data Isolation</h3>
                  <p className="text-gray-700 mb-4">
                    Eats Desk operates as a multi-tenant platform. Your Data is logically isolated and not shared with or accessible to other users. We implement security measures to maintain this separation.
                  </p>

                  <h3 className="text-lg font-semibold text-gray-900 mb-2">6.3 Data Backup</h3>
                  <p className="text-gray-700">
                    We perform regular automated backups of Your Data. However, you are responsible for maintaining your own backups and we are not liable for data loss except in cases of our gross negligence or willful misconduct.
                  </p>
                </div>
              </div>

              {/* Section 7 */}
              <div className="mb-10 pb-10 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900 mb-3">7. Intellectual Property</h2>
                <div className="ml-0">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">7.1 Our Property</h3>
                  <p className="text-gray-700 mb-4">
                    The Service, including its software, design, features, trademarks, logos, and content (excluding Your Data), is owned by Eats Desk and is protected by copyright, trademark, and other intellectual property laws. You may not copy, modify, distribute, sell, or lease any part of the Service without our express written permission.
                  </p>

                  <h3 className="text-lg font-semibold text-gray-900 mb-2">7.2 Feedback</h3>
                  <p className="text-gray-700">
                    If you provide feedback, suggestions, or ideas about the Service, you grant us a perpetual, irrevocable, worldwide, royalty-free license to use, modify, and incorporate such feedback without any obligation to you.
                  </p>
                </div>
              </div>

              {/* Section 8 */}
              <div className="mb-10 pb-10 border-b border-gray-200">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/5 flex items-center justify-center text-primary shrink-0 mt-1">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-3">8. Service Availability and Modifications</h2>
                  </div>
                </div>
                <div className="ml-14">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">8.1 Uptime</h3>
                  <p className="text-gray-700 mb-4">
                    We strive to provide 99% uptime, but we do not guarantee uninterrupted access to the Service. Downtime may occur due to maintenance, updates, technical issues, or circumstances beyond our control.
                  </p>

                  <h3 className="text-lg font-semibold text-gray-900 mb-2">8.2 Modifications</h3>
                  <p className="text-gray-700 mb-4">
                    We reserve the right to modify, suspend, or discontinue any part of the Service at any time with or without notice. We are not liable for any modifications, suspensions, or discontinuations of the Service.
                  </p>

                  <h3 className="text-lg font-semibold text-gray-900 mb-2">8.3 Maintenance</h3>
                  <p className="text-gray-700">
                    We may perform scheduled maintenance during which the Service may be temporarily unavailable. We will attempt to provide advance notice of scheduled maintenance when possible.
                  </p>
                </div>
              </div>

              {/* Section 9 */}
              <div className="mb-10 pb-10 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900 mb-3">9. Third-Party Integrations</h2>
                <div className="ml-0">
                  <p className="text-gray-700 mb-4">
                    The Service may integrate with third-party services (e.g., payment gateways, delivery platforms). Your use of such third-party services is subject to their own terms and conditions. We are not responsible for the performance, availability, or practices of third-party services.
                  </p>
                  <p className="text-gray-700">
                    Any transactions or interactions between you and third-party service providers are solely between you and that provider. We disclaim all liability for issues arising from such interactions.
                  </p>
                </div>
              </div>

              {/* Section 10 */}
              <div className="mb-10 pb-10 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900 mb-3">10. Disclaimer of Warranties</h2>
                <div className="ml-0">
                  <p className="text-gray-700 mb-4">
                    THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, OR COURSE OF PERFORMANCE.
                  </p>
                  <p className="text-gray-700">
                    We do not warrant that the Service will be error-free, secure, or uninterrupted, or that defects will be corrected. You use the Service at your own risk.
                  </p>
                </div>
              </div>

              {/* Section 11 */}
              <div className="mb-10 pb-10 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900 mb-3">11. Limitation of Liability</h2>
                <div className="ml-0">
                  <p className="text-gray-700 mb-4">
                    TO THE MAXIMUM EXTENT PERMITTED BY LAW, EATS DESK SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, REVENUE, DATA, OR USE, ARISING OUT OF OR RELATED TO YOUR USE OF THE SERVICE, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
                  </p>
                  <p className="text-gray-700">
                    Our total liability to you for all claims arising out of or related to these Terms or the Service shall not exceed the amount you paid us in the 12 months preceding the event giving rise to the liability.
                  </p>
                </div>
              </div>

              {/* Section 12 */}
              <div className="mb-10 pb-10 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900 mb-3">12. Indemnification</h2>
                <div className="ml-0">
                  <p className="text-gray-700">
                    You agree to indemnify, defend, and hold harmless Eats Desk, its affiliates, officers, directors, employees, and agents from and against any claims, liabilities, damages, losses, costs, or expenses (including reasonable attorneys' fees) arising out of or related to:
                  </p>
                  <ul className="space-y-2 text-gray-700 mt-4">
                    <li>• Your use of the Service</li>
                    <li>• Your violation of these Terms</li>
                    <li>• Your violation of any third-party rights</li>
                    <li>• Your Data or any content you submit through the Service</li>
                    <li>• Your restaurant's operations, including food safety, licensing, or employment matters</li>
                  </ul>
                </div>
              </div>

              {/* Section 13 */}
              <div className="mb-10 pb-10 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900 mb-3">13. Termination</h2>
                <div className="ml-0">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">13.1 By You</h3>
                  <p className="text-gray-700 mb-4">
                    You may terminate your account at any time by canceling your subscription or contacting our support team.
                  </p>

                  <h3 className="text-lg font-semibold text-gray-900 mb-2">13.2 By Us</h3>
                  <p className="text-gray-700 mb-4">
                    We may suspend or terminate your access to the Service immediately if:
                  </p>
                  <ul className="space-y-2 text-gray-700 mb-4">
                    <li>• You violate these Terms</li>
                    <li>• Your account is inactive for more than 12 months</li>
                    <li>• You fail to pay subscription fees</li>
                    <li>• We believe your actions pose a security risk or legal liability</li>
                  </ul>

                  <h3 className="text-lg font-semibold text-gray-900 mb-2">13.3 Effect of Termination</h3>
                  <p className="text-gray-700">
                    Upon termination, your access to the Service will cease immediately. We may delete Your Data after 90 days unless legally required to retain it. You remain responsible for all fees and charges incurred prior to termination.
                  </p>
                </div>
              </div>

              {/* Section 14 */}
              <div className="mb-10 pb-10 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900 mb-3">14. Governing Law and Dispute Resolution</h2>
                <div className="ml-0">
                  <p className="text-gray-700 mb-4">
                    These Terms shall be governed by and construed in accordance with the laws of Pakistan, without regard to its conflict of law provisions.
                  </p>
                  <p className="text-gray-700">
                    Any disputes arising out of or related to these Terms or the Service shall be resolved through good-faith negotiation. If negotiation fails, disputes shall be subject to the exclusive jurisdiction of the courts located in Islamabad, Pakistan.
                  </p>
                </div>
              </div>

              {/* Section 15 */}
              <div className="mb-10 pb-10 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900 mb-3">15. Changes to Terms</h2>
                <div className="ml-0">
                  <p className="text-gray-700 mb-4">
                    We may update these Terms from time to time. When we make changes, we will update the "Last updated" date at the top of this page and notify you via email or through a prominent notice in the Service.
                  </p>
                  <p className="text-gray-700">
                    Your continued use of the Service after the effective date of the updated Terms constitutes your acceptance of the changes. If you do not agree with the updated Terms, you must stop using the Service and cancel your account.
                  </p>
                </div>
              </div>

              {/* Section 16 */}
              <div className="mb-10 pb-10 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900 mb-3">16. General Provisions</h2>
                <div className="ml-0">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">16.1 Entire Agreement</h3>
                  <p className="text-gray-700 mb-4">
                    These Terms, together with our Privacy Policy, constitute the entire agreement between you and Eats Desk regarding the Service and supersede all prior agreements.
                  </p>

                  <h3 className="text-lg font-semibold text-gray-900 mb-2">16.2 Severability</h3>
                  <p className="text-gray-700 mb-4">
                    If any provision of these Terms is found to be invalid or unenforceable, the remaining provisions will remain in full force and effect.
                  </p>

                  <h3 className="text-lg font-semibold text-gray-900 mb-2">16.3 Waiver</h3>
                  <p className="text-gray-700 mb-4">
                    Our failure to enforce any right or provision of these Terms does not constitute a waiver of that right or provision.
                  </p>

                  <h3 className="text-lg font-semibold text-gray-900 mb-2">16.4 Assignment</h3>
                  <p className="text-gray-700">
                    You may not assign or transfer these Terms or your rights under them without our prior written consent. We may assign these Terms at any time without notice.
                  </p>
                </div>
              </div>

              {/* Contact Section */}
              <div className="mb-10">
                <h2 className="text-2xl font-bold text-gray-900 mb-3">17. Contact Information</h2>
                <div className="ml-0">
                  <p className="text-gray-700 mb-4">
                    If you have any questions about these Terms, please contact us:
                  </p>
                  <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                    <p className="text-gray-900 font-semibold mb-2">Eats Desk Legal Team</p>
                    <p className="text-gray-700 text-sm mb-1">Email: support@eatsdesk.com</p>
                    <p className="text-gray-700 text-sm mb-1">Phone / WhatsApp: +92 316 622 269</p>
                    <p className="text-gray-700 text-sm">Address: Islamabad, Pakistan</p>
                  </div>
                </div>
              </div>

              {/* Acknowledgment */}
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-6">
                <p className="text-sm text-gray-900 font-semibold mb-2">
                  By using Eats Desk, you acknowledge that you have read, understood, and agree to be bound by these Terms and Conditions.
                </p>
                <p className="text-sm text-gray-700">
                  Thank you for choosing Eats Desk to power your restaurant operations.
                </p>
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
              <p>Made with ❤️ for restaurants in Pakistan.</p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
