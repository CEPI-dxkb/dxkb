import { Separator } from "@/components/ui/separator";
import { LuMail, LuMapPin, LuTwitter, LuLinkedin, LuGithub, LuClock, LuPhone } from "react-icons/lu";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const ContactForm = () => {
  return (
    <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Contact Info Sidebar */}
              <div className="md:col-span-1">
                <div className="sticky top-24">
                  <h2 className="text-xl font-bold mb-6">Contact Information</h2>

                  <div className="space-y-6">
                    <div className="flex items-start">
                      <div className="bg-secondary/20 p-3 rounded-full mr-4">
                        <LuMail className="h-5 w-5 text-secondary" />
                      </div>
                      <div>
                        <h3 className="font-medium mb-1">Email</h3>
                        <a href="mailto:contact@virusdb.org" className="text-link hover:underline">
                          contact@virusdb.org
                        </a>
                      </div>
                    </div>

                    <div className="flex items-start">
                      <div className="bg-secondary/20 p-3 rounded-full mr-4">
                        <LuPhone className="h-5 w-5 text-secondary" />
                      </div>
                      <div>
                        <h3 className="font-medium mb-1">Phone</h3>
                        <a href="tel:+18005551234" className="text-link hover:underline">
                          +1 (800) 555-1234
                        </a>
                        <p className="text-sm text-muted-foreground mt-1">Mon-Fri, 9am-5pm EST</p>
                      </div>
                    </div>

                    <div className="flex items-start">
                      <div className="bg-secondary/20 p-3 rounded-full mr-4">
                        <LuMapPin className="h-5 w-5 text-secondary" />
                      </div>
                      <div>
                        <h3 className="font-medium mb-1">Main Office</h3>
                        <p className="text-muted-foreground">123 Science Way, Cambridge, MA 02142, USA</p>
                      </div>
                    </div>
                  </div>

                  <Separator className="my-8" />

                  <h3 className="font-medium mb-4">Follow Us</h3>
                  <div className="flex space-x-4">
                    <a
                      href="#"
                      className="bg-accent/20 p-3 rounded-full hover:bg-accent/40 transition-colors duration-200"
                    >
                      <LuTwitter className="h-5 w-5 text-accent" />
                    </a>
                    <a
                      href="#"
                      className="bg-accent/20 p-3 rounded-full hover:bg-accent/40 transition-colors duration-200"
                    >
                      <LuLinkedin className="h-5 w-5 text-accent" />
                    </a>
                    <a
                      href="#"
                      className="bg-accent/20 p-3 rounded-full hover:bg-accent/40 transition-colors duration-200"
                    >
                      <LuGithub className="h-5 w-5 text-accent" />
                    </a>
                  </div>

                  <Separator className="my-8" />

                  <div className="bg-secondary/20 rounded-lg p-6">
                    <h3 className="font-medium mb-2">Support Hours</h3>
                    <div className="space-y-2">
                      <div className="flex items-center">
                        <LuClock className="h-4 w-4 text-secondary mr-2" />
                        <span className="text-sm">Monday - Friday: 9:00 AM - 5:00 PM (EST)</span>
                      </div>
                      <div className="flex items-center">
                        <LuClock className="h-4 w-4 text-secondary mr-2" />
                        <span className="text-sm">Saturday: 10:00 AM - 2:00 PM (EST)</span>
                      </div>
                      <div className="flex items-center">
                        <LuClock className="h-4 w-4 text-secondary mr-2" />
                        <span className="text-sm">Sunday: Closed</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Contact Form */}
              <div className="md:col-span-2">
                <Card>
                  <CardContent className="px-8 py-4">
                    <h2 className="text-xl font-bold mb-6">Send Us a Message</h2>
                    <form className="space-y-6">
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="inquiry-type" className="text-base font-medium">
                            What can we help you with?
                          </Label>
                          <RadioGroup defaultValue="general" className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="flex items-center gap-3">
                              <RadioGroupItem value="general" id="general" />
                              <Label htmlFor="general" className="font-normal">
                                General Inquiry
                              </Label>
                            </div>
                            <div className="flex items-center gap-3">
                              <RadioGroupItem value="technical" id="technical" />
                              <Label htmlFor="technical" className="font-normal">
                                Technical Support
                              </Label>
                            </div>
                            <div className="flex items-center gap-3">
                              <RadioGroupItem value="research" id="research" />
                              <Label htmlFor="research" className="font-normal">
                                Research Collaboration
                              </Label>
                            </div>
                            <div className="flex items-center gap-3">
                              <RadioGroupItem value="feedback" id="feedback" />
                              <Label htmlFor="feedback" className="font-normal">
                                Feedback & Suggestions
                              </Label>
                            </div>
                          </RadioGroup>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="name" className="text-sm font-medium">
                              Full Name
                            </Label>
                            <Input id="name" placeholder="Enter your full name" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="email" className="text-sm font-medium">
                              Email Address
                            </Label>
                            <Input id="email" type="email" placeholder="Enter your email address" />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="institution" className="text-sm font-medium">
                              Institution/Organization
                            </Label>
                            <Input id="institution" placeholder="Enter your institution or organization" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="phone" className="text-sm font-medium">
                              Phone Number (Optional)
                            </Label>
                            <Input id="phone" placeholder="Enter your phone number" />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="subject" className="text-sm font-medium">
                            Subject
                          </Label>
                          <Input id="subject" placeholder="Enter the subject of your message" />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="message" className="text-sm font-medium">
                            Message
                          </Label>
                          <Textarea
                            id="message"
                            placeholder="Please provide details about your inquiry..."
                            rows={6}
                          />
                        </div>

                        <div className="flex items-start space-x-2">
                          <input type="checkbox" id="privacy" className="mt-1" />
                          <Label htmlFor="privacy" className="text-sm font-normal">
                            I agree to the
                            <a href="#" className="text-link hover:underline">
                              Privacy Policy
                            </a>
                            and consent to the processing of my personal data.
                          </Label>
                        </div>
                      </div>

                      <div className="pt-2">
                        <Button className="w-full bg-secondary hover:bg-secondary py-6">Submit Message</Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>
  )
}

export default ContactForm