import { useEffect } from 'react'
import NavBar from '../components/NavBar'
import { useScrollVisibility } from '../hooks/useScrollVisibility'

export default function PrivacyPolicyPage() {
  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])
  
  // Enable scroll-triggered visibility animations
  useScrollVisibility()

  return (
    <div className="min-h-screen pt-0 relative z-10 bg-app-gradient">
      <NavBar />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 pt-24">
        <div className="bg-white/5 backdrop-blur-sm rounded-lg shadow-lg p-8 md:p-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-8">
            Privacy Policy
          </h1>
          
          <p className="text-gray-300 mb-8">
            <strong className="text-white">Effective Date:</strong> November 12, 2025
          </p>

          <div className="prose prose-invert max-w-none text-gray-300 space-y-6">
            <p>
              This Privacy Policy describes how Whatsapp Automation collects, uses, and processes your information when you interact with our services.
            </p>

            <section>
              <h2 className="text-2xl md:text-3xl font-bold text-white mt-8 mb-4">
                1. What Information We Collect
              </h2>
              <p>
                When you use our app, we collect the messages you send to us, including any information or content you submit.
              </p>
            </section>

            <section>
              <h2 className="text-2xl md:text-3xl font-bold text-white mt-8 mb-4">
                2. How We Use Your Information
              </h2>
              <p>
                All messages and content you send are used as input to a Large Language Model (LLM) system. The primary purposes are:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-2">
                <li>To provide, maintain, and improve our service</li>
                <li>To analyze your messages and respond with automated answers, insights, or actions powered by LLM technology</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl md:text-3xl font-bold text-white mt-8 mb-4">
                3. Data Sharing and Disclosure
              </h2>
              <p>
                We do not sell your personal data. Your messages may be processed by third-party providers that supply LLM and cloud infrastructure, solely for the purposes described above.
              </p>
            </section>

            <section>
              <h2 className="text-2xl md:text-3xl font-bold text-white mt-8 mb-4">
                4. Data Retention
              </h2>
              <p>
                We retain your messages only as long as necessary to fulfill the purposes above, unless a longer retention period is required by law.
              </p>
            </section>

            <section>
              <h2 className="text-2xl md:text-3xl font-bold text-white mt-8 mb-4">
                5. Security
              </h2>
              <p>
                We implement appropriate measures to protect your data. However, no internet transmission is fully secure, so we cannot guarantee absolute security.
              </p>
            </section>

            <section>
              <h2 className="text-2xl md:text-3xl font-bold text-white mt-8 mb-4">
                6. Your Rights
              </h2>
              <p>
                Depending on your location, you may have the right to request access to, correction of, or deletion of your data. Please contact us at [Your Contact Email].
              </p>
            </section>

            <section>
              <h2 className="text-2xl md:text-3xl font-bold text-white mt-8 mb-4">
                7. Changes to This Privacy Policy
              </h2>
              <p>
                We may update this Privacy Policy from time to time. Changes will be posted on this page with a new effective date.
              </p>
            </section>

            <section className="mt-12 pt-8 border-t border-white/10">
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
                Contact Us
              </h2>
              <p>
                For questions or requests regarding your privacy, contact us at: <a href="mailto:[Your Contact Email]" className="text-accent hover:underline">[Your Contact Email]</a>
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}

