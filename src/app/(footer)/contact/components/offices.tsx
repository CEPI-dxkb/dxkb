import { Button } from "@/components/ui/button";
import { LuMapPin, LuExternalLink } from "react-icons/lu";

const Offices = () => {
  return (
    <section className="py-12 bg-background">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-2xl font-bold mb-8 text-center">Visit Our Offices</h2>
              <div className="bg-gray-200 rounded-lg overflow-hidden h-96 mb-8">
                {/* This would be replaced with an actual map component */}
                <div className="w-full h-full flex items-center justify-center bg-gray-300">
                  <div className="text-center">
                    <LuMapPin className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">Interactive Map Would Be Displayed Here</p>
                    <Button variant="outline" className="mt-4">
                      <LuExternalLink className="h-4 w-4 mr-2" />
                      View Full Map
                    </Button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-background p-6 rounded-lg shadow-sm">
                  <h3 className="font-bold text-lg mb-2">Cambridge, MA</h3>
                  <p className="text-muted-foreground mb-4">123 Science Way, Cambridge, MA 02142, USA</p>
                  <Button variant="outline" size="sm" className="w-full">
                    Get Directions
                  </Button>
                </div>

                <div className="bg-background p-6 rounded-lg shadow-sm">
                  <h3 className="font-bold text-lg mb-2">Oxford, UK</h3>
                  <p className="text-muted-foreground mb-4">45 Research Boulevard, Oxford, UK OX1 2JD</p>
                  <Button variant="outline" size="sm" className="w-full">
                    Get Directions
                  </Button>
                </div>

                <div className="bg-background p-6 rounded-lg shadow-sm">
                  <h3 className="font-bold text-lg mb-2">Singapore</h3>
                  <p className="text-muted-foreground mb-4">78 Innovation Road, Singapore 138632</p>
                  <Button variant="outline" size="sm" className="w-full">
                    Get Directions
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
  )
}

export default Offices