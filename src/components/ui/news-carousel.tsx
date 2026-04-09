import { Card, CardContent } from "@/components/ui/card"
import Image from "next/image";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"

const newsItems = [
  {
    image: "https://images.unsplash.com/photo-1532187863486-abf9dbad1b69",
    title: "Research Update",
    section: "Latest Findings",
    description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco...",
    link: "/news"
  },
  {
    image: "https://images.unsplash.com/photo-1576086213369-97a306d36557",
    title: "New Features",
    section: "Platform Updates",
    description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco...",
    link: "/news"
  },
  {
    image: "https://images.unsplash.com/photo-1475906089153-644d9452ce87",
    title: "Community Spotlight",
    section: "Research Community",
    description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco...",
    link: "/news"
  },
  {
    image: "https://plus.unsplash.com/premium_photo-1674850274929-5c4468358a9e",
    title: "Latest Discovery",
    section: "Breakthrough",
    description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco...",
    link: "/news"
  },
  {
    image: "https://plus.unsplash.com/premium_photo-1661515590895-e2f4d9d16fbb",
    title: "New Research Methods",
    section: "Methodology",
    description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco...",
    link: "/news"
  },
];

const NewsCarousel = () => {
  return (
    <section id="news-carousel-container" className="items-center max-w-7xl mx-auto my-16">
      <h3 className="text-2xl font-bold text-center mb-6">News</h3>

      <Carousel
        opts={{
          align: "start",
          loop: false,
        }}
        className="mx-16"
      >
        <CarouselContent className="-ml-2 md:-ml-4">
          {newsItems.map((item, index) => (
            <CarouselItem key={index} className="pl-2 md:pl-4 md:basis-1/2 lg:basis-1/4">
              <div className="p-1">
                <Card className="h-96 w-full overflow-hidden p-0">
                  <CardContent id={`news-card-${index}`} className="flex flex-col aspect-square w-full h-full p-0">
                    <div className="h-2/3 w-full relative" id={`news-image-${index}`}>
                      <Image
                        src={item.image}
                        alt={item.title}
                        quality={80}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        className="object-cover"
                        priority={index === 0}
                      />
                    </div>
                    <div className="p-4">
                      <a href={item.link} className="news-link">
                        <h4 className="font-bold">{item.title}</h4>
                      </a>
                      <p className="text-sm text-foreground mb-2">{item.section}</p>
                      <p className="text-sm text-muted-foreground line-clamp-3">
                        {item.description}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>
    </section>
  )
}

export default NewsCarousel;
