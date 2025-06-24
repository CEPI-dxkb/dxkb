import React from "react";
import FooterHeader from "@/components/headers/footer-header";
import Image from "next/image";

const institutions = [
  {
    name: "University of Chicago",
    image: "/logos/uc_logo.png",
  },
  {
    name: "University of Texas at Austin",
    image: "/logos/ut-austin.png",
  },
  {
    name: "University of Texas Medical Branch",
    image: "/logos/utmb-logo.png",
  },
];

const teamMembers = [
  {
    name: "John Doe",
    role: "CEO",
    image: "/images/team/placeholder-pfp.jpg",
  },
  {
    name: "Jane Doe",
    role: "CTO",
    image: "/images/team/placeholder-pfp.jpg",
  },
  {
    name: "John Smith",
    role: "CFO",
    image: "/images/team/placeholder-pfp.jpg",
  },
  {
    name: "Jane Smith",
    role: "COO",
    image: "/images/team/placeholder-pfp.jpg",
  },
  {
    name: "John Doe 2",
    role: "CEO",
    image: "/images/team/placeholder-pfp.jpg",
  },
  {
    name: "Jane Doe 2",
    role: "CTO",
    image: "/images/team/placeholder-pfp.jpg",
  },
  {
    name: "John Smith 2",
    role: "CFO",
    image: "/images/team/placeholder-pfp.jpg",
  },
  {
    name: "Jane Smith 2",
    role: "COO",
    image: "/images/team/placeholder-pfp.jpg",
  },
];

const Team = () => {
  return (
    <div id="team-container" className="flex w-full flex-col items-center">
      <FooterHeader title="Our Team" />
      {institutions.map((institution) => (
        <div className="team-section" key={institution.name}>
          <div
            id={`${institution.name.toLowerCase().replace(/\s+/g, "-")}-team`}
            className="container mx-auto flex w-full flex-col items-center justify-center gap-6 text-sm sm:gap-8 md:text-lg bg-card rounded-lg p-4 border shadow-lg"
          >
            <div className="relative h-[75px] w-full max-w-[300px] sm:h-[100px] sm:max-w-[400px]">
              <Image
                src={institution.image}
                alt={`${institution.name} Logo`}
                fill
                className="object-contain"
                priority
              />
            </div>
            <div
              id={`${institution.name.toLowerCase().replace(/\s+/g, "-")}-team-members`}
              className="container mx-auto grid w-full grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 md:grid-cols-4 md:gap-8 lg:grid-cols-6"
            >
              {teamMembers.map((member) => (
                <div
                  key={member.name.toLowerCase().replace(/\s+/g, "-")}
                  className="team-member bg-background rounded-lg p-2 shadow-sm transition-shadow duration-200 hover:shadow-md sm:p-4"
                >
                  <div className="relative aspect-square w-full overflow-hidden rounded-full">
                    <Image
                      src={member.image}
                      alt={member.name}
                      className="object-cover"
                      fill
                      sizes="(max-width: 640px) 120px, (max-width: 768px) 140px, (max-width: 1024px) 160px, 180px"
                    />
                  </div>
                  <h3 className="mt-2 text-center font-semibold">
                    {member.name}
                  </h3>
                  <p className="text-muted-foreground text-center text-sm">
                    {member.role}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default Team;
