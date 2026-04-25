import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PrivacyPolicy() {
  return (
    <div className="bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link href="/">
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>

        <h1 className="text-3xl font-bold mb-8">Privacy Policy</h1>
        
        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
          <p className="text-muted-foreground">
            Last updated: January 2026
          </p>

          <section>
            <h2 className="text-xl font-semibold mb-3">1. Introduction</h2>
            <p>
              Welcome to Classterly. We respect your privacy and are committed to protecting your personal data. 
              This privacy policy explains how we collect, use, and safeguard your information when you use our tutoring management platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Information We Collect</h2>
            <p>We collect information that you provide directly to us, including:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Account information (name, email address)</li>
              <li>Profile information (timezone, preferences)</li>
              <li>Session and scheduling data</li>
              <li>Student information you add to manage your tutoring</li>
              <li>Payment and earnings tracking data</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Google Calendar Integration</h2>
            <p>
              If you choose to connect your Google Calendar, we request access to:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Create, read, update, and delete calendar events</li>
              <li>This access is used solely to sync your tutoring sessions with your Google Calendar</li>
            </ul>
            <p className="mt-2">
              You can disconnect Google Calendar integration at any time from your profile settings.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. How We Use Your Information</h2>
            <p>We use the collected information to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Provide and maintain the Classterly service</li>
              <li>Manage your tutoring sessions and student information</li>
              <li>Sync sessions with your calendar (if enabled)</li>
              <li>Send you service-related notifications</li>
              <li>Improve our platform and user experience</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Data Security</h2>
            <p>
              We implement appropriate security measures to protect your personal information. 
              Your data is stored securely and we use encryption for data transmission.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Data Sharing</h2>
            <p>
              We do not sell your personal data. We may share your information only:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>With service providers who assist in operating our platform</li>
              <li>When required by law or to protect our rights</li>
              <li>With your explicit consent</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Access your personal data</li>
              <li>Correct inaccurate data</li>
              <li>Delete your account and associated data</li>
              <li>Disconnect third-party integrations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy, please contact us at support@classterly.com
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
