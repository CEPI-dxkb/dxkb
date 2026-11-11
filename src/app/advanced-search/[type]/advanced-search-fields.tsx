import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import {
  ServiceCardHeader,
  ServiceCardContent,
  ServiceCardTitle,
} from "@/components/services/form-ui/service-card";
import { ServiceInput } from "@/components/services/form-ui/service-input";
import { ServiceLabel } from "@/components/services/form-ui/service-label";

interface FieldProps {
  value: string;
  onChange: (value: string) => void;
}

function SearchCard({
  title,
  grid = false,
  children,
}: {
  title: string;
  grid?: boolean;
  children: ReactNode;
}) {
  return (
    <Card>
      <ServiceCardHeader>
        <ServiceCardTitle>{title}</ServiceCardTitle>
      </ServiceCardHeader>
      <ServiceCardContent>
        {grid ? (
          <div className="service-card-content-grid">{children}</div>
        ) : (
          children
        )}
      </ServiceCardContent>
    </Card>
  );
}

function SearchTextField({
  id,
  label,
  placeholder,
  value,
  onChange,
}: FieldProps & {
  id: string;
  label: string;
  placeholder: string;
}) {
  return (
    <div className="service-card-row-item">
      <ServiceLabel htmlFor={id}>{label}</ServiceLabel>
      <ServiceInput
        id={id}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
        }}
      />
    </div>
  );
}

export function KeywordCard({ value, onChange }: FieldProps) {
  return (
    <SearchCard title="Keyword">
      <SearchTextField
        id="keyword"
        label="Keyword"
        placeholder="Search term"
        value={value}
        onChange={onChange}
      />
    </SearchCard>
  );
}

export function PathogenCard({ value, onChange }: FieldProps) {
  return (
    <SearchCard title="Pathogen" grid>
      <SearchTextField
        id="taxon-name"
        label="Taxon Name"
        placeholder="e.g. Influenza A virus"
        value={value}
        onChange={onChange}
      />
    </SearchCard>
  );
}

export function GeographyCard({
  country,
  group,
  onGroupChange,
  countryValue,
  onCountryChange,
}: {
  country: "collection" | "isolation";
  group: string;
  onGroupChange: (value: string) => void;
  countryValue: string;
  onCountryChange: (value: string) => void;
}) {
  return (
    <SearchCard title="Geography" grid>
      <SearchTextField
        id="geographic-group"
        label="Geographic Group"
        placeholder="e.g. Asia"
        value={group}
        onChange={onGroupChange}
      />
      <SearchTextField
        id={`${country}-country`}
        label={country === "collection" ? "Collection Country" : "Isolation Country"}
        placeholder="e.g. China"
        value={countryValue}
        onChange={onCountryChange}
      />
    </SearchCard>
  );
}

const datePlaceholder = "YYYY or YYYY-MM or YYYY-MM-DD";

function RangeField({
  kind,
  edge,
  placeholder,
  value,
  onChange,
}: FieldProps & {
  kind: "year" | "date";
  edge: "from" | "to";
  placeholder: string;
}) {
  const id = `${kind}-${edge}`;
  const yearProps = kind === "year" ? { type: "number", min: 1900, max: 2100 } : {};
  return (
    <div className="service-card-row-item">
      <ServiceLabel htmlFor={id}>{edge === "from" ? "From" : "To"}</ServiceLabel>
      <ServiceInput
        id={id}
        {...yearProps}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
        }}
      />
    </div>
  );
}

export function RangeCard({
  kind,
  from,
  to,
  onFromChange,
  onToChange,
}: {
  kind: "year" | "date";
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
}) {
  const isYear = kind === "year";
  return (
    <SearchCard title={isYear ? "Collection Year" : "Collection Date"} grid>
      <RangeField
        kind={kind}
        edge="from"
        placeholder={isYear ? "e.g. 2010" : datePlaceholder}
        value={from}
        onChange={onFromChange}
      />
      <RangeField
        kind={kind}
        edge="to"
        placeholder={isYear ? "e.g. 2024" : datePlaceholder}
        value={to}
        onChange={onToChange}
      />
    </SearchCard>
  );
}
