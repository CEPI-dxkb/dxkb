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

interface ResourceLink {
  href: string;
  label: string;
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
  const resourceLinks: ResourceLink[] = [
    ...(quickReferenceGuide
      ? [{ href: quickReferenceGuide, label: "Quick Reference Guide" }]
      : []),
    ...(tutorial ? [{ href: tutorial, label: "Tutorial" }] : []),
    ...(instructionalVideo
      ? [{ href: instructionalVideo, label: "Instructional Video" }]
      : []),
  ];

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
          {resourceLinks.length > 0 && (
            <>
              <br />
              For more information, please see the{" "}
              {resourceLinks.map((link, index) => (
                <span key={link.label}>
                  {index > 0 && index < resourceLinks.length - 1 && ", "}
                  {index > 0 && index === resourceLinks.length - 1 && (resourceLinks.length > 2 ? ", and " : " and ")}
                  <a href={link.href} target="_blank" rel="noopener">
                    {link.label}
                    <ExternalLink className="ml-1 h-3 w-3" />
                  </a>
                </span>
              ))}
              .
            </>
          )}
        </p>
      </div>
    </div>
  );
}
