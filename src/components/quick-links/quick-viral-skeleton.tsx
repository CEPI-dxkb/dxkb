import QuickViralContent from "@/components/quick-links/quick-viral-content";

/** Same cards as the loaded section, so nothing shifts when the counts arrive. */
const QuickViralSkeleton = () => <QuickViralContent counts={null} />;

export default QuickViralSkeleton;
