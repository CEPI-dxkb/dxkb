import React from "react";
import FooterHeader from "@/components/headers/footer-header";
import Image from "next/image";

const institutions = [
  {
    id: "uchicago",
    name: "University of Chicago",
    image: "/logos/institutions/uc_logo.png",
  },
  {
    id: "ut-austin",
    name: "University of Texas at Austin",
    image: "/logos/institutions/ut-austin.png",
  },
  {
    id: "utmb",
    name: "University of Texas Medical Branch",
    image: "/logos/institutions/utmb-logo.png",
  },
  {
    id: "la-jolla",
    name: "La Jolla Institute for Immunology",
    image: "/logos/institutions/lajolla-logo.png",
  },
  {
    id: "jcvi",
    name: "J. Craig Venter Institute",
    image: "/logos/institutions/jcvi-logo.png",
  },
  {
    id: "hmri",
    name: "Houston Methodist Research Institute",
    image: "/logos/institutions/hmri-logo.png",
  },
];

const teamMembers = [
  {
    name: "Rick Stevens",
    role: "Co-Investigator",
    institutionId: "uchicago",
    bioLink: "https://cs.uchicago.edu/people/rick-stevens/",
  },
  {
    name: "Alex Brace",
    institutionId: "uchicago",
  },
  {
    name: "Alex Partin",
    institutionId: "uchicago",
  },
  {
    name: "Andreas Wilke",
    institutionId: "uchicago",
  },
  {
    name: "Arvind Ramanathan",
    institutionId: "uchicago",
  },
  {
    name: "Bharat Kale",
    institutionId: "uchicago",
  },
  {
    name: "Bob Olson",
    institutionId: "uchicago",
  },
  {
    name: "Brian Hsu",
    institutionId: "uchicago",
  },
  {
    name: "Bruce Parrello",
    institutionId: "uchicago",
  },
  {
    name: "Carla Mann",
    institutionId: "uchicago",
  },
  {
    name: "Chris Escobar",
    institutionId: "uchicago",
  },
  {
    name: "Christian Seitz",
    institutionId: "uchicago",
  },
  {
    name: "Clark Cucinell",
    institutionId: "uchicago",
  },
  {
    name: "Dovie Gelerinter",
    institutionId: "uchicago",
  },
  {
    name: "Heng Ma",
    institutionId: "uchicago",
  },
  {
    name: "James Davis",
    institutionId: "uchicago",
  },
  {
    name: "Jamie Overbeek",
    institutionId: "uchicago",
  },
  {
    name: "Justin Podowski",
    institutionId: "uchicago",
  },
  {
    name: "Kyle Hippe",
    institutionId: "uchicago",
  },
  {
    name: "Marcus Nguyen",
    institutionId: "uchicago",
  },
  {
    name: "Maulik Shukla",
    institutionId: "uchicago",
  },
  {
    name: "Nick Chia",
    institutionId: "uchicago",
  },
  {
    name: "Nicole Bowers",
    institutionId: "uchicago",
  },
  {
    name: "Ozan Gokdemir",
    institutionId: "uchicago",
  },
  {
    name: "Thomas Brettin",
    institutionId: "uchicago",
  },
  {
    name: "Jason McLellan",
    role: "Co-Investigator",
    institutionId: "ut-austin",
    bioLink: "https://molecularbiosci.utexas.edu/directory/jason-mclellan",
  },
  {
    name: "Nasim Abdi",
    institutionId: "ut-austin",
  },
  {
    name: "Nicole Johnson",
    institutionId: "ut-austin",
  },
  {
    name: "Scott Weaver",
    role: "Co-Investigator",
    institutionId: "utmb",
    bioLink: "https://www.utmb.edu/scsb/bios/scott-c-weaver-phd",
  },
  {
    name: "Alexander Freiberg",
    institutionId: "utmb",
  },
  {
    name: "Alessandro Sette",
    role: "Co-Investigator",
    institutionId: "la-jolla",
    bioLink: "https://www.lji.org/labs/sette-lab/",
  },
  {
    name: "Alba Grifoni",
    institutionId: "la-jolla",
  },
  {
    name: "Gene Tan",
    role: "Co-Investigator",
    institutionId: "jcvi",
  },
  {
    name: "Abril Zuniga",
    institutionId: "jcvi",
  },
  {
    name: "Christian Zmasek",
    institutionId: "jcvi",
  },
  {
    name: "Max Qian",
    institutionId: "jcvi",
  },
  {
    name: "Jimmy Gollihar",
    role: "Principal Investigator",
    institutionId: "hmri",
    bioLink: "https://scholars.houstonmethodist.org/en/persons/jimmy-gollihar/",
  },
  {
    name: "Adalia Brixen",
    institutionId: "hmri",
  },
  {
    name: "Andrew P Horton",
    institutionId: "hmri",
  },
  {
    name: "Daniel Kluttz",
    institutionId: "hmri",
  },
  {
    name: "Daniel R Boutz",
    institutionId: "hmri",
  },
  {
    name: "Jon Corral",
    institutionId: "hmri",
  },
  {
    name: "Kameka Johnson",
    institutionId: "hmri",
  },
  {
    name: "Kenneth Roman",
    institutionId: "hmri",
  },
  {
    name: "Michelle Byrom",
    institutionId: "hmri",
  },
  {
    name: "Omar Daher",
    institutionId: "hmri",
  },
  {
    name: "Philipp Ilinykh",
    institutionId: "hmri",
  },
  {
    name: "Raghav Shroff",
    institutionId: "hmri",
  },
  {
    name: "Shaunak Kar",
    institutionId: "hmri",
  },
  {
    name: "Thomas H Segall-Shapiro",
    institutionId: "hmri",
  },
];

