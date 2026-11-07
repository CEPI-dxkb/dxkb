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

/** A titled card; `grid` wraps the children in the two-column content grid. */
export function SearchCard({
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

/** A labelled text input row (`service-card-row-item`). */
export function SearchTextField({
  id,
  label,
  placeholder,
  value,
  onChange,
  className = "service-card-row-item",
}: FieldProps & {
  id: string;
  label: string;
  placeholder: string;
  className?: string;
}) {
  return (
    <div className={className}>
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

/** From/To card: `year` uses bounded number inputs, `date` free-text dates. */
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
      <div className="service-card-row-item">
        <ServiceLabel htmlFor={`${kind}-from`}>From</ServiceLabel>
        {isYear ? (
          <ServiceInput
            id="year-from"
            type="number"
            min={1900}
            max={2100}
            placeholder="e.g. 2010"
            value={from}
            onChange={(e) => {
              onFromChange(e.target.value);
            }}
          />
        ) : (
          <ServiceInput
            id="date-from"
            placeholder={datePlaceholder}
            value={from}
            onChange={(e) => {
              onFromChange(e.target.value);
            }}
          />
        )}
      </div>
      <div className="service-card-row-item">
        <ServiceLabel htmlFor={`${kind}-to`}>To</ServiceLabel>
        {isYear ? (
          <ServiceInput
            id="year-to"
            type="number"
            min={1900}
            max={2100}
            placeholder="e.g. 2024"
            value={to}
            onChange={(e) => {
              onToChange(e.target.value);
            }}
          />
        ) : (
          <ServiceInput
            id="date-to"
            placeholder={datePlaceholder}
            value={to}
            onChange={(e) => {
              onToChange(e.target.value);
            }}
          />
        )}
      </div>
    </SearchCard>
  );
}

const datePlaceholder = "YYYY or YYYY-MM or YYYY-MM-DD";
