import FooterHeader from "@/components/headers/footer-header";
import Link from "next/link";
import { fetchCepiNews, type CepiNewsItem } from "@/lib/cepi-news";
import { NewsCardImage } from "./news-card-image";

const fallbackNews: CepiNewsItem[] = [
  {
    title: "Measles Cases and Outbreaks",
    description:
      "As of March 27, 2025, a total of 483 confirmed measles cases were reported by 20 jurisdictions across the United States.",
    image: "https://www.cdc.gov/measles/media/images/Measles-World-Map-Travel.jpg",
    url: "https://www.cdc.gov/measles/data-research/index.html#cdc_data_surveillance_section_10-measles-cases-in-2025",
    date: "2025-03-27",
  },
  {
    title: "Close Relative of Highly Fatal Coronavirus Discovered in Brazil's Bats",
    description:
      "Brazil's bats are harboring a vast and diverse pool of coronaviruses, a new study finds, including a newly identified strain that may pose a danger to human health in the years to come.",
    image: "https://www.sciencealert.com/images/2025/03/MMolossus.jpg",
    url: "https://www.sciencealert.com/close-relative-of-highly-fatal-coronavirus-discovered-in-brazils-bats",
    date: "2025-03-01",
  },
];

const NewsCard = ({ title, description, image, url }: CepiNewsItem) => (
  <Link href={url} target="_blank" rel="noopener noreferrer" className="card-base group">
    <div className="card-image">
      <NewsCardImage src={image} alt={title} />
    </div>
    <div className="card-content">
      <h3 className="card-title">{title}</h3>
      <p className="card-description">{description}</p>
    </div>
  </Link>
);

const News = async () => {
  const items = await fetchCepiNews(3);
  const news = items.length > 0 ? items : fallbackNews;

  return (
    <div className="flex w-full flex-col items-center">
      <FooterHeader title="News" />

      <div className="card-container">
        <section>
          <h2 className="section-title">Latest News</h2>
          <div className="card-grid-three">
            {news.map((item) => (
              <NewsCard key={item.url} {...item} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default News;