if (process.env.NODE_ENV !== "production") {
  const institutionIds = new Set(
    institutions.map((institution) => institution.id),
  );
  const orphans = teamMembers.filter(
    (member) => !institutionIds.has(member.institutionId),
  );
  if (orphans.length > 0) {
    console.warn(
      `[team] ${String(orphans.length)} member(s) reference an unknown institutionId and will not render: ${orphans
        .map((member) => `${member.name} (${member.institutionId})`)
        .join(", ")}`,
    );
  }
}

const MemberName = ({
  member,
}: {
  member: { name: string; bioLink?: string };
}) =>
  member.bioLink ? (
    <a
      href={member.bioLink}
      target="_blank"
      rel="noopener noreferrer"
      className="font-semibold text-primary underline decoration-dotted underline-offset-4 hover:decoration-solid dark:text-link"
      aria-label={`${member.name} bio, opens in a new tab`}
    >
      {member.name}
    </a>
  ) : (
    <span className="font-semibold">{member.name}</span>
  );

const Team = () => {
  return (
    <div id="team-container" className="flex w-full flex-col items-center">
      <FooterHeader title="Our Team" />
      {institutions.map((institution) => (
        <div className="team-section" key={institution.name}>
          <div
            id={`${institution.name.toLowerCase().replace(/\s+/g, "-")}-team`}
            className="container mx-auto flex w-full flex-col items-center justify-center gap-3 rounded-lg border bg-card p-3 text-sm shadow-lg sm:gap-4 md:text-lg"
          >
            <div className="relative h-18 w-full max-w-75 sm:h-25 sm:max-w-100">
              <Image
                src={institution.image}
                alt={`${institution.name} Logo`}
                fill
                sizes="(min-width: 640px) 400px, 300px"
                className="object-contain"
                priority
              />
            </div>
            {(() => {
              const members = teamMembers.filter(
                (member) => member.institutionId === institution.id,
              );
              const titledMembers = members.filter((member) => member.role);
              const otherMembers = members.filter((member) => !member.role);
              const institutionSlug = institution.name
                .toLowerCase()
                .replace(/\s+/g, "-");
              return (
                <div
                  id={`${institutionSlug}-team-members`}
                  className="flex w-full flex-col items-center gap-4"
                >
                  {titledMembers.map((member) => (
                    <div
                      key={member.name.toLowerCase().replace(/\s+/g, "-")}
                      className="team-member text-center"
                    >
                      <MemberName member={member} />
                      <p className="text-sm text-muted-foreground">
                        {member.role}
                      </p>
                    </div>
                  ))}
                  {otherMembers.length > 0 && (
                    <div className="grid w-full grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
                      {otherMembers.map((member) => (
                        <div
                          key={member.name.toLowerCase().replace(/\s+/g, "-")}
                          className="team-member text-center"
                        >
                          <MemberName member={member} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      ))}
    </div>
  );
};

export default Team;
