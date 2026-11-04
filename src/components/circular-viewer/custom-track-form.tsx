"use client";

import { CircleHelp, Plus } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  isCustomFeatureType,
  isCustomStrand,
  maxKeywordLength,
  type CustomFeatureType,
  type CustomStrand,
  type CustomTrackQuery,
} from "@/lib/circular-viewer/contract";

const typeItems: Record<CustomFeatureType, string> = { CDS: "CDS", RNA: "RNA", Miscellaneous: "Misc" };
const strandItems: Record<CustomStrand, string> = { both: "Both", forward: "Forward", reverse: "Reverse" };

/** Legacy `TrackController`'s "Add custom tracks" section. */
export function CustomTrackForm({ onAdd }: { onAdd: (query: CustomTrackQuery, name: string) => void }) {
  const id = useId();
  const [type, setType] = useState<CustomFeatureType | null>(null);
  const [strand, setStrand] = useState<CustomStrand | null>(null);
  const [keyword, setKeyword] = useState("");
  const [name, setName] = useState("");
  const ready = type !== null && strand !== null && keyword.trim() !== "";
  return (
    <form
      aria-labelledby={`${id}-title`}
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (type === null || strand === null || keyword.trim() === "") return;
        onAdd({ type, strand, keyword: keyword.trim() }, name);
        setKeyword("");
        setName("");
      }}
    >
      {/* A heading or label sits 8px above its control; fields are 12px apart. */}
      <div className="space-y-2">
        <div className="flex h-6 items-center gap-1">
          <h2 id={`${id}-title`} className="text-base font-semibold">Add custom tracks</h2>
          <Popover>
            <PopoverTrigger
              render={
                <Button variant="ghost" size="icon-xs" aria-label="About custom tracks">
                  <CircleHelp className="size-4" />
                </Button>
              }
            />
            <PopoverContent className="w-72">
              <p className="text-xs">
                Add custom tracks by selecting feature type, strand and keywords to show genes of
                interest. For example: secretion, membrane, or transposon OR transposase OR insertion
                OR mobile.
              </p>
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex gap-2">
          <Select
            items={typeItems}
            value={type}
            onValueChange={(value) => {
              setType(isCustomFeatureType(value) ? value : null);
            }}
          >
            <SelectTrigger size="sm" aria-label="Feature type" className="flex-1">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {Object.entries(typeItems).map(([value, text]) => (
                  <SelectItem key={value} value={value}>{text}</SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Select
            items={strandItems}
            value={strand}
            onValueChange={(value) => {
              setStrand(isCustomStrand(value) ? value : null);
            }}
          >
            <SelectTrigger size="sm" aria-label="Strand" className="flex-1">
              <SelectValue placeholder="Strand" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {Object.entries(strandItems).map(([value, text]) => (
                  <SelectItem key={value} value={value}>{text}</SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${id}-keyword`}>Keyword</Label>
        <Input
          id={`${id}-keyword`}
          value={keyword}
          maxLength={maxKeywordLength}
          placeholder="secretion"
          onChange={(event) => {
            setKeyword(event.target.value);
          }}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${id}-name`}>Track name (optional)</Label>
        {/* The service forms' inline add button (`ServiceAddButton`'s look), but a
            submit: Enter in a field adds the track too. */}
        <div className="flex gap-2">
          <Input
            id={`${id}-name`}
            value={name}
            placeholder="Defaults to the keyword"
            onChange={(event) => {
              setName(event.target.value);
            }}
          />
          <Button type="submit" variant="soft" size="icon" aria-label="Add custom track" disabled={!ready}>
            <Plus />
          </Button>
        </div>
      </div>
    </form>
  );
}
