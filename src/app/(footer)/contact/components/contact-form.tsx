"use client";

import { useForm } from "@tanstack/react-form";
import { toast } from "sonner";
import { Mail } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  FieldItem,
  FieldLabel,
  FieldErrors,
} from "@/components/ui/tanstack-form";
import {
  contactFormSchema,
  defaultContactFormValues,
  inquiryTypes,
  type ContactFormData,
  type InquiryType,
} from "./contact-form-utils";

const ContactForm = () => {
  const form = useForm({
    defaultValues: defaultContactFormValues,
    validators: { onChange: contactFormSchema },
    onSubmit: async ({ value, formApi }) => {
      try {
        const response = await fetch("/api/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(value satisfies ContactFormData),
        });

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          toast.error(
            body?.error ??
              `Request failed with status ${String(response.status)}`,
          );
          return;
        }

        toast.success("Message sent. We'll be in touch soon.");
        formApi.reset();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to send message.";
        toast.error(message);
      }
    },
  });

  return (
    <section className="py-12">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {/* Contact Info Sidebar */}
            <div className="md:col-span-1">
              <div className="sticky top-24">
                <h2 className="mb-6 text-xl font-bold">Contact Information</h2>

                <div className="space-y-6">
                  <div className="flex items-start">
                    <div className="mr-4 rounded-full bg-secondary/20 p-3">
                      <Mail className="size-5 text-secondary" />
                    </div>
                    <div>
                      <h3 className="mb-1 font-medium">Email</h3>
                      <a
                        href="mailto:help@dxkb.org"
                        className="text-primary hover:underline"
                      >
                        help@dxkb.org
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Form */}
            <div className="md:col-span-2">
              <Card>
                <CardContent className="px-8 py-4">
                  <h2 className="mb-6 text-xl font-bold">Send Us a Message</h2>
                  <form
                    className="space-y-6"
                    onSubmit={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      void form.handleSubmit();
                    }}
                  >
                    <div className="space-y-4">
                      <form.Field name="inquiryType">
                        {(field) => (
                          <FieldItem>
                            {/*
                              Group label: uses id + aria-labelledby rather than
                              htmlFor, since a radio group has no single input to
                              associate with.
                            */}
                            <span
                              id="inquiryType-label"
                              className="text-base font-medium"
                            >
                              What can we help you with?
                            </span>
                            <RadioGroup
                              aria-labelledby="inquiryType-label"
                              value={field.state.value}
                              onValueChange={(value) => {
                                field.handleChange(value as InquiryType);
                              }}
                              className="mt-1 grid grid-cols-1 gap-3 md:grid-cols-2"
                            >
                              {inquiryTypes.map((option) => (
                                <div
                                  key={option.value}
                                  className="flex items-center gap-3"
                                >
                                  <RadioGroupItem
                                    value={option.value}
                                    id={option.value}
                                  />
                                  <FieldLabel
                                    field={field}
                                    htmlFor={option.value}
                                    className="font-normal"
                                  >
                                    {option.label}
                                  </FieldLabel>
                                </div>
                              ))}
                            </RadioGroup>
                          </FieldItem>
                        )}
                      </form.Field>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <form.Field name="name">
                          {(field) => (
                            <FieldItem>
                              <FieldLabel
                                field={field}
                                className="text-sm font-medium"
                              >
                                Full Name
                              </FieldLabel>
                              <Input
                                id={field.name}
                                name={field.name}
                                value={field.state.value}
                                onBlur={field.handleBlur}
                                onChange={(e) => {
                                  field.handleChange(e.target.value);
                                }}
                                placeholder="Enter your full name"
                              />
                              <FieldErrors field={field} />
                            </FieldItem>
                          )}
                        </form.Field>

                        <form.Field name="email">
                          {(field) => (
                            <FieldItem>
                              <FieldLabel
                                field={field}
                                className="text-sm font-medium"
                              >
                                Email Address
                              </FieldLabel>
                              <Input
                                id={field.name}
                                name={field.name}
                                type="email"
                                value={field.state.value}
                                onBlur={field.handleBlur}
                                onChange={(e) => {
                                  field.handleChange(e.target.value);
                                }}
                                placeholder="Enter your email address"
                              />
                              <FieldErrors field={field} />
                            </FieldItem>
                          )}
                        </form.Field>
                      </div>

                      <form.Field name="subject">
                        {(field) => (
                          <FieldItem>
                            <FieldLabel
                              field={field}
                              className="text-sm font-medium"
                            >
                              Subject
                            </FieldLabel>
                            <Input
                              id={field.name}
                              name={field.name}
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(e) => {
                                field.handleChange(e.target.value);
                              }}
                              placeholder="Enter the subject of your message"
                            />
                            <FieldErrors field={field} />
                          </FieldItem>
                        )}
                      </form.Field>

                      <form.Field name="message">
                        {(field) => (
                          <FieldItem>
                            <FieldLabel
                              field={field}
                              className="text-sm font-medium"
                            >
                              Message
                            </FieldLabel>
                            <Textarea
                              id={field.name}
                              name={field.name}
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(e) => {
                                field.handleChange(e.target.value);
                              }}
                              placeholder="Please provide details about your inquiry..."
                              rows={6}
                            />
                            <FieldErrors field={field} />
                          </FieldItem>
                        )}
                      </form.Field>
                    </div>

                    <div className="pt-2">
                      <form.Subscribe selector={(state) => state.isSubmitting}>
                        {(isSubmitting) => (
                          <Button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full bg-secondary py-6 hover:bg-secondary"
                          >
                            {isSubmitting ? (
                              <>
                                <Spinner className="mr-2" />
                                Sending...
                              </>
                            ) : (
                              "Submit Message"
                            )}
                          </Button>
                        )}
                      </form.Subscribe>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ContactForm;
