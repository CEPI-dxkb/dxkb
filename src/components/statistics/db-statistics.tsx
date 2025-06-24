import React from 'react'

const DBStatistics = () => {
  return (
    <section className="py-12 bg-secondary text-white">
      <div className="container mx-auto px-4">
        <h2 className="text-2xl font-bold mb-8 text-center">Database Statistics</h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div>
            <div className="text-4xl font-bold mb-2">42,891</div>
            <div className="text-white">Viral Genomes</div>
          </div>
          <div>
            <div className="text-4xl font-bold mb-2">156,742</div>
            <div className="text-white">Protein Entries</div>
          </div>
          <div>
            <div className="text-4xl font-bold mb-2">8,453</div>
            <div className="text-white">Virus Species</div>
          </div>
          <div>
            <div className="text-4xl font-bold mb-2">12,389</div>
            <div className="text-white">Research Citations</div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default DBStatistics;