import type { ServiceInfoPopup } from "@/types/services";

export const primerDesignInfo: ServiceInfoPopup = {
  title: "Primer Design Overview",
  description:
    "The Primer Design Service utilizes Primer3[1-5] to design primers from a given input \
        sequence under a variety of temperature, size, and concentration constraints. Primer3 can be used to design primers \
        for several uses including, PCR (Polymerase Chain Reaction) primers, hybridization probes, and sequencing primers. \
        The service accepts a nucleotide sequence (pasted in, or select a FASTA formatted file from the workspace) \
        and allows users to specify design. After specifying an appropriate output folder and clicking “submit”, \
        the primer design is queued as a “job” to process in the Jobs information box on the bottom right of the page. \
        Once the job has successfully completed, the output file will appear in the workspace, allowing the user to choose from a list of appropriate primers.",
};

export const primerDesignInputSequence: ServiceInfoPopup = {
  title: "Input Sequence",
  description: "Users may select one of two input options.",
  sections: [
    {
      header: "Pasting in a relevant sequence",
      subsections: [
        {
          subheader: "Sequence Identifier",
          subdescription:
            "The user-provided name to identify the input sequence. If using a FASTA formatted file, this field will automatically be populated with the sequence name.",
        },
        {
          subheader: "Paste Sequence",
          subdescription:
            "Choosing this option allows users to paste in an input sequence.",
        },
      ],
    },
    {
      header: "Choosing a workspace sequence",
      subsections: [
        {
          subheader: "Workspace FASTA",
          subdescription:
            "Choosing this option allows users to specify the FASTA file from their workspace. \
                        Users will also need to select appropriate target, inclusion and exclusion positions using options shown below. \
                        Selections can either be denoted by highlighting the desired regions and clicking the appropriate buttons (red box), \
                        or by manually typing in a list of coordinates in the appropriate boxes below. \
                        If you would like to design a hybridization probe to detect the PCR product after amplification (real-time PCR applications) you may select the “PICK INTERNAL OLIGO” option as shown above.",
        },
        {
          subheader: "Excluded Regions",
          subdescription:
            "Values should be one or a space-separated list of start, length pairs. Primers will not overlap these regions. These values will be denoted with “< >” symbols.",
        },
        {
          subheader: "Targets",
          subdescription:
            "Values should be one or a space-separated list of start, length pairs. Primers will flank one or more regions. These values will be denoted with “[ ]” symbols.",
        },
        {
          subheader: "Included Regions",
          subdescription:
            "Values should be a single start, length pair. Primers will be picked within this range. These values will be denoted with “{ }” symbols.",
        },
        {
          subheader: "Primer Overlap Positions",
          subdescription:
            "Values should be space separated list of positions, The forward OR reverse primer will overlap one of these positions. These values will be denoted with “-” symbol.",
        },
      ],
    },
  ],
};
