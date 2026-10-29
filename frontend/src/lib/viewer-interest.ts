"use client";

import { useEffect, useState } from "react";
import { requestApi } from "@/lib/api";
import { buildNames } from "@/lib/expert-search";
import type { AbleWorkOption, CareerProfile, FieldCategory } from "@/lib/my-career";
import type { Research } from "@/lib/my-research";
import { interestFromExpert, interestFromResearch, type Interest } from "@/lib/related-rank";

/** 로그인한 연구·전문가의 키워드. 비로그인이거나 키워드가 없으면 null입니다. */
export function useViewerInterest(): Interest | null {
  const [interest, setInterest] = useState<Interest | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([
      requestApi<{ user_role: "researcher" | "expert" | null }>("/auth/me"),
      requestApi<AbleWorkOption[]>("/expert/able-works"),
      requestApi<FieldCategory[]>("/taxonomy/fields"),
    ])
      .then(([me, ableWorks, categories]) => {
        const names = buildNames(ableWorks, categories);
        if (me.user_role === "researcher") {
          return requestApi<Research[]>("/researcher/researches").then((list) => {
            if (alive) setInterest(interestFromResearch(list, names));
          });
        }
        if (me.user_role === "expert") {
          return requestApi<CareerProfile>("/expert/profile").then((profile) => {
            if (alive) setInterest(interestFromExpert(profile, names));
          });
        }
        if (alive) setInterest(null);
      })
      .catch(() => {
        if (alive) setInterest(null);
      });
    return () => {
      alive = false;
    };
  }, []);

  return interest;
}
