import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function CitationsPage() {
  return (
    <section className="container mx-auto max-w-4xl px-4 py-10 md:px-6">
      <div className="flex flex-col gap-8">
        <h2 className="text-lg font-semibold text-foreground">
          How to cite DXKB and BV-BRC in your research publications and proposals.
        </h2>

        <Card>
          <CardHeader>
            <CardTitle>Citing DXKB</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm leading-relaxed">
              <p>
                If you use <strong>DXKB web resources</strong> to assist in research publications or proposals, please
                cite us as:
              </p>
              <p>
                The DiseaseX Knowledge Base (DXKB):{" "}
                <Link href="https://dxkb.org/" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                  https://dxkb.org
                </Link>
              </p>
              <p>
                In some circumstances, you may also wish to cite DXKB in the Acknowledgement section as follows: &ldquo;This
                project is supported by the Coalition for Epidemic Preparedness Innovations (CEPI) under the Disease X
                Program. We gratefully acknowledge CEPI&rsquo;s commitment to advancing global health security and its
                pivotal role in funding initiatives aimed at preventing and controlling infectious disease
                outbreaks.&rdquo;
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Citing BV-BRC</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm leading-relaxed">
              <p>
                If you use <strong>BV-BRC web resources</strong> to assist in research publications or proposals, please
                cite as:
              </p>
              <p>
                <Link
                  href="https://pubmed.ncbi.nlm.nih.gov/36350631/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  Introducing the Bacterial and Viral Bioinformatics Resource Center (BV-BRC): a resource combining
                  PATRIC, IRD and ViPR.
                </Link>
                <br />
                Olson RD, Assaf R, Brettin T, Conrad N, Cucinell C, Davis JJ, Dempsey DM, Dickerman A, Dietrich EM, Kenyon
                RW, Kuscuoglu M, Lefkowitz EJ, Lu J, Machi D, Macken C, Mao C, Niewiadomska A, Nguyen M, Olsen GJ, Overbeek
                JC, Parrello B, Parrello V, Porter JS, Pusch GD, Shukla M, Singh I, Stewart L, Tan G, Thomas C, VanOeffelen
                M, Vonstein V, Wallace ZS, Warren AS, Wattam AR, Xia F, Yoo H, Zhang Y, Zmasek CM, Scheuermann RH, Stevens
                RL.
                <br />
                Nucleic Acids Res. 2022 Nov 9:gkac1003. doi: 10.1093/nar/gkac1003. Epub ahead of print.
                <br />
                PMID:{" "}
                <Link
                  href="https://www.ncbi.nlm.nih.gov/pubmed/36350631"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  36350631
                </Link>
              </p>
              <p>
                The Bacterial and Viral Bioinformatics Resource Center (BV-BRC):{" "}
                <Link href="https://www.bv-brc.org/" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                  https://www.bv-brc.org
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contacting Us</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm leading-relaxed">
              <p>
                If your manuscript or abstract submission is accepted and cites DXKB, please notify us by sending an email
                to the following address, to help us track the resource usage.
              </p>
              <p>
                DXKB:{" "}
                <Link href="mailto:help@dxkb.org" className="text-primary underline">
                  help@dxkb.org
                </Link>
                <br />
                BV-BRC:{" "}
                <Link href="mailto:help@bv-brc.org" className="text-primary underline">
                  help@bv-brc.org
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
