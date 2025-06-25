"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import React from 'react';
import { useSearchParams } from "next/navigation";
import { DomainsAndMotifData } from "../../(searchdata)/DomainsAndMotifsData/page";

export default function DomainsAndMotifs() {

    const searchParams = useSearchParams();
    const q = searchParams.get('q');

    return(
        <Tabs defaultValue="domainsandmotifs" className="h-[85vh]">
          <TabsList className="pb-0 mb-0">
            <TabsTrigger 
                value="domainsandmotifs" 
                className="border-primary bg-primary text-secondary data-[state=active]:bg-secondary data-[state=active]:text-primary hover:bg-secondary hover:text-primary mx-[2px]"
                >
                Domains and Motifs
            </TabsTrigger>
          </TabsList>
          <TabsContent value="domainsandmotifs" className="border border-black mt-0 px-0 pt-[5px] flex-1 flex flex-col overflow-hidden">
            <DomainsAndMotifData q={{q}} />
          </TabsContent>
        </Tabs>
    );
}; 
