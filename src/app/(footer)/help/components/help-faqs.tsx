import React from 'react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const HelpFAQs = () => {
  return (
    <section className="py-12 bg-background">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold mb-8 text-center">Frequently Asked Questions</h2>

          <Tabs defaultValue="general" className="max-w-3xl mx-auto">
            <TabsList className="grid w-full grid-cols-3 mb-8">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="technical">Technical</TabsTrigger>
              <TabsTrigger value="account">Account</TabsTrigger>
            </TabsList>

            <TabsContent value="general">
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="item-1">
                  <AccordionTrigger>What is VirusDB?</AccordionTrigger>
                  <AccordionContent>
                    VirusDB is a comprehensive database of viral genomic and proteomic data designed for scientific
                    research. It provides detailed information on various viruses, including their proteins, genomes,
                    and other biological information, serving as a central repository for researchers with advanced
                    degrees in virology, microbiology, and related fields.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-2">
                  <AccordionTrigger>How often is the database updated?</AccordionTrigger>
                  <AccordionContent>
                    The VirusDB database is updated on a weekly basis with new viral sequences, protein structures, and
                    research findings. Major updates, including new features and tools, are typically released
                    quarterly. All updates are documented in our &quot;Database Updates&quot; section, accessible from the
                    homepage.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-3">
                  <AccordionTrigger>Is VirusDB free to use?</AccordionTrigger>
                  <AccordionContent>
                    Yes, VirusDB offers free access to basic features for academic and research purposes. However, some
                    advanced features and high-throughput API access may require a subscription. Please refer to our
                    pricing page for more details on the different tiers of access available.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-4">
                  <AccordionTrigger>How do I cite VirusDB in my research?</AccordionTrigger>
                  <AccordionContent>
                    To cite VirusDB in your research, please use the following format: &quot;Smith J, et al. (2023) VirusDB:
                    A comprehensive database for viral genomic and proteomic research. Journal of Molecular Biology,
                    45(2), 112-118.&quot; Alternatively, you can use the &quot;Cite&quot; button available on each data page to
                    generate a citation in your preferred format.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </TabsContent>

            <TabsContent value="technical">
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="item-1">
                  <AccordionTrigger>What file formats are supported for sequence uploads?</AccordionTrigger>
                  <AccordionContent>
                    VirusDB supports multiple file formats for sequence uploads, including FASTA, GenBank, EMBL, and
                    plain text. For protein structure data, we accept PDB, mmCIF, and related formats. All uploaded
                    files must adhere to standard formatting guidelines to ensure proper processing and integration with
                    our database.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-2">
                  <AccordionTrigger>How can I access the VirusDB API?</AccordionTrigger>
                  <AccordionContent>
                    To access the VirusDB API, you need to register for an API key in your account settings. Once you
                    have your API key, you can make requests to our endpoints following the documentation available in
                    the Developer section. We provide client libraries for Python, R, and JavaScript to facilitate
                    integration with your research workflows.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-3">
                  <AccordionTrigger>What are the system requirements for using VirusDB tools?</AccordionTrigger>
                  <AccordionContent>
                    Most VirusDB web tools are designed to work in modern web browsers (Chrome, Firefox, Safari, Edge)
                    without any additional software. For computationally intensive tasks like phylogenetic analysis or
                    protein structure prediction, we recommend a high-speed internet connection and a computer with at
                    least 8GB of RAM. Some downloadable tools may have specific operating system requirements detailed
                    in their documentation.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-4">
                  <AccordionTrigger>How do I report technical issues or bugs?</AccordionTrigger>
                  <AccordionContent>
                    Technical issues or bugs can be reported through our issue tracker accessible from the &quot;Support&quot;
                    section. Please provide detailed information about the problem, including steps to reproduce it, the
                    browser and operating system you&apos;re using, and any error messages displayed. Screenshots or screen
                    recordings are also helpful for our technical team to diagnose and resolve the issue efficiently.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </TabsContent>

            <TabsContent value="account">
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="item-1">
                  <AccordionTrigger>How do I create a VirusDB account?</AccordionTrigger>
                  <AccordionContent>
                    To create a VirusDB account, click on the &quot;Register&quot; button in the top-right corner of the homepage.
                    Fill out the registration form with your professional email address (academic or institutional
                    emails are preferred), create a secure password, and provide your name and affiliation. After
                    submitting the form, you&apos;ll receive a verification email to activate your account.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-2">
                  <AccordionTrigger>Can I share my account with colleagues?</AccordionTrigger>
                  <AccordionContent>
                    No, VirusDB accounts are intended for individual use only. Sharing account credentials violates our
                    terms of service and may result in account suspension. However, we offer collaborative workspaces
                    and team accounts for research groups that need shared access to certain features and data. Please
                    contact our support team for more information on setting up a team account.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-3">
                  <AccordionTrigger>How do I reset my password?</AccordionTrigger>
                  <AccordionContent>
                    To reset your password, click on the &quot;Sign In&quot; button, then select &quot;Forgot Password&quot; below the login
                    form. Enter the email address associated with your account, and you&apos;ll receive a password reset
                    link. This link is valid for 24 hours. If you don&apos;t receive the email, check your spam folder or
                    contact support for assistance.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-4">
                  <AccordionTrigger>How can I update my profile information?</AccordionTrigger>
                  <AccordionContent>
                    To update your profile information, sign in to your account and navigate to &quot;Account Settings&quot; from
                    the dropdown menu in the top-right corner. From there, you can edit your personal information,
                    change your password, update your institutional affiliation, and manage your notification
                    preferences. Remember to click &quot;Save Changes&quot; after making any updates to your profile.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </TabsContent>
          </Tabs>
        </div>
      </section>
  )
}

export default HelpFAQs