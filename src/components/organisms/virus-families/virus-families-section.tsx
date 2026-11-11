import { GeneraCard } from "@/components/organisms/genera-grid/genera-card";
import { taxonomyHref as familyHref } from "@/lib/views/hrefs";
import { cn } from "@/lib/utils";

import { type VirusFamiliesColumn, virusFamilies } from "./virus-families-data";

type VirusFamilySubGroup = Extract<
  VirusFamiliesColumn,
  { group: null }
>["subGroups"][number];

function SubGroups({ subGroups }: { subGroups: VirusFamilySubGroup[] }) {
  return (
    <>
      {subGroups.map((subGroup) => (
        <div key={subGroup.label} className="flex flex-col gap-3">
          <h3 className="px-0.5 text-sm font-semibold text-muted-foreground">
            {subGroup.label}
          </h3>
          <div className="flex flex-col gap-2">
            {subGroup.families.map((family) => (
              <GeneraCard
                key={family.name}
                name={family.name}
                href={familyHref(family.taxonId)}
                viewLabel="overview"
              />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

export function VirusFamiliesSection() {
  // col3 is the mixed group: below DS-DNA at lg, its own 4th column at xl+.
  const col3 = virusFamilies[3];

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-2xl font-semibold tracking-normal">
          Virus Families
        </h2>
        <p className="text-base text-muted-foreground">
          Common viral family groupings organized by genome type.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {virusFamilies.map((column, index) => (
          <div
            key={
              column.group ??
              column.subGroups.map((group) => group.label).join("|")
            }
            className={cn(
              "flex min-w-0 flex-col gap-3",
              index === 3 && "hidden md:flex lg:hidden xl:flex",
            )}
          >
            {column.group === null ? (
              <SubGroups subGroups={column.subGroups} />
            ) : (
              <>
                <h3 className="px-0.5 text-sm font-semibold text-muted-foreground">
                  {column.group}
                </h3>
                <div className="flex flex-col gap-2">
                  {column.families.map((family) => (
                    <GeneraCard
                      key={family.name}
                      name={family.name}
                      href={familyHref(family.taxonId)}
                    />
                  ))}
                </div>
                {index === 2 && col3.group === null && (
                  <div className="hidden flex-col gap-3 lg:flex xl:hidden">
                    <SubGroups subGroups={col3.subGroups} />
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
