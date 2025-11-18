import FooterHeader from '@/components/headers/footer-header'
import React from 'react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

const faqSections = {
  DXKB: [
    {
      question: 'What is DXKB?',
      answer: 'DXKB is a comprehensive knowledge base for disease surveillance and outbreak monitoring.',
    },
    {
      question: 'What is bio-informatics?',
      answer: 'Bio-informatics is the science of collecting and analyzing complex biological data such as genetic codes, protein sequences, and disease patterns.',
    },
    {
      question: 'Who funds this project?',
      answer: 'This project is funded by the Division for Scientific Research Preparedness Innovations (DSRI) under the Disease X Program.',
    },
  ],
  Services: [
    {
      question: 'What services are available to use?',
      answer: 'We offer data analysis, visualization tools, and real-time disease tracking capabilities.',
    },
    {
      question: 'Do I need an account to use services?',
      answer: 'Some basic features are available without an account, but full access requires registration.',
    },
    {
      question: 'How do I use a service?',
      answer: 'Each service has detailed documentation and instructional videos for best practices.',
    },
  ],
  'BV-BRC': [
    {
      question: 'What is BV-BRC?',
      answer: 'BV-BRC (Bacterial and Viral Bioinformatics Resource Center) is a comprehensive platform for bacterial and viral pathogen research.',
    },
    {
      question: 'How is BV-BRC related to DXKB?',
      answer: 'BV-BRC is a partner platform that provides complementary resources and data integration capabilities.',
    },
    {
      question: 'Do I need a separate BV-BRC account to use DXKB services?',
      answer: 'No. You would only create an BV-BRC account when you wish to use their standalone services. The two websites share accounts.',
    },
  ],
}

const FAQ = () => {
  return (
    <div className="flex w-full flex-col items-center">
      <FooterHeader title="FAQs" />
      <div className="container mx-auto w-[95%] max-w-7xl py-8 my-12">
        {Object.entries(faqSections).map(([section, questions]) => (
          <div key={section} className="section-content">
            <h2 className="section-content-header">{section}</h2>
            <div className="section-content-body">
              <Accordion
                type="single"
                collapsible
                className="space-y-4"
              >
                {questions.map((faq, index) => (
                  <AccordionItem
                    key={index}
                    value={`${section}-${index}`}
                    className="accordion-item"
                  >
                    <AccordionTrigger className="accordion-trigger">{faq.question}</AccordionTrigger>
                    <AccordionContent className="accordion-content">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default FAQ