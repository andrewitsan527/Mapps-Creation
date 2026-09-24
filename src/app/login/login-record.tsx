"use client";

import { useEffect, useState } from "react";

const RECORD = `MAPPS CREATION
FABRIC RECEIPT / 004

QUALITY     : ALPINO A1
SHADE       : DEEP TEAL
TAKA NO.    : 018
MILL        : GONDA
QTY         : 500 KG
PROCESS     : DYEING
--------------------------------
QC          : PASSED`;

export function LoginRecord() {
  const [text, setText] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setText(RECORD);
      setDone(true);
      return;
    }

    let index = 0;
    let timer = 0;
    const start = window.setTimeout(() => {
      timer = window.setInterval(() => {
        index += 1;
        setText(RECORD.slice(0, index));
        if (index >= RECORD.length) {
          window.clearInterval(timer);
          setDone(true);
        }
      }, 28);
    }, 500);

    return () => {
      window.clearTimeout(start);
      window.clearInterval(timer);
    };
  }, []);

  return (
    <pre className="login-record" aria-hidden>
      {text}
      {done ? null : <span className="login-record-cursor">▌</span>}
    </pre>
  );
}
