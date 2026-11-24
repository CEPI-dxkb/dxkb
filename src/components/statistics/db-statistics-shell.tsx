import type { ReactNode } from "react";

const DBStatisticsShell = ({ children }: { children: ReactNode }) => {
  return (
    <section className="bg-primary py-12 text-white">
      <div className="container mx-auto px-4">
        <h2 className="mb-8 text-center text-2xl font-bold">Database Statistics</h2>

        <div className="grid grid-cols-2 gap-6 text-center lg:grid-cols-4">
          {children}
        </div>
      </div>
    </section>
  );
};

export default DBStatisticsShell;
