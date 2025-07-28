"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import React from 'react';
import { useSearchParams } from "next/navigation";
import { TaxaData } from "../../(searchdata)/TaxaData/page";

export default function Taxa() {

    const searchParams = useSearchParams();
    const q = searchParams.get('q');

    return(
        <Tabs defaultValue="taxa" className="h-[85vh]">
          <TabsList className="pb-0 mb-0">
            <TabsTrigger 
                value="taxa" 
                className="border-primary bg-primary text-secondary data-[state=active]:bg-secondary data-[state=active]:text-primary hover:bg-secondary hover:text-primary mx-[2px]"
                >
                Taxa
            </TabsTrigger>
          </TabsList>
          <TabsContent value="taxa" className="border-0 mt-0 px-0 pt-[5px] flex-1 flex flex-col overflow-hidden">
            <TaxaData q={{q}} />
          </TabsContent>
        </Tabs>
    );
}; 
