import Navbar from "@/components/navbars/navbar";
import Footer from "@/components/footers/footer";

export default function SearchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="w-[95%] ml-[10px] mt-[10px]">
        {children}
    </div>
  );
}