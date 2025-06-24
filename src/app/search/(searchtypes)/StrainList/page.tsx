"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import React from 'react';
import { useSearchParams } from "next/navigation";
import { StrainData } from "../../(searchdata)/StrainData/page";

export default function Strains() {

    const searchParams = useSearchParams();
    const q = searchParams.get('q');

    return(
        <Tabs defaultValue="strains" className="w-[95%] ml-[10px] h-[85vh]">
          <TabsList className="pb-0 mb-0">
            <TabsTrigger 
                value="strains" 
                className="bg-primary-800 text-white data-[state=active]:bg-secondary-800 data-[state=active]:text-white mx-[2px]"
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
