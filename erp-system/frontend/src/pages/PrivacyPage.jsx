import React from 'react';
import { Link } from 'react-router-dom';
import { Lock, ArrowLeft } from 'lucide-react';

const Section = ({ title, children }) => (
    <div className="mb-8">
        <h2 className="text-base font-bold text-gray-900 mb-3 pb-2 border-b border-gray-200">{title}</h2>
        <div className="text-sm text-gray-700 leading-relaxed space-y-2">{children}</div>
    </div>
);

const PrivacyPage = () => (
    <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
            <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
                <Link to="/login" className="flex items-center gap-1.5 text-sm text-orange-600 hover:underline font-medium">
                    <ArrowLeft className="h-4 w-4" /> Back
                </Link>
                <div className="flex items-center gap-2 ml-2">
                    <Lock className="h-5 w-5 text-orange-600" />
                    <h1 className="text-base font-bold text-gray-900">Privacy Policy — ShopSize24 ERP</h1>
                </div>
            </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 py-8">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">

                <p className="text-xs text-gray-500 mb-6">
                    Last updated: May 2026 &nbsp;·&nbsp; This policy is effective upon account creation.
                </p>

                <Section title="1. Introduction">
                    <p>ShopSize24 ("we", "us", "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, store, and protect information when you use the ShopSize24 ERP platform ("the Software"). By using the Software, you consent to the practices described in this policy.</p>
                </Section>

                <Section title="2. Information We Collect">
                    <p><strong>Account Information:</strong> When you register or are added to the system, we collect your name, mobile number, role, and password (stored as a secure hash). We never store plaintext passwords.</p>
                    <p><strong>Business Data:</strong> We collect sales records, financial entries, expense reports, cash transfer records, and other business data you enter into the system as part of normal operations.</p>
                    <p><strong>Activity Data:</strong> We log user actions including logins, data edits, approvals, rejections, and other system interactions. Each log entry records the action type, timestamp, and associated data.</p>
                    <p><strong>Technical Information:</strong> We automatically collect IP addresses, browser/device user-agent strings, and session metadata when you access the Software. This information is used for security monitoring and audit purposes.</p>
                </Section>

                <Section title="3. Device Information">
                    <p>When you access ShopSize24 ERP, we may collect:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Browser type and version</li>
                        <li>Operating system</li>
                        <li>Device type (mobile, tablet, desktop)</li>
                        <li>Screen resolution</li>
                        <li>Network IP address</li>
                        <li>Time zone and language settings</li>
                    </ul>
                    <p>This information helps us ensure security, detect unauthorized access, and improve the Software experience.</p>
                </Section>

                <Section title="4. Location &amp; GPS Data">
                    <p>The ShopSize24 ERP may request access to your device's GPS location for the following purposes:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li><strong>Entry Verification:</strong> Location data may be collected when submitting daily sales entries to verify the submission originates from the correct shop premises.</li>
                        <li><strong>Security:</strong> Location data helps detect suspicious login activity from unexpected geographic locations.</li>
                    </ul>
                    <p>Location access is requested explicitly and you may deny it; however, certain features requiring location verification may be unavailable. We do not continuously track your location — data is only captured at the time of specific actions.</p>
                </Section>

                <Section title="5. Login Tracking &amp; Session Data">
                    <p>We maintain records of all login attempts to your account, including:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Date and time of login/logout</li>
                        <li>IP address of the connecting device</li>
                        <li>Device/browser information</li>
                        <li>Success or failure status</li>
                    </ul>
                    <p>This data is retained for security auditing, anomaly detection, and compliance purposes. Administrators can view login history for all users in the system.</p>
                </Section>

                <Section title="6. How We Use Your Information">
                    <p>We use collected information to:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Provide, operate, and improve the Software</li>
                        <li>Authenticate users and protect against unauthorized access</li>
                        <li>Generate business reports and analytics for your organization</li>
                        <li>Send operational notifications (WhatsApp alerts for entries, approvals, summaries)</li>
                        <li>Conduct security audits and investigate suspicious activity</li>
                        <li>Comply with legal obligations</li>
                    </ul>
                    <p>We do not sell your data to third parties or use it for advertising purposes.</p>
                </Section>

                <Section title="7. Data Security">
                    <p>We implement industry-standard security measures to protect your data:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li><strong>Encryption in Transit:</strong> All data is transmitted over HTTPS/TLS encrypted connections.</li>
                        <li><strong>Password Security:</strong> Passwords are hashed using bcrypt with salt rounds. Plaintext passwords are never stored.</li>
                        <li><strong>JWT Authentication:</strong> Session tokens are cryptographically signed and expire after 24 hours.</li>
                        <li><strong>Security Headers:</strong> The application implements HSTS, CSP, X-Frame-Options, and other security headers.</li>
                        <li><strong>Rate Limiting:</strong> Login and API endpoints are rate-limited to prevent brute-force attacks.</li>
                        <li><strong>Access Control:</strong> Role-based permissions ensure users only access data appropriate to their role.</li>
                    </ul>
                </Section>

                <Section title="8. Data Retention Policy">
                    <p><strong>User Accounts:</strong> Account data is retained for the duration of the business relationship and for up to 5 years after account deactivation for legal and compliance purposes.</p>
                    <p><strong>Business Data:</strong> Sales records, financial entries, and business transactions are retained for a minimum of 7 years in compliance with Indian accounting and taxation requirements.</p>
                    <p><strong>Activity Logs:</strong> Security and audit logs are retained for 12 months for active investigation purposes and 3 years in archived form.</p>
                    <p><strong>Data Deletion:</strong> Requests for data deletion may be submitted to our contact email. Deletion requests are subject to legal retention requirements and may not be fully honored where retention is required by law.</p>
                </Section>

                <Section title="9. Third-Party Services">
                    <p>ShopSize24 ERP uses the following third-party services which may process your data:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li><strong>AiSensy / WhatsApp Business API:</strong> Used to send operational notifications to mobile numbers registered in the system. Messages contain business data such as sales summaries and entry notifications.</li>
                        <li><strong>Razorpay:</strong> Payment processing for any applicable transactions. Governed by Razorpay's own privacy policy.</li>
                    </ul>
                </Section>

                <Section title="10. Your Rights">
                    <p>Under applicable Indian data protection laws, you have the right to:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Access the personal data we hold about you</li>
                        <li>Request correction of inaccurate data</li>
                        <li>Request deletion of your data (subject to legal retention requirements)</li>
                        <li>Object to processing of your data in certain circumstances</li>
                        <li>Receive a copy of your data in a machine-readable format</li>
                    </ul>
                    <p>To exercise these rights, contact us at the details below.</p>
                </Section>

                <Section title="11. Cookies &amp; Local Storage">
                    <p>ShopSize24 ERP uses browser local storage (not cookies) to maintain your session authentication token. This token is automatically cleared upon logout. We do not use advertising cookies or third-party tracking cookies.</p>
                </Section>

                <Section title="12. Changes to This Policy">
                    <p>We may update this Privacy Policy periodically. Material changes will be communicated to users at next login. Continued use of the Software after changes constitutes acceptance of the updated policy.</p>
                </Section>

                <Section title="13. Contact Information">
                    <p>For privacy-related queries, data requests, or concerns, contact:</p>
                    <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 mt-2">
                        <p className="font-semibold text-gray-900">ShopSize24 — Data Protection</p>
                        <p>Email: <a href="mailto:size24.in@gmail.com" className="text-orange-600 hover:underline">size24.in@gmail.com</a></p>
                        <p>Website: <span className="text-orange-600">shopsize24.in</span></p>
                        <p>Jurisdiction: Pune, Maharashtra, India</p>
                    </div>
                </Section>

                <div className="mt-8 p-4 rounded-xl bg-gray-900 text-gray-300 text-xs leading-relaxed">
                    © ShopSize24. All Rights Reserved. Unauthorized copying, resale, reverse engineering, distribution, or duplication of this software is strictly prohibited and may lead to legal action under Indian IT and Copyright laws.
                </div>
            </div>
        </div>
    </div>
);

export default PrivacyPage;
