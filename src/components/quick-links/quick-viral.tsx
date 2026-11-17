import QuickViralContent from "@/components/quick-links/quick-viral-content";
import { getQuickAccessStatistics } from "@/lib/services/quick-access-statistics";

const QuickViralLinks = async () => {
  const { counts, unavailableReason } = await getQuickAccessStatistics();
  return <QuickViralContent counts={counts} unavailableReason={unavailableReason} />;
};

export default QuickViralLinks;
