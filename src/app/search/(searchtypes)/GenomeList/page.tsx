"use client";

import React, { useEffect, useState } from 'react';
import { useSearchParams } from "next/navigation";
import { DataTable } from '@/components/containers/DataTable';

export default function Genomes() {

  const widget = {
    id: 'widget-1',
    columns: {
      genome_name: 'Genome Name',
      strain: 'Strain',
    },
    data: [
      { genome_name: 'E. coli K12', strain: 'MG1655' },
      { genome_name: 'B. subtilis', strain: '168' },
    ],
  };

  const searchParams = useSearchParams();
  const [data, setData] = useState(null);
  const [fullData, setFullData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalItems, setTotalItems] = useState(null);

  const q = searchParams.get('q');
  const DataAPI = process.env.NEXT_PUBLIC_DATA_API;



  console.log('q', q);
  const cleanQ = q.split('#')[0];
  console.log('clean', cleanQ);

  var dataURL = DataAPI + '/genome/?' + cleanQ;

  useEffect(() => {
  const fetchData = async () => {
      try {
        const response = await fetch(dataURL + '&limit(1)', {
            method: 'GET',
            headers: {
                'Accept': 'application/solr+json',
            },
          });
        
          const res = await response.json();
          console.log('res:', res.response);
          setTotalItems(res.response.numFound);
          setData(res);
        } catch (error) {
          console.error("Error fetching search results:", error);
        } finally {
          setLoading(false);
        }
  };
  fetchData();

  }, []); // Empty array means this runs only once when the component mounts

  useEffect(() => {
      const fetchAllData = async () => {
          try {

            const response = await fetch(dataURL, {
                method: 'GET',
                headers: {
                    'Content-type': 'application/rqlquery+x-www-form-urlencoded',
                    'Accept': 'application/json',
                    'Range': 'items=0-{totalItems}',
                    'X-Range': 'items=0-{totalItems}',
                },
              });
            
              const res = await response.json();
              setFullData(res);
            } catch (error) {
              console.error("Error fetching search results:", error);
            } finally {
              setLoading(false);
            }
      };

    fetchAllData();

    }, []); // Empty array means this runs only once when the component mounts

    if (loading) return <div>Loading...</div>;
    if (error) return <div>Error: {error}. <br/>Sent: {JSON.stringify(q)}</div>;

    const dataSet = [
      {
          id: '1',
          data: [{fullData}],
          columns: {
              genome_name: 'Genome Name',
              strain: 'Strain'
          }
      }
      ];

      const columnCount = Object.keys(dataSet.columns ?? {}).length;

    return  ( 
        <DataTable
        id={widget.id}
        data={fullData ?? []}
        columns={widget.columns}
        />
    );
}; 