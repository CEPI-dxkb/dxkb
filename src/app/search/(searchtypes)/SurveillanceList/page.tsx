"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import React from 'react';
import { useSearchParams } from "next/navigation";
import { SurveillanceData } from "../../(searchdata)/SurveillanceData/page";

export default function Surveillance() {

    const searchParams = useSearchParams();
    const q = searchParams.get('q');

    return(
        <Tabs defaultValue="surveillance" className="h-[85vh]">
          <TabsList className="pb-0 mb-0">
            <TabsTrigger 
                value="surveillance" 
                className="border-primary bg-primary text-secondary data-[state=active]:bg-secondary data-[state=active]:text-primary hover:bg-secondary hover:text-primary mx-[2px]"
                >
                Surveillance
            </TabsTrigger>
          </TabsList>
          <TabsContent value="surveillance" className="border border-black mt-0 px-0 pt-[5px] flex-1 flex flex-col overflow-hidden">
            <SurveillanceData q={{q}} />
          </TabsContent>
        </Tabs>
    );
}; 
