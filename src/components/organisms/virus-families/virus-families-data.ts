export interface VirusPathogen {
  /** The name a non-expert would search for, e.g. "Dengue virus". */
  name: string;
  taxonId: number;
}

export interface VirusFamily {
  name: string;
  taxonId: number;
  /** Major human pathogens in the family; empty when it has none. */
  pathogens: VirusPathogen[];
  /** Shown in place of the list when `pathogens` is empty. */
  pathogenNote?: string;
}

interface VirusFamilyGroup {
  group: string;
  families: VirusFamily[];
}

interface VirusFamilySubGroup {
  label: string;
  families: VirusFamily[];
}

interface MixedVirusFamilyGroup {
  group: null;
  subGroups: VirusFamilySubGroup[];
}

export type VirusFamiliesColumn = VirusFamilyGroup | MixedVirusFamilyGroup;

export const virusFamilies: VirusFamiliesColumn[] = [
  {
    group: "Single-Stranded Positive-Sense RNA",
    families: [
      {
        name: "Caliciviridae",
        taxonId: 11974,
        pathogens: [
          { name: "Norovirus", taxonId: 142786 },
          { name: "Sapovirus", taxonId: 95341 },
        ],
      },
      {
        name: "Coronaviridae",
        taxonId: 11118,
        pathogens: [
          { name: "SARS-CoV-2", taxonId: 2697049 },
          { name: "SARS-CoV", taxonId: 2901879 },
          { name: "MERS-CoV", taxonId: 1335626 },
          { name: "Human coronavirus OC43", taxonId: 31631 },
          { name: "Human coronavirus HKU1", taxonId: 290028 },
          { name: "Human coronavirus 229E", taxonId: 11137 },
          { name: "Human coronavirus NL63", taxonId: 277944 },
        ],
      },
      {
        name: "Flaviviridae",
        taxonId: 11050,
        pathogens: [
          { name: "Dengue virus", taxonId: 3052464 },
          { name: "Zika virus", taxonId: 3048459 },
          { name: "Yellow fever virus", taxonId: 3046277 },
          { name: "West Nile virus", taxonId: 3048448 },
          { name: "Japanese encephalitis virus", taxonId: 3048158 },
          { name: "Tick-borne encephalitis virus", taxonId: 3052465 },
          { name: "Hepatitis C virus", taxonId: 3052230 },
        ],
      },
      {
        name: "Hepeviridae",
        taxonId: 291484,
        pathogens: [{ name: "Hepatitis E virus", taxonId: 1678143 }],
      },
      {
        name: "Picornaviridae",
        taxonId: 12058,
        pathogens: [
          { name: "Enteroviruses", taxonId: 12059 },
          { name: "Poliovirus", taxonId: 3428505 },
          { name: "Enterovirus A71", taxonId: 39054 },
          { name: "Enterovirus D68", taxonId: 42789 },
          { name: "Rhinovirus (common cold)", taxonId: 3428501 },
          { name: "Hepatitis A virus", taxonId: 3407641 },
        ],
      },
      {
        name: "Togaviridae",
        taxonId: 11018,
        pathogens: [
          { name: "Chikungunya virus", taxonId: 3426298 },
          { name: "Eastern equine encephalitis virus", taxonId: 3426299 },
          { name: "Venezuelan equine encephalitis virus", taxonId: 3426322 },
          { name: "Western equine encephalitis virus", taxonId: 3426323 },
          { name: "Ross River virus", taxonId: 3426314 },
          { name: "Mayaro virus", taxonId: 3426306 },
        ],
      },
    ],
  },
  {
    group: "Single-Stranded Negative-Sense RNA",
    families: [
      {
        name: "Bunyaviricetes",
        taxonId: 3151693,
        pathogens: [
          { name: "Hantaan virus", taxonId: 3052480 },
          { name: "Sin Nombre virus", taxonId: 3052499 },
          { name: "Crimean-Congo hemorrhagic fever virus", taxonId: 3052518 },
          { name: "Rift Valley fever virus", taxonId: 3052676 },
          { name: "Lassa virus", taxonId: 3052310 },
          { name: "La Crosse virus", taxonId: 3052409 },
        ],
      },
      {
        name: "Filoviridae",
        taxonId: 11266,
        pathogens: [
          { name: "Ebola virus", taxonId: 3052462 },
          { name: "Sudan virus", taxonId: 3052460 },
          { name: "Bundibugyo virus", taxonId: 3052458 },
          { name: "Marburg virus", taxonId: 3052505 },
        ],
      },
      {
        name: "Paramyxoviridae",
        taxonId: 11158,
        pathogens: [
          { name: "Measles virus", taxonId: 3052345 },
          { name: "Mumps virus", taxonId: 3052560 },
          { name: "Nipah virus", taxonId: 3052225 },
          { name: "Hendra virus", taxonId: 3052223 },
          { name: "Human parainfluenza virus 3", taxonId: 3049953 },
        ],
      },
      {
        name: "Orthomyxoviridae",
        taxonId: 11308,
        pathogens: [
          { name: "Influenza A virus", taxonId: 2955291 },
          { name: "Influenza B virus", taxonId: 2955465 },
          { name: "Influenza C virus", taxonId: 2955935 },
          { name: "Avian influenza H5N1", taxonId: 102793 },
        ],
      },
      {
        name: "Pneumoviridae",
        taxonId: 11244,
        pathogens: [
          { name: "Respiratory syncytial virus (RSV)", taxonId: 3049954 },
          { name: "Human metapneumovirus", taxonId: 3048148 },
        ],
      },
      {
        name: "Rhabdoviridae",
        taxonId: 11270,
        pathogens: [
          { name: "Rabies virus", taxonId: 11292 },
          { name: "Australian bat lyssavirus", taxonId: 90961 },
        ],
      },
    ],
  },
  {
    group: "Double-Stranded DNA",
    families: [
      {
        name: "Adenoviridae",
        taxonId: 10508,
        pathogens: [
          { name: "Human adenovirus B (types 3, 7, 14)", taxonId: 108098 },
          { name: "Human adenovirus C (types 1, 2, 5)", taxonId: 129951 },
          { name: "Human adenovirus D (types 8, 37)", taxonId: 130310 },
          { name: "Human adenovirus F (types 40, 41)", taxonId: 130309 },
        ],
      },
      {
        name: "Asfarviridae",
        taxonId: 137992,
        pathogens: [],
        pathogenNote:
          "No known human pathogens. African swine fever virus infects pigs.",
      },
      {
        name: "Herpesvirales",
        taxonId: 548681,
        pathogens: [
          { name: "Herpes simplex virus 1 (HSV-1)", taxonId: 3050292 },
          { name: "Herpes simplex virus 2 (HSV-2)", taxonId: 3050293 },
          {
            name: "Varicella-zoster virus (chickenpox, shingles)",
            taxonId: 3050294,
          },
          { name: "Cytomegalovirus (CMV)", taxonId: 3050295 },
          { name: "Epstein-Barr virus (EBV)", taxonId: 3050299 },
          { name: "Kaposi sarcoma herpesvirus (HHV-8)", taxonId: 3050300 },
        ],
      },
      {
        name: "Polyomaviridae",
        taxonId: 151341,
        pathogens: [
          { name: "BK polyomavirus", taxonId: 1891762 },
          { name: "JC polyomavirus", taxonId: 1891763 },
          { name: "Merkel cell polyomavirus", taxonId: 1891726 },
        ],
      },
      {
        name: "Poxviridae",
        taxonId: 10240,
        pathogens: [
          { name: "Mpox (monkeypox) virus", taxonId: 10244 },
          { name: "Variola virus (smallpox)", taxonId: 3431487 },
          { name: "Vaccinia virus", taxonId: 10245 },
          { name: "Molluscum contagiosum virus", taxonId: 3430922 },
        ],
      },
    ],
  },
  {
    group: null,
    subGroups: [
      {
        label: "Double-Stranded RNA",
        families: [
          {
            name: "Reovirales",
            taxonId: 2732541,
            pathogens: [
              { name: "Rotavirus A", taxonId: 3432193 },
              { name: "Colorado tick fever virus", taxonId: 46839 },
            ],
          },
        ],
      },
      {
        label: "Single-Stranded DNA",
        families: [
          {
            name: "Parvoviridae",
            taxonId: 10780,
            pathogens: [
              { name: "Parvovirus B19", taxonId: 3052189 },
              { name: "Human bocavirus", taxonId: 329641 },
            ],
          },
        ],
      },
      {
        label: "Partially Double-Stranded DNA",
        families: [
          {
            name: "Hepadnaviridae",
            taxonId: 10404,
            pathogens: [{ name: "Hepatitis B virus", taxonId: 3431302 }],
          },
        ],
      },
    ],
  },
];
