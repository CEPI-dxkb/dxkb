import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const ContactUs = () => {
  return (
    <section className="py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-4">Still Need Help?</h2>
          <p className="text-muted-foreground mb-8">
            Our support team is available to assist you with any questions or issues you may encounter.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <div className="w-12 h-12 rounded-full bg-secondary/20 flex items-center justify-center mx-auto mb-4">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-secondary"
                  >
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                </div>
                <CardTitle className="text-center">Technical Support</CardTitle>
                <CardDescription className="text-center">
                  Get help with technical issues and bug reports
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <p className="mb-4 text-sm">
                  Our technical support team is available Monday through Friday, 9 AM to 5 PM EST.
                </p>
                <Button className="bg-secondary hover:bg-secondary/20">Submit a Ticket</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="w-12 h-12 rounded-full bg-secondary/20 flex items-center justify-center mx-auto mb-4">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-secondary"
                  >
                    <path d="M21.2 8.4c.5.38.8.97.8 1.6v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2h3.8a2 2 0 0 0 1.4-.6L12 4.6a2 2 0 0 1 1.4-.6h3.8a2 2 0 0 1 2 2v2.4Z" />
                    <path d="M12 10v6" />
                    <path d="M9 13h6" />
                  </svg>
                </div>
                <CardTitle className="text-center">Research Support</CardTitle>
                <CardDescription className="text-center">
                  Get assistance with research-related questions
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <p className="mb-4 text-sm">
                  Our scientific team can help with database content and research methodology questions.
                </p>
                <Button className="bg-secondary hover:bg-secondary/20">Contact Research Team</Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  )
}

export default ContactUs