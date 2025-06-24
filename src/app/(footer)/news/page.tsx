import React from "react";
import FooterHeader from "@/components/headers/footer-header";
import Image from "next/image";
import Link from "next/link";

interface NewsCard {
  title: string;
  description: string;
  image: string;
  url: string;
}

const topNews: NewsCard[] = [
  {
    title: "Measles Cases and Outbreaks",
    description:
      "As of March 27, 2025, a total of 483 confirmed* measles cases were reported by 20 jurisdictions: Alaska, California, Florida, Georgia, Kansas, Kentucky, Maryland, Michigan, Minnesota, New Jersey, New Mexico, New York City, New York State, Ohio, Pennsylvania, Rhode Island, Tennessee, Texas, Vermont, and Washington.",
    image:
      "https://www.cdc.gov/measles/media/images/Measles-World-Map-Travel.jpg",
    url: "https://www.cdc.gov/measles/data-research/index.html#cdc_data_surveillance_section_10-measles-cases-in-2025",
  },
  {
    title:
      "MONSTER Bird Flu Update: Unprecedented Mammal-to-Mammal Transmission Confirmed",
    description:
      "Mammal-to-mammal gain-of-function — the newfound ability to transmit between mammals — has always seemed inevitable, given that the biomedical security state is literally funding gain-of-function research on viruses in clandestine labs all over the world, fully immune from oversight.",
    image:
      "https://media.townhall.com/cdn/hodl/2018/221/61b03a15-3bcd-4c49-8f5d-f8d47a97f7a3-1052x615.jpg",
    url: "https://pjmedia.com/benbartee/2025/03/18/monster-bird-flu-update-unprecedented-mammal-to-mammal-transmission-confirmed-n4938014",
  },
];

const moreNews: NewsCard[] = [
  {
    title:
      "Influenza A viruses adapt shape in response to environmental pressures",
    description: "NIH study identifies previously unknown adaptation.",
    image:
      "https://www.nih.gov/sites/default/files/styles/thumbnail_large/public/2025-05/20250509-nutrition_0.jpg",
    url: "https://www.nih.gov/news-events/news-releases/fda-nih-announce-innovative-joint-nutrition-regulatory-science-program",
  },
  {
    title:
      "NASA’s SPHEREx Takes First Images, Preps to Study Millions of Galaxies",
    description:
      "Processed with rainbow hues to represent a range of infrared wavelengths, the new pictures indicate the astrophysics space observatory is working as expected.",
    image:
      "https://d2pn8kiwq2w21t.cloudfront.net/images/1-PIA26280-SPHEREx-cropped.width-1320.jpg",
    url: "https://www.jpl.nasa.gov/news/nasas-spherex-takes-first-images-preps-to-study-millions-of-galaxies/",
  },
  {
    title:
      "Close Relative of Highly Fatal Coronavirus Discovered in Brazil's Bats",
    description:
      "Brazil's bats are harboring a vast and diverse pool of coronaviruses, a new study finds, including a newly identified strain that may pose a danger to human health in the years to come.",
    image: "https://www.sciencealert.com/images/2025/03/MMolossus.jpg",
    url: "https://www.sciencealert.com/close-relative-of-highly-fatal-coronavirus-discovered-in-brazils-bats#",
  },
];

const NewsCard = ({ title, description, image, url }: NewsCard) => (
  <Link href={url} target="_blank" className="card-base group">
    <div className="card-image">
      <Image src={image} alt={title} fill className="object-cover" />
    </div>
    <div className="card-content">
      <h3 className="card-title">{title}</h3>
      <p className="card-description">{description}</p>
    </div>
  </Link>
);

const News = () => {
  return (
    <div className="flex w-full flex-col items-center">
      <FooterHeader title="News" />

      <div className="card-container">
        {/* Top News */}
        <section>
          <h2 className="section-title">Top News</h2>
          <div className="card-grid-two">
            {topNews.map((news) => (
              <NewsCard key={news.title} {...news} />
            ))}
          </div>
        </section>

        {/* More News */}
        <section>
          <h2 className="section-title">More News</h2>
          <div className="card-grid-three">
            {moreNews.map((news) => (
              <NewsCard key={news.title} {...news} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default News;
