"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import React from 'react';
import { useSearchParams } from "next/navigation";
import { GenomeData } from "@/app/search/(searchdata)/GenomeListData/page";
import { FeatureData } from "@/app/search/(searchdata)/FeatureListData/page";
import { SequenceData } from "../../(searchdata)/SequenceData/page";
import { AMRPhenotypeData } from "../../(searchdata)/AMRPhenotypeData/page";

export default function Genomes() {

    const searchParams = useSearchParams();
    const q = searchParams.get('q');

    return(
        <Tabs defaultValue="genomes" className="w-[95%] ml-[10px] h-[85vh]">
          <TabsList className="pb-0 mb-0">
          <TabsTrigger 
              value="genomes" 
              className="bg-primary-800 text-white data-[state=active]:bg-secondary-800 data-[state=active]:text-white mx-[2px]"
            >
              Genomes
            </TabsTrigger>
            <TabsTrigger 
              value="sequences" 
              className="bg-primary-800 text-white data-[state=active]:bg-secondary-800 data-[state=active]:text-white mx-[2px]"
            >
              Sequences
            </TabsTrigger>
            <TabsTrigger 
              value="amrphenotypes" 
              className="bg-primary-800 text-white data-[state=active]:bg-secondary-800 data-[state=active]:text-white mx-[2px]"
            >
              AMR Phenotypes
            </TabsTrigger>
            <TabsTrigger 
              value="features" 
              className="mb-0 bg-primary-800 text-white data-[state=active]:bg-secondary-800 data-[state=active]:text-white mx-[2px]"
            >
              Features
            </TabsTrigger>
          </TabsList>
          <TabsContent value="genomes" className="border border-black mt-0 px-0 pt-[5px] flex-1 flex flex-col overflow-hidden">
            <GenomeData q={{q}} />
          </TabsContent>
          <TabsContent value="sequences" className="border border-black mt-0 px-0 pt-[5px] flex-1 flex flex-col overflow-hidden">
            <SequenceData q={{q}} />
          </TabsContent>
          <TabsContent value="amrphenotypes" className="border border-black mt-0 px-0 pt-[5px] flex-1 flex flex-col overflow-hidden">
            <AMRPhenotypeData q={{q}} />
          </TabsContent>
          <TabsContent value="features" className="border border-black mt-0 px-0 pt-[5px] flex-1 flex flex-col overflow-hidden">
            <FeatureData q={{q}} />
          </TabsContent>
        </Tabs>
    );
}; 
