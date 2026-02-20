import FooterHeader from "@/components/headers/footer-header";
import Image from "next/image";
import Link from "next/link";

interface ResourceCard {
  title: string;
  subtitle: string;
  image: string;
  url: string;
}

const resourceCenters: ResourceCard[] = [
  {
    title: "UChicago CASE",
    subtitle: "University of Chicago Consortium for Advanced Science and Engineering",
    image: "/images/websites/uchicago-case.png",
    url: "https://researchdevelopment.uchicago.edu/uchicago-case/",
  },
  {
    title: "BV-BRC",
    subtitle: "Bacterial and Viral Bioinformatics Resource Center",
    image: "/images/websites/bv-brc.png",
    url: "https://www.bv-brc.org",
  },
  {
    title: "CEPI",
    subtitle: "Coalition for Epidemic Preparedness Innovations",
    image: "/images/websites/cepi.png",
    url: "https://cepi.net",
  },
];

const relatedWebsites: ResourceCard[] = [
  {
    title: "NIH",
    subtitle: "National Institute of Allergy and Infectious Diseases",
    image: "/images/websites/nih.png",
    url: "https://www.niaid.nih.gov",
  },
  {
    title: "PDN",
    subtitle: "Pathogen Data Network",
    image: "/images/websites/pdn.png",
    url: "https://pathogendatanetwork.org/",
  },
  {
    title: "CEIRR",
    subtitle: "Centers of Excellence for Influenza Research and Response",
    image: "/images/websites/ceirr.png",
    url: "https://www.ceirr-network.org",
  },
  {
    title: "KBase",
    subtitle: "The knowledge creation and discovery environment for systems biology.",
    image: "/images/websites/kbase.png",
    url: "https://www.kbase.us",
  },
];

const ResourceCard = ({ title, subtitle, image, url }: ResourceCard) => (
  <Link href={url} target="_blank" className="card-base group">
    <div className="card-image">
      <Image
        src={image}
        alt={title}
        fill
        className="object-cover items-center justify-center"
      />
    </div>
    <div className="card-content">
      <h3 className="card-title">{title}</h3>
      <p className="card-description">{subtitle}</p>
    </div>
  </Link>
);

const RelatedResources = () => {
  return (
    <div className="flex w-full flex-col items-center">
      <FooterHeader title="Related Resources" />

      <div className="card-container">
        {/* Disease X/CEPI Resource Centers */}
        <section>
          <h2 className="section-title">
            Disease X/CEPI Resource Centers
          </h2>
          <div className="card-grid-three">
            {resourceCenters.map((resource) => (
              <ResourceCard key={resource.title} {...resource} />
            ))}
          </div>
        </section>

        {/* Related Websites */}
        <section>
          <h2 className="section-title">
            Related Websites
          </h2>
          <div className="card-grid-four">
            {relatedWebsites.map((resource) => (
              <ResourceCard key={resource.title} {...resource} />
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

export default RelatedResources;
