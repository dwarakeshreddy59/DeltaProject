import React from "react";
import PDFReferenceTable from "./PDFReferenceTable";
import { useOrganization } from "../context/OrganizationContext";

export default function PDFFieldReferenceTab() {
  const { openRegisterModal } = useOrganization();

  return (
    <div className="pdf-ref-container animate-fadein">
      <PDFReferenceTable onOpenRegisterModal={openRegisterModal} />
    </div>
  );
}
