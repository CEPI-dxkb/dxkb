import React, { useState } from "react";
import Image from "next/image";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

const newsItems = [
  {
    image: "https://images.unsplash.com/photo-1532187863486-abf9dbad1b69",
    title: "Research Update",
    section: "Latest Findings",
    description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco...",
  },
  {
    image: "https://images.unsplash.com/photo-1576086213369-97a306d36557",
    title: "New Features",
    section: "Platform Updates",
    description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco...",
  },
  {
    image: "https://images.unsplash.com/photo-1475906089153-644d9452ce87",
    title: "Community Spotlight",
    section: "Research Community",
    description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco...",
  },
  {
    image: "https://plus.unsplash.com/premium_photo-1674850274929-5c4468358a9e",
    title: "Latest Discovery",
    section: "Breakthrough",
    description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco...",
  },
  {
    image: "https://images.unsplash.com/photo-1576086213369-97a306d36557",
    title: "New Research Methods",
    section: "Methodology",
    description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco...",
  },
];

const OldNews = () => {
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 4;
  const totalPages = Math.ceil(newsItems.length / itemsPerPage);

  const getCurrentPageItems = () => {
    const start = currentPage * itemsPerPage;
    return newsItems.slice(start, start + itemsPerPage);
  };

  return (
    <section className="py-8 px-4">
      <h3 className="text-2xl font-bold text-center mb-6">News</h3>
      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-4 gap-6">
          {getCurrentPageItems().map((item, index) => (
            <Card key={`${currentPage}-${index}`} className="overflow-hidden">
              <div className="relative h-48">
                <Image
                  src={item.image}
                  alt={item.title}
                  fill
                  className="object-cover"
                />
              </div>
              <div className="p-4">
                <h4 className="font-bold">{item.title}</h4>
                <p className="text-sm text-gray-600 mb-2">{item.section}</p>
                <p className="text-sm text-gray-700 line-clamp-3">
                  {item.description}
                </p>
              </div>
            </Card>
          ))}
        </div>

        <div className="flex justify-center items-center gap-4 mt-8">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
            disabled={currentPage === 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <span className="text-sm">
            Page {currentPage + 1} of {totalPages}
          </span>

          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
            disabled={currentPage === totalPages - 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>
  )
}

export default OldNews;

