import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const ResearchUpdates = () => {
  return (
    <section className="py-12">
      <div className="container mx-auto px-4">
        <h2 className="text-2xl font-bold mb-8 text-center">Featured Research & Updates</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <div className="h-40 bg-blue-100 rounded-t-lg flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="64"
                  height="64"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-blue-500"
                >
                  <path d="M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.611 1.611a.98.98 0 0 1-.837.276c-.47-.07-.802-.48-.743-.95l.09-.706c.046-.35-.066-.695-.308-.938a1.11 1.11 0 0 0-.77-.332H16.1c-.5 0-.919.362-.993.858l-.276 1.843A3.06 3.06 0 0 1 11.8 16.8l-1.993-1.995c-.475-.475-1.118-.731-1.774-.731s-1.3.256-1.774.73l-.376.377a.91.91 0 0 1-.836.274c-.47-.069-.802-.479-.743-.949l.09-.707c.046-.35-.066-.695-.308-.938a1.11 1.11 0 0 0-.77-.332H2.1c-.5 0-.919.362-.993.858l-.276 1.843A3.06 3.06 0 0 1 .8 16.8V21h17.819c.885-.001 1.721-.421 2.246-1.134l2.898-3.9c.47-.633.467-1.497-.006-2.126l-1.479-1.86A3.06 3.06 0 0 0 20.1 11h-1.819c-1.008 0-1.977.394-2.696 1.099l-.172.163c-.339.32-.37.857-.067 1.211.301.354.816.422 1.2.158l.097-.066c.477-.325 1.05-.499 1.638-.499h.685c.505 0 .931.367 1.01.868.073.47-.217.92-.679 1.054l-.406.118a.91.91 0 0 1-.578-.039l-1.497-.552c-.304-.112-.637-.132-.952-.056l-1.653.397c-.304.073-.521.342-.539.654a.69.69 0 0 0 .682.738h1.039c.042 0 .084-.003.125-.007l1.692-.194c.384-.044.764.112 1.007.413l.241.3c.316.394.401.93.217 1.401l-.322.825a.61.61 0 0 1-.555.365H15.75c-.056 0-.11-.01-.163-.027l-1.055-.353a2.69 2.69 0 0 0-1.35-.099l-3.509.701a2.69 2.69 0 0 1-1.35-.099l-1.17-.39c-.06-.02-.122-.03-.184-.03h-1.495a.61.61 0 0 1-.555-.365l-.322-.825a1.21 1.21 0 0 1 .217-1.4l.241-.3c.243-.304.623-.458 1.007-.414l1.692.194c.041.004.083.007.125.007h1.039a.69.69 0 0 0 .682-.738c-.018-.312-.235-.581-.539-.654l-1.653-.397a1.42 1.42 0 0 0-.952.056l-1.497.552a.91.91 0 0 1-.578.039l-.406-.118c-.462-.134-.752-.584-.679-1.054.079-.501.505-.868 1.01-.868h.685c.588 0 1.16.174 1.638.499l.097.066c.384.264.899.196 1.2-.158.303-.354.272-.891-.067-1.211l-.172-.163A3.95 3.95 0 0 0 5.719 11H3.9a3.06 3.06 0 0 0-2.278 1.01l-1.479 1.86c-.473.629-.476 1.493-.006 2.126l2.898 3.9c.525.713 1.361 1.133 2.246 1.134H22v-4.2a3.06 3.06 0 0 1-.031-1.854l.276-1.843c.074-.496.493-.858.993-.858h1.217c.288 0 .563.132.743.36.18.228.247.53.18.815l-.09.706c-.059.47.273.88.743.95a.98.98 0 0 0 .837-.277l1.611-1.61c.47-.471.706-1.087.706-1.704s-.235-1.233-.706-1.704l-1.568-1.568a.98.98 0 0 1-.289-.878l.09-.706c.046-.35-.066-.695-.308-.938a1.11 1.11 0 0 0-.77-.332H23.9c-.5 0-.919.362-.993.858l-.276 1.843A3.06 3.06 0 0 1 22.6 6.8v4.2h-2.5z" />
                </svg>
              </div>
              <CardTitle className="mt-2">New SARS-CoV-2 Variant Analysis</CardTitle>
              <CardDescription>Published April 2, 2023</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Comprehensive genomic and proteomic analysis of the latest SARS-CoV-2 variant, including mutation
                profiles and potential impact on transmissibility.
              </p>
              <Button variant="link" className="link">
                Read Full Analysis →
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="h-40 bg-green-100 rounded-t-lg flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="64"
                  height="64"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-green-500"
                >
                  <path d="M4.5 9.5V5.5C4.5 4.4 5.4 3.5 6.5 3.5H18.5C19.6 3.5 20.5 4.4 20.5 5.5V9.5" />
                  <path d="M4.5 14.5V18.5C4.5 19.6 5.4 20.5 6.5 20.5H18.5C19.6 20.5 20.5 19.6 20.5 18.5V14.5" />
                  <path d="M9.5 12C9.5 12.8 8.8 13.5 8 13.5C7.2 13.5 6.5 12.8 6.5 12C6.5 11.2 7.2 10.5 8 10.5C8.8 10.5 9.5 11.2 9.5 12Z" />
                  <path d="M14.5 12C14.5 12.8 13.8 13.5 13 13.5C12.2 13.5 11.5 12.8 11.5 12C11.5 11.2 12.2 10.5 13 10.5C13.8 10.5 14.5 11.2 14.5 12Z" />
                  <path d="M19.5 12C19.5 12.8 18.8 13.5 18 13.5C17.2 13.5 16.5 12.8 16.5 12C16.5 11.2 17.2 10.5 18 10.5C18.8 10.5 19.5 11.2 19.5 12Z" />
                </svg>
              </div>
              <CardTitle className="mt-2">Database Update: 5,000+ New Viral Proteins</CardTitle>
              <CardDescription>Updated March 15, 2023</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Our database has been expanded with over 5,000 new viral protein entries, including structural data
                and functional annotations from recent research.
              </p>
              <Button variant="link" className="link">
                View Updates →
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="h-40 bg-purple-100 rounded-t-lg flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="64"
                  height="64"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-purple-500"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                  <path d="M8 11h8" />
                  <path d="M12 15V7" />
                </svg>
              </div>
              <CardTitle className="mt-2">New Tool: Viral Epitope Predictor</CardTitle>
              <CardDescription>Released April 5, 2023</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Introducing our new computational tool for predicting viral epitopes with enhanced accuracy,
                supporting vaccine design and immunological research.
              </p>
              <Button variant="link" className="link">
                Try the Tool →
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="text-center mt-8">
          <Button variant="outline">View All Research Updates</Button>
        </div>
      </div>
    </section>
  )
}

export default ResearchUpdates;