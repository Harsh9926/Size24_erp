import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, ArrowLeft } from 'lucide-react';

const Section = ({ title, children }) => (
    <div className="mb-8">
        <h2 className="text-base font-bold text-gray-900 mb-3 pb-2 border-b border-gray-200">{title}</h2>
        <div className="text-sm text-gray-700 leading-relaxed space-y-2">{children}</div>
    </div>
);

const TermsPage = () => (
    <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
            <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
                <Link to="/login" className="flex items-center gap-1.5 text-sm text-orange-600 hover:underline font-medium">
                    <ArrowLeft className="h-4 w-4" /> Back
                </Link>
                <div className="flex items-center gap-2 ml-2">
                    <Shield className="h-5 w-5 text-orange-600" />
                    <h1 className="text-base font-bold text-gray-900">Terms &amp; Conditions — ShopSize24 ERP</h1>
                </div>
            </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 py-8">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">

                <p className="text-xs text-gray-500 mb-6">
                    Last updated: May 2026 &nbsp;·&nbsp; Effective immediately upon first use.
                </p>

                <Section title="1. Software Ownership &amp; Intellectual Property">
                    <p>ShopSize24 ERP ("the Software") is the exclusive intellectual property of ShopSize24, owned and operated by <strong>Harsh Chandel</strong>. All rights, title, and interest in and to the Software — including but not limited to source code, design, architecture, database schemas, algorithms, and documentation — are and shall remain the sole property of ShopSize24.</p>
                    <p>The Software is protected under the <strong>Indian Copyright Act, 1957</strong> and the <strong>Information Technology Act, 2000</strong>. Unauthorized reproduction, copying, distribution, or use of any part of this Software without express written consent from ShopSize24 management is strictly prohibited.</p>
                </Section>

                <Section title="2. Licence Grant &amp; User Access">
                    <p>ShopSize24 grants you a limited, non-exclusive, non-transferable, revocable licence to access and use the Software solely for your business operations as authorized by ShopSize24. This licence does not constitute a sale or transfer of ownership of the Software.</p>
                    <p>Your access is tied to a specific user account. Sharing login credentials, allowing unauthorized persons to access your account, or using the account for any purpose other than authorized business operations is strictly prohibited.</p>
                </Section>

                <Section title="3. No Resale / No Cloning Policy">
                    <p>You may not, under any circumstances:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Resell, sublicense, lease, or transfer access to the Software to any third party.</li>
                        <li>Reverse engineer, decompile, disassemble, or attempt to derive the source code of the Software.</li>
                        <li>Clone, duplicate, or create derivative works based on the Software's design, logic, or functionality.</li>
                        <li>Copy or reproduce the Software's user interface, workflows, or business logic for use in another product.</li>
                        <li>Use the Software's architecture or data structures in any competing or similar product.</li>
                    </ul>
                    <p>Violation of this policy may result in immediate termination of access and legal proceedings under applicable Indian law.</p>
                </Section>

                <Section title="4. User Responsibilities">
                    <p>By using this Software, you agree to:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Provide accurate and complete information when creating your account.</li>
                        <li>Keep your login credentials confidential and notify ShopSize24 immediately of any unauthorized use.</li>
                        <li>Use the Software only for lawful business purposes in accordance with applicable Indian laws.</li>
                        <li>Not use the Software to process, store, or transmit any unlawful, harmful, or fraudulent data.</li>
                        <li>Comply with all applicable local, state, and national laws regarding data protection and business operations.</li>
                    </ul>
                </Section>

                <Section title="5. Termination Rights">
                    <p>ShopSize24 reserves the right to suspend or permanently terminate your access to the Software at any time, with or without notice, for reasons including but not limited to:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Breach of any provision of these Terms &amp; Conditions.</li>
                        <li>Suspected fraudulent, abusive, or illegal activity.</li>
                        <li>Non-compliance with ShopSize24's policies.</li>
                        <li>End of the business relationship between you and ShopSize24.</li>
                    </ul>
                    <p>Upon termination, your licence to use the Software immediately ceases. ShopSize24 may retain your data for legal, regulatory, or operational purposes as outlined in our Privacy Policy.</p>
                </Section>

                <Section title="6. Data Usage Policy">
                    <p>All data entered into the Software, including sales records, financial data, user information, and business data, is stored securely on ShopSize24's servers. This data is used solely for the purpose of operating the Software and providing services to you.</p>
                    <p>ShopSize24 does not sell, rent, or share your business data with third parties except as required by law or with your explicit consent. All data handling is governed by our <Link to="/privacy" className="text-orange-600 hover:underline">Privacy Policy</Link>.</p>
                </Section>

                <Section title="7. Liability Limitations">
                    <p>The Software is provided on an "as is" and "as available" basis. ShopSize24 makes no warranties, express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, or non-infringement.</p>
                    <p>To the maximum extent permitted by applicable law, ShopSize24 shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, or business opportunities arising from your use of the Software.</p>
                    <p>ShopSize24's total liability to you for any claim arising out of or relating to these Terms shall not exceed the amount paid by you to ShopSize24 in the twelve (12) months preceding the claim.</p>
                </Section>

                <Section title="8. Third-Party Services">
                    <p>The Software may integrate with third-party services (including but not limited to payment gateways, WhatsApp Business APIs, and cloud storage). Use of these services is governed by their respective terms and privacy policies. ShopSize24 is not responsible for the practices or content of third-party services.</p>
                </Section>

                <Section title="9. Modifications to Terms">
                    <p>ShopSize24 reserves the right to modify these Terms &amp; Conditions at any time. Continued use of the Software following notification of changes constitutes your acceptance of the revised terms. Users will be notified of material changes upon next login.</p>
                </Section>

                <Section title="10. Legal Jurisdiction &amp; Governing Law">
                    <p>These Terms &amp; Conditions are governed by and construed in accordance with the laws of India. Any disputes arising out of or relating to these Terms, the Software, or your use thereof shall be subject to the exclusive jurisdiction of the courts located in <strong>Pune, Maharashtra, India</strong>.</p>
                    <p>Any disputes shall first be attempted to be resolved through good-faith negotiation. If unresolved, disputes shall be submitted to binding arbitration in accordance with the Arbitration and Conciliation Act, 1996.</p>
                </Section>

                <Section title="11. Contact Information">
                    <p>For any questions, concerns, or legal notices regarding these Terms &amp; Conditions, please contact:</p>
                    <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 mt-2">
                        <p className="font-semibold text-gray-900">ShopSize24</p>
                        <p>Email: <a href="mailto:size24.in@gmail.com" className="text-orange-600 hover:underline">size24.in@gmail.com</a></p>
                        <p>Website: <span className="text-orange-600">shopsize24.in</span></p>
                        <p>Jurisdiction: Pune, Maharashtra, India</p>
                    </div>
                </Section>

                {/* Legal notice */}
                <div className="mt-8 p-4 rounded-xl bg-gray-900 text-gray-300 text-xs leading-relaxed">
                    © ShopSize24. All Rights Reserved. Unauthorized copying, resale, reverse engineering, distribution, or duplication of this software is strictly prohibited and may lead to legal action under Indian IT and Copyright laws.
                </div>
            </div>
        </div>
    </div>
);

export default TermsPage;
