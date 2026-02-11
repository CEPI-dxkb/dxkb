import { type ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DialogInfoPopup } from "./dialog-info-popup";

interface ServiceHeaderProps {
  title: string;
  description: ReactNode;
  infoPopupTitle?: string;
  infoPopupDescription?: string;
  infoPopupSections?: any[];
  quickReferenceGuide?: string;
  tutorial?: string;
  instructionalVideo?: string;
  version?: string;
  isHeader?: boolean;
}

export function ServiceHeader({
  title,
  description,
  infoPopupTitle,
  infoPopupDescription,
  infoPopupSections,
  quickReferenceGuide,
  tutorial,
  instructionalVideo,
  version,
}: ServiceHeaderProps) {
  return (
    <div className="service-header">
      <div className="service-header-title">
        <h1>{title}</h1>
        {infoPopupTitle && infoPopupDescription && (
          <DialogInfoPopup
            title={infoPopupTitle}
            description={infoPopupDescription}
            sections={infoPopupSections}
            isHeader={true}
          />
        )}
        {version && (
          <Badge variant="outline" className="bg-primary text-foreground">
            {version}
          </Badge>
        )}
      </div>
      <div className="service-header-description">
        <p>
          {description}
          <br />
          For more information, please see the
          {quickReferenceGuide && (
            <>
              {" "}
              <a href={quickReferenceGuide} target="_blank" rel="noopener">
                Quick Reference Guide
                <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </>
          )}
          {tutorial && (
            <>
              {", "}
              <a href={tutorial} target="_blank" rel="noopener">
                Tutorial
                <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </>
          )}
          {instructionalVideo && (
            <>
              {" "}
              and{" "}
              <a href={instructionalVideo} target="_blank" rel="noopener">
                Instructional Video
                <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </>
          )}
          .
        </p>
      </div>
    </div>
  );
}
