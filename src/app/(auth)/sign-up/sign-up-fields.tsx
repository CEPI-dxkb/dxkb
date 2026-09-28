"use client";

import { Eye, EyeOff, Lock, Mail, MessageCircle, User } from "lucide-react";
import { useState } from "react";
import type { SignupForm } from "./use-signup-form";
import { RequiredFormLabel } from "@/components/forms/required-form-components";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import {
  FieldErrors,
  FieldItem,
  FieldLabel,
} from "@/components/ui/tanstack-form";

interface SignupFieldsProps {
  form: Pick<SignupForm, "Field">;
}

interface SignupProfileFieldsProps extends SignupFieldsProps {
  disabled: boolean;
}

export function SignupProfileFields({
  form,
  disabled,
}: SignupProfileFieldsProps) {
  return (
    <>
      <form.Field name="first_name">
        {(field) => (
          <FieldItem>
            <RequiredFormLabel>First name</RequiredFormLabel>
            <InputGroup>
              <InputGroupInput
                placeholder="John"
                id={field.name}
                name={field.name}
                value={field.state.value}
                onChange={(event) => {
                  field.handleChange(event.target.value);
                }}
                onBlur={field.handleBlur}
              />
              <InputGroupAddon align="inline-start">
                <User />
              </InputGroupAddon>
            </InputGroup>
            <FieldErrors field={field} />
          </FieldItem>
        )}
      </form.Field>

      <form.Field name="middle_name">
        {(field) => (
          <FieldItem>
            <FieldLabel field={field}>Middle name</FieldLabel>
            <InputGroup>
              <InputGroupInput
                placeholder="James"
                id={field.name}
                name={field.name}
                value={field.state.value}
                onChange={(event) => {
                  field.handleChange(event.target.value);
                }}
                onBlur={field.handleBlur}
                disabled={disabled}
              />
              <InputGroupAddon align="inline-start">
                <User />
              </InputGroupAddon>
            </InputGroup>
            <FieldErrors field={field} />
          </FieldItem>
        )}
      </form.Field>

      <form.Field name="last_name">
        {(field) => (
          <FieldItem>
            <RequiredFormLabel>Last name</RequiredFormLabel>
            <InputGroup>
              <InputGroupInput
                placeholder="Doe"
                id={field.name}
                name={field.name}
                value={field.state.value}
                onChange={(event) => {
                  field.handleChange(event.target.value);
                }}
                onBlur={field.handleBlur}
                disabled={disabled}
              />
              <InputGroupAddon align="inline-start">
                <User />
              </InputGroupAddon>
            </InputGroup>
            <FieldErrors field={field} />
          </FieldItem>
        )}
      </form.Field>

      <form.Field name="username">
        {(field) => (
          <FieldItem>
            <RequiredFormLabel>Username</RequiredFormLabel>
            <InputGroup>
              <InputGroupInput
                placeholder="john.doe"
                id={field.name}
                name={field.name}
                value={field.state.value}
                onChange={(event) => {
                  field.handleChange(event.target.value);
                }}
                onBlur={field.handleBlur}
              />
              <InputGroupAddon align="inline-start">
                <Mail />
              </InputGroupAddon>
            </InputGroup>
            <FieldErrors field={field} />
          </FieldItem>
        )}
      </form.Field>

      <form.Field name="email">
        {(field) => (
          <FieldItem>
            <RequiredFormLabel>Email</RequiredFormLabel>
            <InputGroup>
              <InputGroupInput
                placeholder="john.doe@example.com"
                id={field.name}
                name={field.name}
                value={field.state.value}
                onChange={(event) => {
                  field.handleChange(event.target.value);
                }}
                onBlur={field.handleBlur}
              />
              <InputGroupAddon align="inline-start">
                <Mail />
              </InputGroupAddon>
            </InputGroup>
            <FieldErrors field={field} />
          </FieldItem>
        )}
      </form.Field>

      <form.Field name="affiliation">
        {(field) => (
          <FieldItem>
            <FieldLabel field={field}>Organization</FieldLabel>
            <InputGroup>
              <InputGroupInput
                placeholder="John Doe Inc."
                id={field.name}
                name={field.name}
                value={field.state.value}
                onChange={(event) => {
                  field.handleChange(event.target.value);
                }}
                onBlur={field.handleBlur}
              />
              <InputGroupAddon align="inline-start">
                <User />
              </InputGroupAddon>
            </InputGroup>
            <FieldErrors field={field} />
          </FieldItem>
        )}
      </form.Field>

      <form.Field name="organisms">
        {(field) => (
          <FieldItem>
            <FieldLabel field={field}>Organisms</FieldLabel>
            <InputGroup>
              <InputGroupInput
                placeholder="Enter organisms"
                id={field.name}
                name={field.name}
                value={field.state.value}
                onChange={(event) => {
                  field.handleChange(event.target.value);
                }}
                onBlur={field.handleBlur}
              />
              <InputGroupAddon align="inline-start">
                <User />
              </InputGroupAddon>
            </InputGroup>
            <FieldErrors field={field} />
          </FieldItem>
        )}
      </form.Field>

      <form.Field name="interests">
        {(field) => (
          <FieldItem>
            <FieldLabel field={field}>Interests</FieldLabel>
            <InputGroup>
              <InputGroupTextarea
                placeholder="Enter interests"
                id={field.name}
                name={field.name}
                value={field.state.value}
                onChange={(event) => {
                  field.handleChange(event.target.value);
                }}
                onBlur={field.handleBlur}
                className="max-h-32"
              />
              <InputGroupAddon align="inline-start" className="mt-0.75 self-start">
                <MessageCircle />
              </InputGroupAddon>
            </InputGroup>
            <FieldErrors field={field} />
          </FieldItem>
        )}
      </form.Field>
    </>
  );
}

export function SignupPasswordFields({ form }: SignupFieldsProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  return (
    <>
      <form.Field name="password">
        {(field) => (
          <FieldItem>
            <RequiredFormLabel>Password</RequiredFormLabel>
            <InputGroup>
              <InputGroupInput
                id={field.name}
                name={field.name}
                type={showPassword ? "text" : "password"}
                placeholder="Enter a password"
                value={field.state.value}
                onChange={(event) => {
                  field.handleChange(event.target.value);
                }}
                onBlur={field.handleBlur}
                required
              />
              <InputGroupAddon align="inline-start">
                <Lock />
              </InputGroupAddon>
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  size="icon-xs"
                  onClick={() => {
                    setShowPassword((visible) => !visible);
                  }}
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                  <span className="sr-only">
                    {showPassword ? "Hide password" : "Show password"}
                  </span>
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
            <FieldErrors field={field} />
          </FieldItem>
        )}
      </form.Field>

      <form.Field name="password_repeat">
        {(field) => (
          <FieldItem>
            <RequiredFormLabel>Confirm password</RequiredFormLabel>
            <InputGroup>
              <InputGroupInput
                id={field.name}
                name={field.name}
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Enter a password"
                value={field.state.value}
                onChange={(event) => {
                  field.handleChange(event.target.value);
                }}
                onBlur={field.handleBlur}
                required
              />
              <InputGroupAddon align="inline-start">
                <Lock />
              </InputGroupAddon>
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  size="icon-xs"
                  onClick={() => {
                    setShowConfirmPassword((visible) => !visible);
                  }}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                  <span className="sr-only">
                    {showConfirmPassword ? "Hide password" : "Show password"}
                  </span>
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
            <FieldErrors field={field} />
          </FieldItem>
        )}
      </form.Field>
    </>
  );
}
