import React from "react";

/** Shows warning when wrong PDF type is detected in a slot */
export default function WrongFileAlert({ warnings }) {
  if (!warnings || warnings.length === 0) return null;

  return (
    <div style={{ marginBottom: "1.25rem" }}>
      {warnings.map((w, i) => (
        <div key={i} className="wrong-file-alert">
          <div className="alert-icon">⚠️</div>
          <div className="alert-body">
            <strong>Wrong File Detected</strong>
            <p>{w}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
