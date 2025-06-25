"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import React from 'react';
import { useSearchParams } from "next/navigation";
import { StrainData } from "../../(searchdata)/StrainData/page";

export default function Strains() {

    const searchParams = useSearchParams();
    const q = searchParams.get('q');

    return(
        <Tabs defaultValue="strains" className="h-[85vh]">
          <TabsList className="pb-0 mb-0">
            <TabsTrigger 
                value="strains" 
                className="border-primary bg-primary text-secondary data-[state=active]:bg-secondary data-[state=active]:text-primary hover:bg-secondary hover:text-primary mx-[2px]"
                >
                Strains
            </TabsTrigger>
          </TabsList>
          <TabsContent value="strains" className="border border-black mt-0 px-0 pt-[5px] flex-1 flex flex-col overflow-hidden">
            <StrainData q={{q}} />
          </TabsContent>
        </Tabs>
    );
}; 
