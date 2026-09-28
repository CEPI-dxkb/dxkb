import Link from "next/link";

import FooterHeader from "@/components/headers/footer-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Publication {
  title: string;
  url: string;
  authors: string;
  doi: string;
}

interface PublicationYear {
  year: string;
  publications: Publication[];
}

const publicationsByYear: PublicationYear[] = [
  {
    year: "2025",
    publications: [
      {
        title:
          "Scalable Agentic Reasoning for Designing Biologics Targeting Intrinsically Disordered Proteins",
        url: "https://dl.acm.org/doi/10.1145/3815572.3815764",
        authors:
          "Matthew Sinclair, Moeen Meigooni, Archit Vasan, Ozan Gokdemir, Xinran Lian, Heng Ma, Yadu Babuji, Alexander Brace, Khalid Hossain, Carlo Siebenschuh, Thomas Brettin, Kyle Chard, Christopher Henry, Daniel Schabacker, Venkatram Vishwanath, Rick Stevens, Ian Foster, Arvind Ramanathan",
        doi: "10.1145/3815572.3815764",
      },
      {
        title: "High-resolution in situ structures of hantavirus glycoprotein tetramers",
        url: "https://www.biorxiv.org/content/10.1101/2025.06.17.660152v1",
        authors:
          "Luqiang Guo, Elizabeth McFadden, Megan M. Slough, E. Taylor Stone, Jacob Berrigan, Eva Mittler, Kiara Hatzakis, Troy Hinkley, Heather S. Kain, Zunlong Ke, Nikole L. Warner, Jesse H. Erasmus, Kartik Chandran, Jason S. McLellan",
        doi: "10.1101/2025.06.17.660152",
      },
    ],
  },
  {
    year: "2024",
    publications: [
      {
        title:
          "MProt-DPO: Breaking the ExaFLOPS Barrier for Multimodal Protein Design Workflows with Direct Preference Optimization",
        url: "https://ieeexplore.ieee.org/stamp/stamp.jsp?tp=&arnumber=10793126&tag=1",
        authors:
          "Gautham Dharuman, Kyle Hippe, Alexander Brace, Sam Foreman, Vain Hatanp, Varuni K. Sastry, Huihuo Zheng, Logan Ward, Servesh Muralidharan, Archit Vasan, Bharat Kale, Carla M. Mann, Heng Ma, Yun-Hsuan Cheng, Yuliana Zamora, Shengchao Liu, Chaowei Xiao, Murali Emani, Tom Gibbs, Mahidhar Tatineni, Deepak Canchi, Jerome Mitchell, Koichi Yamada, Maria Garzaran, Michael E. Papka, Ian Foster, Rick Stevens, Anima Anandkumar, Venkatram Vishwanath, Arvind Ramanathan",
        doi: "10.1109/SC41406.2024.00013",
      },
    ],
  },
];

export default function PublicationsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <FooterHeader title="Publications" />
      <section className="container mx-auto max-w-4xl px-4 py-10 md:px-6">
        <div className="flex flex-col gap-8">
          <h2 className="text-lg font-semibold text-foreground">
            Research publications that have utilized DXKB resources.
          </h2>

          {publicationsByYear.map(({ year, publications }) => (
            <Card key={year}>
              <CardHeader>
                <CardTitle>{year}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6 text-sm leading-relaxed">
                  {publications.map((publication) => (
                    <div key={publication.doi} className="space-y-1">
                      <Link
                        href={publication.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-primary hover:underline"
                      >
                        {publication.title}
                      </Link>
                      <p className="text-muted-foreground">{publication.authors}</p>
                      <p>
                        DOI:{" "}
                        <Link
                          href={`https://doi.org/${publication.doi}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline"
                        >
                          {publication.doi}
                        </Link>
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}

          <p className="text-sm text-muted-foreground">
            Looking for more? Explore additional publications on{" "}
            <Link
              href="https://scholar.google.com/citations?hl=en&user=wtbrhBgAAAAJ&view_op=list_works&sortby=pubdate"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              Google Scholar
            </Link>
            .
          </p>
        </div>
      </section>
    </div>
  );
}
